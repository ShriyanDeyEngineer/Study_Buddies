/**
 * User avatar — profile picture if one exists, otherwise the user's
 * initials on a accent circle. Used everywhere a person appears (chat,
 * member lists, search results, headers).
 *
 * Plain <img> instead of next/image on purpose: avatars are tiny, appear
 * in long realtime lists, and next/image's lazy placeholder dance causes
 * visible pop-in there. The `sizes` prop of next/image buys us nothing at
 * 32–80px. (Large images elsewhere should still use next/image.)
 */
import { cn, initials } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-xl",
} as const;

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  /** Display name, used for initials fallback and alt text. */
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- see header comment
    <img
      src={src}
      alt={name ? `${name}'s profile picture` : "Profile picture"}
      className={cn(
        "shrink-0 rounded-full border border-line object-cover",
        SIZES[size],
        className,
      )}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full bg-accent-light font-semibold text-primary",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
