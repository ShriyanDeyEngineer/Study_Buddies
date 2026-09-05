/**
 * The smart join control (spec §5.7) — renders exactly ONE of the seven
 * states decided by getJoinState() and wires the two actionable ones:
 *
 *   join      → joins immediately (open group)
 *   request   → files a join request (closed group)
 *   requested → shows "Requested ✓", click to withdraw
 *   member / manager / full / unavailable → informational, no action
 *
 * The state is computed SERVER-side (the page passes it in) so first
 * paint is always correct; after acting we refresh the route so the next
 * server render recomputes it. Existing members never see a join option
 * because the state machine puts 'member' above everything but 'manager'.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Crown, Hourglass } from "lucide-react";
import {
  joinGroupAction,
  withdrawJoinRequestAction,
} from "@/lib/actions/groups";
import { JOIN_STATE_LABELS, type JoinState } from "@/lib/groups/join-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function JoinButton({
  groupId,
  state,
  size = "sm",
}: {
  groupId: string;
  state: JoinState;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  // Joining swaps the whole page (non-member preview → member view), so
  // there is nothing honest to render optimistically. Instead the button
  // stays in its loading state until the new page has actually arrived,
  // rather than going idle mid-flight still reading "Join".
  const busy = running || refreshing;

  async function handleJoin() {
    setRunning(true);
    const { result, error } = await joinGroupAction(groupId);
    setRunning(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      result === "joined"
        ? "You've joined the group."
        : "Request sent to the group manager.",
    );
    startRefresh(() => router.refresh());
  }

  async function handleWithdraw() {
    setRunning(true);
    const { error } = await withdrawJoinRequestAction(groupId);
    setRunning(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Request withdrawn.");
    startRefresh(() => router.refresh());
  }

  switch (state) {
    case "join":
      return (
        <Button size={size} loading={busy} onClick={handleJoin}>
          {JOIN_STATE_LABELS.join}
        </Button>
      );
    case "request":
      return (
        <Button size={size} variant="secondary" loading={busy} onClick={handleJoin}>
          {JOIN_STATE_LABELS.request}
        </Button>
      );
    case "requested":
      return (
        <Button
          size={size}
          variant="outline"
          loading={busy}
          onClick={handleWithdraw}
          title="Click to withdraw your request"
        >
          <Hourglass aria-hidden className="h-3.5 w-3.5" />
          {JOIN_STATE_LABELS.requested}
        </Button>
      );
    case "manager":
      return (
        <Badge variant="accent">
          <Crown aria-hidden className="h-3 w-3" />
          {JOIN_STATE_LABELS.manager}
        </Badge>
      );
    case "member":
      return (
        <Badge variant="success">
          <Check aria-hidden className="h-3 w-3" />
          {JOIN_STATE_LABELS.member}
        </Badge>
      );
    case "full":
      return <Badge variant="outline">{JOIN_STATE_LABELS.full}</Badge>;
    case "unavailable":
      return <Badge variant="outline">{JOIN_STATE_LABELS.unavailable}</Badge>;
  }
}
