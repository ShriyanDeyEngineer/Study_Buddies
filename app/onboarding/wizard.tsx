/**
 * The three-step onboarding wizard (spec §5.3).
 *
 *   Step 1 — who you are: display name (the ONLY required field),
 *            college, major, standing, graduation. Optional fields are
 *            labeled optional and never gate progress.
 *   Step 2 — current courses (searchable multi-select, skippable).
 *   Step 3 — bio (optional) → Finish.
 *
 * HOW IT STAYS REFRESH-SAFE: it's ONE <form> and nothing saves until
 * Finish. Inactive steps stay mounted but hidden, so their inputs are
 * still in the form when it finally submits. A refresh mid-wizard just
 * restarts it — annoying at worst, never corrupt.
 *
 * KNOWN PITFALL GUARD (spec §9.1): pressing Enter in a text input would
 * normally submit the form — from step 1 that would submit a half-empty
 * wizard. The form's onKeyDown turns Enter into "next step" instead;
 * only the explicit Finish button (the form's lone type="submit")
 * actually submits.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { saveOnboardingAction } from "@/lib/actions/profile";
import { COLLEGES, CLASS_STANDINGS, GRAD_YEAR_MAX, GRAD_YEAR_MIN } from "@/lib/constants";
import { courseCode, type CourseRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STEP_TITLES = ["Tell us about you", "What are you taking?", "Add a bio"];

export function OnboardingWizard({
  courses,
  suggestedName,
}: {
  courses: CourseRow[];
  suggestedName: string;
}) {
  const [state, formAction, pending] = useActionState(saveOnboardingAction, {});
  // Everyone starts on step 1. A name from the Google account is prefilled
  // there (see the display_name field below), but we still want the
  // student to see and confirm it — the label nudges them to shorten it to
  // a first name, and skipping the step meant most never got that far.
  const [step, setStep] = React.useState(0);
  const [courseQuery, setCourseQuery] = React.useState("");

  // Moving between steps swaps a whole fieldset in place with no
  // navigation and no visible page change, so a screen-reader user gets
  // no signal anything happened. Move focus to the new step's heading —
  // the aria-live wrapper around it (below) announces the new title too.
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // If the server bounced us with field errors, jump to the step that
  // owns the first broken field so the student actually sees it.
  React.useEffect(() => {
    if (!state.fieldErrors) return;
    if (
      state.fieldErrors.display_name ||
      state.fieldErrors.graduation_year
    ) setStep(0);
    else if (state.fieldErrors.bio) setStep(2);
  }, [state.fieldErrors]);

  const filteredCourses = courses.filter((course) => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      courseCode(course).toLowerCase().includes(q) ||
      course.course_name.toLowerCase().includes(q)
    );
  });

  function next() {
    setStep((s) => Math.min(s + 1, 2));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <form
      action={formAction}
      noValidate
      onKeyDown={(event) => {
        // The Enter-key guard described in the header comment. Textareas
        // keep Enter for newlines.
        if (
          event.key === "Enter" &&
          !(event.target instanceof HTMLTextAreaElement) &&
          step < 2
        ) {
          event.preventDefault();
          next();
        }
      }}
    >
      {/* Progress header */}
      <div className="mb-6 text-center" aria-live="polite">
        <p className="text-sm text-ink-muted">Step {step + 1} of 3</p>
        {/* tabIndex + programmatic focus only — never a Tab stop, so the
            missing focus-visible ring (outline-none) is intentional here,
            unlike a normally-tabbable control. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 font-display text-2xl text-ink outline-none"
        >
          {STEP_TITLES[step]}
        </h1>
        <div className="mx-auto mt-3 flex max-w-45 gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-line",
              )}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardContent>
          {/* ── Step 1: identity ─────────────────────────────────────── */}
          {/* Inactive steps use `hidden` (not unmount) so their values
              survive navigation and submit together at the end. */}
          <fieldset hidden={step !== 0} className="space-y-4">
            <legend className="sr-only">About you</legend>
            <div>
              <Label htmlFor="display_name">
                Display name (required, recommended to set it to just your first name)
                {suggestedName.trim() && (
                  <span className="ml-1.5 font-normal text-ink-muted">— from your Google account, change it if you like</span>
                )}
              </Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={suggestedName}
                maxLength={50}
                placeholder="Alex R."
                required
                aria-invalid={!!state.fieldErrors?.display_name}
                aria-describedby="display_name-error"
              />
              <FieldError id="display_name-error" error={state.fieldErrors?.display_name} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="college">College (optional)</Label>
                <Select id="college" name="college" defaultValue="">
                  <option value="">Prefer not to say</option>
                  {COLLEGES.map((college) => (
                    <option key={college.value} value={college.value}>
                      {college.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="major">Major (optional)</Label>
                <Input id="major" name="major" maxLength={100} placeholder="Undecided is fine!" />
              </div>
              <div>
                <Label htmlFor="class_standing">Class standing (optional)</Label>
                <Select id="class_standing" name="class_standing" defaultValue="">
                  <option value="">Prefer not to say</option>
                  {CLASS_STANDINGS.map((standing) => (
                    <option key={standing.value} value={standing.value}>
                      {standing.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="graduation_month">Graduation (optional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select id="graduation_month" name="graduation_month" defaultValue="" aria-label="Graduation month">
                    <option value="">Month</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i, 1).toLocaleString("en-US", { month: "long" })}
                      </option>
                    ))}
                  </Select>
                  <Select
                    name="graduation_year"
                    defaultValue=""
                    aria-label="Graduation year"
                    aria-invalid={!!state.fieldErrors?.graduation_year}
                    aria-describedby="graduation_year-error"
                  >
                    <option value="">Year</option>
                    {Array.from(
                      { length: GRAD_YEAR_MAX - GRAD_YEAR_MIN + 1 },
                      (_, i) => GRAD_YEAR_MIN + i,
                    )
                      .filter((year) => year >= new Date().getFullYear() - 1)
                      .map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                  </Select>
                </div>
                <FieldError id="graduation_year-error" error={state.fieldErrors?.graduation_year} />
              </div>
            </div>
          </fieldset>

          {/* ── Step 2: current courses ──────────────────────────────── */}
          <fieldset hidden={step !== 1}>
            <legend className="sr-only">Your current courses</legend>
            <p className="mb-3 text-sm text-ink-muted">
              Check what you&rsquo;re taking this term (optional — you can always add
              them later, and add missing courses from the catalog).
            </p>
            <div className="relative mb-3">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              />
              <Input
                type="search"
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="Search — try MATH 1371 or physics"
                aria-label="Search courses"
                className="pl-9"
              />
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {filteredCourses.length === 0 && (
                <li className="px-2 py-4 text-center text-sm text-ink-muted">
                  No matches — you can add missing courses from the catalog after setup.
                </li>
              )}
              {filteredCourses.map((course) => (
                <li key={course.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-cream">
                    <Checkbox name="course_ids" value={course.id} />
                    <span className="text-sm">
                      <span className="font-medium text-ink">{courseCode(course)}</span>{" "}
                      <span className="text-ink-muted">{course.course_name}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {/* ── Step 3: bio ──────────────────────────────────────────── */}
          <fieldset hidden={step !== 2} className="space-y-4">
            <legend className="sr-only">Bio</legend>
            <div>
              <Label htmlFor="bio">Bio (optional)</Label>
              <Textarea
                id="bio"
                name="bio"
                maxLength={500}
                rows={4}
                placeholder="I'm usually at Walter Library after 4 and looking for a weekly group."
                aria-describedby="bio-error"
              />
              <FieldError id="bio-error" error={state.fieldErrors?.bio} />
            </div>
          </fieldset>

          {state.error && (
            <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          {/* ── Navigation ───────────────────────────────────────────── */}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0 || pending}>
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back
            </Button>
            {step < 2 ? (
              // The `key`s below are load-bearing — do not remove them.
              // Without keys, React reuses ONE <button> DOM node for both
              // branches and just mutates its `type`. Clicking "Almost
              // done" then advances the step, React synchronously flips
              // the node to type="submit", and THEN the browser runs the
              // click's default action against the button's NEW type —
              // submitting the form and skipping step 3 entirely (bio and
              // photo lost). Distinct keys force a fresh DOM node per
              // branch, so the old click can't detonate the new button.
              <Button key="advance" onClick={next}>
                {step === 1 ? "Almost done" : "Next"}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Button>
            ) : (
              <Button key="finish" type="submit" loading={pending}>
                Finish — take me in
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
