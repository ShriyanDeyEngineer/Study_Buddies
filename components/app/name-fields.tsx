/**
 * The first + last name inputs, shared by onboarding, profile settings,
 * and the layout's "confirm your name" screen. Both are required; the
 * database joins them into the display name classmates see (migration
 * 0042). Uncontrolled with defaultValues, like the forms around them.
 */
import { NAME_PART_MAX } from "@/lib/constants";
import type { NameParts } from "@/lib/names";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "first_name", label: "First name", autoComplete: "given-name" },
  { name: "last_name", label: "Last name", autoComplete: "family-name" },
] as const;

export function NameFields({
  defaults,
  fieldErrors,
}: {
  defaults: NameParts;
  fieldErrors?: Record<string, string[]>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <div key={field.name}>
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            defaultValue={defaults[field.name]}
            maxLength={NAME_PART_MAX}
            autoComplete={field.autoComplete}
            required
            aria-invalid={!!fieldErrors?.[field.name]}
            aria-describedby={`${field.name}-error`}
          />
          <FieldError id={`${field.name}-error`} error={fieldErrors?.[field.name]} />
        </div>
      ))}
    </div>
  );
}
