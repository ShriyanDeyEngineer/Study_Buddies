/**
 * Group settings (/groups/[id]/settings) — MANAGER ONLY (spec §5.9).
 *
 * Anyone else gets a 404 — not a 403 — via notFound(). A 403 would
 * confirm the page exists and dangle "if only I were manager"; a 404
 * reveals nothing. The database would refuse a non-manager's writes
 * anyway; this is the presentation half of that rule.
 */
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { courseCode, type CourseRow, type StudyGroupRow } from "@/lib/types";
import { SettingsForm } from "./settings-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Group settings" };

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) notFound();

  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const { data } = await supabase
    .from("study_groups")
    .select("*, courses(*)")
    .eq("id", groupId)
    .maybeSingle();
  const group = data as (StudyGroupRow & { courses: CourseRow }) | null;

  // Missing, disbanded, or simply not yours — all the same 404.
  if (!group || group.status !== "active" || group.manager_id !== profile.id) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">
        {courseCode(group.courses)}
      </p>
      <h1 className="font-display text-3xl text-ink">Group settings</h1>
      <p className="mt-1 mb-6 text-ink-muted">
        Manager tools for <span className="font-medium text-ink">{group.name}</span>.
      </p>
      <SettingsForm
        groupId={group.id}
        currentName={group.name}
        currentDescription={group.description}
        currentCapacity={group.capacity}
        currentMemberCount={group.member_count}
        currentMode={group.mode}
        pendingNote={group.mode === "closed"}
      />
    </div>
  );
}
