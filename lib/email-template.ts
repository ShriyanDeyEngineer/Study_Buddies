/**
 * The look of every email this app sends.
 *
 * WHY THIS IS TABLES AND INLINE STYLES AND NOT THE DESIGN SYSTEM:
 * email clients are not browsers. Gmail strips <style> blocks in some
 * contexts, Outlook renders through Word's HTML engine, and flexbox /
 * grid / CSS variables are simply unavailable. So this file deliberately
 * uses 2005-era HTML — nested tables, inline styles, hex colours typed
 * out literally — because that is the only thing that renders the same
 * everywhere. Do not "modernise" it.
 *
 * The hex values are copied from the @theme block in app/globals.css and
 * must be kept in step with it by hand (CSS variables can't cross into
 * an email). The CONTRAST RULE from that file still applies here: accent
 * (#d2694a) is a FILL with ink on it, accent-light (#edb59f) is the
 * on-dark colour. Nothing sitting on the forest-green header uses accent.
 *
 * EVERY EMAIL SENDS BOTH HTML AND PLAIN TEXT. The text part isn't a
 * fallback nicety — some people read mail in a terminal, some clients
 * block HTML by default, and a text part measurably improves spam
 * scoring. buildEmail() takes the text version as an input so the two
 * can never drift apart silently.
 */
import { getSiteUrl } from "@/lib/site";

const COLORS = {
  primary: "#1f4a3d",
  primaryDark: "#143026",
  accent: "#d2694a",
  accentLight: "#edb59f",
  cream: "#faf7f2",
  surface: "#ffffff",
  ink: "#1a1a1a",
  inkMuted: "#6b6b6b",
  line: "#e9e2d8",
} as const;

/** Serif for headings mirrors the app's display face; the fallbacks are
 *  what actually renders, since web fonts don't load in most clients. */
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

/** Escapes text before it goes anywhere near the HTML part. Group names,
 *  display names and message previews are all user-written, and an
 *  unescaped apostrophe or angle bracket would corrupt the markup (or
 *  worse, inject it) in someone's inbox. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailBlock {
  /** A paragraph of body copy. Already-escaped HTML is NOT expected —
   *  pass plain text and it gets escaped for you. */
  text?: string;
  /** A call-to-action button. */
  button?: { label: string; url: string };
  /** A labelled detail row ("When", "Where", "Who's coming"). */
  detail?: { label: string; value: string };
  /** A quoted excerpt, used by the chat digest for message previews. */
  quote?: { author: string; body: string };
  /** A horizontal rule between logical sections. */
  divider?: true;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Wraps content in the branded shell: logo header, white card, footer
 * with the unsubscribe pointer.
 *
 * @param preheader the grey line inboxes show after the subject. Worth
 *   setting deliberately — left empty, Gmail scrapes the first words of
 *   the body, which is usually "Hi Dana," and wastes the slot.
 */
export function buildEmail({
  subject,
  preheader,
  heading,
  blocks,
  text,
  footerNote,
}: {
  subject: string;
  preheader: string;
  heading: string;
  blocks: EmailBlock[];
  /** The plain-text part, authored by the caller alongside the blocks. */
  text: string;
  footerNote?: string;
}): BuiltEmail {
  const site = getSiteUrl();
  const body = blocks.map(renderBlock).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.cream};">
<!-- Preheader: shown in the inbox list, hidden in the open email. The
     trailing whitespace stops clients padding it with body copy. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
${escapeHtml(preheader)}
${"&#847;&zwnj;&nbsp;".repeat(60)}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.cream};">
<tr>
<td align="center" style="padding:24px 12px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<!-- Header -->
<tr>
<td align="center" style="padding:8px 0 20px 0;">
<a href="${site}" style="text-decoration:none;color:${COLORS.primary};font-family:${SERIF};font-size:20px;font-weight:bold;">
Study Buddies
</a>
</td>
</tr>

<!-- Card -->
<tr>
<td style="background-color:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:12px;padding:28px 28px 24px 28px;">
<h1 style="margin:0 0 16px 0;font-family:${SERIF};font-size:22px;line-height:1.3;color:${COLORS.ink};font-weight:normal;">
${escapeHtml(heading)}
</h1>
${body}
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:20px 8px 8px 8px;">
<p style="margin:0 0 8px 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${COLORS.inkMuted};">
${escapeHtml(footerNote ?? "You're getting this because something involving you happened on Study Buddies.")}
</p>
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${COLORS.inkMuted};">
<a href="${site}/settings/profile" style="color:${COLORS.primary};">Turn these emails off</a>
 &nbsp;·&nbsp; Study Buddies is a student project, not affiliated with the University of Minnesota.
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

function renderBlock(block: EmailBlock): string {
  if (block.divider) {
    return `<hr style="border:none;border-top:1px solid ${COLORS.line};margin:20px 0;">`;
  }

  if (block.button) {
    // Padded <a> rather than a styled <button>: buttons don't render as
    // links in most clients, and a bare <a> with padding is the one
    // approach Outlook and Gmail both honour.
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px 0;">
<tr><td style="background-color:${COLORS.accent};border-radius:8px;">
<a href="${block.button.url}" style="display:inline-block;padding:11px 22px;font-family:${SANS};font-size:15px;font-weight:bold;color:${COLORS.ink};text-decoration:none;">
${escapeHtml(block.button.label)}
</a>
</td></tr></table>`;
  }

  if (block.detail) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px 0;">
<tr>
<td width="86" valign="top" style="font-family:${SANS};font-size:14px;line-height:1.5;color:${COLORS.inkMuted};padding-right:10px;">
${escapeHtml(block.detail.label)}
</td>
<td valign="top" style="font-family:${SANS};font-size:14px;line-height:1.5;color:${COLORS.ink};">
${escapeHtml(block.detail.value)}
</td>
</tr>
</table>`;
  }

  if (block.quote) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
<tr>
<td style="border-left:3px solid ${COLORS.accentLight};padding:2px 0 2px 12px;">
<p style="margin:0 0 2px 0;font-family:${SANS};font-size:13px;font-weight:bold;color:${COLORS.primary};">
${escapeHtml(block.quote.author)}
</p>
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.5;color:${COLORS.ink};">
${escapeHtml(block.quote.body)}
</p>
</td>
</tr>
</table>`;
  }

  return `<p style="margin:0 0 12px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.ink};">
${escapeHtml(block.text ?? "")}
</p>`;
}
