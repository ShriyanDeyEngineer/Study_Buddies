/**
 * The "new meetup" notification email — the one email that carries real
 * detail instead of the generic one-liner: who scheduled it, when (with
 * duration), where, and who's attending so far.
 *
 * Pure function on purpose: the webhook route fetches the rows and this
 * builds the text, so the wording is unit-testable without a database
 * (tests/meetup-email.test.ts).
 *
 * TIMEZONE: email is static text, so it can't render "the reader's local
 * time" the way the UI does. Every campus reader is on US Central time,
 * so times are formatted for America/Chicago and labeled "Central Time"
 * — explicit beats silently using the server's zone (UTC on Vercel).
 */
import { googleCalendarUrl } from "@/lib/calendar";
import { buildEmail, type BuiltEmail } from "@/lib/email-template";
import { formatDuration } from "@/lib/format";
import { pluralize } from "@/lib/utils";

export interface MeetupEmailInput {
  recipientName: string | null;
  groupName: string;
  title: string;
  creatorName: string | null;
  /** UTC ISO instant, straight from meetups.scheduled_at. */
  scheduledAtIso: string;
  durationMinutes: number;
  format: "online" | "in_person";
  location: string | null;
  meetingLink: string | null;
  /** display_names of everyone RSVP'd "attending" (the creator auto-RSVPs). */
  attendeeNames: string[];
  /** Absolute URL of the group page (RSVP lives there). */
  groupUrl: string;
}

const CENTRAL = "America/Chicago";

function centralDay(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function centralClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function buildMeetupEmail(input: MeetupEmailInput): BuiltEmail {
  const startsAt = new Date(input.scheduledAtIso);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  const creator = input.creatorName ?? "A group member";

  const when =
    `${centralDay(startsAt)}, ${centralClock(startsAt)} – ${centralClock(endsAt)} ` +
    `Central Time (${formatDuration(input.durationMinutes)})`;

  const where =
    input.format === "online"
      ? `Online${input.meetingLink ? ` — join at ${input.meetingLink}` : ""}`
      : (input.location ?? "In person");

  const attending =
    input.attendeeNames.length > 0
      ? `${pluralize(input.attendeeNames.length, "person", "people")} so far: ${input.attendeeNames.join(", ")}`
      : "No RSVPs yet — be the first!";

  const calendarUrl = googleCalendarUrl({
    title: `${input.groupName} — ${input.title}`,
    startsAt,
    endsAt,
    location: input.format === "online" ? (input.meetingLink ?? "") : (input.location ?? ""),
    details: `Study session with ${input.groupName} (via Study Buddies).`,
  });

  return buildEmail({
    subject: `Study Buddies: New meetup in ${input.groupName} — ${input.title}`,
    preheader: `${input.title} — ${when}`,
    heading: `${creator} scheduled a meetup for ${input.groupName}`,
    blocks: [
      { text: `Hi ${input.recipientName ?? "there"},` },
      { detail: { label: "What", value: input.title } },
      { detail: { label: "When", value: when } },
      { detail: { label: "Where", value: where } },
      { detail: { label: "Attending", value: attending } },
      { button: { label: "RSVP and see details", url: input.groupUrl } },
      { text: "Prefer it in your calendar?" },
      { button: { label: "Add to Google Calendar", url: calendarUrl } },
    ],
    footerNote:
      "You're getting this because you're in this study group. " +
      "Turn these emails off any time under Edit profile → Notifications.",
    text:
      `Hi ${input.recipientName ?? "there"},\n\n` +
      `${creator} scheduled a new meetup for ${input.groupName}:\n\n` +
      `  ${input.title}\n` +
      `  When: ${when}\n` +
      `  Where: ${where}\n` +
      `  Attending: ${attending}\n\n` +
      `RSVP and see details: ${input.groupUrl}\n` +
      `Add it to Google Calendar: ${calendarUrl}\n\n` +
      `— Study Buddies\n` +
      `You're getting this because a group or classmate did something that involves you. ` +
      `Turn these emails off any time under Edit profile → Notifications.`,
  });
}
