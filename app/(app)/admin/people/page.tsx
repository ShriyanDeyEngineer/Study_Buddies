/**
 * /admin/people — every account, with the two moderation controls.
 *
 * Reads come straight from `profiles` (the admin RLS policy, 0020) rather
 * than public_profiles, because admins need to see accounts that view
 * hides: paused, suspended, banned and deleted ones.
 *
 * Search is a plain ?q= on the URL so a filtered list is linkable, the
 * same pattern /people uses.
 */
import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { courseCode, type CourseRow, type ProfileRow, type StudyGroupRow } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PersonModeration } from "./person-moderation";
import { Search } from "lucide-react";

export const metadata = { title: "People · Admin" };

type MemberRow = { user_id: string; group_id: string };
type GroupRow = StudyGroupRow & { courses: CourseRow };

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, profile } = await getSessionProfile();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);

  let peopleQuery = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (query.length >= 2) {
    // Escape LIKE wildcards so a search for "100%" can't match everything.
    const safe = query.replace(/[\\%_]/g, (c) => `\\${c}`);
    peopleQuery = peopleQuery.or(`display_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const peopleRes = await peopleQuery;
  const people = (peopleRes.data ?? []) as ProfileRow[];

  // Group memberships for everyone shown, in two queries rather than N.
  const ids = people.map((p) => p.id);
  const membersRes = ids.length
    ? await supabase.from("study_group_members").select("user_id, group_id").in("user_id", ids)
    : { data: [] };
  const members = (membersRes.data ?? []) as MemberRow[];

  const groupIds = [...new Set(members.map((m) => m.group_id))];
  const groupsRes = groupIds.length
    ? await supabase.from("study_groups").select("*, courses(*)").in("id", groupIds)
    : { data: [] };
  const groupsById = Object.fromEntries(
    ((groupsRes.data ?? []) as GroupRow[]).map((g) => [g.id, g]),
  );

  const groupsFor = (userId: string) =>
    members
      .filter((m) => m.user_id === userId)
      .map((m) => groupsById[m.group_id])
      .filter(Boolean);

  return (
    <div>
      <form action="/admin/people" method="get" className="relative mb-5 max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        />
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or email…"
          aria-label="Search people"
          maxLength={100}
          className="pl-9"
        />
      </form>

      <p className="mb-3 text-sm text-ink-muted">
        {people.length} account{people.length === 1 ? "" : "s"}
        {query.length >= 2 && ` matching “${query}”`}
      </p>

      {people.length === 0 ? (
        <p className="text-sm text-ink-muted">Nobody matches that search.</p>
      ) : (
        <ul className="space-y-3">
          {people.map((person) => {
            const groups = groupsFor(person.id);
            const isSelf = person.id === profile?.id;
            return (
              <li
                key={person.id}
                className="rounded-xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <Avatar src={person.avatar_url} name={person.display_name} size="md" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/profile/${person.id}`}
                          className="break-words font-medium text-primary underline underline-offset-2"
                        >
                          {person.display_name ?? "(no name yet)"}
                        </Link>
                        {person.is_admin && <Badge variant="primary">admin</Badge>}
                        {person.is_muted && <Badge variant="warning">muted</Badge>}
                        {person.account_status !== "active" && (
                          <Badge variant="danger">{person.account_status}</Badge>
                        )}
                      </p>
                      <p className="mt-0.5 break-all text-xs text-ink-muted">{person.email}</p>

                      <p className="mt-2 text-xs text-ink-muted">
                        {groups.length === 0
                          ? "Not in any groups"
                          : `In ${groups.length} group${groups.length === 1 ? "" : "s"}:`}
                      </p>
                      {groups.length > 0 && (
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {groups.map((group) => (
                            <li key={group.id}>
                              <Link
                                href={`/admin/groups/${group.id}`}
                                className="inline-block rounded-full border border-line px-2.5 py-1 text-xs text-ink hover:border-primary hover:text-primary"
                              >
                                {courseCode(group.courses)} · {group.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {!isSelf && person.account_status !== "deleted" && (
                    <PersonModeration
                      userId={person.id}
                      name={person.display_name ?? "this account"}
                      isMuted={person.is_muted}
                      isPaused={person.account_status === "paused"}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
