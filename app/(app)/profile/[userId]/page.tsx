/**
 * A user profile (/profile/[userId]) — spec §5.11.
 *
 * Everything shown comes from get_public_profile(), which strips hidden
 * fields IN THE DATABASE — a field the owner hid is absent from the JSON
 * this page receives, so there is nothing here to accidentally render.
 * A null response (nonexistent user, suspended account, or the owner
 * blocked YOU) is a plain 404 — indistinguishable on purpose.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, GraduationCap, LinkIcon, Users } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { CLASS_STANDINGS, COLLEGES } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileActions } from "./profile-actions";
import { pluralize } from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape of get_public_profile()'s JSON. Optional keys are the hideable
 *  fields — absent when hidden (that absence IS the privacy feature). */
interface PublicProfileData {
  id: string;
  display_name: string;
  avatar_url: string | null;
  friend_count: number;
  member_since: string;
  is_available_for_buddies: boolean;
  college?: string | null;
  major?: string | null;
  class_standing?: string | null;
  bio?: string | null;
  graduation_month?: number | null;
  graduation_year?: number | null;
  social_links?: string[];
  courses_current?: CourseEntry[];
  courses_taken?: CourseEntry[];
  courses_future?: CourseEntry[];
  relationship?: {
    is_friend: boolean;
    outgoing_friend_request: { id: string } | null;
    incoming_friend_request: { id: string } | null;
    is_buddy: boolean;
    outgoing_buddy_request: { id: string } | null;
    incoming_buddy_request: { id: string } | null;
    blocked_by_me: boolean;
  };
}

interface CourseEntry {
  id: string;
  department_code: string;
  course_number: string;
  course_name: string;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!UUID_RE.test(userId)) notFound();

  const { supabase, profile: me } = await getSessionProfile();
  if (!me) return null;

  const { data } = await supabase.rpc("get_public_profile", { p_user_id: userId });
  const person = data as PublicProfileData | null;
  if (!person) notFound();

  const isOwn = person.id === me.id;
  const collegeLabel = COLLEGES.find((c) => c.value === person.college)?.label;
  const standingLabel = CLASS_STANDINGS.find(
    (s) => s.value === person.class_standing,
  )?.label;

  const graduation =
    person.graduation_year != null
      ? person.graduation_month != null
        ? `${format(new Date(2000, person.graduation_month - 1, 1), "MMMM")} ${person.graduation_year}`
        : String(person.graduation_year)
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardContent>
          <div className="flex flex-col items-start gap-5 sm:flex-row">
            <Avatar src={person.avatar_url} name={person.display_name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-words font-display text-3xl text-ink">{person.display_name}</h1>
                {person.is_available_for_buddies && (
                  <Badge variant="success">Open to study buddy</Badge>
                )}
              </div>

              <p className="mt-1 text-sm text-ink-muted">
                {[standingLabel, person.major, collegeLabel].filter(Boolean).join(" · ")}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Users aria-hidden className="h-4 w-4" />
                  {pluralize(person.friend_count, "friend")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="h-4 w-4" />
                  Joined {format(new Date(person.member_since), "MMMM yyyy")}
                </span>
                {graduation && (
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap aria-hidden className="h-4 w-4" />
                    Graduating {graduation}
                  </span>
                )}
              </div>

              {person.bio && (
                <p className="mt-4 whitespace-pre-wrap break-words text-sm text-ink">{person.bio}</p>
              )}

              {person.social_links && person.social_links.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {person.social_links.map((link) => (
                    <li key={link}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
                      >
                        <LinkIcon aria-hidden className="h-3.5 w-3.5" />
                        <span className="max-w-xs truncate">
                          {link.replace(/^https?:\/\//, "")}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5">
                {isOwn ? (
                  <Button asChild variant="secondary">
                    <Link href="/settings/profile">Edit profile</Link>
                  </Button>
                ) : (
                  person.relationship && (
                    <ProfileActions
                      userId={person.id}
                      displayName={person.display_name}
                      buddyAvailable={person.is_available_for_buddies}
                      relationship={person.relationship}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The three class lists — each key is simply absent when hidden. */}
      {(["courses_current", "courses_taken", "courses_future"] as const).map((key) => {
        const list = person[key];
        if (!list) return null; // hidden by the owner
        const titles = {
          courses_current: "Taking now",
          courses_taken: "Already taken",
          courses_future: "Planning to take",
        } as const;
        return (
          <section key={key} aria-label={titles[key]} className="mt-6">
            <h2 className="mb-2 font-display text-lg text-ink">{titles[key]}</h2>
            {list.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing here yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {list.map((course) => (
                  <li key={`${key}-${course.id}`}>
                    <Link
                      href={`/courses/${course.id}`}
                      className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                      title={course.course_name}
                    >
                      {course.department_code} {course.course_number}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
