/**
 * The banner above people search asking whether YOU are open to being a
 * study buddy — flipping it on is what makes you discoverable in the
 * buddies-only filter (spec §5.10).
 *
 * The switch is driven by local state, not the server prop, so it moves
 * under your finger instead of after a round trip. The prop re-syncs it
 * whenever fresh server data lands.
 */
"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { setBuddyAvailabilityAction } from "@/lib/actions/profile";
import { Switch } from "@/components/ui/switch";

export function BuddyPromo({ available }: { available: boolean }) {
  const [on, setOn] = React.useState(available);
  React.useEffect(() => setOn(available), [available]);

  async function toggle(checked: boolean) {
    setOn(checked);
    try {
      await setBuddyAvailabilityAction(checked);
      toast.success(
        checked
          ? "You're now listed as available."
          : "You won't appear in buddy searches.",
      );
    } catch {
      setOn(!checked);
      toast.error("Couldn't save that — try again.");
    }
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-xl bg-accent-light/50 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-primary">
        <Sparkles aria-hidden className="h-4 w-4" />
        {on
          ? "You're discoverable as a study buddy — classmates can send you buddy requests."
          : "Turn this on to appear in study-buddy searches and get 1 on 1 partner requests."}
      </p>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-primary">
        <Switch
          checked={on}
          onCheckedChange={(checked) => void toggle(checked === true)}
          aria-label="Available for study buddy sessions"
        />
        {on ? "On" : "Off"}
      </label>
    </div>
  );
}
