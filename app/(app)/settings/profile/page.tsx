/**
 * Profile settings (/settings/profile): edit every profile field, upload
 * a picture, manage the per-field privacy switches, and the study-buddy
 * availability toggle.
 */
import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types";
import { ProfileForm } from "./profile-form";
import { PrivacyForm } from "./privacy-form";
import { DeleteAccountCard } from "./delete-account";

export const metadata = { title: "Edit profile" };

export default async function ProfileSettingsPage() {
  const { profile } = await getSessionProfile();
  if (!profile) return null;
  const typedProfile = profile as ProfileRow;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-ink">Edit profile</h1>
      <p className="mt-1 mb-6 text-ink-muted font-['Times_New_Roman']">
        Anything shared here is what classmates see on{" "}
        <Link
          href={`/profile/${typedProfile.id}`}
          className="text-primary underline underline-offset-2"
        >
          your profile
        </Link>
        {""}except the fields you choose to hide.
      </p>

      <div className="space-y-8">
        <ProfileForm profile={typedProfile} />
        <PrivacyForm profile={typedProfile} />
        <DeleteAccountCard />
      </div>
    </div>
  );
}
