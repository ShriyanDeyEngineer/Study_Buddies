/**
 * POST /api/hooks/notification-email — emails a student when they get an
 * important in-app notification (bug report #9).
 *
 * WHO CALLS THIS: a Supabase DATABASE WEBHOOK, configured once in the
 * dashboard (Database → Webhooks → notifications table → INSERT → this
 * URL, with the shared secret header). Every notification in this app is
 * created inside a Postgres function (app_notify), never by app code, so
 * a webhook on the table is the one place that sees ALL of them — group
 * invites, approvals, removals, disbands, meetups, friend requests…
 *
 * WHAT IT DOES: looks up the recipient's email + notification preference,
 * renders the same sentence the bell shows (lib/notifications.ts, so
 * email and in-app copy can never disagree), and sends it through
 * lib/email.ts. If RESEND_API_KEY isn't configured, sendEmail() is a
 * silent no-op and this route still returns 200 — email is optional
 * everywhere in this app (spec §10) and must never break anything.
 *
 * SECURITY: the request must carry our shared secret; anything else gets
 * a 401. Without that, anyone who found this URL could make us email
 * arbitrary students. The secret lives in NOTIFICATION_WEBHOOK_SECRET on
 * Vercel and is pasted into the webhook's headers in Supabase (SETUP.md).
 * The recipient's email is looked up with the service-role client (RLS
 * would otherwise hide it), which is exactly why the secret is required.
 *
 * WHAT WE DON'T EMAIL: chat messages and DMs. Those arrive by the second;
 * emailing each one would be spam. The bell/badge handle those live.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildMeetupEmail } from "@/lib/meetup-email";
import { renderNotification } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site";
import type { MeetupRow, NotificationRow } from "@/lib/types";

/** Types worth an email. Everything else stays in-app only. */
const EMAIL_WORTHY = new Set([
  "group_invitation",
  "invitation_accepted",
  "join_request_received",
  "join_request_approved",
  "join_request_denied",
  "request_cancelled_group_full",
  "removed_from_group",
  "group_disbanded",
  "manager_transferred",
  "meetup_created",
  "meetup_cancelled",
  "friend_request",
  "friend_request_accepted",
  "buddy_request",
  "buddy_request_accepted",
]);

/** Shape Supabase Database Webhooks POST for an INSERT. */
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRow | null;
}

