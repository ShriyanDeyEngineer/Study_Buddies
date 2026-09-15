/**
 * "Add a missing course" dialog (spec §5.5) — files a COURSE REQUEST.
 *
 * Requests land in our own database (course_requests, migration 0020)
 * where admins review, fix typos if needed, and approve or decline; the
 * student hears back through an in-app notification. This replaced the
 * earlier email flow — no mail app involved, which also kills the
 * Android mailto/Play Store headaches for good.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createCourseRequestAction } from "@/lib/actions/course-requests";
import { submitWithoutReset } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddCourseDialog({ triggerLabel = "Add a Course" }: { triggerLabel?: string }) {
  const [state, formAction, pending] = useActionState(createCourseRequestAction, {});
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (state.success && open) {
      toast.success(state.success);
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacting to action completion
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus aria-hidden className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Request a missing UMN course</DialogTitle>
        <DialogDescription>
          Can&rsquo;t find a course even with the search filters? Send us a
          request. An admin reviews it and you&rsquo;ll get a notification
          when it&rsquo;s approved or declined — usually within a few days.
        </DialogDescription>

        <form onSubmit={submitWithoutReset(formAction)} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="request-dept">Department (required)</Label>
              <Input
                id="request-dept"
                name="department_code"
                placeholder="MATH"
                maxLength={8}
                required
                aria-invalid={!!state.fieldErrors?.department_code}
                aria-describedby="request-dept-error"
              />
              <FieldError id="request-dept-error" error={state.fieldErrors?.department_code} />
            </div>
            <div>
              <Label htmlFor="request-number">Course number (required)</Label>
              <Input
                id="request-number"
                name="course_number"
                placeholder="1371"
                maxLength={7}
                required
                aria-invalid={!!state.fieldErrors?.course_number}
                aria-describedby="request-number-error"
              />
              <FieldError id="request-number-error" error={state.fieldErrors?.course_number} />
            </div>
          </div>
          <div>
            <Label htmlFor="request-name">Course name (optional)</Label>
            <Input
              id="request-name"
              name="course_name"
              placeholder="CSE Calculus I"
              maxLength={200}
            />
          </div>

          {state.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={pending}>
            Send request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
