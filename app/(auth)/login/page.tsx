/**
 * Sign-in page. One method only: "Continue with UMN Google" (product
 * decision, 2026-08-06 — passwords are gone entirely).
 *
 * Also where OAuth failures land: /auth/callback redirects here with
 * ?error=<friendly text> — most importantly the "Only @umn.edu accounts"
 * message when someone picked a personal Gmail in Google's chooser.
 */
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card>
      <CardContent>
        <h1 className="font-display text-2xl text-ink">Welcome back</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted font-['Times_New_Roman']">
          Sign in with your UMN Google account.
        </p>

        {/* OAuth error handoff (e.g. non-UMN Google account rejected). */}
        {params.error && (
          <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger font-['Times_New_Roman']">
            {params.error}
          </p>
        )}

        <GoogleButton next={params.next} />

        <p className="mt-6 text-center text-sm text-ink-muted font-['Times_New_Roman']">
          First time here? Your account gets created the first time you sign in.
        </p>
      </CardContent>
    </Card>
  );
}
