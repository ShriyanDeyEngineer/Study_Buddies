/**
 * Shared header for every PUBLIC page (home, about, why, testimonials):
 * logo, the three subpage links, and Sign in / Sign up buttons.
 *
 * On phones the nav links move into a second row (the spec's "top nav
 * collapses to a bottom row of links" for marketing pages) — one
 * component reflowed with CSS, no separate mobile copy.
 */
import Link from "next/link";
import { LogoLockup } from "@/components/buddies-logo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/why", label: "Why Use it" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/communityRulesGuidelines", label: "Community Guidelines" },
];

export function PublicHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:gap-x-6">
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          {/* One size down on phones so the auth buttons fit beside it. */}
          <LogoLockup className="text-base sm:text-xl" />
        </Link>

        <nav
          aria-label="Main"
          className="order-last flex w-full items-center gap-5 sm:order-none sm:w-auto sm:flex-1"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded text-sm font-medium text-ink-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="px-2.5 sm:px-3">
            <Link href="/register">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
