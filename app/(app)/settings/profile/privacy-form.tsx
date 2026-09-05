/**
 * The per-field privacy switches (spec §5.11). Each switch hides one
 * field from everyone else — stripped by the database, not just the UI —
 * and ALSO removes you from that field's people-filter (a hidden major
 * means you never appear in major-filtered results at all).
 *
 * Saves automatically on every flip: privacy changes shouldn't wait
 * behind an unrelated "Save" button.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updatePrivacyAction,
  setBuddyAvailabilityAction,
  setEmailNotificationsAction,
} from "@/lib/actions/profile";
import type { PrivacyFlags } from "@/lib/validation/profile";
import type { ProfileRow } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const PRIVACY_SWITCHES: { key: keyof PrivacyFlags; label: string; hint: string }[] = [
  { key: "college", label: "College", hint: "Also removes you from the college filter." },
  { key: "major", label: "Major", hint: "Also removes you from the major filter." },
  { key: "class_standing", label: "Class standing", hint: "Also removes you from the standing filter." },
  { key: "bio", label: "Bio", hint: "Hides your bio text." },
  { key: "graduation", label: "Graduation date", hint: "Also removes you from graduation-year filters and same-year suggestions." },
  { key: "social_links", label: "Social links", hint: "Hides all your links." },
  { key: "courses_current", label: "Current classes", hint: "Also removes you from course filters, classmate invite lists, and shared-class suggestions." },
  { key: "courses_taken", label: "Classes taken", hint: "Hides the list from your profile." },
  { key: "courses_future", label: "Planned classes", hint: "Hides the list from your profile." },
];

export function PrivacyForm({ profile }: { profile: ProfileRow }) {
  const router = useRouter();
  const [privacy, setPrivacy] = React.useState<PrivacyFlags>(profile.privacy ?? {});
  const [pending, startTransition] = React.useTransition();

  function toggle(key: keyof PrivacyFlags, hidden: boolean) {
    const next = { ...privacy, [key]: hidden || undefined };
    // Drop false/undefined keys so the stored JSON stays minimal.
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v === true),
    ) as PrivacyFlags;
    setPrivacy(cleaned);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("privacy", JSON.stringify(cleaned));
      const result = await updatePrivacyAction({}, formData);
      if (result.error) {
        toast.error(result.error);
        setPrivacy(profile.privacy ?? {}); // roll back the optimistic flip
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <h2 className="font-display text-xl text-ink">Privacy</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Flip a switch to HIDE that field from everyone but you. Hidden fields are
          removed server-side and exclude you from the matching search filter —
          nobody can find out by filtering, either.
        </p>

        <ul className="divide-y divide-line">
          {PRIVACY_SWITCHES.map(({ key, label, hint }) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Hide {label.toLowerCase()}</p>
                <p className="text-xs text-ink-muted">{hint}</p>
              </div>
              <Switch
                checked={privacy[key] === true}
                disabled={pending}
                onCheckedChange={(checked) => toggle(key, checked === true)}
                aria-label={`Hide ${label.toLowerCase()} from other users`}
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-accent-light/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">Study-buddy availability</p>
            <p className="text-xs text-ink-muted">
              On = you appear in study-buddy discovery and can receive buddy requests.
            </p>
          </div>
          <Switch
            checked={profile.is_available_for_buddies}
            disabled={pending}
            onCheckedChange={(checked) => {
              startTransition(async () => {
                await setBuddyAvailabilityAction(checked === true);
                router.refresh();
              });
            }}
            aria-label="Available for study buddy sessions"
          />
        </div>

        {/* Email notifications (bug report #9). Defaults on; the webhook
            that sends them checks this flag first. */}
        <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Email me about group &amp; friend activity</p>
            <p className="text-xs text-ink-muted">
              Invites, approvals, new meetups, cancellations, friend requests. Chat
              messages are never emailed. You&rsquo;ll always see everything in the bell.
            </p>
          </div>
          <Switch
            checked={profile.email_notifications ?? true}
            disabled={pending}
            onCheckedChange={(checked) => {
              startTransition(async () => {
                await setEmailNotificationsAction(checked === true);
                router.refresh();
              });
            }}
            aria-label="Email me about group and friend activity"
          />
        </div>
      </CardContent>
    </Card>
  );
}
