/**
 * Onboarding (first sign-in only): guards the session, bounces anyone
 * who already finished, loads the course catalog for step 2's picker,
 * and hands off to the client wizard.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { suggestNameParts } from "@/lib/names";
import { ProfileMissingScreen } from "@/components/app/account-screens";
import type { CourseRow, ProfileRow } from "@/lib/types";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Welcome!" };

export default async function OnboardingPage() {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  if (!profile) return <ProfileMissingScreen />;

  const typedProfile = profile as ProfileRow;
  // Already onboarded? Nothing to do here.
  if (typedProfile.display_name) redirect("/dashboard");

  // The whole catalog for the course picker. Fine to ship to the client
  // at seed-catalog size (~50 rows); if the catalog grows past a few
  // hundred, switch the picker to server-side search.
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("is_active", true)
    .order("department_code")
    .order("course_number");

  // Google accounts arrive with a name we can politely prefill (still
  // editable — it's a suggestion, not a decision).
  const suggestedName = suggestNameParts(user.user_metadata);

  return (
    <OnboardingWizard
      courses={(courses ?? []) as CourseRow[]}
      suggestedName={suggestedName}
    />
  );
}
