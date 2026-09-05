/**
 * Availability polls (spec §5.8) — our native When2Meet.
 *
 * A member opens a poll by picking a DATE RANGE and DAILY HOURS ("next
 * week, 9 AM–9 PM"); the poll becomes a grid of 30-minute slots. Members
 * drag across the grid to paint when they're free (AvailabilityGrid). The
 * cell most people can make gets highlighted with a one-click "Schedule"
 * button that opens the meetup form prefilled with that time.
 *
 * Built natively on purpose: embedding When2Meet/Calendly would force
 * external accounts and break the single-sign-in experience (the spec
 * forbids it explicitly). The grid interaction is theirs; the data,
 * accounts, and the "turn the winner into a real meetup" step are ours.
 *
 * Realtime: useLiveRefresh on availability_votes so other members'
 * painting shows up without a manual reload.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarRange, ListPlus, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  closeAvailabilityPollAction,
  createAvailabilityPollAction,
} from "@/lib/actions/meetups";
import { generateGridSlots } from "@/lib/availability-grid";
import { POLL_SLOTS_MAX } from "@/lib/constants";
import type { AvailabilityPollRow, AvailabilitySlotRow } from "@/lib/types";
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
import { Select } from "@/components/ui/select";
import { AvailabilityGrid } from "@/components/groups/availability-grid";
import { MeetupFormDialog } from "@/components/groups/meetup-form-dialog";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { pluralize } from "@/lib/utils";

interface Vote {
  slot_id: string;
  user_id: string;
}

export function PollsSection({
  groupId,
  currentUserId,
  isManager,
  polls,
  slots,
  votes,
  members,
}: {
  groupId: string;
  currentUserId: string;
  isManager: boolean;
  polls: AvailabilityPollRow[];
  slots: AvailabilitySlotRow[];
  votes: Vote[];
  members: { id: string; display_name: string | null }[];
}) {
  const router = useRouter();
  // The page now asks for open polls only; this keeps rendering honest if
  // a closed one ever arrives (e.g. from a stale cached payload).
  const openPolls = polls.filter((p) => p.status === "open");

  // Other members' painting appears live (RLS: this table = group members).
  // availability_votes now carries a group_id (migration 0029), so this
  // filters server-side to just this group — a vote in someone else's
  // group no longer wakes this subscription at all. Also still gated to
  // "only while a poll is actually open", so groups with no live poll pay
  // nothing either way.
  useLiveRefresh({
    table: "availability_votes",
    filter: `group_id=eq.${groupId}`,
    enabled: openPolls.length > 0,
  });

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Availability polls</h2>
        <NewPollDialog groupId={groupId} />
      </div>

      {openPolls.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          Open a poll to find a time: everyone marks when they&rsquo;re free, and
          the best slot rises to the top.
        </p>
      ) : (
        openPolls.map((poll) => {
          const pollSlots = slots
            .filter((s) => s.poll_id === poll.id)
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          const slotIds = new Set(pollSlots.map((s) => s.id));
          const pollVotes = votes.filter((v) => slotIds.has(v.slot_id));

          // The winner: most votes; ties go to the earliest slot.
          const countBySlot = new Map<string, number>();
          for (const v of pollVotes) countBySlot.set(v.slot_id, (countBySlot.get(v.slot_id) ?? 0) + 1);
          let best: AvailabilitySlotRow | null = null;
          let bestCount = 0;
          for (const s of pollSlots) {
            const c = countBySlot.get(s.id) ?? 0;
            if (c > bestCount) {
              best = s;
              bestCount = c;
            }
          }
          const voterCount = new Set(pollVotes.map((v) => v.user_id)).size;

          return (
            <div key={poll.id} className="mt-3 rounded-xl border border-line p-2 sm:p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-medium text-ink">{poll.title}</h4>
                  <p className="text-xs text-ink-muted" aria-live="polite">
                    {pluralize(voterCount, "person has", "people have")} responded ·{" "}
                    {pluralize(pollSlots.length, "time slot")}
                  </p>
                </div>
                {(poll.creator_id === currentUserId || isManager) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-ink-muted"
                    onClick={async () => {
                      const { error } = await closeAvailabilityPollAction(poll.id, groupId);
                      if (error) {
                        toast.error(error);
                        return;
                      }
                      toast.success("Poll closed.");
                      router.refresh();
                    }}
                  >
                    Close poll
                  </Button>
                )}
              </div>

              <div className="mt-3">
                <AvailabilityGrid
                  pollId={poll.id}
                  groupId={groupId}
                  slots={pollSlots}
                  votes={pollVotes}
                  currentUserId={currentUserId}
                  members={members}
                  onCommitted={() => router.refresh()}
                />
              </div>

              {/* The winning slot → one click to a real meetup */}
              {best && bestCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-light/40 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-sm text-ink">
                    <Trophy aria-hidden className="h-4 w-4 shrink-0 text-accent" />
                    <span>
                      <span className="font-medium">
                        {format(new Date(best.starts_at), "EEE, MMM d · h:mm a")}
                      </span>{" "}
                      works for {pluralize(bestCount, "person", "people")}
                      {voterCount > 0 && bestCount === voterCount ? " — everyone!" : ""}
                    </span>
                  </p>
                  <MeetupFormDialog
                    groupId={groupId}
                    prefillStart={best.starts_at}
                    trigger={
                      <Button size="sm" variant="secondary">
                        Schedule this time
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── New poll: date range + daily hours → auto-generated grid ────────────────

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => h); // 0..24

function hourLabel(h: number) {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The "new poll" dialog. Instead of typing individual times, the creator
 * picks a date range and the hours of the day worth polling; the slots
 * are generated in the browser (which is the only place that knows the
 * student's timezone) and posted as one JSON list — the same wire format
 * the old dialog used, so nothing server-side changed except the cap.
 */
function NewPollDialog({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(createAvailabilityPollAction, {});
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // Sensible defaults: today through +6 days, 9 AM–9 PM.
  const today = React.useMemo(() => new Date(), []);
  const [startDate, setStartDate] = React.useState(toDateInput(today));
  const [endDate, setEndDate] = React.useState(
    toDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6)),
  );
  const [startHour, setStartHour] = React.useState(9);
  const [endHour, setEndHour] = React.useState(21);
  const [clientError, setClientError] = React.useState<string | null>(null);

  // Live preview of the grid size, so the cap is never a surprise.
  const previewSlots = React.useMemo(
    () => generateGridSlots(startDate, endDate, startHour, endHour),
    [startDate, endDate, startHour, endHour],
  );
  const dayCount =
    startDate && endDate
      ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1)
      : 0;

  React.useEffect(() => {
    if (state.success && open) {
      toast.success(state.success);
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacting to action completion
  }, [state]);

  const tooMany = previewSlots.length > POLL_SLOTS_MAX;
  const tooFew = previewSlots.length < 2;
  const hoursInverted = endHour <= startHour;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ListPlus aria-hidden className="h-4 w-4" />
          New poll
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Find a time that works</DialogTitle>
        <DialogDescription>
          Pick the days and hours to consider. Everyone then drags across a grid to
          mark when they&rsquo;re free — the best time rises to the top.
        </DialogDescription>

        <form
          action={(formData) => {
            if (hoursInverted) {
              setClientError("The end hour has to be after the start hour.");
              return;
            }
            if (tooFew) {
              setClientError("That range has no upcoming times — pick a later day or hours.");
              return;
            }
            if (tooMany) {
              setClientError(
                `That's ${previewSlots.length} half-hour slots — the limit is ${POLL_SLOTS_MAX}. Narrow the days or hours.`,
              );
              return;
            }
            setClientError(null);
            formData.set("slots", JSON.stringify(previewSlots));
            formAction(formData);
          }}
          noValidate
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="group_id" value={groupId} />

          <div>
            <Label htmlFor="poll-title">What&rsquo;s it for? (required)</Label>
            <Input
              id="poll-title"
              name="title"
              maxLength={100}
              placeholder="Midterm review session"
              required
              aria-invalid={!!state.fieldErrors?.title}
              aria-describedby="poll-title-error"
            />
            <FieldError id="poll-title-error" error={state.fieldErrors?.title} />
          </div>

          <fieldset>
            <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
              <CalendarRange aria-hidden className="h-4 w-4 text-ink-muted" />
              Which days?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="poll-start-date" className="text-xs text-ink-muted">
                  From
                </Label>
                <Input
                  id="poll-start-date"
                  type="date"
                  value={startDate}
                  min={toDateInput(today)}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="poll-end-date" className="text-xs text-ink-muted">
                  To
                </Label>
                <Input
                  id="poll-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">
              Which hours each day? <span className="font-normal text-ink-muted">(your local time)</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="poll-start-hour" className="text-xs text-ink-muted">
                  No earlier than
                </Label>
                <Select
                  id="poll-start-hour"
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                >
                  {HOUR_OPTIONS.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="poll-end-hour" className="text-xs text-ink-muted">
                  No later than
                </Label>
                <Select
                  id="poll-end-hour"
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  aria-invalid={hoursInverted}
                  aria-describedby="poll-slots-error"
                >
                  {HOUR_OPTIONS.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </fieldset>

          <p className={`text-xs ${tooMany || hoursInverted ? "text-danger" : "text-ink-muted"}`} aria-live="polite">
            {hoursInverted
              ? "End hour must be after start hour."
              : `${pluralize(dayCount, "day")} × ${hourLabel(startHour)}–${hourLabel(endHour)} = ${pluralize(previewSlots.length, "half-hour slot")}${tooMany ? ` (max ${POLL_SLOTS_MAX})` : ""}`}
          </p>

          <FieldError id="poll-slots-error" error={clientError ?? state.fieldErrors?.slots} />
          {state.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={pending} disabled={tooMany || hoursInverted}>
            Open the poll
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
