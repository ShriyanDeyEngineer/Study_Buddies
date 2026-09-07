/**
 * Why Use It (/why) — argument cards drawn directly from the problem
 * statement in the spec (§1). Static page.
 */
import type { Metadata } from "next";
import {
  Clock,
  DoorOpen,
  Landmark,
  MessagesSquare,
  Table2,
  UserRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Our Reasoning",
  description:
    "Why study groups beat studying alone — and why finding one at the U is harder than it should be.",
};

const ARGUMENTS = [
  {
    icon: Landmark,
    title: "Office Hours Don't Fit Everyone Everytime",
    body: "Your schedule may not be compatible with the typically fixed office hours of your courses. You can easily find an alternate form of support which fits your schedule with a group of other students in the same courses as you.",
  },
  {
    icon: DoorOpen,
    title: "Open Groups Beat Cold Approaches",
    body: "Walking up to strangers in a 300-person lecture takes nerve. Clicking \"Join\" on an open group doesn't.",
  },
  {
    icon: UserRound,
    title: "Every Section Isn't Equal",
    body: "Some sections get more support than others. Study buddy groups connect students across sections, so everyone has easier access to those that \"make it click.\"",
  },
  {
    icon: Table2,
    title: "Efficient Meeting Planning with Your Fellow Students",
    body: "Once you join a study group, plan in person/online meetings with students in the same group through availability polls and chat messages. With the click of a button, send and store scheduled meetings inside of your Google Calendar.",
  },
  {
    icon: MessagesSquare,
    title: "It's a Conversation Starter",
    body: "Asking someone to join your study group is an easy way to start a conversation. Many friendships start with a shared problem set.",
  },
];

export default function WhyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl text-ink">Why Use Study Buddies?</h1>
        <p className="mt-4 text-ink-muted">
           To be academically successful, it's always better studying with others than alone.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-1 lg:grid-cols-1">
        {ARGUMENTS.map((argument) => (
          <Card key={argument.title} className="h-full">
            <CardContent>
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light">
                <argument.icon aria-hidden className="h-5 w-5 text-primary" />
              </span>
              <h2 className="font-display text-lg text-ink">{argument.title}</h2>
              <p className="mt-2 text-sm text-ink-muted">{argument.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
