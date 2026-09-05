/**
 * The group creation form (spec §5.6): name, capacity (2–50, default 8),
 * open/closed with the difference explained, and — when creating for an
 * existing course — the invite picker limited to capacity − 1 classmates.
 *
 * With course=null it renders the "my course isn't listed" variant that
 * also collects department/number/name (§5.6's custom-course allowance).
 * Every validation error is per-field and inline.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createGroupAction, createGroupWithCourseAction } from "@/lib/actions/groups";
import {
  GROUP_CAPACITY_DEFAULT,
  GROUP_CAPACITY_MAX,
  GROUP_CAPACITY_MIN,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
} from "@/lib/constants";
import type { PublicProfile } from "@/lib/types";
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
  course,
  classmates,
}: {
  /** null = the custom-course variant. */
  course: { id: string; label: string } | null;
  classmates: PublicProfile[];
}) {
  // Two actions, one form component: which action runs depends on the
  // variant, so the right database path gets the right validation.
  const [state, formAction, pending] = useActionState(
    course ? createGroupAction : createGroupWithCourseAction,
    {},
  );
  const [capacity, setCapacity] = React.useState(GROUP_CAPACITY_DEFAULT);
  const [selectedInvitees, setSelectedInvitees] = React.useState<Set<string>>(new Set());

  const maxInvites = Math.max(0, capacity - 1);
  const overInvited = selectedInvitees.size > maxInvites;

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
        {course ? (
          <>For {course.label}</>
        ) : (
          "For a course that isn't in our catalog yet — tell us which one."
        )}
      </p>

      <Card>
        <CardContent>
          <form action={formAction} noValidate className="space-y-5">
            {course ? (
              <input type="hidden" name="course_id" value={course.id} />
            ) : (
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
                      Anyone in the course can join instantly. Best for meeting new people and getting started fast.
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

            {course && classmates.length > 0 && (
              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-ink">
                  Invite classmates right away (optional)
                </legend>
                <p className="mb-2 text-xs text-ink-muted">
                  Everyone listed is taking this course. You can invite up to{" "}
                  {maxInvites} {maxInvites === 1 ? "person" : "people"} — you hold the
                  other seat.
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

            {course && classmates.length === 0 && (
              <p className="rounded-xl bg-cream px-3 py-2 text-sm text-ink-muted">
                No classmates to invite yet — nobody else has added this course. Your
                group will still be discoverable on the course page.
              </p>
            )}

            {state.error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={pending} disabled={overInvited}>
              Create group
            </Button>

            {course && (
              <p className="text-center text-base text-ink-muted">
                Course not right?{" "}
                <AddCourseDialog />
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
