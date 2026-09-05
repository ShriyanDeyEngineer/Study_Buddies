/**
 * Accept / Decline controls shown on a group's preview when YOU have a
 * pending invitation to it (spec §5.6: invitees can accept or decline).
 * Replaces the ordinary join control — accepting an invitation seats you
 * even in a closed group, no request needed.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MailOpen } from "lucide-react";
import { toast } from "sonner";
import { respondToInvitationAction } from "@/lib/actions/groups";
import { Button } from "@/components/ui/button";

export function InvitationBanner({
  invitationId,
  inviterName,
}: {
  invitationId: string;
  inviterName: string | null;
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  // Accepting replaces this banner with the whole member view, so keep
  // the buttons busy until that view is here rather than dropping back to
  // an idle "Accept invitation" that has already been accepted.
  const busy = running || refreshing;

  async function respond(accept: boolean) {
    setRunning(true);
    const { result, error } = await respondToInvitationAction(invitationId, accept);
    setRunning(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (result === "joined") {
      toast.success("You've joined the group.");
    } else if (result === "cancelled_full") {
      toast.warning("Ah, bad luck — the group filled up before you accepted.");
    }
    startRefresh(() => router.refresh());
  }

  return (
    <div className="rounded-xl bg-accent-light/50 p-4 text-center">
      <p className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
        <MailOpen aria-hidden className="h-4 w-4" />
        {inviterName ?? "A member"} invited you to this group
      </p>
      <div className="mt-3 flex justify-center gap-3">
        <Button loading={busy} onClick={() => respond(true)}>
          Accept invitation
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => respond(false)}>
          Decline
        </Button>
      </div>
    </div>
  );
}
