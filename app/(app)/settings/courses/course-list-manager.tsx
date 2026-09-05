/**
 * The three course lists (current / taken / future) with a search-and-add
 * box per list. Each check/uncheck saves immediately.
 * The same course may sit on two lists (retakes happen) — the database
 * allows it deliberately, one row per (course, list).
 *
 * Chips appear and disappear OPTIMISTICALLY. Previously every click ran
 * inside a transition that disabled every control and waited on a full
 * page refresh, so adding three courses meant three visible stalls.
 * `edits` overlays the server list until fresh props arrive.
 */
"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { setCourseEnrollmentAction } from "@/lib/actions/profile";
import { courseCode, type CourseRow } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ListKey = "current" | "taken" | "future";

/** One overlay entry per (course, list) this tab has changed. */
const editKey = (courseId: string, list: ListKey) => `${list}:${courseId}`;

const LISTS = [
  { key: "current", title: "Taking now", empty: "Add the classes you're in this term." },
  { key: "taken", title: "Already taken", empty: "Add classes you've finished — they show on your profile." },
  { key: "future", title: "Planning to take", empty: "Add classes you're eyeing for later." },
] as const;

export function CourseListManager({
  courses,
  enrollments,
}: {
  courses: CourseRow[];
  enrollments: { course_id: string; enrollment_type: ListKey }[];
}) {
  // Each list keeps its own search box — one shared box carried your
  // typing (and its results) across tabs, which read as a glitch.
  const [queries, setQueries] = React.useState<Record<ListKey, string>>({
    current: "",
    taken: "",
    future: "",
  });
  /** editKey → enrolled?, for changes not yet reflected in the props. */
  const [edits, setEdits] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => setEdits({}), [enrollments]);

  const coursesById = new Map(courses.map((c) => [c.id, c]));

  function isEnrolled(courseId: string, list: ListKey): boolean {
    const key = editKey(courseId, list);
    if (key in edits) return edits[key];
    return enrollments.some(
      (e) => e.course_id === courseId && e.enrollment_type === list,
    );
  }

  /** Server rows for a list, plus/minus this tab's un-reconciled edits. */
  function courseIdsFor(list: ListKey): string[] {
    const ids = enrollments
      .filter((e) => e.enrollment_type === list)
      .map((e) => e.course_id);
    const set = new Set(ids);
    for (const [key, enrolled] of Object.entries(edits)) {
      const [editList, courseId] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
      if (editList !== list) continue;
      if (enrolled) set.add(courseId);
      else set.delete(courseId);
    }
    // Keep the server's order, then append anything added just now.
    return [...ids.filter((id) => set.has(id)), ...[...set].filter((id) => !ids.includes(id))];
  }

  async function setEnrollment(courseId: string, list: ListKey, enrolled: boolean) {
    const key = editKey(courseId, list);
    setEdits((current) => ({ ...current, [key]: enrolled }));
    const { error } = await setCourseEnrollmentAction(courseId, list, enrolled);
    if (error) {
      setEdits((current) => ({ ...current, [key]: !enrolled }));
      toast.error(error);
    }
  }

  function matchesFor(list: ListKey): CourseRow[] {
    const q = queries[list].trim().toLowerCase();
    if (!q) return [];
    return courses
      .filter(
        (course) =>
          courseCode(course).toLowerCase().includes(q) ||
          course.course_name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }

  return (
    <Tabs defaultValue="current">
      <TabsList>
        {LISTS.map((list) => (
          <TabsTrigger key={list.key} value={list.key}>
            {list.title} ({courseIdsFor(list.key).length})
          </TabsTrigger>
        ))}
      </TabsList>

      {LISTS.map((list) => {
        const listCourseIds = courseIdsFor(list.key);
        const matches = matchesFor(list.key);
        return (
          <TabsContent key={list.key} value={list.key}>
            <Card>
              <CardContent>
                {/* Add box */}
                <div className="relative mb-3">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  />
                  <Input
                    type="search"
                    value={queries[list.key]}
                    onChange={(e) =>
                      setQueries((q) => ({ ...q, [list.key]: e.target.value }))
                    }
                    placeholder="Search the catalog to add…"
                    aria-label={`Add a course to "${list.title}"`}
                    className="pl-9"
                  />
                </div>
                {matches.length > 0 && (
                  <ul className="mb-4 overflow-hidden rounded-xl border border-line">
                    {matches.map((course) => {
                      const already = isEnrolled(course.id, list.key);
                      return (
                        <li key={course.id}>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() => {
                              void setEnrollment(course.id, list.key, true);
                              setQueries((q) => ({ ...q, [list.key]: "" }));
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-cream disabled:opacity-50"
                          >
                            <span>
                              <span className="font-medium text-ink">{courseCode(course)}</span>{" "}
                              <span className="text-ink-muted">{course.course_name}</span>
                            </span>
                            <span className="text-xs text-primary">
                              {already ? "Added" : "+ Add"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Current list contents */}
                {listCourseIds.length === 0 ? (
                  <p className="py-4 text-center text-sm text-ink-muted">{list.empty}</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {listCourseIds.map((courseId) => {
                      const course = coursesById.get(courseId);
                      if (!course) return null;
                      return (
                        <li
                          key={courseId}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-3 py-1.5 text-sm text-ink"
                        >
                          <span title={course.course_name}>{courseCode(course)}</span>
                          <button
                            type="button"
                            onClick={() => void setEnrollment(course.id, list.key, false)}
                            aria-label={`Remove ${courseCode(course)} from "${list.title}"`}
                            className="rounded-full p-2 text-ink-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <X aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
