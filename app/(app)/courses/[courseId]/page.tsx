/**
 * Course detail page (/courses/[courseId]) — every active study group for
 * the course, each with the smart join button, plus the prominent
 * "Create a group for this course" action (spec §5.5).
 *
 * The join button's state is computed here on the server (membership +
 * pending request + capacity), so what you see is always true at render
 * time — the state machine itself is the unit-tested pure function.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { getCourseWithGroups } from "@/lib/data/course-catalog";
import { courseCode } from "@/lib/types";
import { getJoinState } from "@/lib/groups/join-state";
import { JoinButton } from "@/components/groups/join-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ existing?: string; mode?: string}>;
}) {
  const { courseId } = await params;
  const searchParameters = await searchParams;
  const existing = searchParameters.existing;

  const mode = (searchParameters.mode?? "").trim().toLowerCase();
  
  // Validate before it ever reaches a query filter (spec pitfall #5).
  if (!UUID_RE.test(courseId)) notFound();

  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;
  
  // Course + its active groups are identical for every viewer, so they're
  // cached (lib/data/course-catalog.ts) instead of re-querying Postgres on
  // every visit; only the caller's OWN membership/pending-request state
  // is genuinely per-user and stays on the normal request-scoped client.
  const [{ course, groups }, membershipRes, requestsRes] = await Promise.all([
    getCourseWithGroups(courseId),
    supabase.from("study_group_members").select("group_id").eq("user_id", profile.id),
    supabase
      .from("join_requests")
      .select("group_id")
      .eq("user_id", profile.id)
      .eq("status", "pending"),
  ]);

  if (!course) notFound();

  const myGroupIds = new Set((membershipRes.data ?? []).map((m) => m.group_id as string));
  const myPendingIds = new Set((requestsRes.data ?? []).map((r) => r.group_id as string));


  const filteredGroups = groups.filter(group => group.mode === mode || mode.length === 0 ? true : false);
  
  
  return (
    <div>
      {existing && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-accent-light/60 px-4 py-2.5 text-sm text-primary"
        >
          Good news — that course was already in the catalog. Here it is.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            {courseCode(course)}
          </p>
          <h1 className="break-words font-display text-3xl text-ink">{course.course_name}</h1>
        </div>
        <Button asChild>
          <Link href={`/groups/new?course=${course.id}`}>
            <Plus aria-hidden className="h-4 w-4" />
            Create a group for this course
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No study groups here yet"
          description="Create the first group for this course so your classmates have one to join."
          action={
            <Button asChild>
              <Link href={`/groups/new?course=${course.id}`}>Create the first group</Link>
            </Button>
          }
        />
      ) : (
        <div>


          <form method="get" className="mb-6 grid gap-3 sm:grid-cols-[1fr_10rem_14rem_auto]">
            <Select name="mode" defaultValue={mode} aria-label="Filter by mode">
              <option value="">All Groups</option>
              <option value="open">Open Groups</option>
              <option value="closed">Closed Groups</option>
            </Select>
            <Button type="submit" variant="secondary" className="whitespace-normal break-words">
              Apply Selected Search Filters
            </Button>
          </form>


          {filteredGroups.length === 0 ? (
                  <EmptyState
                    title="No groups match"
                    description="Try applying a different search filter or create your own study group."
                  />
          ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {filteredGroups.map((group) => {
              const state = getJoinState({
                groupStatus: group.status,
                mode: group.mode,
                memberCount: group.member_count,
                capacity: group.capacity,
                isManager: group.manager_id === profile.id,
                isMember: myGroupIds.has(group.id),
                hasPendingRequest: myPendingIds.has(group.id),
              });
              return (
                <li key={group.id}>
                  
                    <Card>
                      <CardContent className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={`/groups/${group.id}`} className="truncate font-display text-lg text-ink hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                            {group.name}
                          </Link>
                          <div className="mt-1.5 flex items-center gap-3 text-sm text-ink-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <Users aria-hidden className="h-4 w-4" />
                              {group.member_count}/{group.capacity}
                            </span>
                            <Badge variant={group.mode === "open" ? "success" : "warning"}>
                              {group.mode === "open" ? "Open — join instantly" : "Closed — request to join"}
                            </Badge>
                          </div>
                        </div>
                        <JoinButton groupId={group.id} state={state} />
                      </CardContent>
                    </Card>
                </li>
              );
            })}
          </ul>
          )}
        </div>
      )}
    </div>
  );
}