export async function POST(request: Request) {
  // ── Auth: shared secret, constant-time compare ────────────────────
  // Both sides are hashed to a fixed 32 bytes first: timingSafeEqual
  // requires equal-length inputs, and hashing means neither the compare
  // nor the (removed) length check can leak the real secret's length.
  const expected = process.env.NOTIFICATION_WEBHOOK_SECRET;
  const provided = request.headers.get("x-webhook-secret");

  // The 401 carries a REASON. All three failures used to look identical
  // from the outside, which made a misconfigured webhook impossible to
  // debug: pg_net just logs {"error":"unauthorized"} and you cannot tell
  // a missing env var from a missing header from a wrong value. None of
  // these reasons leak the secret or help an attacker — every path still
  // refuses the request.
  const deny = (reason: string) => {
    console.error(
      `[notification-email] 401 ${reason} — headers seen: ` +
        [...request.headers.keys()].join(", "),
    );
    return NextResponse.json({ error: "unauthorized", reason }, { status: 401 });
  };

  // No env var on the running deployment. Vercel only applies environment
  // variables to deployments created AFTER they are added — if this fires
  // while the variable is visibly set in the dashboard, the fix is a
  // redeploy, not a value change.
  if (!expected) return deny("server-missing-NOTIFICATION_WEBHOOK_SECRET");
  // Header absent entirely — usually the name is misspelled in the
  // Supabase webhook (it must be exactly `x-webhook-secret`).
  if (!provided) return deny("request-missing-x-webhook-secret-header");

  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  if (!timingSafeEqual(expectedHash, providedHash)) {
    // Values differ. Most often invisible whitespace — a trailing newline
    // or space copied along with the value on one side or the other.
    return deny(
      `secret-mismatch (server len ${expected.length}, request len ${provided.length})`,
    );
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const notification = payload.record;
  if (payload.type !== "INSERT" || !notification || !EMAIL_WORTHY.has(notification.type)) {
    // Not our concern — acknowledge so Supabase doesn't retry.
    return NextResponse.json({ skipped: true });
  }

  // ── Recipient lookup (service role: profiles.email is RLS-hidden) ──
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, display_name, account_status, email_notifications")
    .eq("id", notification.recipient_id)
    .maybeSingle();

  if (
    !profile ||
    profile.account_status !== "active" ||
    profile.email_notifications === false
  ) {
    return NextResponse.json({ skipped: true });
  }

  const { message, href } = renderNotification(notification);
  const link = `${getSiteUrl()}${href}`;

  // meetup_created gets the detailed email (who scheduled it, when/where,
  // who's attending); everything else keeps the generic one-liner. Falls
  // back to the generic email if the meetup vanished between the insert
  // and the webhook firing.
  const rich =
    notification.type === "meetup_created"
      ? await buildRichMeetupEmail(admin, notification, profile.display_name)
      : null;

  await sendEmail(
    rich
      ? { to: profile.email, subject: rich.subject, text: rich.text }
      : {
          to: profile.email,
          subject: `Study Buddies: ${message}`,
          text:
            `Hi ${profile.display_name ?? "there"},\n\n` +
            `${message}\n\n` +
            `Open it here: ${link}\n\n` +
            `— Study Buddies\n` +
            `You're getting this because a group or classmate did something that involves you. ` +
            `Turn these emails off any time under Edit profile → Notifications.`,
        },
  );

  return NextResponse.json({ sent: true });
}

/**
 * Fetch everything the detailed meetup email needs (service role — the
 * webhook has no user session) and hand it to the pure builder. Returns
 * null when the meetup can't be loaded or was already cancelled, so the
 * caller falls back to the generic email instead of failing the send.
 */
async function buildRichMeetupEmail(
  admin: ReturnType<typeof createAdminClient>,
  notification: NotificationRow,
  recipientName: string | null,
): Promise<{ subject: string; text: string } | null> {
  const meetupId = notification.payload?.meetup_id;
  const groupId = notification.payload?.group_id;
  if (!meetupId) return null;

  const [meetupRes, attendanceRes] = await Promise.all([
    admin.from("meetups").select("*").eq("id", meetupId).maybeSingle(),
    admin
      .from("meetup_attendance")
      .select("user_id")
      .eq("meetup_id", meetupId)
      .eq("status", "attending"),
  ]);
  const meetup = meetupRes.data as MeetupRow | null;
  if (!meetup || meetup.is_cancelled) return null;

  // One name lookup covers the creator and every attendee.
  const attendeeIds = (attendanceRes.data ?? []).map((a) => a.user_id as string);
  const nameIds = [...new Set([meetup.creator_id, ...attendeeIds])];
  const namesRes = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", nameIds);
  const nameById = new Map(
    (namesRes.data ?? []).map((p) => [p.id as string, p.display_name as string | null]),
  );

  return buildMeetupEmail({
    recipientName,
    groupName: notification.payload?.group_name ?? "your group",
    title: meetup.title,
    creatorName: nameById.get(meetup.creator_id) ?? null,
    scheduledAtIso: meetup.scheduled_at,
    durationMinutes: meetup.duration_minutes ?? 60,
    format: meetup.format,
    location: meetup.location,
    meetingLink: meetup.meeting_link,
    attendeeNames: attendeeIds
      .map((id) => nameById.get(id))
      .filter((n): n is string => !!n),
    groupUrl: `${getSiteUrl()}/groups/${groupId ?? ""}`,
  });
}
