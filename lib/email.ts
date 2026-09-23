/**
 * Optional email sending (spec §10): if RESEND_API_KEY is configured we
 * send; if not, every send silently succeeds as a no-op and the app runs
 * happily on in-app notifications alone. Nothing may ever crash because
 * email isn't set up.
 *
 * Implementation detail worth knowing: we call Resend's REST API with
 * fetch instead of installing their SDK — one less dependency, and the
 * no-op path stays obvious.
 *
 * Currently used for: notifying the admin inbox when a report is filed,
 * notification emails, and the group-chat digest.
 * (Signup/reset emails are Supabase Auth's job, not ours.)
 *
 * `html` is optional and always accompanied by `text`. Sending both parts
 * is not politeness: some clients block HTML by default, some people read
 * mail in a terminal, and a missing text part hurts spam scoring. See
 * lib/email-template.ts, which builds the two together so they can't
 * drift apart.
 */
import "server-only";

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    // Email intentionally unconfigured — silently do nothing (spec §10).
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(html ? { from, to, subject, text, html } : { from, to, subject, text }),
    });
    if (!response.ok) {
      // Log for the team, but never surface to the user — email is a
      // best-effort extra, not part of any user-facing promise.
      console.error("[email] Resend responded", response.status, await response.text());
    }
  } catch (error) {
    console.error("[email] send failed", error);
  }
}

/** Where report notifications go, if configured. */
export function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL ?? null;
}
