/**
 * /admin/groups — every group in the app, linking to the read-only
 * observation view. Admins see this WITHOUT joining anything.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import { courseCode, type CourseRow, type StudyGroupRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Groups · Admin" };

type GroupWithCourse = StudyGroupRow & { courses: CourseRow };

export default async function AdminGroupsPage() {
  const { supabase } = await getSessionProfile();
  const groupsRes = await supabase
    .from("study_groups")
    .select("*, courses(*)")
    .order("last_activity_at", { ascending: false })
    .limit(300);
  const groups = (groupsRes.data ?? []) as GroupWithCourse[];

  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        All groups, most recently active first. Opening one shows its chat,
        members, meetups, and resources read-only — you are not joining it
        and members can&rsquo;t see you looking.
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href={`/admin/groups/${group.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{group.name}</span>
                <span className="block text-xs text-ink-muted">
                  {courseCode(group.courses)} · {group.member_count}/{group.capacity} members ·
                  active {formatDistanceToNow(new Date(group.last_activity_at), { addSuffix: true })}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant={group.mode === "open" ? "success" : "warning"}>
                  {group.mode}
                </Badge>
                {group.status !== "active" && <Badge variant="danger">{group.status}</Badge>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
