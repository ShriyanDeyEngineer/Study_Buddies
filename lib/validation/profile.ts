/**
 * Profile validation: onboarding and the profile edit form, including the
 * per-field privacy flags and the social-links rules.
 *
 * One schema serves both forms (they edit the same fields); onboarding
 * just uses a subset. Shared by client (inline errors) and server action
 * (the enforcement that counts).
 */
import { z } from "zod";
import {
  containsProfanity,
  PROFANITY_NAME_MESSAGE,
  PROFANITY_TEXT_MESSAGE,
} from "@/lib/profanity";
import {
  BIO_MAX_LENGTH,
  COLLEGE_VALUES,
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
  NAME_PART_MAX,
  SOCIAL_LINKS_MAX,
  STANDING_VALUES,
} from "@/lib/constants";

/** "" from an empty form field means "no answer" — normalize to null so
 *  optional fields don't fail their max-length/enum checks on "". */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema);

/** First or last name — both required. The database joins them into
 *  display_name, the name classmates see (migration 0042).
 *
 *  No profanity check, on purpose: these are real names, and the filter
 *  rejected real ones ("Dick", "Shitole") with no way past the required
 *  field. Inappropriate names are handled by admins (pause/ban). */
const namePartSchema = (which: "first" | "last") => {
  const missing = `Enter your ${which} name.`;
  return z
    .string({ required_error: missing, invalid_type_error: missing })
    .trim()
    .min(1, missing)
    .max(NAME_PART_MAX, `Keep it under ${NAME_PART_MAX} characters.`);
};

/** A single social link: must be a real http(s) URL (spec §5.11). The
 *  protocol check stops javascript: links from ever rendering as <a href>. */
export const socialLinkSchema = z
  .string()
  .trim()
  .url("Enter a full link, starting with https://")
  .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
    message: "Links must start with http:// or https://",
  });

export const profileSchema = z.object({
  first_name: namePartSchema("first"),
  last_name: namePartSchema("last"),
  college: emptyToNull(
    z.enum(COLLEGE_VALUES as [string, ...string[]]).nullable(),
  ),
  major: emptyToNull(
    z
      .string()
      .trim()
      .max(100, "Keep majors under 100 characters.")
      .nullable()
      .refine((v) => v === null || !containsProfanity(v), PROFANITY_NAME_MESSAGE),
  ),
  class_standing: emptyToNull(
    z.enum(STANDING_VALUES as [string, ...string[]]).nullable(),
  ),
  graduation_month: emptyToNull(
    z.coerce.number().int().min(1, "Pick a month.").max(12, "Pick a month.").nullable(),
  ),
  graduation_year: emptyToNull(
    z.coerce
      .number()
      .int()
      .min(GRAD_YEAR_MIN, `Years ${GRAD_YEAR_MIN}–${GRAD_YEAR_MAX} only.`)
      .max(GRAD_YEAR_MAX, `Years ${GRAD_YEAR_MIN}–${GRAD_YEAR_MAX} only.`)
      .nullable(),
  ),
  bio: emptyToNull(
    z
      .string()
      .trim()
      .max(BIO_MAX_LENGTH, `Bios max out at ${BIO_MAX_LENGTH} characters.`)
      .nullable()
      .refine((v) => v === null || !containsProfanity(v), PROFANITY_TEXT_MESSAGE),
  ),
  social_links: z
    .array(socialLinkSchema)
    .max(SOCIAL_LINKS_MAX, `Up to ${SOCIAL_LINKS_MAX} links.`)
    .default([]),
});

/** Onboarding step 1 collects just the identity basics. */
export const onboardingSchema = profileSchema.pick({
  first_name: true,
  last_name: true,
  college: true,
  major: true,
  class_standing: true,
  graduation_month: true,
  graduation_year: true,
});

/** The layout's "confirm your name" screen, for accounts from before
 *  first + last names were required. */
export const nameSchema = profileSchema.pick({
  first_name: true,
  last_name: true,
});

/**
 * The privacy flags. Every key optional; true = "hide this from others".
 * `strict()` so an unknown key is an error — a typo like "majr" would
 * otherwise silently protect nothing.
 */
export const privacySchema = z
  .object({
    college: z.boolean().optional(),
    major: z.boolean().optional(),
    class_standing: z.boolean().optional(),
    bio: z.boolean().optional(),
    graduation: z.boolean().optional(),
    social_links: z.boolean().optional(),
    courses_current: z.boolean().optional(),
    courses_taken: z.boolean().optional(),
    courses_future: z.boolean().optional(),
  })
  .strict();

export type PrivacyFlags = z.infer<typeof privacySchema>;
