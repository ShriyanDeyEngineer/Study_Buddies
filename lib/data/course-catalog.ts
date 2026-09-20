/**
 * Cached reads for data that's IDENTICAL for every signed-in student —
 * the course catalog, and each course's list of active study groups.
 * Neither `courses` nor `study_groups` SELECT policies filter by caller
 * identity (`using (true)` for any authenticated user — migrations
 * 0002/0004: "Any signed-in student can browse the whole catalog" /
 * "Groups are previewable by any signed-in student"), so unlike almost
 * everything else in this app, this data has nothing per-user to merge
 * in — it's safe to fetch once and share across every viewer.
 *
 * Every page under app/(app) reads cookies() (auth), which forces that
 * whole route to render dynamically on every request — so this can't be
 * ISR at the route level. What unstable_cache buys instead: the
 * EXPENSIVE PART (the actual Postgres round trips) gets reused across
 * requests/users up to the revalidate window, even though the page
 * around it still re-renders every time. That's why this uses the
 * ADMIN client (lib/supabase/admin.ts) rather than the normal per-
 * request client — a cookie-bound client can't be called from inside
 * unstable_cache at all (Next.js forbids reading cookies() in a cached
 * function), and this data was never filtered by the caller's identity
 * in the first place, so bypassing RLS here doesn't expose anything an
 * ordinary authenticated read wouldn't already return.
 *
 * Freshness: revalidated every 60s as a self-healing floor, PLUS
 * revalidateTag(COURSE_CATALOG_TAG) is called on-demand from every
 * action that actually changes this data (course approval, group
 * create/disband/settings — see lib/actions/groups.ts and
 * lib/actions/course-requests.ts) for near-instant updates on the
 * common paths. If some future write path forgets to invalidate, the
 * 60s window is the backstop, not a single point of failure.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GROUP_WITH_COURSES_SELECT,
  type CourseRow,
  type GroupWithCourses,
} from "@/lib/types";

export const COURSE_CATALOG_TAG = "course-catalog";

/** How many groups the "Existing study groups" list on /courses holds. */
export const EXISTING_GROUPS_LIMIT = 200;

interface GroupCountRow {
  course_id: string;
  mode: "open" | "closed";
}

/**
 * Every active course, plus one (course_id, mode) row per (group, COURSE)
 * pair for every active study group — callers derive per-course counts
 * from the latter (courses/page.tsx counts groups AND open-groups in one
 * pass over it).
 *
 * Since 0043 the rows come from study_group_courses rather than from
 * study_groups.course_id, so a group tagged with both MATH 1271 and MATH
 * 1371 is counted under BOTH — which is the point: a student browsing
 * either course should see that the group exists.
 */
export const getCourseCatalog = unstable_cache(
  async (): Promise<{ courses: CourseRow[]; groupRows: GroupCountRow[] }> => {
    const supabase = createAdminClient();
    const [coursesRes, groupsRes] = await Promise.all([
      supabase
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .order("department_code")
        .order("course_number"),
      supabase
        .from("study_group_courses")
        .select("course_id, study_groups!inner(mode, status)")
        .eq("study_groups.status", "active"),
    ]);

    const groupRows = ((groupsRes.data ?? []) as unknown as {
      course_id: string;
      study_groups: { mode: "open" | "closed" } | null;
    }[])
      .filter((row) => row.study_groups !== null)
      .map((row) => ({ course_id: row.course_id, mode: row.study_groups!.mode }));

    return { courses: (coursesRes.data ?? []) as CourseRow[], groupRows };
  },
  ["course-catalog"],
  { tags: [COURSE_CATALOG_TAG], revalidate: 60 },
);

/** One course plus its active study groups — the shared half of
 *  /courses/[courseId]; membership/pending-request state is per-viewer
 *  and stays on the normal request-scoped client in the page itself.
 *
 *  Two round trips rather than one filtered join: filtering an EMBEDDED
 *  resource in PostgREST also trims what comes back inside it, so asking
 *  for "groups where study_group_courses.course_id = X" would hand back
 *  each group carrying only that one course — and the page would lose
 *  the "also MATH 1371" line that's the whole feature. Ask which groups
 *  first, then fetch those groups with their FULL course list. */
export const getCourseWithGroups = unstable_cache(
  async (courseId: string): Promise<{ course: CourseRow | null; groups: GroupWithCourses[] }> => {
    const supabase = createAdminClient();
    const [courseRes, linkRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("study_group_courses").select("group_id").eq("course_id", courseId),
    ]);

    const groupIds = ((linkRes.data ?? []) as { group_id: string }[]).map((r) => r.group_id);
    const groupsRes = groupIds.length
      ? await supabase
          .from("study_groups")
          .select(GROUP_WITH_COURSES_SELECT)
          .in("id", groupIds)
          .eq("status", "active")
          .order("created_at", { ascending: true })
      : { data: [] };

    return {
      course: (courseRes.data ?? null) as CourseRow | null,
      groups: (groupsRes.data ?? []) as unknown as GroupWithCourses[],
    };
  },
  ["course-with-groups"],
  { tags: [COURSE_CATALOG_TAG], revalidate: 60 },
);

/**
 * Every active group in the app, most recently active first — the
 * "Existing study groups" list on /courses, which exists so finding a
 * group doesn't mean scrolling the whole catalog course by course.
 *
 * Cached for the same reason as the catalog above: group name, courses,
 * capacity and mode are identical for every viewer (study_groups is
 * `using (true)` for any signed-in student), so only the caller's own
 * membership state has to be fetched per request.
 */
export const getActiveGroups = unstable_cache(
  async (): Promise<GroupWithCourses[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("study_groups")
      .select(GROUP_WITH_COURSES_SELECT)
      .eq("status", "active")
      .order("last_activity_at", { ascending: false })
      .limit(EXISTING_GROUPS_LIMIT);
    return (data ?? []) as unknown as GroupWithCourses[];
  },
  ["active-groups"],
  { tags: [COURSE_CATALOG_TAG], revalidate: 60 },
);
