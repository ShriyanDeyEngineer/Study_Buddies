/**
 * The home page (/) — hero, "How it works" in three steps, features, and
 * a closing CTA. Static; copy leads with the big intro STEM courses
 * because CSE freshmen are the primary audience (spec §1) — but nothing
 * here excludes anyone else.
 */
import Link from "next/link";
import {
  CalendarClock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BuddiesLogo } from "@/components/buddies-logo";

const STEPS = [
  {
    title: "Sign in with UMN Google",
    body: "Sign in with your University of Minnesota Twin Cities Google account (@umn.edu). That's the only way in — no separate password needed.",
  },
  {
    title: "Pick Your Courses",
    body: "Tell us what you're taking — PHYS 1301W, MATH 1371, CSCI 1133, or anything at all. We'll connect you with classmates.",
  },
  {
    title: "Join or Create a Group",
    body: "Join an open group instantly, request a closed one, or create your own whilst inviting fellow classmates.",
  },
];

const FEATURES = [
  {
    icon: Users,
    title: "Groups for Your Exact Course",
    body: "Meet fellow students taking the same courses as you.",
  },
  {
    icon: MessageCircle,
    title: "Group Chats",
    body: "Live chat for real-time planning and studying for each individual study group.",
  },
  {
    icon: CalendarClock,
    title: "Built-In Calendar Compatibility",
    body: "Create meetings and directly add it to your Google Calendar with the click of a button — no back-and-forth.",
  },
  {
    icon: Vote,
    title: "Meetups that Fit Your Schedule",
    body: "Schedule virtual or in-person study sessions through the availability poll feature that show which slot works for the majority.",
  },
  {
    icon: Sparkles,
    title: "1:1 Study Sessions",
    body: "Turn on the study buddy option and individually pair up with students sharing your exact courses.",
  },
  {
    icon: ShieldCheck,
    title: "For the UMN Community",
    body: "Access requires a University of Minnesota Twin Cities Google account. Per-field privacy settings and blocking controls are built in.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-primary text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:py-28">
          <BuddiesLogo className="h-20 w-20 text-accent-light" />
          <h1 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
            Find Your Study Buddies
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Find study partners and join or create study groups for your UMN courses.
            <span className="font-bold text-accent-light"> It's FREE to use</span>, built by students, for students.
          </p>
          {/* Both buttons sit directly on this section's primary
              background, so — unlike the rest of the app — they keep the
              accent focus ring instead of the site-wide primary default: a
              primary ring would vanish here. */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="secondary" size="lg" className="focus-visible:outline-accent-light">
              <Link href="/register">Get Started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-white/40 bg-transparent text-white hover:bg-white/10 focus-visible:outline-accent-light"
            >
              <Link href="#how-it-works">See How it Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:py-20">
        <h2 className="text-center font-display text-3xl text-ink">How It Works</h2>
        <p className="mx-auto mt-2 max-w-md text-center text-ink-muted">
          Only 3 simple steps between you and your study group.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent>
                  <span
                    aria-hidden="true"
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-lg text-primary"
                  >
                    {index + 1}
                  </span>
                  <h3 className="font-display text-lg text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-center font-display text-3xl text-ink">
            Everything a Study Group Needs
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light">
                  <feature.icon aria-hidden className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <h3 className="font-medium text-ink">{feature.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
        <h2 className="font-display text-3xl text-ink">
          Ready to Find Your Study Buddies?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-ink-muted">
          Click the button below and reach your academic potential!
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/register">Find My Study Buddies!</Link>
        </Button>
      </section>
    </>
  );
}
