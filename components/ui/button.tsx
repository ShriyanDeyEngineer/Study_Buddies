/**
 * The shared Button. Every clickable button in the app should be this
 * component (or asChild-wrap a link), so all buttons look and behave
 * consistently.
 *
 * Variants:
 *   primary   — primary background, white text (the main action on a page)
 *   secondary — accent background, primary text (supporting CTAs)
 *   outline   — bordered, transparent (neutral actions)
 *   ghost     — borderless (toolbar/icon actions)
 *   danger    — red (destructive actions: remove, disband, block)
 *
 * Touch this file to change how ALL buttons look. For a one-off tweak,
 * pass className instead.
 */
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles shared by every variant. The focus ring is an
  // accessibility requirement — do not remove it.
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
    "disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-dark",
        secondary: "bg-accent text-primary hover:bg-accent-light",
        outline: "border border-line bg-surface text-ink hover:bg-cream",
        ghost: "text-ink hover:bg-line/50",
        danger: "bg-danger text-white hover:bg-danger/90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        /* icon buttons are square; remember to give them an aria-label!
           44px clears the common ~44x44 minimum tap-target guideline. */
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a <Link>) with button styling. */
  asChild?: boolean;
  /** Show a spinner and disable the button — use during form submission. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, asChild, loading, disabled, type, children, ...props },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        // KNOWN PITFALL GUARD: a native <button> inside a <form> defaults to
        // type="submit", which makes random buttons (like "show password")
        // submit the form. We default to type="button"; real submit buttons
        // must explicitly pass type="submit".
        {...(asChild ? {} : { type: type ?? "button" })}
        disabled={asChild ? undefined : disabled || loading}
        {...props}
      >
        {asChild ? (
          // Radix Slot demands EXACTLY one element child (it merges props
          // onto it) — so no loader sibling in asChild mode. asChild is
          // for links, which never show a loading spinner anyway.
          children
        ) : (
          <>
            {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
