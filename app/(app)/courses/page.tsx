/**
 * Join & Create (/courses) — the page for finding a group and starting
 * one (spec §5.5).
 *
 * Two halves, in the order a student actually needs them:
 *   1. EXISTING STUDY GROUPS — every active group, searchable, with its
 *      join button. Groups used to be reachable only from inside a course
 *      page, so finding one meant already knowing which course to open.
 *   2. The course catalog, for browsing by course.
 *
 * Creating a group starts here too: it no longer requires opening a
 * course first, because a group can now be for SEVERAL courses (0043)
 * and there is no single course to start from.
 *
 * Search matches department code, number, or name; filters narrow by
 * department and (approximate) college. All state lives in the URL so a
 * filtered view survives refresh and can be shared.
 *
 * "Add a missing course" is deliberately prominent — including from the
 * empty search state, which is exactly the moment a student discovers
 * their course is missing.
 */
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { getActiveGroups, getCourseCatalog } from "@/lib/data/course-catalog";
import { courseCode, groupCourseCodes } from "@/lib/types";
import { collegeForDepartment } from "@/lib/courses";
import { COLLEGES } from "@/lib/constants";
import { pluralize } from "@/lib/utils";
import { GroupRow, viewerJoinState } from "@/components/groups/group-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AddCourseDialog } from "./add-course-dialog";

export const metadata = { title: "Join & Create" };

/** Groups shown before the list collapses behind "Show all". Enough to
 *  be useful at a glance without burying the catalog underneath it. */
