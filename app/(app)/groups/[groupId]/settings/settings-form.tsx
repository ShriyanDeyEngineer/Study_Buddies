/**
 * The manager's settings form: rename, open⇄closed switch, and the
 * danger zone (disband behind typed-name confirmation).
 *
 * The closed → open warning matters: flipping open AUTO-APPROVES waiting
 * requests oldest-first until the group is full (spec §5.9). Managers
 * should flip it knowingly, so the form says so right next to the radio.
 */
"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { disbandGroupAction, updateGroupSettingsAction } from "@/lib/actions/groups";
import {
  GROUP_CAPACITY_MAX,
  GROUP_CAPACITY_MIN,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TypedConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pluralize } from "@/lib/utils";

export function SettingsForm({
  groupId,
  currentName,
  currentDescription,
  currentCapacity,
  currentMemberCount,
  currentMode,
  pendingNote,
}: {
  groupId: string;
  currentName: string;
  currentDescription: string | null;
  currentCapacity: number;
  /** The DB won't let capacity drop below this — checked here too, for an
   *  immediate message instead of a round trip. */
  currentMemberCount: number;
  currentMode: "open" | "closed";
  /** True when the group is currently closed (may have queued requests). */
  pendingNote: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateGroupSettingsAction, {});
  const [capacity, setCapacity] = React.useState(currentCapacity);
  const belowMemberCount = capacity < currentMemberCount;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <form action={formAction} noValidate className="space-y-5">
            <input type="hidden" name="group_id" value={groupId} />

            <div>
              <Label htmlFor="name">Group name (required)</Label>
              <Input
                id="name"
                name="name"
                defaultValue={currentName}
                maxLength={GROUP_NAME_MAX}
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
                defaultValue={currentDescription ?? ""}
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
                aria-invalid={!!state.fieldErrors?.capacity || belowMemberCount}
                aria-describedby="capacity-help capacity-error"
              />
              <p id="capacity-help" className="mt-1 text-xs text-ink-muted">
                Between {GROUP_CAPACITY_MIN} and {GROUP_CAPACITY_MAX} people, you
                included — {pluralize(currentMemberCount, "member")} right now.
              </p>
              {belowMemberCount && (
                <p role="alert" className="mt-1.5 text-sm text-danger">
                  The group already has {pluralize(currentMemberCount, "member")} —
                  pick {currentMemberCount} or higher.
                </p>
              )}
              <FieldError id="capacity-error" error={state.fieldErrors?.capacity} />
            </div>

            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-ink">Mode</legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-primary has-checked:bg-cream/60">
                  <input
                    type="radio"
                    name="mode"
                    value="open"
                    defaultChecked={currentMode === "open"}
                    aria-describedby="mode-error"
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">Open</span>
                    <span className="block text-sm text-ink-muted">
                      Anyone joins instantly.
                      {pendingNote && (
                        <>
                          {" "}
                          <strong className="font-medium text-warning">
                            Switching to open approves everyone currently waiting,
                            oldest request first, until the group is full.
                          </strong>
                        </>
                      )}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-primary has-checked:bg-cream/60">
                  <input
                    type="radio"
                    name="mode"
                    value="closed"
                    defaultChecked={currentMode === "closed"}
                    aria-describedby="mode-error"
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">Closed</span>
                    <span className="block text-sm text-ink-muted">
                      You approve each join request.
                    </span>
                  </span>
                </label>
              </div>
              <FieldError id="mode-error" error={state.fieldErrors?.mode} />
            </fieldset>

            {state.error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}
            {state.success && (
              <p role="status" className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
                {state.success}
              </p>
            )}

            <Button type="submit" loading={pending} disabled={belowMemberCount}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/40">
        <CardContent>
          <h2 className="font-display text-lg text-ink">Danger zone</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Disbanding removes every member, cancels all upcoming meetups, declines
            all pending requests, and notifies everyone. There is no undo.
          </p>
          <div className="mt-4">
            <TypedConfirmDialog
              title="Disband this group?"
              description="This permanently shuts the group down: members removed, upcoming meetups cancelled, pending requests declined, everyone notified."
              requiredText={currentName}
              confirmLabel="Disband forever"
              onConfirm={async () => {
                // On success the action redirects to the dashboard.
                const result = await disbandGroupAction(groupId);
                if (result?.error) toast.error(result.error);
              }}
            >
              <Button variant="danger">Disband group…</Button>
            </TypedConfirmDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
