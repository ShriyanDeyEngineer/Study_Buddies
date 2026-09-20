/**
 * One study group as a full-width row: name, the course(s) it's for,
 * members vs capacity, open/closed, and the smart join button.
 *
 * Shared by the course page (/courses/[courseId]) and the "Existing study
 * groups" list on /courses, so a group looks and behaves the same whether
 * you found it by browsing a course or by browsing groups.
 *
 * `omitCourseCode` drops one code from the course line: on a course's own
 * page, repeating that course on every row is noise — what's worth saying
 * there is which OTHER courses the group also covers.
 */
import Link from "next/link";
import { Users } from "lucide-react";
import { groupCourseCodes, type GroupWithCourses } from "@/lib/types";
import { getJoinState, type JoinState } from "@/lib/groups/join-state";
import { JoinButton } from "@/components/groups/join-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function GroupRow({
  group,
  state,
  omitCourseCode,
}: {
  group: GroupWithCourses;
  state: JoinState;
  omitCourseCode?: string;
}) {
  const codes = groupCourseCodes(group);
  const shown = omitCourseCode ? codes.filter((c) => c !== omitCourseCode) : codes;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/groups/${group.id}`}
            className="truncate font-display text-lg text-ink hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {group.name}
          </Link>
          {shown.length > 0 && (
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-primary">
              {omitCourseCode ? `Also for ${shown.join(", ")}` : shown.join(" · ")}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
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
  );
}

/** The join state for a group as seen by one viewer — the same three
 *  inputs every caller has to gather, in one place so they can't drift. */
export function viewerJoinState(
  group: GroupWithCourses,
  viewerId: string,
  myGroupIds: Set<string>,
  myPendingIds: Set<string>,
): JoinState {
  return getJoinState({
    groupStatus: group.status,
    mode: group.mode,
    memberCount: group.member_count,
    capacity: group.capacity,
    isManager: group.manager_id === viewerId,
    isMember: myGroupIds.has(group.id),
    hasPendingRequest: myPendingIds.has(group.id),
  });
}
