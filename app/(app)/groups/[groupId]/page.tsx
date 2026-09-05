/**
 * The group page (/groups/[groupId]) — spec §5.8.
 *
 * NON-MEMBERS get only the preview: name, course, member count, manager,
 * open/closed, and the join control. No chat, no meetups, no member
 * emails — and that's enforced twice: this page doesn't render them, and
 * the database's RLS wouldn't hand the rows to a non-member anyway.
 *
 * MEMBERS get the three panels — Chat, Meetups, Members — side by side
 * on desktop, stacked on mobile. Each panel is rendered exactly ONCE and
 * reflowed with CSS (never a desktop copy + hidden mobile copy — that
 * would open duplicate realtime subscriptions, spec §8).
 */
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { getJoinState } from "@/lib/groups/join-state";
import { CHAT_PAGE_SIZE, GROUP_RESOURCES_LIMIT } from "@/lib/constants";
import {
  courseCode,
  type AvailabilityPollRow,
  type AvailabilitySlotRow,
  type CourseRow,
  type GroupMemberRow,
  type GroupResourceRow,
  type GroupMessageRow,
  type JoinRequestRow,
  type MeetupAttendanceRow,
  type MeetupRow,
  type PublicProfile,
  type StudyGroupRow,
} from "@/lib/types";
import { JoinButton } from "@/components/groups/join-button";
import { InvitationBanner } from "@/components/groups/invitation-banner";
import { GroupChat } from "@/components/groups/group-chat";
import { MeetupsPanel } from "@/components/groups/meetups-panel";
import { MembersPanel } from "@/components/groups/members-panel";
import { PollsSection } from "@/components/groups/polls-section";
import { ResourcesPanel } from "@/components/groups/resources-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Users } from "lucide-react";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) notFound();

  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  // Both queries key off ids we already have (the route param and my own
  // id), so they go together — chaining the membership check behind the
  // group fetch cost a whole extra round trip on every render AND every
  // post-action refresh, for no dependency.
  const [groupRes, membershipRes] = await Promise.all([
    supabase.from("study_groups").select("*, courses(*)").eq("id", groupId).maybeSingle(),
    supabase
      .from("study_group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);
  const group = groupRes.data as (StudyGroupRow & { courses: CourseRow }) | null;
  if (!group) notFound();

  // Membership decides which page this is. (RLS lets me see my own row.)
  const isMember = !!membershipRes.data;
  const isManager = group.manager_id === profile.id;

  /* ── Non-member: the preview ──────────────────────────────────────── */
  if (!isMember) {
    const [managerRes, myRequestRes, myInvitationRes] = await Promise.all([
      supabase
        .from("public_profiles")
        .select("*")
        .eq("id", group.manager_id)
        .maybeSingle(),
      supabase
        .from("join_requests")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .maybeSingle(),
      supabase
        .from("group_invitations")
        .select("id, inviter_id")
        .eq("group_id", groupId)
        .eq("invited_user_id", profile.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);
    const manager = managerRes.data as PublicProfile | null;
    const invitation = myInvitationRes.data as { id: string; inviter_id: string } | null;

    // Resolve the inviter's name for the invitation banner.
    let inviterName: string | null = null;
    if (invitation) {
      const inviterRes = await supabase
        .from("public_profiles")
        .select("display_name")
        .eq("id", invitation.inviter_id)
        .maybeSingle();
      inviterName = (inviterRes.data?.display_name as string | null) ?? null;
    }

    const state = getJoinState({
      groupStatus: group.status,
      mode: group.mode,
      memberCount: group.member_count,
      capacity: group.capacity,
      isManager: false,
      isMember: false,
      hasPendingRequest: !!myRequestRes.data,
    });

    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              {courseCode(group.courses)}
            </p>
            <h1 className="mt-1 break-words font-display text-3xl text-ink">{group.name}</h1>
            {group.description && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-muted">
                {group.description}
              </p>
            )}

            <div className="mt-4 flex items-center justify-center gap-4 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users aria-hidden className="h-4 w-4" />
                {group.member_count}/{group.capacity} members
              </span>
              <Badge variant={group.mode === "open" ? "success" : "warning"}>
                {group.mode === "open" ? "Open" : "Closed"}
              </Badge>
            </div>

            {manager && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-ink-muted">
                <Avatar src={manager.avatar_url} name={manager.display_name} size="sm" />
                Managed by <span className="font-medium text-ink">{manager.display_name}</span>
              </div>
            )}

            {/* A pending invitation replaces the ordinary join control —
                accepting seats you even in a closed group. */}
            {invitation && group.status === "active" ? (
              <div className="mt-6">
                <InvitationBanner
                  invitationId={invitation.id}
                  inviterName={inviterName}
                />
              </div>
            ) : (
              <div className="mt-6 flex justify-center">
                <JoinButton groupId={group.id} state={state} size="md" />
              </div>
            )}
            <p className="mt-4 text-xs text-ink-muted">
              Chat, meetups, and the member list unlock when you join.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Member: the full page ────────────────────────────────────────── */
  // Everything the three panels need, fetched in parallel.
  const [
    messagesRes,
    membersRes,
    meetupsRes,
    pollsRes,
    resourcesRes,
    requestsRes,
    myFlagsRes,
  ] = await Promise.all([
      // Most recent page only — an old, active group's chat could run to
      // thousands of rows, and this query (plus its RLS check) re-runs on
      // every member's every page load and every post-action refresh.
      // GroupChat loads further history itself, on demand.
      supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE),
      supabase
        .from("study_group_members")
        .select("*")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("meetups")
        .select("*")
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: true }),
      // Only OPEN polls: PollsSection renders nothing else, and a closed
      // poll dragged its whole slot grid (up to 400 rows) and every vote
      // on it through the next two waves just to be filtered out in the
      // browser.
      supabase
        .from("availability_polls")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
      supabase
        .from("group_resources")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(GROUP_RESOURCES_LIMIT),
      isManager
        ? supabase
            .from("join_requests")
            .select("*")
            .eq("group_id", groupId)
            .eq("status", "pending")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      // Which of this group's messages / resources the viewer has flagged
      // (0040). RLS returns only their own rows, so this leaks nothing.
      supabase
        .from("content_flags")
        .select("content_type, content_id")
        .eq("flagger_id", profile.id)
        .eq("group_id", groupId),
    ]);

  // Fetched newest-first (for the .limit() above) — flip back to
  // chronological order for display.
  const messages = ((messagesRes.data ?? []) as GroupMessageRow[]).reverse();
  const members = (membersRes.data ?? []) as GroupMemberRow[];
  const meetups = (meetupsRes.data ?? []) as MeetupRow[];
  const polls = (pollsRes.data ?? []) as AvailabilityPollRow[];
  const resources = (resourcesRes.data ?? []) as GroupResourceRow[];
  const pendingRequests = (requestsRes.data ?? []) as JoinRequestRow[];

  const myFlags = (myFlagsRes.data ?? []) as {
    content_type: string;
    content_id: string;
  }[];
  const flaggedMessageIds = myFlags
    .filter((f) => f.content_type === "group_message")
    .map((f) => f.content_id);
  const flaggedResourceIds = myFlags
    .filter((f) => f.content_type === "group_resource")
    .map((f) => f.content_id);

  // Attendance + poll details depend on the ids we just fetched.
  const meetupIds = meetups.map((m) => m.id);
  const pollIds = polls.map((p) => p.id);
  // One name/avatar lookup for everyone who appears anywhere on the page
  // (members, message senders who might have left, requesters). Batched
  // alongside attendance/slots below rather than after them — it depends
  // on none of the three, so awaiting it separately just added a needless
  // sequential round trip to every group-page load.
  const everyoneIds = [
    ...new Set([
      ...members.map((m) => m.user_id),
      ...messages.map((m) => m.sender_id),
      ...pendingRequests.map((r) => r.user_id),
      ...resources.map((r) => r.author_id),
    ]),
  ];
  const [attendanceRes, slotsRes, profilesRes] = await Promise.all([
    meetupIds.length
      ? supabase.from("meetup_attendance").select("*").in("meetup_id", meetupIds)
      : Promise.resolve({ data: [] }),
    pollIds.length
      ? supabase.from("availability_slots").select("*").in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
    everyoneIds.length
      ? supabase.from("public_profiles").select("*").in("id", everyoneIds)
      : Promise.resolve({ data: [] }),
  ]);
  const attendance = (attendanceRes.data ?? []) as MeetupAttendanceRow[];
  const slots = (slotsRes.data ?? []) as AvailabilitySlotRow[];
  const profileList = (profilesRes.data ?? []) as PublicProfile[];
  const profilesById = Object.fromEntries(profileList.map((p) => [p.id, p]));

  // Genuinely sequential: which slots exist depends on the poll ids above,
  // and which votes exist depends on the slot ids from THIS query.
  const slotIds = slots.map((s) => s.id);
  const votesRes = slotIds.length
    ? await supabase.from("availability_votes").select("*").in("slot_id", slotIds)
    : { data: [] };
  const votes = (votesRes.data ?? []) as { slot_id: string; user_id: string }[];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            {courseCode(group.courses)} · {group.courses.course_name}
          </p>
          <h1 className="break-words font-display text-3xl text-ink">{group.name}</h1>
          {group.description && (
            <p className="mt-1 max-w-2xl whitespace-pre-wrap break-words text-sm text-ink-muted">
              {group.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={group.mode === "open" ? "success" : "warning"}>
            {group.mode === "open" ? "Open" : "Closed"}
          </Badge>
          {isManager && (
            <a
              href={`/groups/${group.id}/settings`}
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              Group settings
            </a>
          )}
        </div>
      </div>

      {/* One render of each panel; CSS handles desktop vs mobile. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <GroupChat
          groupId={group.id}
          currentUserId={profile.id}
          initialMessages={messages}
          initialHasMore={messages.length === CHAT_PAGE_SIZE}
          initialProfiles={profilesById}
          flaggedMessageIds={flaggedMessageIds}
        />
        <MeetupsPanel
          groupId={group.id}
          currentUserId={profile.id}
          isManager={isManager}
          meetups={meetups}
          attendance={attendance}
          groupName={group.name}
          courseLabel={courseCode(group.courses)}
          profiles={profilesById}
        />
        <MembersPanel
          groupId={group.id}
          groupName={group.name}
          currentUserId={profile.id}
          managerId={group.manager_id}
          members={members}
          profiles={profilesById}
          pendingRequests={pendingRequests}
          isManager={isManager}
        />
      </div>

      {/* Availability polls get the FULL page width — a day × time grid
          needs room to breathe. Up to 7 days fit without any horizontal
          scroll on a laptop; the grid only scrolls sideways past that. */}
      <section className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <PollsSection
          groupId={group.id}
          currentUserId={profile.id}
          isManager={isManager}
          polls={polls}
          slots={slots}
          votes={votes}
          members={members.map((m) => ({
            id: m.user_id,
            display_name: profilesById[m.user_id]?.display_name ?? null,
          }))}
        />
      </section>

      {/* Shared notes & links — full width like the polls. */}
      <section className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <ResourcesPanel
          groupId={group.id}
          currentUserId={profile.id}
          isManager={isManager}
          resources={resources}
          profiles={profilesById}
          flaggedResourceIds={flaggedResourceIds}
        />
      </section>
    </div>
  );
}
