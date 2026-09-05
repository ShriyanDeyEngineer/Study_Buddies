/**
 * Tabs (Radix) — used on mobile to switch between a group's Chat /
 * Meetups / Members panels, and anywhere else content is sectioned.
 * NOTE: do not mount the same realtime component in two tabs "for
 * layout reasons" — see the realtime rules in docs/GLOSSARY.md.
 */
"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex w-full gap-1 rounded-xl border border-line bg-surface p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors",
        "focus-visible:outline-2 focus-visible:outline-primary",
        "data-[state=active]:bg-primary data-[state=active]:text-white",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-4 outline-none focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
}
