/**
 * Full-screen "you can't use the app right now" states, rendered by the
 * app layout INSTEAD of the page when something is wrong with the
 * account itself:
 *
 *   <SuspendedScreen>      — account_status is suspended/banned (spec
 *                            §5.14: explanatory screen + sign out).
 *   <ProfileMissingScreen> — session exists but its profile row doesn't.
 *                            Redirecting to login would BOUNCE FOREVER
 *                            (middleware sends signed-in users right
 *                            back) — spec pitfall #4 — so we break the
 *                            loop with a sign-out screen instead.
 */
import { Ban, ScrollText, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { acceptCurrentTermsAction, signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogoLockup } from "@/components/buddies-logo";
import { CONTACT_EMAIL } from "@/lib/site";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mb-8">
        <LogoLockup />
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="text-center">{children}</CardContent>
      </Card>
    </main>
  );
}

const LOCKOUT_COPY = {
  banned: {
    title: "Your account has been banned",
    body: "A review found activity that breaks our community rules, and this account can no longer use Study Buddies. If you would like to attempt to repeal this ban, please contact the email address on our home page footer.",
  },
  suspended: {
    title: "Your account is suspended",
    body: "Your account was suspended after a report was reviewed. If you believe this is a mistake, contact the team using the email address on our home page footer.",
  },
  paused: {
    title: "Your account is paused",
    body:
      "An admin has paused this account, so it can't be used right now. Nothing " +
      `has been deleted. Email ${CONTACT_EMAIL} and we'll help sort it out.`,
  },
  deleted: {
    title: "This account has been deleted",
    body: "This account was deleted and its profile removed. Old messages remain, shown as Deleted User. Sign out and sign in with Google again to start a brand-new account.",
  },
} as const;

export function SuspendedScreen({
  status,
}: {
  status: "paused" | "suspended" | "banned" | "deleted";
}) {
  return (
    <Shell>
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
        <Ban aria-hidden className="h-7 w-7 text-danger" />
      </span>
      <h1 className="font-display text-2xl text-ink">{LOCKOUT_COPY[status].title}</h1>
      <p className="mt-2 text-sm text-ink-muted">{LOCKOUT_COPY[status].body}</p>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </Shell>
  );
}

export function TermsUpdatedScreen() {
  return (
    <Shell>
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <ScrollText aria-hidden className="h-7 w-7 text-primary" />
      </span>
      <h1 className="font-display text-2xl text-ink">We&rsquo;ve updated our terms</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Our{" "}
        <Link href="/terms_of_service" target="_blank" rel="noopener" className="font-medium text-primary underline underline-offset-2">
          Terms of Service
        </Link>
        ,{" "}
        <Link href="/privacy_policy" target="_blank" rel="noopener" className="font-medium text-primary underline underline-offset-2">
          Privacy Policy
        </Link>
        , and{" "}
        <Link href="/communityRulesGuidelines" target="_blank" rel="noopener" className="font-medium text-primary underline underline-offset-2">
          Community Guidelines
        </Link>{" "}
        have changed since you last accepted them. Please review them and accept
        again to keep using Study Buddies.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <form action={acceptCurrentTermsAction}>
          <Button type="submit" className="w-full">
            I agree to the updated terms
          </Button>
        </form>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </Shell>
  );
}

export function ProfileMissingScreen() {
  return (
    <Shell>
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
        <TriangleAlert aria-hidden className="h-7 w-7 text-warning" />
      </span>
      <h1 className="font-display text-2xl text-ink">There was a problem setting up your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        You're signed in, but your profile didn't finish setting up. Sign out and
        register again. If it keeps happening, contact the team.
      </p>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline">
          Sign out and start over
        </Button>
      </form>
    </Shell>
  );
}
