/**
 * "Sign up" page. Since auth is Google-only (product decision,
 * 2026-08-06), signing up IS signing in — the first Google sign-in
 * creates the account and drops the student into onboarding. This page
 * exists because every marketing CTA says "Get started", and those
 * clicks deserve welcome copy, not a login form's "welcome back".
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Sign up" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <Card>
      <CardContent>
        <h1 className="font-display text-2xl text-ink">Join Study Buddies</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          For University of Minnesota students. Continue with your UMN
          Google account (the one ending in @umn.edu).
        </p>

        {params.error && (
          <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {params.error}
          </p>
        )}

        <GoogleButton next="/onboarding" errorPath="/register" />

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline underline-offset-2">
            Sign in
          </Link>.
        </p>
      </CardContent>
    </Card>
  );
}
