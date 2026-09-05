/**
 * The shared dropdown select.
 *
 * This is a styled NATIVE <select>, not a custom popover widget. That is a
 * deliberate choice: native selects are keyboard- and screen-reader-
 * accessible for free, work on mobile with the OS picker, and are the
 * simplest thing for the team to maintain. If we ever need multi-select
 * with checkboxes, use the FilterPopover pattern instead of extending this.
 */
"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-line bg-surface pl-3 pr-9 text-sm text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {/* Decorative chevron; the real control is the native select above. */}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
});
