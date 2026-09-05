/**
 * Tiny shared utilities used all over the app.
 *
 * Touch this file only for helpers that genuinely belong everywhere.
 * Anything domain-specific (groups, profiles, courses…) lives in its own
 * module under lib/ instead.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn("px-2", isActive && "bg-primary", className)
 *
 * Combines CSS class names, dropping falsy values, and resolves Tailwind
 * conflicts so a caller's class can override a component's default
 * (e.g. "px-4" passed in beats the built-in "px-2").
 *
 * Why it exists: every UI component accepts a className prop, and without
 * tailwind-merge the component's own classes would sometimes win over the
 * caller's, in ways that depend on CSS file order — a classic source of
 * "why won't this style apply" confusion.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a count with its noun, choosing singular or plural:
 * pluralize(1, "member") → "1 member";  pluralize(3, "member") → "3 members".
 * Pass a custom plural for irregular nouns: pluralize(2, "person", "people").
 */
export function pluralize(count: number, noun: string, plural?: string) {
  return `${count} ${count === 1 ? noun : (plural ?? noun + "s")}`;
}

/**
 * First letter of each of the first two words, uppercased — used for the
 * avatar shown for every user ("Ada Lovelace" → "AL"). Falls back to "?"
 * for empty names so the avatar never renders blank.
 */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