const GROUPS_PREVIEW_COUNT = 6;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    dept?: string;
    college?: string;
    gq?: string;
    gmode?: string;
    groups?: string;
  }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const deptFilter = (params.dept ?? "").trim().toUpperCase();
  const collegeFilter = (params.college ?? "").trim().toLowerCase();
  const groupQuery = (params.gq ?? "").trim().toLowerCase();
  const groupMode = (params.gmode ?? "").trim().toLowerCase();
  const showAllGroups = params.groups === "all";

  const { profile, supabase } = await getSessionProfile();
  if (!profile) return null;

  // The whole catalog + group counts, cached — this data is identical for
  // every student (see lib/data/course-catalog.ts), so it's fetched once
  // and shared across requests/users instead of re-querying Postgres on
  // every single /courses visit. Search/department/college filtering
  // still happens here in code on the (cached) result.
  //
  // The group list is cached the same way; only MY membership and pending
  // requests are per-viewer, so only those two go to the request client.
  const [{ courses: allActiveCourses, groupRows }, activeGroups, membershipRes, requestsRes] =
    await Promise.all([
      getCourseCatalog(),
      getActiveGroups(),
      supabase.from("study_group_members").select("group_id").eq("user_id", profile.id),
      supabase
        .from("join_requests")
        .select("group_id")
        .eq("user_id", profile.id)
        .eq("status", "pending"),
    ]);

  const myGroupIds = new Set((membershipRes.data ?? []).map((m) => m.group_id as string));
  const myPendingIds = new Set((requestsRes.data ?? []).map((r) => r.group_id as string));

  // Searching groups matches the NAME or any of its course codes, so
  // "MATH 1271" finds the Calc group tagged with it even though the group
  // isn't named after the course.
  const matchedGroups = activeGroups.filter((group) => {
    if (groupMode && group.mode !== groupMode) return false;
    if (!groupQuery) return true;
    const haystack = `${group.name} ${groupCourseCodes(group).join(" ")}`.toLowerCase();
    return haystack.includes(groupQuery);
  });
  const visibleGroups = showAllGroups
    ? matchedGroups
    : matchedGroups.slice(0, GROUPS_PREVIEW_COUNT);

  const groupCounts = new Map<string, number>();
  const joinableGroupCounts = new Map<string, number>();

  for (const row of groupRows) {
    groupCounts.set(row.course_id, (groupCounts.get(row.course_id) ?? 0) + 1);
    if (row.mode === "open") {
      joinableGroupCounts.set(
        row.course_id,
        (joinableGroupCounts.get(row.course_id) ?? 0) + 1,
      );
    }
  }

  const courseGeneral = allActiveCourses.find((c) => c.department_code === "GENERAL") ?? null;
  const allCourses = allActiveCourses.filter((c) => c.department_code !== "GENERAL");
  const departments = [...new Set(allCourses.map((c) => c.department_code))].sort();

  const courseGeneralID = courseGeneral?.id;
  const courseGeneralDeptCode = courseGeneral?.department_code;
  const courseGeneralCourseNum = courseGeneral?.course_number;
  const courseGeneralName = courseGeneral?.course_name;
  let courseGeneralGroupCount;
  let courseGeneralJoinableGroupCount;

  if(typeof(courseGeneralID) == "string")
  {
    courseGeneralGroupCount = groupCounts.get(courseGeneralID) ?? 0;
    courseGeneralJoinableGroupCount = joinableGroupCounts.get(courseGeneralID) ?? 0;
  }

  const courses = allCourses.filter((course) => {
    if (deptFilter && course.department_code !== deptFilter) return false;
    if (collegeFilter && collegeForDepartment(course.department_code) !== collegeFilter)
      return false;
    if (query) {
      const haystack =
        `${course.department_code} ${course.course_number} ${course.course_name}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Join &amp; Create</h1>
          <p className="mt-1 text-ink-muted">
            Join a group that already exists, or start your own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AddCourseDialog />
          {/* No course id needed any more — the form asks which courses
              the group is for, and takes more than one. */}
          <Button asChild>
            <Link href="/groups/new">
              <Plus aria-hidden className="h-4 w-4" />
              Create a group
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Existing study groups ─────────────────────────────────────── */}
      <section aria-labelledby="existing-groups-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="existing-groups-heading"
            className="font-display text-xl text-ink"
          >
            Existing study groups
          </h2>
          <p className="text-sm text-ink-muted">
            {matchedGroups.length === 0
              ? "None yet"
              : `${pluralize(matchedGroups.length, "group")} you can join`}
          </p>
        </div>

        {/* Its own GET form so searching groups doesn't disturb the
            catalog filters below (and vice versa). */}
        <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <div className="relative">
            <Users
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            />
            <Input
              type="search"
              name="gq"
              defaultValue={params.gq ?? ""}
              placeholder="Search groups by name or course — try Calc or MATH 1271"
              aria-label="Search study groups"
              className="pl-9"
            />
          </div>
          <Select name="gmode" defaultValue={groupMode} aria-label="Filter groups by mode">
            <option value="">Any group</option>
            <option value="open">Open only</option>
            <option value="closed">Closed only</option>
          </Select>
          <Button type="submit" variant="secondary">
            Search groups
          </Button>
          {showAllGroups && <input type="hidden" name="groups" value="all" />}
        </form>

        {matchedGroups.length === 0 ? (
          <EmptyState
            title={groupQuery || groupMode ? "No groups match" : "No study groups yet"}
            description={
              groupQuery || groupMode
                ? "Try a shorter search, or start the group yourself."
                : "Be the first — create a group and tag every course it covers."
            }
            action={
              <Button asChild>
                <Link href="/groups/new">Create a group</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2">
              {visibleGroups.map((group) => (
                <li key={group.id}>
                  <GroupRow
                    group={group}
                    state={viewerJoinState(group, profile.id, myGroupIds, myPendingIds)}
                  />
                </li>
              ))}
            </ul>
            {!showAllGroups && matchedGroups.length > visibleGroups.length && (
              <p className="mt-3 text-center">
                <Link
                  href={{
                    pathname: "/courses",
                    query: {
                      ...(params.gq ? { gq: params.gq } : {}),
                      ...(groupMode ? { gmode: groupMode } : {}),
                      groups: "all",
                    },
                  }}
                  className="text-sm font-medium text-primary underline underline-offset-2"
                >
                  Show all {matchedGroups.length} groups
                </Link>
              </p>
            )}
          </>
        )}
      </section>

      <h2 className="mb-3 font-display text-xl text-ink">Browse by course</h2>

      {/* GET form → filters live in the URL. */}
      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-[1fr_10rem_14rem_auto]">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          />
          <Input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search by code, number, or name — try CSCI or 1301"
            aria-label="Search courses"
            className="pl-9"
          />
        </div>
        <Select name="dept" defaultValue={deptFilter} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </Select>
        <Select name="college" defaultValue={collegeFilter} aria-label="Filter by college">
          <option value="">All colleges</option>
          {COLLEGES.filter((c) => c.value !== "other").map((college) => (
            <option key={college.value} value={college.value}>
              {college.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Apply Selected Search Filters
        </Button>
      </form>
      
      {/** Create an element that sits above the rest of the course catalog to hold the general "course" which is not part of the courses list that can be filtered */}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <li key={courseGeneralID}>
            <Link href={`/courses/${courseGeneralID}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
              <span className="min-w-0">
                <span className="font-bold text-ink text-l">{courseGeneralDeptCode + " " + courseGeneralCourseNum}</span>
                <span className="ml-2 truncate text-sm text-ink-muted">
                    {courseGeneralName}
                </span>
              </span>
              {typeof courseGeneralGroupCount === "number" &&
              typeof courseGeneralJoinableGroupCount === "number" && (
              <span
                className={
                  courseGeneralGroupCount > 0
                    ? "shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-primary"
                    : "shrink-0 text-xs text-ink-muted"
                }
              >
                {courseGeneralGroupCount > 0
                  ? pluralize(courseGeneralGroupCount, "Group") + " || " + courseGeneralJoinableGroupCount + " Joinable"
                  : "No groups yet"}
              </span>
            )}
            </Link>
          </li>
      </ul>

      <br></br>
        
      {courses.length === 0 ? (
        <EmptyState
          title="No courses match"
          description="Try a shorter search, or add the course if it isn't in the catalog yet."
          action={<AddCourseDialog triggerLabel="Add a missing course" />}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {courses.map((course) => {
            const groupCount = groupCounts.get(course.id) ?? 0;
            const joinableGroupCount = joinableGroupCounts.get(course.id) ?? 0;
            return (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{courseCode(course)}</span>
                    <span className="ml-2 truncate text-sm text-ink-muted">
                      {course.course_name}
                    </span>
                  </span>
                  <span
                    className={
                      groupCount > 0
                        ? "shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-primary"
                        : "shrink-0 text-xs text-ink-muted"
                    }
                  >
                    {groupCount > 0 ? pluralize(groupCount, "Group") + " || " + joinableGroupCount + " Joinable" : "No groups yet"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
