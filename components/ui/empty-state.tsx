/**
 * Empty state — shown whenever a list has nothing in it.
 *
 * The design spec makes empty states a first-class requirement: every one
 * must have a friendly illustration, encouraging copy, and (whenever
 * possible) a primary action that FIXES the emptiness — e.g. an empty
 * "My groups" list offers "Find a group", not just a shrug.
 */
import * as React from "react";
import { BuddiesLogo } from "@/components/buddies-logo";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  /** Short, warm headline — "No groups yet" not "0 results". */
  title: string;
  /** One or two encouraging sentences; student-to-student tone. */
  description: string;
  /** Usually a <Button asChild><Link…>. Optional but strongly preferred. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      {/* Our logo mark doubles as the illustration, in a muted accent circle. */}
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-light">
        <BuddiesLogo className="h-9 w-9 text-primary" />
      </span>
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
