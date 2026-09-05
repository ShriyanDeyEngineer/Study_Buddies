/**
 * Course catalog (/courses) — searchable and filterable list of every
 * course, each with its live count of active study groups (spec §5.5).
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
import { Search } from "lucide-react";
import { getCourseCatalog } from "@/lib/data/course-catalog";
import { courseCode } from "@/lib/types";
import { collegeForDepartment } from "@/lib/courses";
import { COLLEGES } from "@/lib/constants";
import { pluralize } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AddCourseDialog } from "./add-course-dialog";

export const metadata = { title: "Courses" };

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; college?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const deptFilter = (params.dept ?? "").trim().toUpperCase();
  const collegeFilter = (params.college ?? "").trim().toLowerCase();

  // The whole catalog + group counts, cached — this data is identical for
  // every student (see lib/data/course-catalog.ts), so it's fetched once
  // and shared across requests/users instead of re-querying Postgres on
  // every single /courses visit. Search/department/college filtering
  // still happens here in code on the (cached) result.
  const { courses: allActiveCourses, groupRows } = await getCourseCatalog();

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
          <h1 className="font-display text-3xl text-ink">Courses</h1>
          <p className="mt-1 text-ink-muted">
            Find your course, then find your people.
          </p>
        </div>
        <AddCourseDialog />
      </div>

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
