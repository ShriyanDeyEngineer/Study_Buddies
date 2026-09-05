/**
 * The dashboard (/dashboard) — the signed-in home. Five sections, per
 * spec §5.4:
 *   1. My study groups (cards, or an empty state that fixes it)
 *   2. Your courses, each with its count of available groups
 *   3. Explore: most-active courses + link to the catalog
 *   4. People search box (min 2 chars — goes to /people)
 *   5. Suggested people (max 10, course-sharers ranked before
 *      grad-year-sharers — the ranking lives in the database function)
 */
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { courseCode, type CourseRow, type MeetupRow, type StudyGroupRow } from "@/lib/types";
import { GroupCard } from "@/components/groups/group-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from "@/lib/constants";
import { pluralize } from "@/lib/utils";

/** Row shapes for this page's joined queries (see lib/types.ts for why
 *  results are cast). */
type GroupWithCourse = StudyGroupRow & { courses: CourseRow };
type SuggestedPerson = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  college: string | null;
  major: string | null;
  shared_courses: number;
  same_grad_year: boolean;
};

export default async function DashboardPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null; // layout already handled every broken state

  // My memberships → groups (+course), my current courses, and catalog
  // activity — fetched in parallel; nothing here depends on anything else.
  const [membershipsRes, myCoursesRes, activeGroupsRes, suggestedRes] =
    await Promise.all([
      supabase.from("study_group_members").select("group_id").eq("user_id", profile.id),
      supabase
        .from("user_courses")
        .select("course_id, courses(*)")
        .eq("user_id", profile.id)
        .eq("enrollment_type", "current"),
      supabase.from("study_groups").select("id, course_id, courses(*)").eq("status", "active"),
      supabase.rpc("suggested_people"),
    ]);

  const myGroupIds = (membershipsRes.data ?? []).map((m) => m.group_id as string);

  let myGroups: GroupWithCourse[] = [];
  let upcomingByGroup = new Map<string, MeetupRow>();
  if (myGroupIds.length > 0) {
    const [groupsRes, meetupsRes] = await Promise.all([
      supabase
        .from("study_groups")
        .select("*, courses(*)")
        .in("id", myGroupIds)
        .eq("status", "active")
        .order("last_activity_at", { ascending: false }),
      supabase
        .from("meetups")
        .select("*")
        .in("group_id", myGroupIds)
        .eq("is_cancelled", false)
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true }),
    ]);
    myGroups = (groupsRes.data ?? []) as GroupWithCourse[];
    // First upcoming meetup per group (list is already time-ordered).
    upcomingByGroup = new Map();
    for (const meetup of (meetupsRes.data ?? []) as MeetupRow[]) {
      if (!upcomingByGroup.has(meetup.group_id)) {
        upcomingByGroup.set(meetup.group_id, meetup);
      }
    }
  }

  const myCourses = (myCoursesRes.data ?? []) as unknown as {
    course_id: string;
    courses: CourseRow;
  }[];

  // Active-group counts per course, shared by sections 2 and 3.
  const activeGroups = (activeGroupsRes.data ?? []) as unknown as {
    id: string;
    course_id: string;
    courses: CourseRow;
  }[];
  const groupCountByCourse = new Map<string, { course: CourseRow; count: number }>();
  for (const row of activeGroups) {
    const entry = groupCountByCourse.get(row.course_id);
    if (entry) entry.count += 1;
    else groupCountByCourse.set(row.course_id, { course: row.courses, count: 1 });
  }
  const mostActiveCourses = [...groupCountByCourse.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const suggested = (suggestedRes.data ?? []) as SuggestedPerson[];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="break-words font-display text-3xl text-ink">
          Hello, {profile.display_name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-ink-muted">Here&rsquo;s what&rsquo;s happening with your studies.</p>
      </div>

      {/* ── 1. My study groups ─────────────────────────────────────────── */}
      <section aria-labelledby="my-groups-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="my-groups-heading" className="font-display text-xl text-ink">
            My study groups
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/courses">Find a group</Link>
          </Button>
        </div>
        {myGroups.length === 0 ? (
          <EmptyState
            title="You're not in any groups yet"
            description="Pick one of your courses and join an open group or start your own and let classmates come to you!"
            action={
              <Button asChild>
                <Link href="/courses">Browse courses</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.map((group) => {
              const meetup = upcomingByGroup.get(group.id);
              return (
                <div key={group.id} className="relative">
                  <GroupCard
                    groupId={group.id}
                    name={group.name}
                    courseLabel={courseCode(group.courses)}
                    memberCount={group.member_count}
                    capacity={group.capacity}
                    mode={group.mode}
                    status={group.status}
                    nextMeetup={
                      meetup
                        ? { title: meetup.title, scheduledAt: meetup.scheduled_at }
                        : null
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2. Your courses ────────────────────────────────────────────── */}
      <section aria-labelledby="my-courses-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="my-courses-heading" className="font-display text-xl text-ink">
            Your courses
          </h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/settings/courses">Manage courses</Link>
          </Button>
        </div>
        {myCourses.length === 0 ? (
          <EmptyState
            title="No courses on your profile yet"
            description="Add what you're taking this term so we can match you with classmates and groups."
            action={
              <Button asChild>
                <Link href="/settings/courses">Add your courses</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myCourses.map(({ course_id, courses: course }) => {
              const availableGroups = groupCountByCourse.get(course_id)?.count ?? 0;
              return (
                <li key={course_id}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{courseCode(course)}</p>
                        <p className="truncate text-sm text-ink-muted">{course.course_name}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {availableGroups === 0
                            ? "No groups yet — start the first!"
                            : pluralize(availableGroups, "group")}
                        </p>
                      </div>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/courses/${course_id}`}>Find a group</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── 3. Explore courses ─────────────────────────────────────────── */}
      <section aria-labelledby="explore-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="explore-heading" className="font-display text-xl text-ink">
            Add your Courses
          </h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/courses">Full catalog</Link>
          </Button>
        </div>
        {mostActiveCourses.length === 0 ? (
          <EmptyState
            title="No study groups yet"
            description="Create the first group for one of your courses and your classmates will find it."
            action={
              <Button asChild>
                <Link href="/courses">Create the first group</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mostActiveCourses.map(({ course, count }) => (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{courseCode(course)}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {course.course_name}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-primary">
                    {pluralize(count, "group")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 4 + 5. Find people ─────────────────────────────────────────── */}
      <section aria-label="Find people">
        <div className="mb-4 flex items-center justify-center">
          <Button asChild variant="secondary" size="sm">
            <Link href="/people">Find & Connect with other Students</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
