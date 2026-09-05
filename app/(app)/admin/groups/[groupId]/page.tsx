/**
 * /admin/groups/[groupId] — read-only observation of one group: full
 * chat log, members, meetups, resources. Everything renders as static
 * server output — no composer, no RSVP buttons, no realtime channel —
 * so observation cannot write and leaves no trace. The admin RLS
 * policies (0020) are what let these queries return rows without
 * membership.
 */
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import {
  courseCode,
  type CourseRow,
  type GroupMemberRow,
  type GroupMessageRow,
  type GroupResourceRow,
  type MeetupRow,
  type PublicProfile,
  type StudyGroupRow,
} from "@/lib/types";
import { GROUP_RESOURCES_LIMIT } from "@/lib/constants";
import { adminPersonLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { format, formatDistanceToNow } from "date-fns";
import { Crown, ExternalLink } from "lucide-react";
import Link from "next/link";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Observe group · Admin" };

export default async function AdminGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) notFound();

  const { supabase } = await getSessionProfile();
  const groupRes = await supabase
    .from("study_groups")
    .select("*, courses(*)")
    .eq("id", groupId)
    .maybeSingle();
  const group = groupRes.data as (StudyGroupRow & { courses: CourseRow }) | null;
  if (!group) notFound();

  const [messagesRes, membersRes, meetupsRes, resourcesRes, flagsRes] =
    await Promise.all([
      supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("study_group_members")
        .select("*")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("meetups")
        .select("*")
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: false })
        .limit(30),
      supabase
        .from("group_resources")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(GROUP_RESOURCES_LIMIT),
      // Open/reviewing user flags on this group's content (0040).
      supabase
        .from("content_flags")
        .select("content_type, content_id")
        .eq("group_id", groupId)
        .in("status", ["open", "reviewing"]),
    ]);
  const messages = ((messagesRes.data ?? []) as GroupMessageRow[]).reverse();
  const members = (membersRes.data ?? []) as GroupMemberRow[];
  const meetups = (meetupsRes.data ?? []) as MeetupRow[];
  const resources = (resourcesRes.data ?? []) as GroupResourceRow[];

  const flagRows = (flagsRes.data ?? []) as {
    content_type: string;
    content_id: string;
  }[];
  const flaggedMessageIds = new Set(
    flagRows.filter((f) => f.content_type === "group_message").map((f) => f.content_id),
  );
  const flaggedResourceIds = new Set(
    flagRows.filter((f) => f.content_type === "group_resource").map((f) => f.content_id),
  );

  const everyoneIds = [
    ...new Set([
      ...members.map((m) => m.user_id),
      ...messages.map((m) => m.sender_id),
      ...resources.map((r) => r.author_id),
    ]),
  ];
  const profilesRes = everyoneIds.length
    ? await supabase.from("public_profiles").select("*").in("id", everyoneIds)
    : { data: [] };
  const profiles = Object.fromEntries(
    ((profilesRes.data ?? []) as PublicProfile[]).map((p) => [p.id, p]),
  );
  const nameOf = (id: string) => adminPersonLabel(profiles[id]?.display_name, id);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            {courseCode(group.courses)} · read-only observation
          </p>
          <h2 className="break-words font-display text-2xl text-ink">{group.name}</h2>
        </div>
        <Badge variant={group.status === "active" ? "success" : "danger"}>
          {group.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* chat log */}
        <section aria-label="Chat log" className="rounded-xl border border-line bg-surface shadow-sm">
          <h3 className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">
            Chat — latest {messages.length} messages
          </h3>
          <div className="max-h-[32rem] overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">No messages.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="mb-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    <span className="font-medium text-ink">{nameOf(message.sender_id)}</span>{" "}
                    · {format(new Date(message.created_at), "MMM d, h:mm a")}
                    {flaggedMessageIds.has(message.id) && (
                      <Badge variant="danger">🚩 flagged</Badge>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-ink">
                    {message.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          {/* members */}
          <section aria-label="Members" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-ink">
              Members ({members.length}/{group.capacity})
            </h3>
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.user_id} className="flex items-center gap-2 text-sm text-ink">
                  <Avatar
                    src={profiles[member.user_id]?.avatar_url}
                    name={nameOf(member.user_id)}
                    size="sm"
                  />
                  <Link
                    href={`/profile/${member.user_id}`}
                    className="truncate underline-offset-2 hover:underline"
                  >
                    {nameOf(member.user_id)}
                  </Link>
                  {member.user_id === group.manager_id && (
                    <Crown aria-label="Manager" className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                  <span className="ml-auto shrink-0 text-xs text-ink-muted">
                    joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* meetups */}
          <section aria-label="Meetups" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-ink">Meetups</h3>
            {meetups.length === 0 ? (
              <p className="text-sm text-ink-muted">None scheduled.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {meetups.map((meetup) => (
                  <li key={meetup.id} className={meetup.is_cancelled ? "text-ink-muted line-through" : "text-ink"}>
                    <span className="font-medium">{meetup.title}</span>{" "}
                    · {format(new Date(meetup.scheduled_at), "MMM d, h:mm a")} ·{" "}
                    {meetup.format === "online" ? "online" : meetup.location}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* resources */}
          <section aria-label="Resources" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-ink">Resources</h3>
            {resources.length === 0 ? (
              <p className="text-sm text-ink-muted">None shared.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {resources.map((resource) => (
                  <li key={resource.id} className="min-w-0">
                    <span className="font-medium text-ink">{resource.title}</span>
                    <span className="text-xs text-ink-muted"> — {nameOf(resource.author_id)}</span>
                    {flaggedResourceIds.has(resource.id) && (
                      <Badge variant="danger" className="ml-1.5">
                        🚩 flagged
                      </Badge>
                    )}
                    {resource.kind === "link" ? (
                      <a
                        href={resource.content}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-0.5 flex max-w-full items-center gap-1 text-primary underline underline-offset-2"
                      >
                        <span className="truncate">{resource.content}</span>
                        <ExternalLink aria-hidden className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-ink-muted">
                        {resource.content}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
