/**
 * Study-group form validation: creating a group (with or without a brand
 * new course attached) and the manager's settings form.
 *
 * The database functions re-validate all of this — these schemas exist to
 * give students per-field inline errors before a round trip, and to give
 * the server actions typed, trusted input.
 */
import { z } from "zod";
import { containsProfanity, PROFANITY_NAME_MESSAGE, PROFANITY_TEXT_MESSAGE } from "@/lib/profanity";
import {
  GROUP_CAPACITY_MAX,
  GROUP_CAPACITY_MIN,
  GROUP_COURSES_MAX,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
} from "@/lib/constants";

const uuid = z.string().uuid("Something went wrong — refresh and try again.");

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Give your group a name.")
  .max(GROUP_NAME_MAX, `Group names max out at ${GROUP_NAME_MAX} characters.`)
  .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE);

/** Optional — same "empty is fine, just cap the length" shape as bio. */
export const groupDescriptionSchema = z
  .string()
  .trim()
  .max(GROUP_DESCRIPTION_MAX, `Keep the description under ${GROUP_DESCRIPTION_MAX} characters.`)
  .refine((v) => !containsProfanity(v), PROFANITY_TEXT_MESSAGE);

export const capacitySchema = z.coerce
  .number({ invalid_type_error: "Capacity must be a number." })
  .int("Capacity must be a whole number.")
  .min(GROUP_CAPACITY_MIN, `Groups need room for at least ${GROUP_CAPACITY_MIN} people (you plus one).`)
  .max(GROUP_CAPACITY_MAX, `Groups are capped at ${GROUP_CAPACITY_MAX} people.`);

export const groupModeSchema = z.enum(["open", "closed"], {
  errorMap: () => ({ message: "Choose open or closed." }),
});

/**
 * The courses a group is for. At least one is required; the list is
 * de-duplicated here so picking the same course twice (possible if the
 * form is bypassed) isn't an error, just a no-op.
 */
export const groupCourseIdsSchema = z
  .array(uuid)
  .transform((ids) => [...new Set(ids)])
  .pipe(
    z
      .array(uuid)
      .min(1, "Pick at least one course this group is for.")
      .max(
        GROUP_COURSES_MAX,
        `Tag up to ${GROUP_COURSES_MAX} courses — that's plenty for equivalent classes.`,
      ),
  );

export const createGroupSchema = z
  .object({
    course_ids: groupCourseIdsSchema,
    name: groupNameSchema,
    description: groupDescriptionSchema,
    capacity: capacitySchema,
    mode: groupModeSchema,
    invitee_ids: z.array(uuid).default([]),
  })
  .superRefine((data, ctx) => {
    // The creator occupies one seat, so at most capacity − 1 invitations.
    if (data.invitee_ids.length > data.capacity - 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["invitee_ids"],
        message: `With a capacity of ${data.capacity}, you can invite at most ${data.capacity - 1} people (you take one seat).`,
      });
    }
  });

/**
 * Creating a group for a course that isn't in the catalog yet (spec
 * §5.6): the student supplies the course's department code and number,
 * we find-or-create the course, then create the group in it.
 */
export const createGroupWithCourseSchema = z
  .object({
    department_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,8}$/, "Department codes look like CSCI or MATH (2–8 letters)."),
    course_number: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9]{1,4}[A-Z]{0,3}$/, "Course numbers look like 1133 or 1301W."),
    course_name: z
      .string()
      .trim()
      .min(1, "What's the course called?")
      .max(200, "Keep the course name under 200 characters.")
      .refine((v) => !containsProfanity(v), PROFANITY_NAME_MESSAGE),
    name: groupNameSchema,
    description: groupDescriptionSchema,
    capacity: capacitySchema,
    mode: groupModeSchema,
  });

export const updateGroupSettingsSchema = z.object({
  group_id: uuid,
  name: groupNameSchema,
  description: groupDescriptionSchema,
  capacity: capacitySchema,
  mode: groupModeSchema,
});
