/** Accessibility statement (/accessibility). Static page. */
import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "Study Buddies' commitment to an accessible experience, and how to report a problem.",
};

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl text-ink">Accessibility</h1>
        <h3 className="mt-2 text-sm text-ink-muted">Last Updated: August 31, 2026</h3>

        <p className="mt-6 text-ink-muted">
          We want everyone at the University of Minnesota to be able to use Study
          Buddies, including people who use screen readers, keyboard navigation,
          screen magnification, or other assistive technology.
        </p>

        <h2 className="mt-10 font-display text-2xl text-ink">Our goal</h2>
        <p className="mt-3 text-ink-muted">
          We aim to conform to the{" "}
          <a
            href="https://www.w3.org/WAI/WCAG21/quickref/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            Web Content Accessibility Guidelines (WCAG) 2.1, Level AA
          </a>
          . The app is built with semantic HTML, labelled form controls, visible
          focus indicators, a &ldquo;skip to main content&rdquo; link, keyboard
          support for menus and dialogs, and live-region announcements for chat
          and status changes. We test with keyboard-only navigation and a screen
          reader as part of our normal work.
        </p>

        <h2 className="mt-10 font-display text-2xl text-ink">Known limitations</h2>
        <p className="mt-3 text-ink-muted">
          We are a small student team and this is an ongoing effort. Some areas
          may not yet fully meet our goal. If you hit a barrier, please tell us, as it helps us prioritize.
        </p>

        <h2 className="mt-10 font-display text-2xl text-ink">Tell us about a problem</h2>
        <p className="mt-3 text-ink-muted">
          Email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-primary underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          with the page or feature, what went wrong, and the assistive technology
          and browser you were using. We will respond and work with you on an
          alternative way to get what you need in the meantime.
        </p>
      </div>
    </div>
  );
}
