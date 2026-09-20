/**
 * The group creation form (spec §5.6): the course(s) the group is for,
 * name, capacity (2–50, default 8), open/closed with the difference
 * explained, and the invite picker limited to capacity − 1 classmates.
 *
 * COURSES ARE A LIST, NOT A FIELD (0043). UMN teaches the same material
 * under different numbers — CSE calculus (MATH 1371) and CLA calculus
 * (MATH 1271) — and one group should be able to cover both. At least one
 * course is required; the FIRST one picked becomes the group's primary.
 *
 * Because the courses drive who can be invited, the invite list is
 * refetched from the server whenever the selection changes: invitees must
 * be currently enrolled in at least one tagged course, and the database
 * re-checks that on submit regardless of what this form sent.
 *
 * With variant="custom" it renders the "my course isn't listed" form that
 * collects department/number/name instead (§5.6's custom-course
 * allowance). Every validation error is per-field and inline.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { Search, X } from "lucide-react";
import {
  classmatesForCoursesAction,
  createGroupAction,
  createGroupWithCourseAction,
} from "@/lib/actions/groups";
import { submitWithoutReset } from "@/lib/forms";
import {
  GROUP_CAPACITY_DEFAULT,
  GROUP_CAPACITY_MAX,
  GROUP_CAPACITY_MIN,
  GROUP_COURSES_MAX,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
} from "@/lib/constants";
import { courseCode, type CourseRow, type PublicProfile } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddCourseDialog } from "../../courses/add-course-dialog";

export function CreateGroupForm({
  variant = "catalog",
  courses,
  initialCourseIds = [],
  initialClassmates = [],
}: {
  /** "custom" = the course isn't in the catalog yet. */
  variant?: "catalog" | "custom";
  /** The catalog to pick from. Empty for the custom variant. */
  courses?: CourseRow[];
  /** Pre-tagged courses — set when arriving from a course page. */
  initialCourseIds?: string[];
  initialClassmates?: PublicProfile[];
}) {
  const isCustom = variant === "custom";

  // Two actions, one form component: which action runs depends on the
  // variant, so the right database path gets the right validation.
  const [state, formAction, pending] = useActionState(
    isCustom ? createGroupWithCourseAction : createGroupAction,
    {},
  );
  const [capacity, setCapacity] = React.useState(GROUP_CAPACITY_DEFAULT);
  const [selectedInvitees, setSelectedInvitees] = React.useState<Set<string>>(new Set());

  // Order matters: the first course picked becomes the group's PRIMARY
  // course, so this is an array, not a Set.
  const [courseIds, setCourseIds] = React.useState<string[]>(initialCourseIds);
  const [courseQuery, setCourseQuery] = React.useState("");
  const [classmates, setClassmates] = React.useState<PublicProfile[]>(initialClassmates);

  const catalog = React.useMemo(() => courses ?? [], [courses]);
  const coursesById = React.useMemo(
    () => new Map(catalog.map((c) => [c.id, c])),
    [catalog],
  );

  const maxInvites = Math.max(0, capacity - 1);
  const overInvited = selectedInvitees.size > maxInvites;
  const atCourseLimit = courseIds.length >= GROUP_COURSES_MAX;

  // Whoever can be invited depends on the tagged courses, so the list is
  // refetched when they change. The `cancelled` flag drops the response
  // of a request that a newer selection has already superseded.
  React.useEffect(() => {
    if (isCustom) return;
    if (courseIds.length === 0) {
      setClassmates([]);
      return;
    }
    let cancelled = false;
    void classmatesForCoursesAction(courseIds).then(({ classmates: next }) => {
      if (cancelled) return;
      setClassmates(next);
      // Someone who was checked may no longer be a classmate of any
      // tagged course — drop them rather than submit an invite the
      // database would reject.
      const validIds = new Set(next.map((p) => p.id));
      setSelectedInvitees((current) => {
        const kept = new Set([...current].filter((id) => validIds.has(id)));
        return kept.size === current.size ? current : kept;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [courseIds, isCustom]);

  const courseMatches = React.useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (course) =>
          !courseIds.includes(course.id) &&
          (courseCode(course).toLowerCase().includes(q) ||
            course.course_name.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [catalog, courseQuery, courseIds]);

  function addCourse(id: string) {
    setCourseIds((current) =>
      current.includes(id) || current.length >= GROUP_COURSES_MAX ? current : [...current, id],
    );
    setCourseQuery("");
  }

  function removeCourse(id: string) {
    setCourseIds((current) => current.filter((c) => c !== id));
  }

  function toggleInvitee(id: string, checked: boolean) {
    setSelectedInvitees((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl text-ink">Create a study group</h1>
      <p className="mt-1 mb-6 text-ink-muted">
        {isCustom
          ? "For a course that isn't in our catalog yet — tell us which one."
          : "Tag every course this group is for — equivalent classes can share one group."}
      </p>

      <Card>
        <CardContent>
          <form onSubmit={submitWithoutReset(formAction)} noValidate className="space-y-5">
            {isCustom ? (
              <div className="space-y-4 rounded-xl border border-line bg-cream/60 p-4">
                <p className="text-sm font-medium text-ink">The course</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="department_code">Department (required)</Label>
                    <Input
                      className="placeholder:opacity-50"
                      id="department_code"
                      name="department_code"
                      placeholder="EE"
                      required
                      aria-invalid={!!state.fieldErrors?.department_code}
                      aria-describedby="department_code-error"
                    />
                    <FieldError
                      id="department_code-error"
                      error={state.fieldErrors?.department_code}
                    />
                  </div>
                  <div>
                    <Label htmlFor="course_number">Course number (required)</Label>
                    <Input
                      className="placeholder:opacity-50"
                      id="course_number"
                      name="course_number"
                      placeholder="2301"
                      required
                      aria-invalid={!!state.fieldErrors?.course_number}
                      aria-describedby="course_number-error"
                    />
                    <FieldError
                      id="course_number-error"
                      error={state.fieldErrors?.course_number}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="course_name">Course name (required)</Label>
                  <Input
                    className="placeholder:opacity-50"
                    id="course_name"
                    name="course_name"
                    placeholder="Introduction to Digital System Design"
                    required
                    aria-invalid={!!state.fieldErrors?.course_name}
                    aria-describedby="course_name-error"
                  />
                  <FieldError id="course_name-error" error={state.fieldErrors?.course_name} />
                </div>
              </div>
            ) : (
              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-ink">
                  Which classes is this group for? (at least one)
                </legend>
                <p className="mb-2 text-xs text-ink-muted">
                  Tag every course it covers — CSE and CLA versions of the same
                  class can share one group. Up to {GROUP_COURSES_MAX}.
                </p>

                {/* Each tagged course rides along as a hidden input, so the
                    form submits with no JavaScript bookkeeping on the server. */}
                {courseIds.map((id) => (
                  <input key={id} type="hidden" name="course_ids" value={id} />
                ))}

                <div className="relative mb-3">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  />
                  <Input
                    type="search"
                    value={courseQuery}
                    onChange={(e) => setCourseQuery(e.target.value)}
                    disabled={atCourseLimit}
                    placeholder={
                      atCourseLimit
                        ? `That's the ${GROUP_COURSES_MAX}-course maximum`
                        : "Search the catalog — try MATH 1271 or Calculus"
                    }
                    aria-label="Search for a course to tag"
                    aria-invalid={!!state.fieldErrors?.course_ids}
                    aria-describedby="course_ids-error"
                    className="pl-9"
                  />
                </div>

                {courseMatches.length > 0 && (
                  <ul className="mb-3 overflow-hidden rounded-xl border border-line">
                    {courseMatches.map((course) => (
                      <li key={course.id}>
                        <button
                          type="button"
                          onClick={() => addCourse(course.id)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-cream"
                        >
                          <span>
                            <span className="font-medium text-ink">{courseCode(course)}</span>{" "}
                            <span className="text-ink-muted">{course.course_name}</span>
                          </span>
                          <span className="text-xs text-primary">+ Add</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {courseIds.length === 0 ? (
                  <p className="rounded-xl bg-cream px-3 py-2 text-sm text-ink-muted">
                    No courses tagged yet — search above to add the first one.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {courseIds.map((id, index) => {
                      const course = coursesById.get(id);
                      if (!course) return null;
                      return (
                        <li
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-3 py-1.5 text-sm text-ink"
                        >
                          <span title={course.course_name}>{courseCode(course)}</span>
                          {index === 0 && courseIds.length > 1 && (
                            <span className="text-xs text-ink-muted">(main)</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeCourse(id)}
                            aria-label={`Remove ${courseCode(course)}`}
                            className="rounded-full p-2 text-ink-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <X aria-hidden className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <FieldError id="course_ids-error" error={state.fieldErrors?.course_ids} />
              </fieldset>
            )}

            <div>
              <Label htmlFor="name">Group name (required)</Label>
              <Input
                className="placeholder:opacity-50"
                id="name"
                name="name"
                maxLength={GROUP_NAME_MAX}
                placeholder="Homework Grinders"
                required
                aria-invalid={!!state.fieldErrors?.name}
                aria-describedby="name-error"
              />
              <FieldError id="name-error" error={state.fieldErrors?.name} />
            </div>

            <div>
              <Label htmlFor="description">Group description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                maxLength={GROUP_DESCRIPTION_MAX}
                placeholder="What this group is about, when you usually meet, what to bring…"
                aria-invalid={!!state.fieldErrors?.description}
                aria-describedby="description-help description-error"
              />
              <p id="description-help" className="mt-1 text-xs text-ink-muted">
                Up to {GROUP_DESCRIPTION_MAX} characters. Shows on the group&rsquo;s page.
              </p>
              <FieldError id="description-error" error={state.fieldErrors?.description} />
            </div>

            <div>
              <Label htmlFor="capacity">Size limit</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={GROUP_CAPACITY_MIN}
                max={GROUP_CAPACITY_MAX}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                aria-invalid={!!state.fieldErrors?.capacity}
                aria-describedby="capacity-help capacity-error"
              />
              <p id="capacity-help" className="mt-1 text-xs text-ink-muted">
                Between {GROUP_CAPACITY_MIN} and {GROUP_CAPACITY_MAX} people, you included.
              </p>
              <FieldError id="capacity-error" error={state.fieldErrors?.capacity} />
            </div>

            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-ink">
                Who can join?
              </legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-primary has-checked:bg-cream/60">
                  <input
                    type="radio"
                    name="mode"
                    value="open"
                    defaultChecked
                    aria-describedby="mode-error"
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">Open &#40;Recommended&#41;</span>
                    <span className="block text-sm text-ink-muted">
                      Anyone in these courses can join instantly. Best for meeting new people and getting started fast.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-primary has-checked:bg-cream/60">
                  <input
                    type="radio"
                    name="mode"
                    value="closed"
                    aria-describedby="mode-error"
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">Closed</span>
                    <span className="block text-sm text-ink-muted">
                      People request to join and you approve each one.
                    </span>
                  </span>
                </label>
              </div>
              <FieldError id="mode-error" error={state.fieldErrors?.mode} />
            </fieldset>

            {!isCustom && classmates.length > 0 && (
              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-ink">
                  Invite classmates right away (optional)
                </legend>
                <p className="mb-2 text-xs text-ink-muted">
                  Everyone listed is taking one of the courses you tagged. You can
                  invite up to {maxInvites} {maxInvites === 1 ? "person" : "people"} —
                  you hold the other seat.
                </p>
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                  {classmates.map((classmate) => (
                    <li key={classmate.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-cream">
                        <Checkbox
                          name="invitee_ids"
                          value={classmate.id}
                          checked={selectedInvitees.has(classmate.id)}
                          onCheckedChange={(checked) =>
                            toggleInvitee(classmate.id, checked === true)
                          }
                        />
                        <Avatar
                          src={classmate.avatar_url}
                          name={classmate.display_name}
                          size="sm"
                        />
                        <span className="text-sm text-ink">{classmate.display_name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {overInvited && (
                  <p role="alert" className="mt-1.5 text-sm text-danger">
                    That&rsquo;s {selectedInvitees.size} invites for {maxInvites} open{" "}
                    {maxInvites === 1 ? "seat" : "seats"} — raise the size limit or uncheck
                    a few.
                  </p>
                )}
                <FieldError id="invitee_ids-error" error={state.fieldErrors?.invitee_ids} />
              </fieldset>
            )}

            {!isCustom && courseIds.length > 0 && classmates.length === 0 && (
              <p className="rounded-xl bg-cream px-3 py-2 text-sm text-ink-muted">
                No classmates to invite yet — nobody else has added these courses.
                Your group will still be discoverable on Join &amp; Create.
              </p>
            )}

            {state.error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={pending}
              disabled={overInvited || (!isCustom && courseIds.length === 0)}
            >
              Create group
            </Button>

            {!isCustom && (
              <p className="text-center text-base text-ink-muted">
                Course not listed?{" "}
                <AddCourseDialog />
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
