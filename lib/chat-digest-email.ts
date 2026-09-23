/**
 * The "you missed some messages" email (migration 0043).
 *
 * One email per person per run, covering every group that has unread
 * chat — not one per group. Someone in four active groups gets a single
 * message with four sections, which is the whole point of batching.
 *
 * Pure function, like lib/meetup-email.ts: the route fetches rows and
 * this decides the wording, so the copy is unit-testable with no
 * database (tests/chat-digest-email.test.ts).
 */
import { buildEmail, type BuiltEmail } from "@/lib/email-template";
import { pluralize } from "@/lib/utils";

export interface DigestGroup {
  groupId: string;
  groupName: string;
  unreadCount: number;
  /** Up to three of the most recent messages, oldest first. */
  previews: { author: string | null; body: string }[];
}

export interface ChatDigestInput {
  recipientName: string | null;
  groups: DigestGroup[];
  /** Absolute site origin, e.g. https://studybuddies.example. */
  siteUrl: string;
}

/** Long messages are cut so the email stays skimmable — the point is to
 *  pull someone back to the site, not to reproduce the conversation. */
const PREVIEW_MAX = 140;

export function truncate(body: string, max = PREVIEW_MAX): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  // Break on a word boundary when there's a reasonable one nearby,
  // rather than mid-word.
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Returns null when there is nothing to say — the caller should send
 * nothing at all rather than an empty email.
 */
export function buildChatDigestEmail(input: ChatDigestInput): BuiltEmail | null {
  const groups = input.groups.filter((g) => g.unreadCount > 0);
  if (groups.length === 0) return null;

  const totalMessages = groups.reduce((sum, g) => sum + g.unreadCount, 0);
  const greeting = `Hi ${input.recipientName ?? "there"},`;

  // Subject names the group when there's only one, because "3 new
  // messages in Algo Grinders" is far more openable than a generic count.
  const subject =
    groups.length === 1
      ? `${pluralize(totalMessages, "new message")} in ${groups[0].groupName}`
      : `${pluralize(totalMessages, "new message")} across ${pluralize(groups.length, "group")}`;

  const blocks = [];
  const textParts: string[] = [greeting, ""];

  blocks.push({
    text:
      groups.length === 1
        ? `${greeting} your group has been talking while you were away.`
        : `${greeting} your groups have been talking while you were away.`,
  });

  groups.forEach((group, index) => {
    if (index > 0) blocks.push({ divider: true as const });

    blocks.push({
      detail: {
        label: pluralize(group.unreadCount, "message"),
        value: group.groupName,
      },
    });
    textParts.push(`${group.groupName} — ${pluralize(group.unreadCount, "new message")}`);

    for (const preview of group.previews) {
      const author = preview.author ?? "Someone";
      const body = truncate(preview.body);
      blocks.push({ quote: { author, body } });
      textParts.push(`  ${author}: ${body}`);
    }

    blocks.push({
      button: {
        label: groups.length === 1 ? "Open the chat" : `Open ${group.groupName}`,
        url: `${input.siteUrl}/groups/${group.groupId}`,
      },
    });
    textParts.push(`  Open it: ${input.siteUrl}/groups/${group.groupId}`, "");
  });

  textParts.push(
    "— Study Buddies",
    "You're getting this because you have unread messages in a group you're in. " +
      "Turn these emails off any time under Edit profile → Notifications.",
  );

  return buildEmail({
    subject: `Study Buddies: ${subject}`,
    preheader:
      groups.length === 1
        ? `${groups[0].groupName}: ${groups[0].previews.at(-1)?.body.slice(0, 80) ?? "new activity"}`
        : groups.map((g) => g.groupName).join(", "),
    heading: subject,
    blocks,
    footerNote:
      "You're getting this because you have unread messages in a group you're in. " +
      "Turn these emails off any time under Edit profile → Notifications.",
    text: textParts.join("\n"),
  });
}
