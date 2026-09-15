/**
 * The Major field: a dropdown of UMN Twin Cities majors with "Other" last,
 * which opens a text box for a major that isn't listed. Shared by
 * onboarding and Edit profile.
 *
 * It posts two fields, `major` (the dropdown) and `major_other` (the text
 * box), and majorFromForm (lib/majors.ts) folds them into the single value
 * saved in profiles.major. A saved major that isn't on the list opens as
 * Other with its text filled in, so older free-text majors keep working.
 */
"use client";

import * as React from "react";
import { MAJOR_OTHER, MAJORS, majorChoiceFor } from "@/lib/majors";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function MajorField({
  saved,
  error,
  label = "Major",
}: {
  /** The major currently on the profile, if any. */
  saved?: string | null;
  error?: string[];
  label?: string;
}) {
  const initial = majorChoiceFor(saved);
  const [choice, setChoice] = React.useState(initial.choice);
  const isOther = choice === MAJOR_OTHER;

  // Picking Other moves focus into the text box it reveals. A flag rather
  // than `isOther` alone, so a saved Other major doesn't grab focus on load.
  const focusOther = React.useRef(false);
  React.useEffect(() => {
    if (!focusOther.current) return;
    focusOther.current = false;
    document.getElementById("major_other")?.focus();
  }, [choice]);

  return (
    <div>
      <Label htmlFor="major">{label}</Label>
      <Select
        id="major"
        name="major"
        value={choice}
        onChange={(event) => {
          focusOther.current = event.target.value === MAJOR_OTHER;
          setChoice(event.target.value);
        }}
        aria-invalid={!isOther && !!error}
        aria-describedby="major-error"
      >
        <option value="">Prefer not to say</option>
        {MAJORS.map((major) => (
          <option key={major} value={major}>
            {major}
          </option>
        ))}
        <option value={MAJOR_OTHER}>Other</option>
      </Select>
      {/* Stays mounted while hidden so a typed major survives switching the
          dropdown away and back. */}
      <div hidden={!isOther} className="mt-2">
        <Label htmlFor="major_other" className="sr-only">
          Your major
        </Label>
        <Input
          id="major_other"
          name="major_other"
          defaultValue={initial.other}
          maxLength={100}
          placeholder="Type your major"
          aria-invalid={isOther && !!error}
          aria-describedby="major-error"
        />
      </div>
      <FieldError id="major-error" error={error} />
    </div>
  );
}
