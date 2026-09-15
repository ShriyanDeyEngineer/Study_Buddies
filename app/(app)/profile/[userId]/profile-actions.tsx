/**
 * The action row on someone ELSE'S profile (spec §5.11): add friend
 * (state-aware), send message, study-buddy request, block/unblock, and
 * report. Each button reflects the current relationship the server
 * computed — no guessing client-side.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  Flag,
  MessageSquare,
  ShieldBan,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  blockUserAction,
  cancelFriendRequestAction,
  disconnectBuddyAction,
  removeFriendAction,
  reportUserAction,
  respondBuddyRequestAction,
  respondFriendRequestAction,
  sendBuddyRequestAction,
  sendFriendRequestAction,
  unblockUserAction,
} from "@/lib/actions/people";
import { submitWithoutReset } from "@/lib/forms";
import { REPORT_CATEGORIES, REPORT_DESCRIPTION_MAX } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Relationship {
  is_friend: boolean;
  outgoing_friend_request: { id: string } | null;
  incoming_friend_request: { id: string } | null;
  is_buddy: boolean;
  outgoing_buddy_request: { id: string } | null;
  incoming_buddy_request: { id: string } | null;
  blocked_by_me: boolean;
}

export function ProfileActions({
  userId,
  displayName,
  buddyAvailable,
  relationship,
}: {
  userId: string;
  displayName: string;
  buddyAvailable: boolean;
  relationship: Relationship;
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  // Which button state is correct depends on the whole relationship (are
  // we friends? whose request is pending?), so this one is NOT faked
  // client-side — a wrong guess here would offer the wrong action. What
  // it does instead is stay visibly busy until the recomputed state has
  // actually arrived: `busy` used to drop the moment the action returned,
  // leaving the button idle but still showing the OLD state for the whole
  // refresh, which is precisely what read as "my click did nothing".
  const busy = running || refreshing;

  /** Run an action, toast any error, refresh so the server recomputes. */
  async function run(action: () => Promise<{ error?: string }>, successNote?: string) {
    setRunning(true);
    const { error } = await action();
    setRunning(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (successNote) toast.success(successNote);
    startRefresh(() => router.refresh());
  }

  // A profile you've blocked shows only Unblock + Report — every other
  // interaction is off the table until you unblock.
  if (relationship.blocked_by_me) {
    return (
      <div className="flex flex-wrap gap-2">
        <p className="w-full text-sm text-ink-muted">You&rsquo;ve blocked this person.</p>
        <Button
          variant="outline"
          loading={busy}
          onClick={() => run(() => unblockUserAction(userId), "Unblocked.")}
        >
          Unblock
        </Button>
        <ReportDialog userId={userId} displayName={displayName} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* ── Friend button, one state at a time ─────────────────────── */}
      {relationship.is_friend ? (
        <ConfirmDialog
          title={`Unfriend ${displayName}?`}
          description="You'll disappear from each other's friend lists. They won't be notified."
          confirmLabel="Unfriend"
          onConfirm={() => run(() => removeFriendAction(userId))}
        >
          <Button variant="outline">
            <UserMinus aria-hidden className="h-4 w-4" />
            Friends
          </Button>
        </ConfirmDialog>
      ) : relationship.incoming_friend_request ? (
        <>
          <Button
            loading={busy}
            onClick={() =>
              run(
                () =>
                  respondFriendRequestAction(
                    relationship.incoming_friend_request!.id,
                    true,
                  ),
                "You're now friends!",
              )
            }
          >
            <UserCheck aria-hidden className="h-4 w-4" />
            Accept friend request
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(() =>
                respondFriendRequestAction(relationship.incoming_friend_request!.id, false),
              )
            }
          >
            Decline
          </Button>
        </>
      ) : relationship.outgoing_friend_request ? (
        <Button
          variant="outline"
          loading={busy}
          title="Click to cancel your request"
          onClick={() =>
            run(
              () => cancelFriendRequestAction(relationship.outgoing_friend_request!.id),
              "Request cancelled.",
            )
          }
        >
          Friend request sent ✓
        </Button>
      ) : (
        <Button
          loading={busy}
          onClick={() => run(() => sendFriendRequestAction(userId), "Friend request sent!")}
        >
          <UserPlus aria-hidden className="h-4 w-4" />
          Add friend
        </Button>
      )}

      {/* ── Message ────────────────────────────────────────────────── */}
      <Button asChild variant="secondary">
        <Link href={`/messages/${userId}`}>
          <MessageSquare aria-hidden className="h-4 w-4" />
          Message
        </Link>
      </Button>

      {/* ── Study buddy ────────────────────────────────────────────── */}
      {relationship.is_buddy ? (
        <ConfirmDialog
          title={`End your study-buddy connection with ${displayName}?`}
          description="You can send a new request later if you both want to reconnect."
          confirmLabel="Disconnect"
          onConfirm={() => run(() => disconnectBuddyAction(userId))}
        >
          <Button variant="outline">
            <Sparkles aria-hidden className="h-4 w-4" />
            Study buddies
          </Button>
        </ConfirmDialog>
      ) : relationship.incoming_buddy_request ? (
        <Button
          variant="secondary"
          loading={busy}
          onClick={() =>
            run(
              () =>
                respondBuddyRequestAction(relationship.incoming_buddy_request!.id, true),
              "Study buddies!",
            )
          }
        >
          <Sparkles aria-hidden className="h-4 w-4" />
          Accept buddy request
        </Button>
      ) : relationship.outgoing_buddy_request ? (
        <Button variant="outline" disabled>
          Buddy request sent ✓
        </Button>
      ) : buddyAvailable ? (
        <Button
          variant="outline"
          loading={busy}
          onClick={() => run(() => sendBuddyRequestAction(userId), "Buddy request sent!")}
        >
          <Sparkles aria-hidden className="h-4 w-4" />
          Ask to be study buddies
        </Button>
      ) : null}

      {/* ── Block ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        title={`Block ${displayName}?`}
        description="This removes any friendship and buddy connection, cancels pending requests both ways, and stops them from messaging you, sending requests, or seeing your profile. They won't be told."
        confirmLabel="Block"
        onConfirm={() => run(() => blockUserAction(userId), "Blocked.")}
      >
        <Button variant="ghost" className="text-ink-muted hover:text-danger font-['Times_New_Roman']">
          <ShieldBan aria-hidden className="h-4 w-4" />
          Block
        </Button>
      </ConfirmDialog>

      <ReportDialog userId={userId} displayName={displayName} />
    </div>
  );
}

/**
 * The report form (spec §5.14): required category, optional description,
 * the false-reports warning, and an on-screen confirmation after
 * submitting.
 */
function ReportDialog({ userId, displayName }: { userId: string; displayName: string }) {
  const [state, formAction, pending] = useActionState(reportUserAction, {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-ink-muted hover:text-danger font-['Times_New_Roman']">
          <Flag aria-hidden className="h-4 w-4" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Report {displayName}</DialogTitle>
        <DialogDescription className="font-['Times_New_Roman'] text-base">
          The team reviews every report. <strong>Heads up: submitting false or abusive
          reports may result in action against your own account.</strong>
        </DialogDescription>

        {state.success ? (
          <p role="status" className="mt-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            {state.success}
          </p>
        ) : (
          <form onSubmit={submitWithoutReset(formAction)} noValidate className="mt-4 space-y-4 font-['Times_New_Roman']">
            <input type="hidden" name="reported_user_id" value={userId} />
            <div>
              <Label htmlFor="report-category">What&rsquo;s going on?</Label>
              <Select
                id="report-category"
                name="category"
                required
                defaultValue=""
                aria-invalid={!!state.fieldErrors?.category}
                aria-describedby="report-category-error"
              >
                <option value="" disabled>
                  Pick a reason…
                </option>
                {REPORT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
              <FieldError id="report-category-error" error={state.fieldErrors?.category} />
            </div>
            <div>
              <Label htmlFor="report-description">Details (optional)</Label>
              <Textarea
                id="report-description"
                name="description"
                maxLength={REPORT_DESCRIPTION_MAX}
                rows={4}
                placeholder="What happened? Links, group names, and dates all help."
                aria-describedby="report-description-error"
              />
              <FieldError
                id="report-description-error"
                error={state.fieldErrors?.description}
              />
            </div>
            {state.error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" variant="danger" className="w-full" loading={pending}>
              Submit Report
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
