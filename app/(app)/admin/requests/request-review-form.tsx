/** One pending course request: editable fields + Approve / Decline. */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  approveCourseRequestAction,
  declineCourseRequestAction,
} from "@/lib/actions/course-requests";
import { submitWithoutReset } from "@/lib/forms";
import type { CourseRequestRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RequestReviewForm({
  request,
  requesterName,
}: {
  request: CourseRequestRow;
  requesterName: string;
}) {
  const [state, formAction, pending] = useActionState(approveCourseRequestAction, {});
  const [declining, setDeclining] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacting to action completion
  }, [state]);

  async function decline() {
    setDeclining(true);
    const { error } = await declineCourseRequestAction(request.id);
    setDeclining(false);
    if (error) toast.error(error);
    else {
      toast.success("Declined — the student was notified.");
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={submitWithoutReset(formAction)}
      noValidate
      className="rounded-xl border border-line bg-surface p-4 shadow-sm"
    >
      <input type="hidden" name="request_id" value={request.id} />
      <p className="mb-3 text-xs text-ink-muted">
        Requested by <span className="font-medium text-ink">{requesterName}</span>{" "}
        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })} — edit
        the fields if they need fixing, then approve or decline.
      </p>
      <div className="grid gap-3 sm:grid-cols-[8rem_8rem_1fr]">
        <div>
          <Label htmlFor={`dept-${request.id}`}>Department</Label>
          <Input
            id={`dept-${request.id}`}
            name="department_code"
            defaultValue={request.department_code}
            maxLength={8}
            aria-invalid={!!state.fieldErrors?.department_code}
            aria-describedby={`dept-${request.id}-error`}
          />
          <FieldError id={`dept-${request.id}-error`} error={state.fieldErrors?.department_code} />
        </div>
        <div>
          <Label htmlFor={`num-${request.id}`}>Number</Label>
          <Input
            id={`num-${request.id}`}
            name="course_number"
            defaultValue={request.course_number}
            maxLength={7}
            aria-invalid={!!state.fieldErrors?.course_number}
            aria-describedby={`num-${request.id}-error`}
          />
          <FieldError id={`num-${request.id}-error`} error={state.fieldErrors?.course_number} />
        </div>
        <div>
          <Label htmlFor={`name-${request.id}`}>Course name</Label>
          <Input
            id={`name-${request.id}`}
            name="course_name"
            defaultValue={request.course_name}
            maxLength={200}
            aria-invalid={!!state.fieldErrors?.course_name}
            aria-describedby={`name-${request.id}-error`}
          />
          <FieldError id={`name-${request.id}-error`} error={state.fieldErrors?.course_name} />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" loading={pending} disabled={declining}>
          Approve &amp; add to catalog
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={declining}
          disabled={pending}
          onClick={decline}
        >
          Decline
        </Button>
      </div>
    </form>
  );
}
