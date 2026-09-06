/**
 * The Study Buddies logo — an ORIGINAL mark: two abstract figures at a
 * shared table with an open book. It is deliberately NOT a gopher, not the
 * University of Minnesota's Goldy Gopher mascot, and not any University
 * trademark — keep it that way. Never "improve" this by pasting in real
 * UMN artwork.
 *
 * Used in the public header, the app header, and the footer. Size it with
 * the className prop (it scales like any inline SVG).
 */
import { cn } from "@/lib/utils";

/**
 * Icon depicting two students collaborating/studying together, seated at
 * a shared table with an open book between them.
 *
 * Deliberately prop-free: the figures are armless silhouettes and the
 * bodies span the whole table, so there is nowhere for a pencil to be
 * held or to rest — earlier versions floated them outboard, where they
 * read as whiskers and were the first thing to break down at favicon
 * size. Two people + an open book already carries the meaning.
 */
export function BuddiesLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      fill="currentColor"
    >
      {/* table */}
      <rect x="8" y="46" width="48" height="5" rx="2" />

      {/* ===== left student ===== */}
      {/* head — a clean silhouette, no facial features */}
      <circle cx="20" cy="20" r="9" />
      
      {/* body */}
      <path d="M 9 46 C 9 34 14 28 20 28 C 26 28 31 34 31 46 Z" />
      

      {/* ===== right student ===== */}
      {/* head — a clean silhouette, no facial features */}
      <circle cx="44" cy="20" r="9" />
      
      {/* body */}
      <path d="M 33 46 C 33 34 38 28 44 28 C 50 28 55 34 55 46 Z" />
      

      {/* ===== shared open book on the table ===== */}
      <path
        d="M 32 47.5 L 20 43.5 L 20 39 L 32 42 L 44 39 L 44 43.5 Z"
        fill="#fff"
        fillOpacity="0.9"
      />
      {/* spine crease */}
      <line
        x1="32"
        y1="47.5"
        x2="32"
        y2="42"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.3"
      />
    </svg>
  );
}

/**
 * Logo + wordmark lockup used in headers. The `dark` variant is for primary
 * backgrounds (white text, accent mark); the default is for light
 * backgrounds (primary text and mark).
 */
export function LogoLockup({
  dark = false,
  className,
}: {
  dark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-xl leading-none",
        dark ? "text-white" : "text-primary",
        className,
      )}
    >
      {/* Apricot on both surfaces, no badge. Apricot on cream measures
          1.82:1, which the CONTRAST RULE in globals.css otherwise forbids —
          a brand mark is the one documented exception (WCAG exempts
          logotypes from contrast minimums). Do NOT copy this pattern to
          icons or text, where the rule stands. */}
      <BuddiesLogo className="h-[1.35em] w-[1.35em] text-accent" />
      <span>
        <span className={dark ? "text-accent" : ""}>Study Buddies</span>
      </span>
    </span>
  );
}
