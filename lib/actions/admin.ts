/**
 * Admin-only actions. Every one relies on database-side enforcement
 * (is_admin() in RLS policies / functions) — the server action is just
 * the doorway, same as everywhere else.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Move a report through its lifecycle. RLS's "admins update reports"
 *  policy (0007) is the enforcement; non-admins match zero rows. */
export async function setReportStatusAction(
  reportId: string,
  status: ReportStatus,
): Promise<{ error?: string }> {
  if (!REPORT_STATUSES.includes(status)) {
    return { error: friendlyError(null) };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin");
  return {};
}

const FLAG_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

/** Move a content flag through its lifecycle. RLS's "admins update content
 *  flags" policy (0040) is the enforcement; non-admins match zero rows. */
export async function setContentFlagStatusAction(
  flagId: string,
  status: FlagStatus,
): Promise<{ error?: string }> {
  if (!FLAG_STATUSES.includes(status)) {
    return { error: friendlyError(null) };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_flags")
    .update({ status })
    .eq("id", flagId);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/flags");
  revalidatePath("/admin");
  return {};
}

/**
 * Mute / unmute. A muted account still works — the person can browse,
 * join groups, RSVP and vote — they just can't create anything other
 * students see. The database (0041) is the enforcement; this is the
 * doorway.
 */
export async function setUserMutedAction(
  userId: string,
  muted: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_muted", {
    p_user: userId,
    p_muted: muted,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/people");
  return {};
}

/**
 * Pause / unpause. Pausing locks the account out entirely without
 * deleting anything, and unpausing puts it back exactly as it was.
 * Deliberately cannot un-suspend or un-ban — those are separate
 * decisions with their own copy.
 */
export async function setUserPausedAction(
  userId: string,
  paused: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_paused", {
    p_user: userId,
    p_paused: paused,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/admin/people");
  return {};
}
