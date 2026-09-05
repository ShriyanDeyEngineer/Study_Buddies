/**
 * /admin/flags — the user-flagged-content queue (migration 0040).
 *
 * A student can flag one specific group message, DM, or group resource as
 * inappropriate. Flagging is invisible to everyone but the flagger and
 * admins; this page is the admin side. Each row carries a snapshot of the
 * flagged text captured at flag time, so a flagged DM is reviewable here
 * WITHOUT any broad direct-message access. Names come from the profiles
 * table directly (the admin RLS policy, 0020) because a flagged author may
 * be suspended and public_profiles hides those.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import type { ContentFlagRow } from "@/lib/types";
import { adminPersonLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { FlagStatusButtons } from "./flag-actions";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Flagged content · Admin" };

type NameRow = { id: string; display_name: string | null; account_status: string };

const TYPE_LABEL: Record<ContentFlagRow["content_type"], string> = {
  group_message: "group chat",
  direct_message: "direct message",
  group_resource: "resource",
};
const TYPE_BADGE: Record<
  ContentFlagRow["content_type"],
  "accent" | "outline" | "primary"
> = {
  group_message: "accent",
  direct_message: "outline",
  group_resource: "primary",
};

export default async function AdminFlagsPage() {
  const { supabase } = await getSessionProfile();

  const flagsRes = await supabase
    .from("content_flags")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const flags = (flagsRes.data ?? []) as ContentFlagRow[];

  const personIds = [
    ...new Set(
      flags.flatMap((f) => [f.flagger_id, f.content_author_id]).filter(Boolean),
    ),
  ] as string[];
  const namesRes = personIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, account_status")
        .in("id", personIds)
    : { data: [] };
  const names = Object.fromEntries(
    ((namesRes.data ?? []) as NameRow[]).map((p) => [p.id, p]),
  );

  // How many people flagged each distinct item.
  const countByContent = new Map<string, number>();
  for (const f of flags) {
    const key = `${f.content_type}:${f.content_id}`;
    countByContent.set(key, (countByContent.get(key) ?? 0) + 1);
  }

  const openCount = flags.filter(
    (f) => f.status === "open" || f.status === "reviewing",
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Content members flagged for review — {openCount} open. Flagging is
        invisible to other members: the author is never told, and nothing
        about the content changes. The text below is the snapshot captured
        when it was flagged. Latest 200.
      </p>

      {flags.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing has been flagged yet.</p>
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => {
            const flagger = names[flag.flagger_id];
            const author = flag.content_author_id
              ? names[flag.content_author_id]
              : undefined;
            const others =
              (countByContent.get(`${flag.content_type}:${flag.content_id}`) ?? 1) - 1;
            return (
              <li
                key={flag.id}
                className="rounded-xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <Badge variant={TYPE_BADGE[flag.content_type]}>
                        {TYPE_LABEL[flag.content_type]}
                      </Badge>
                      {flag.content_author_id ? (
                        <span>
                          posted by{" "}
                          <Link
                            href={`/profile/${flag.content_author_id}`}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            {adminPersonLabel(author?.display_name, flag.content_author_id)}
                          </Link>
                          {author && author.account_status !== "active" && (
                            <span className="ml-1.5 rounded-full bg-danger/10 px-2 py-0.5 text-danger">
                              account {author.account_status}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>author unknown</span>
                      )}
                      {flag.content_created_at && (
                        <span>
                          ·{" "}
                          {formatDistanceToNow(new Date(flag.content_created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap break-words rounded-lg bg-cream px-3 py-2 text-sm text-ink">
                      {flag.content_snapshot}
                    </p>

                    <p className="text-xs text-ink-muted">
                      flagged by{" "}
                      <Link
                        href={`/profile/${flag.flagger_id}`}
                        className="font-medium text-primary underline underline-offset-2"
                      >
                        {adminPersonLabel(flagger?.display_name, flag.flagger_id)}
                      </Link>{" "}
                      {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                      {others > 0 && (
                        <span className="font-medium text-ink">
                          {" "}
                          · also flagged by {others} other{others === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                    {flag.reason && (
                      <p className="whitespace-pre-wrap break-words border-l-2 border-line pl-3 text-sm text-ink-muted">
                        &ldquo;{flag.reason}&rdquo;
                      </p>
                    )}
                    {flag.group_id && (
                      <Link
                        href={`/admin/groups/${flag.group_id}`}
                        className="inline-block text-xs font-medium text-primary underline underline-offset-2"
                      >
                        View in group →
                      </Link>
                    )}
                  </div>

                  <FlagStatusButtons flagId={flag.id} status={flag.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
