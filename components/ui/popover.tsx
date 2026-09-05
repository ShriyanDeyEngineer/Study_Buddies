/**
 * Popover (Radix) — small floating panels anchored to a trigger.
 * Used by the filter panel's multi-select dropdowns and the notification
 * bell preview.
 */
"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg outline-none focus-visible:outline-2 focus-visible:outline-primary",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
