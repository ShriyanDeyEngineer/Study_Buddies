/**
 * POST /api/hooks/chat-digest — the batched "you missed some messages"
 * mailer for group chat.
 *
 * WHO CALLS THIS: a scheduler, every 15–30 minutes. Either Supabase
 * pg_cron (works on the free tier) or a Vercel Cron entry — SETUP.md has
 * both. It is NOT a database webhook: webhooks fire per row, and firing
 * per chat message is exactly what this feature exists to avoid.
 *
 * WHY A CRON AND NOT A TRIGGER: the whole design depends on waiting.
 * A message only earns an email once it has sat unread and unanswered
 * for a quiet period, which is a question you can only ask later, not at
 * insert time. See migration 0043 for the four gates.
 *
 * SECURITY: same shared secret as the notification webhook — this reads
 * other people's email addresses through the service-role client, so an
 * open endpoint would be a mailing-list leak and a spam cannon. Also
 * refuses to run without a secret configured.
 *
 * SAFE TO RUN OFTEN: every send is recorded against the exact newest
 * message it covered (record_chat_digest), so a double-fire or an
 * overlapping run re-reads nothing and re-sends nothing. If email isn't
 * configured at all, sendEmail() is a no-op and this still returns 200.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildChatDigestEmail, type DigestGroup } from "@/lib/chat-digest-email";
import { getSiteUrl } from "@/lib/site";

/** A message must have gone unanswered this long before it counts. */
const QUIET_MINUTES = 30;
/** At most one digest per member per group in this window. */
const COOLDOWN_MINUTES = 180;

interface PendingRow {
  user_id: string;
  email: string;
  display_name: string | null;
  group_id: string;
  group_name: string;
  unread_count: number;
  newest_message: string;
  previews: { author: string | null; body: string; created_at: string }[] | null;
}

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_WEBHOOK_SECRET;
  const provided = request.headers.get("x-webhook-secret");

  const deny = (reason: string) => {
    console.error(`[chat-digest] 401 ${reason}`);
    return NextResponse.json({ error: "unauthorized", reason }, { status: 401 });
  };

  if (!expected) return deny("server-missing-NOTIFICATION_WEBHOOK_SECRET");
  if (!provided) return deny("request-missing-x-webhook-secret-header");

  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  if (!timingSafeEqual(expectedHash, providedHash)) return deny("secret-mismatch");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("pending_chat_digests", {
    p_quiet_minutes: QUIET_MINUTES,
    p_cooldown_minutes: COOLDOWN_MINUTES,
  });

  if (error) {
    console.error("[chat-digest] pending_chat_digests failed", error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const rows = (data ?? []) as PendingRow[];
  if (rows.length === 0) return NextResponse.json({ sent: 0, recipients: 0 });

  // One email per PERSON, not per group: someone in four busy groups
  // should get one message with four sections, not four emails — which
  // would recreate the spam this feature exists to avoid.
  const byRecipient = new Map<string, PendingRow[]>();
  for (const row of rows) {
    const existing = byRecipient.get(row.user_id);
    if (existing) existing.push(row);
    else byRecipient.set(row.user_id, [row]);
  }

  const siteUrl = getSiteUrl();
  let sent = 0;

  for (const [, groupRows] of byRecipient) {
    const groups: DigestGroup[] = groupRows.map((row) => ({
      groupId: row.group_id,
      groupName: row.group_name,
      unreadCount: Number(row.unread_count),
      previews: (row.previews ?? []).map((p) => ({ author: p.author, body: p.body })),
    }));

    const email = buildChatDigestEmail({
      recipientName: groupRows[0].display_name,
      groups,
      siteUrl,
    });
    if (!email) continue;

    await sendEmail({
      to: groupRows[0].email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    sent += 1;

    // Mark each group covered, up to the newest message actually
    // reported. Anything that arrived mid-send is left for the next run
    // rather than being marked read-and-emailed when it wasn't.
    for (const row of groupRows) {
      const { error: markError } = await admin.rpc("record_chat_digest", {
        p_user_id: row.user_id,
        p_group_id: row.group_id,
        p_upto: row.newest_message,
      });
      if (markError) {
        // Worth shouting about: unrecorded sends mean the next run emails
        // the same messages again.
        console.error("[chat-digest] record_chat_digest failed", row.group_id, markError);
      }
    }
  }

  return NextResponse.json({ sent, recipients: byRecipient.size });
}
