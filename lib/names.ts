/**
 * Prefilling the first + last name fields from a Google account. Only ever
 * a suggestion — the student sees and can edit both fields before anything
 * is saved.
 *
 * Google's own given_name / family_name win when Supabase passes them
 * through. Otherwise the single full name is split at the first space
 * ("Ana García López" → "Ana" + "García López"), which keeps compound
 * surnames whole. A wrong guess costs the student one edit.
 */
import { NAME_PART_MAX } from "@/lib/constants";

export interface NameParts {
  first_name: string;
  last_name: string;
}

export function suggestNameParts(
  metadata: Record<string, unknown> | null | undefined,
): NameParts {
  const text = (key: string) => {
    const value = metadata?.[key];
    return typeof value === "string" ? value.trim() : "";
  };

  let first = text("given_name");
  let last = text("family_name");
  if (!first && !last) {
    const [head = "", ...rest] = (text("full_name") || text("name")).split(/\s+/);
    first = head;
    last = rest.join(" ");
  }

  return {
    first_name: first.slice(0, NAME_PART_MAX),
    last_name: last.slice(0, NAME_PART_MAX),
  };
}
