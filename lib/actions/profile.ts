/**
 * Profile server actions: finishing onboarding, editing the profile,
 * privacy flags, the study-buddy toggle, and course-list management.
 *
 * There are no user-uploaded images anywhere in the app (removed 2026 —
 * see migration 0037): avatars are always the initials fallback rendered
 * by <Avatar>. Nothing here writes profiles.avatar_url, and the column's
 * UPDATE grant is revoked in that migration.
 */
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  nameSchema,
  onboardingSchema,
  privacySchema,
  profileSchema,
} from "@/lib/validation/profile";
import { majorFromForm } from "@/lib/majors";
import { friendlyError } from "@/lib/errors";
import { TERMS_VERSION } from "@/lib/site";
import type { ActionResult } from "@/lib/actions/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shared FormData → object plumbing for the profile schemas. */
function profileFields(formData: FormData) {
  return {
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    college: formData.get("college"),
    major: majorFromForm(formData.get("major"), formData.get("major_other")),
    class_standing: formData.get("class_standing"),
    graduation_month: formData.get("graduation_month"),
    graduation_year: formData.get("graduation_year"),
  };
}

/**
 * Onboarding's single submit (spec §5.3). Everything lands in one action
 * on the final step, which is what makes the wizard refresh-safe: until
 * you press Finish nothing is saved, and after it your display_name
 * exists and the app opens up. Re-submitting just overwrites — no
 * half-done state to corrupt.
 */
export async function saveOnboardingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = onboardingSchema.safeParse(profileFields(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const bio = String(formData.get("bio") ?? "").trim();
  if (bio.length > 500) {
    return { fieldErrors: { bio: ["Bios max out at 500 characters."] } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      ...parsed.data,
      bio: bio || null,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };

  // Stamp the consent record. The user could not have reached onboarding
  // without accepting the current terms at sign-in; this is the durable
  // proof of which version, and when. Non-fatal — a failure here must not
  // block the student from finishing setup.
  await supabase.rpc("record_terms_acceptance", { p_version: TERMS_VERSION });

  // Selected current courses (skippable step). Ids come from our own
  // checkbox list, but validate the shape anyway — never trust the form.
  const courseIds = formData
    .getAll("course_ids")
    .map(String)
    .filter((id) => UUID_RE.test(id));
  if (courseIds.length > 0) {
    await supabase.from("user_courses").upsert(
      courseIds.map((course_id) => ({
        user_id: user.id,
        course_id,
        enrollment_type: "current" as const,
      })),
      { ignoreDuplicates: true },
    );
  }

  redirect("/dashboard");
}

/**
 * "Confirm your name" — the screen the app layout shows accounts created
 * before first + last names were required (migration 0042). Saving both
 * rebuilds display_name in the database, which lets them back in.
 */
export async function saveNameAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = nameSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };

  redirect("/dashboard");
}

/** The profile edit form (settings). Same fields as onboarding plus bio +
 *  social links. */
export async function updateProfileAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const socialLinks = formData
    .getAll("social_links")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const parsed = profileSchema.safeParse({
    ...profileFields(formData),
    bio: formData.get("bio"),
    social_links: socialLinks,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/settings/profile");
  revalidatePath(`/profile/${user.id}`);
  return { success: "Profile saved." };
}

/** Privacy switches save independently of the profile form so flipping
 *  one can never be lost to an unrelated validation error. */
export async function updatePrivacyAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("privacy") ?? "{}"));
  } catch {
    return { error: "Something went wrong saving your privacy settings." };
  }
  const parsed = privacySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Something went wrong saving your privacy settings." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ privacy: parsed.data })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/settings/profile");
  return { success: "Privacy updated." };
}

export async function setBuddyAvailabilityAction(available: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase
    .from("profiles")
    .update({ is_available_for_buddies: available })
    .eq("id", user.id);
  revalidatePath("/people");
  revalidatePath("/settings/profile");
}

/** The "email me about group & friend activity" switch (bug report #9).
 *  Only affects the notification-email webhook; in-app notifications
 *  always arrive. */
export async function setEmailNotificationsAction(enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase
    .from("profiles")
    .update({ email_notifications: enabled })
    .eq("id", user.id);
  revalidatePath("/settings/profile");
}

/** Add/remove a course on one of the three lists (current/taken/future). */
export async function setCourseEnrollmentAction(
  courseId: string,
  enrollmentType: "current" | "taken" | "future",
  enrolled: boolean,
): Promise<ActionResult> {
  if (!UUID_RE.test(courseId)) return { error: "Something went wrong." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (enrolled) {
    const { error } = await supabase.from("user_courses").upsert(
      { user_id: user.id, course_id: courseId, enrollment_type: enrollmentType },
      { ignoreDuplicates: true },
    );
    if (error) return { error: friendlyError(error) };
  } else {
    const { error } = await supabase
      .from("user_courses")
      .delete()
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("enrollment_type", enrollmentType);
    if (error) return { error: friendlyError(error) };
  }
  revalidatePath("/settings/courses");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Self-service account deletion (migrations 0014 / 0035). The database
 * function does the immediate "affects other people" cleanup and scrubs
 * the profile to "Deleted User"; the residual tombstone data ages out
 * after the retention grace period. On success: sign out and land on the
 * marketing home.
 */
export async function deleteAccountAction(): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_account");
  if (error) return { error: friendlyError(error) };
  // Local scope: the RPC deleted the auth user, so the server-side
  // session is already gone — this just clears the cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

/**
 * Records that the walkthrough video has been offered to this student,
 * so the one-time prompt doesn't fire again on their next device
 * (migration 0044).
 *
 * Silent on failure: the worst case is being shown the tutorial twice,
 * which is not worth an error message.
 */
export async function markTutorialSeenAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_tutorial_seen");
  if (error) console.error("[mark_tutorial_seen]", error.message);
}
