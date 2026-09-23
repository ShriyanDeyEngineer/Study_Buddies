/**
 * Study-group server actions. Thin by design: validate with zod, call
 * the database function that owns the rule, translate errors to friendly
 * copy. If you're tempted to add group logic HERE (capacity checks,
 * manager checks…), stop — it belongs in supabase/migrations/0004, where
 * concurrent clicks can't outrun it. The functions there are the only
 * write path; these actions are just the doorway.
 */
"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createGroupSchema,
  createGroupWithCourseSchema,
  updateGroupSettingsSchema,
} from "@/lib/validation/group";
import { friendlyError } from "@/lib/errors";
import { COURSE_CATALOG_TAG } from "@/lib/data/course-catalog";
import type { ActionResult } from "@/lib/actions/types";

export async function createGroupAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createGroupSchema.safeParse({
    course_id: formData.get("course_id"),
    name: formData.get("name"),
    description: formData.get("description"),
    capacity: formData.get("capacity"),
    mode: formData.get("mode"),
    invitee_ids: formData.getAll("invitee_ids").map(String),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("create_study_group", {
    p_course_id: parsed.data.course_id,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_capacity: parsed.data.capacity,
    p_mode: parsed.data.mode,
    p_invitee_ids: parsed.data.invitee_ids,
  });
  if (error) {
    // NAME_TAKEN and INVALID_DESCRIPTION belong on their own fields
    // (inline, per-field errors are a §5.6 requirement); everything else
    // is form-level.
    const message = friendlyError(error);
    if (String(error.message).includes("NAME_TAKEN")) {
      return { fieldErrors: { name: [message] } };
    }
    if (String(error.message).includes("INVALID_DESCRIPTION")) {
      return { fieldErrors: { description: [message] } };
    }
    return { error: message };
  }

  // A new active group changes this course's group count on the catalog.
  revalidateTag(COURSE_CATALOG_TAG);
  redirect(`/groups/${groupId}`);
}

/**
 * Creating a group for a course that isn't in the catalog (spec §5.6):
 * find-or-create the course, then create the group in it. The creator is
 * also enrolled in the new course as 'current' — you don't start a study
 * group for a class you're not taking (judgment call, README).
 */
export async function createGroupWithCourseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createGroupWithCourseSchema.safeParse({
    department_code: formData.get("department_code"),
    course_number: formData.get("course_number"),
    course_name: formData.get("course_name"),
    name: formData.get("name"),
    description: formData.get("description"),
    capacity: formData.get("capacity"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { data: courseRows, error: courseError } = await supabase.rpc("create_course", {
    p_department_code: parsed.data.department_code,
    p_course_number: parsed.data.course_number,
    p_course_name: parsed.data.course_name,
  });
  if (courseError) return { error: friendlyError(courseError) };
  const courseId = (courseRows as { course_id: string }[] | null)?.[0]?.course_id;
  if (!courseId) return { error: friendlyError(null) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("user_courses").upsert(
      { user_id: user.id, course_id: courseId, enrollment_type: "current" },
      { ignoreDuplicates: true },
    );
  }

  const { data: groupId, error } = await supabase.rpc("create_study_group", {
    p_course_id: courseId,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_capacity: parsed.data.capacity,
    p_mode: parsed.data.mode,
    p_invitee_ids: [],
  });
  if (error) {
    const message = friendlyError(error);
    if (String(error.message).includes("NAME_TAKEN")) {
      return { fieldErrors: { name: [message] } };
    }
    if (String(error.message).includes("INVALID_DESCRIPTION")) {
      return { fieldErrors: { description: [message] } };
    }
    return { error: message };
  }

  // New course AND a new active group in it — both change the catalog.
  revalidateTag(COURSE_CATALOG_TAG);
  redirect(`/groups/${groupId}`);
}

/** The join button. Returns what happened so the UI can toast it:
 *  'joined' (open group) or 'requested' (closed group). */
export async function joinGroupAction(
  groupId: string,
): Promise<{ result?: "joined" | "requested"; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_group", { p_group_id: groupId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return { result: data as "joined" | "requested" };
}

export async function withdrawJoinRequestAction(
  groupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_join_request", { p_group_id: groupId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

/** Manager approves a request. 'cancelled_full' means the group filled
 *  while it waited — the requester was told; the UI tells the manager. */
export async function approveJoinRequestAction(
  requestId: string,
  groupId: string,
): Promise<{ result?: "approved" | "cancelled_full"; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_join_request", {
    p_request_id: requestId,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return { result: data as "approved" | "cancelled_full" };
}

export async function denyJoinRequestAction(
  requestId: string,
  groupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deny_join_request", { p_request_id: requestId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function respondToInvitationAction(
  invitationId: string,
  accept: boolean,
): Promise<{ result?: "joined" | "declined" | "cancelled_full"; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_to_invitation", {
    p_invitation_id: invitationId,
    p_accept: accept,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { result: data as "joined" | "declined" | "cancelled_full" };
}

export async function leaveGroupAction(groupId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });
  if (error) return { error: friendlyError(error) };
  // The group page is now the non-member preview; dashboard loses a card.
  revalidatePath(`/groups/${groupId}`);
  // Rare, but the last member leaving auto-disbands the group (0016),
  // which drops it from the catalog's active-group count.
  revalidateTag(COURSE_CATALOG_TAG);
  redirect("/dashboard");
}

export async function removeMemberAction(
  groupId: string,
  memberId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_group_id: groupId,
    p_member_id: memberId,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function updateGroupSettingsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateGroupSettingsSchema.safeParse({
    group_id: formData.get("group_id"),
    name: formData.get("name"),
    description: formData.get("description"),
    capacity: formData.get("capacity"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_group_settings", {
    p_group_id: parsed.data.group_id,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_capacity: parsed.data.capacity,
    p_mode: parsed.data.mode,
  });
  if (error) {
    const message = friendlyError(error);
    if (String(error.message).includes("NAME_TAKEN")) {
      return { fieldErrors: { name: [message] } };
    }
    if (String(error.message).includes("INVALID_DESCRIPTION")) {
      return { fieldErrors: { description: [message] } };
    }
    // Below-current-membership and out-of-range both belong on the
    // capacity field specifically, same reasoning as NAME_TAKEN above.
    if (
      String(error.message).includes("CAPACITY_BELOW_MEMBER_COUNT") ||
      String(error.message).includes("INVALID_CAPACITY")
    ) {
      return { fieldErrors: { capacity: [message] } };
    }
    return { error: message };
  }

  // Mode can flip open⇄closed here, which changes the catalog's "joinable"
  // count for this course even though the group count itself didn't move.
  revalidateTag(COURSE_CATALOG_TAG);
  revalidatePath(`/groups/${parsed.data.group_id}`);
  return { success: "Settings saved." };
}

export async function disbandGroupAction(groupId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disband_group", { p_group_id: groupId });
  if (error) return { error: friendlyError(error) };
  // The group drops out of every course's active-group count.
  revalidateTag(COURSE_CATALOG_TAG);
  redirect("/dashboard");
}

/**
 * "I'm looking at this group now" — moves the caller's read mark so the
 * chat digest (migration 0043) stops counting messages they've seen.
 *
 * Fired from the group page on mount rather than during render: a render
 * can run more than once and must stay side-effect free, and this is a
 * write. Failure is deliberately silent — a missed mark costs at worst
 * one extra digest email, which is not worth interrupting anyone for.
 */
export async function markGroupReadAction(groupId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_group_read", { p_group_id: groupId });
  if (error) console.error("[mark_group_read]", error.message);
}
