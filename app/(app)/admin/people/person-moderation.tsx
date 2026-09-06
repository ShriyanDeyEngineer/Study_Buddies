/**
 * Mute and pause controls for one account on /admin/people.
 *
 * Both are confirmed before firing — they change what another student can
 * do — and both are reversible, which the copy says explicitly so an
 * admin isn't afraid to use them.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MicOff, Mic, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { setUserMutedAction, setUserPausedAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function PersonModeration({
  userId,
  name,
  isMuted,
  isPaused,
}: {
  userId: string;
  name: string;
  isMuted: boolean;
  isPaused: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ error?: string }>, done: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(done);
      router.refresh();
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {isMuted ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(() => setUserMutedAction(userId, false), "Unmuted.")}
        >
          <Mic aria-hidden className="h-4 w-4" />
          Unmute
        </Button>
      ) : (
        <ConfirmDialog
          title={`Mute ${name}?`}
          description="They'll still be able to browse, join groups, RSVP and vote — but not send messages or DMs, or create meetups, polls, groups or resources. Reversible at any time."
          confirmLabel="Mute"
          onConfirm={() => run(() => setUserMutedAction(userId, true), "Muted.")}
        >
          <Button size="sm" variant="outline" disabled={busy}>
            <MicOff aria-hidden className="h-4 w-4" />
            Mute
          </Button>
        </ConfirmDialog>
      )}

      {isPaused ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(() => setUserPausedAction(userId, false), "Unpaused.")}
        >
          <PlayCircle aria-hidden className="h-4 w-4" />
          Unpause
        </Button>
      ) : (
        <ConfirmDialog
          title={`Pause ${name}?`}
          description="They won't be able to use their account at all — they'll see a screen explaining it's paused and asking them to email us. Nothing is deleted, and unpausing restores everything."
          confirmLabel="Pause account"
          onConfirm={() => run(() => setUserPausedAction(userId, true), "Account paused.")}
        >
          <Button size="sm" variant="danger" disabled={busy}>
            <PauseCircle aria-hidden className="h-4 w-4" />
            Pause
          </Button>
        </ConfirmDialog>
      )}
    </div>
  );
}
