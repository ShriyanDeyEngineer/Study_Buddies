/**
 * About Us (/about) — the mission and the five founders. Static page.
 */
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "About",
  description:
    "The student team behind Study Buddies and why we built it.",
};

const CONTRIBUTORS = [
  { name: "Shriyan Dey", role: "Co-founder & Developer (Full-Stack)", major: "Major: Computer Engineering" },
  { name: "anonymous", role: "---------------------", major: "---------------------" },
  { name: "Aadi Sharma", role: "Developer (Full-Stack)", major: "Major: Electrical Engineering" },
  { name: "anonymous", role: "---------------------", major: "---------------------" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl text-ink">About The Team</h1>
        <p className="mt-4 text-ink-muted">
          We&rsquo;re a group of UMN students who saw and felt how hard it is to find 
          a group of peers from our classes to study with. Whether it be because we 
          learned better with others, because resources like office hours weren&rsquo;t 
          fitting with our schedules, or because we just wanted to meet more people 
          going through the same experiences as us, all of us wanted an easy way to find a study group.
        </p>
        <p className="mt-4 text-ink-muted">
          Study Buddies is our fix: finding people in your course takes
          two clicks, joining a group doesn&rsquo;t require being outgoing, and
          scheduling a session doesn&rsquo;t take a long text thread. It&rsquo;s
          free, student-run, and built because we wanted it ourselves.
        </p>
      </div>

      <h2 className="mt-14 text-center font-display text-2xl text-ink">The Team</h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {CONTRIBUTORS.map((contributor, index) => (
          // Key by index: two contributors are listed as "anonymous", so
          // the name is not unique.
          <Card key={index}>
            <CardContent className="flex flex-col items-center text-center">
              <Avatar name={contributor.name} size="xl" />
              <h3 className="mt-4 font-medium text-ink">{contributor.name}</h3>
              <p className="text-sm text-ink-muted">{contributor.role}</p>
              <p className="text-sm text-ink-muted">{contributor.major}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
