/**
 * Layout for every SIGNED-IN page (dashboard, courses, groups, people,
 * messages, notifications, settings, profiles).
 *
 * This is the account checkpoint. In order:
 *   1. No session            → /login (middleware already does this;
 *                              repeated here so the rule holds even if
 *                              the middleware matcher misses a path)
 *   2. Session but NO profile → "sign out and start over" screen —
 *                              NEVER redirect to login (infinite bounce,
 *                              spec pitfall #4)
 *   3. Suspended / banned    → lockout screen with sign-out (§5.14)
 *   4. Not onboarded yet     → /onboarding (it lives OUTSIDE this route
 *                              group precisely so this redirect can't
 *                              loop)
 * Then: header, page content, mobile bottom nav.
 */
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/site";
import { AppHeader } from "@/components/app/app-header";
import { MobileNav } from "@/components/app/app-nav";
import {
  ProfileMissingScreen,
  SuspendedScreen,
  TermsUpdatedScreen,
} from "@/components/app/account-screens";
import type { ProfileRow } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getSessionProfile();

  if (!user) redirect("/login");
  if (!profile) return <ProfileMissingScreen />;

  const typedProfile = profile as ProfileRow;
  if (typedProfile.account_status !== "active") {
    return <SuspendedScreen status={typedProfile.account_status} />;
  }
  if (!typedProfile.display_name) redirect("/onboarding");

  // Legal terms changed since this user last accepted (or we have no
  // record) → re-consent screen before anything else in the app. Onboarding
  // stamps the current version, so a fresh account never sees this.
  if (typedProfile.terms_version !== TERMS_VERSION) {
    return <TermsUpdatedScreen />;
  }

  // Initial unread counts for the bell and the Messages badge. One RPC
  // (0034) rather than two separate COUNT requests — this layout re-runs
  // on every navigation and every router.refresh(), so halving its request
  // count matters under concurrent load. See AppHeader's header comment for
  // why the counts are fetched here at all.
  const { data: countRows } = await supabase.rpc("get_unread_counts");
  const counts = (countRows?.[0] ?? null) as
    | { unread_notifications: number; unread_messages: number }
    | null;
  const unreadNotifications = counts?.unread_notifications ?? 0;
  const unreadMessages = counts?.unread_messages ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Hidden until focused — lets a keyboard user jump past the logo,
          nav links, bell, and avatar menu instead of tabbing through all
          of it on every single page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <AppHeader
        profile={typedProfile}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
      />
      {/* pb-20 keeps content clear of the mobile bottom bar. */}
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-20 md:pb-8">
        {children}
      </main>
      <MobileNav
        userId={typedProfile.id}
        initialUnreadMessages={unreadMessages}
        isAdmin={typedProfile.is_admin}
      />
    </div>
  );
}
