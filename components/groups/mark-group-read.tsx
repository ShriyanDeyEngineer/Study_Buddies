/**
 * Records "this member has seen the chat up to now" when the group page
 * opens, so the batched chat digest (migration 0043) never emails someone
 * about messages they already read.
 *
 * Renders nothing. It exists as a component purely because marking is a
 * WRITE and the group page is a server component — a render may run more
 * than once and must stay side-effect free, so the write happens on mount
 * instead.
 *
 * Runs once per mount, not on an interval: someone sitting on the page
 * for an hour with the tab open is handled by the digest's own quiet
 * period, and polling this would be a write per member per tick for no
 * real gain.
 */
"use client";

import * as React from "react";
import { markGroupReadAction } from "@/lib/actions/groups";

export function MarkGroupRead({ groupId }: { groupId: string }) {
  React.useEffect(() => {
    void markGroupReadAction(groupId);
  }, [groupId]);

  return null;
}
