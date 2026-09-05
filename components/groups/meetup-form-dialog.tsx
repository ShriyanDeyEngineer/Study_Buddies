/**
 * The "schedule a meetup" dialog (spec §5.8). Collects title, date+time,
 * online/in-person, and the conditional link-or-location. Shows a
 * DISTINCT inline error for every invalid field at once.
 *
 * THE TIMEZONE MOVE (pitfall #8), read carefully before touching:
 * <input type="datetime-local"> yields wall-clock text with no timezone
 * ("2026-03-07T19:30"). new Date(thatText) interprets it in the
 * BROWSER'S timezone — the student's own — and .toISOString() converts
 * to UTC. So the conversion to a real instant happens HERE, in the
 * browser, the only place that knows the student's timezone. The server
 * only ever sees UTC.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { createMeetupAction } from "@/lib/actions/meetups";
import {
  MEETUP_DURATION_DEFAULT,
  MEETUP_DURATION_MAX,
  MEETUP_DURATION_MIN,
  MEETUP_DURATION_STEP,
} from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/** Wall-clock text ("2026-03-07T19:30", browser-local) → UTC ISO string. */
function localInputToUtcIso(local: string): string {
  return new Date(local).toISOString();
}

export function MeetupFormDialog({
  groupId,
  /** Prefill for "schedule this slot" from a poll. */
  prefillStart,
  trigger,
}: {
  groupId: string;
  prefillStart?: string;
  trigger?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(createMeetupAction, {});
  // Duration slider (bug report #2). Controlled so the label can read
  // "1 h 30 min" live as the thumb moves; the value posts as a plain
  // number of minutes.
  const [duration, setDuration] = React.useState(MEETUP_DURATION_DEFAULT);
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<"online" | "in_person">("in_person");
  const router = useRouter();

  // Close + refresh on success (state flips to {success} after the action).
  React.useEffect(() => {
    if (state.success && open) {
      toast.success(state.success);
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacting to state identity is the point
  }, [state]);

  // datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time. For prefill we
  // convert the UTC slot time into the student's wall clock.
  const prefillLocal = React.useMemo(() => {
    if (!prefillStart) return "";
    const d = new Date(prefillStart);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [prefillStart]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <CalendarPlus aria-hidden className="h-4 w-4" />
            New meetup
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Schedule a meetup</DialogTitle>
        <DialogDescription>
          Pick a future time — everyone in the group gets notified.
        </DialogDescription>

        <form
          action={(formData) => {
            // Swap the local wall-clock value for its UTC instant before
            // the server ever sees it (see header comment).
            const local = String(formData.get("scheduled_at_local") ?? "");
            formData.set("scheduled_at", local ? localInputToUtcIso(local) : "");
            formData.delete("scheduled_at_local");
            formAction(formData);
          }}
          noValidate
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="group_id" value={groupId} />
          {/* The converted UTC value lands here via formData.set above. */}
          <input type="hidden" name="scheduled_at" />

          <div>
            <Label htmlFor="meetup-title">Title (required)</Label>
            <Input
              id="meetup-title"
              name="title"
              maxLength={100}
              placeholder="Problem set 6 grind"
              required
              aria-invalid={!!state.fieldErrors?.title}
              aria-describedby="meetup-title-error"
            />
            <FieldError id="meetup-title-error" error={state.fieldErrors?.title} />
          </div>

          <div>
            <Label htmlFor="meetup-when">Date and time (required, your local time)</Label>
            <Input
              id="meetup-when"
              name="scheduled_at_local"
              type="datetime-local"
              defaultValue={prefillLocal}
              required
              aria-invalid={!!state.fieldErrors?.scheduled_at}
              aria-describedby="meetup-when-error"
            />
            <FieldError id="meetup-when-error" error={state.fieldErrors?.scheduled_at} />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <Label htmlFor="meetup-duration" className="mb-0">
                How long?
              </Label>
              <span className="text-sm font-medium text-primary" aria-live="polite">
                {formatDuration(duration)}
              </span>
            </div>
            {/* Native range input: keyboard-accessible (arrows/Home/End)
                and works with the OS on mobile. Snaps to 15-minute steps
                between 15 min and 8 h. */}
            <input
              id="meetup-duration"
              name="duration_minutes"
              type="range"
              min={MEETUP_DURATION_MIN}
              max={MEETUP_DURATION_MAX}
              step={MEETUP_DURATION_STEP}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              aria-valuetext={formatDuration(duration)}
              aria-invalid={!!state.fieldErrors?.duration_minutes}
              aria-describedby="meetup-duration-error"
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-ink-muted">
              <span>15 min</span>
              <span>8 h</span>
            </div>
            <FieldError id="meetup-duration-error" error={state.fieldErrors?.duration_minutes} />
          </div>

          <div>
            <Label htmlFor="meetup-format">Format</Label>
            <Select
              id="meetup-format"
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "online" | "in_person")}
              aria-invalid={!!state.fieldErrors?.format}
              aria-describedby="meetup-format-error"
            >
              <option value="in_person">In person</option>
              <option value="online">Online</option>
            </Select>
            <FieldError id="meetup-format-error" error={state.fieldErrors?.format} />
          </div>

          {/* Conditional fields — both stay mounted so a typed value
              survives toggling; only the relevant one is shown+required. */}
          <div hidden={format !== "in_person"}>
            <Label htmlFor="meetup-location">Where?</Label>
            <Input
              id="meetup-location"
              name="location"
              maxLength={300}
              placeholder="Walter Library, 2nd floor tables"
              aria-invalid={!!state.fieldErrors?.location}
              aria-describedby="meetup-location-error"
            />
            <FieldError id="meetup-location-error" error={state.fieldErrors?.location} />
          </div>
          <div hidden={format !== "online"}>
            <Label htmlFor="meetup-link">Meeting link</Label>
            <Input
              id="meetup-link"
              name="meeting_link"
              type="url"
              maxLength={500}
              placeholder="https://umn.zoom.us/j/…"
              aria-invalid={!!state.fieldErrors?.meeting_link}
              aria-describedby="meetup-link-error"
            />
            <FieldError id="meetup-link-error" error={state.fieldErrors?.meeting_link} />
          </div>

          {state.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={pending}>
            Schedule it
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
