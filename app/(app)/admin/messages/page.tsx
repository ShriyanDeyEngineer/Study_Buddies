/**
 * /admin/messages — the flagged-message log. EVERY chat/DM message the
 * filter altered gets a row here — a plain "shit" masked to **** just as
 * much as a spaced-out "s h i t" dodge. Each entry shows both versions
 * side by side: the masked text everyone saw, and the original the
 * sender actually typed (0017/0023). Other users only ever see the
 * masked version.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import type { MessageOriginalRow } from "@/lib/types";
import { adminPersonLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Flagged messages · Admin" };

type NameRow = { id: string; display_name: string | null; account_status: string };

export default async function AdminMessagesPage() {
  const { supabase } = await getSessionProfile();

  const originalsRes = await supabase
    .from("message_originals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const originals = (originalsRes.data ?? []) as MessageOriginalRow[];

  const senderIds = [...new Set(originals.map((o) => o.sender_id))];
  const namesRes = senderIds.length
    ? await supabase.from("profiles").select("id, display_name, account_status").in("id", senderIds)
    : { data: [] };
  const names = Object.fromEntries(
    ((namesRes.data ?? []) as NameRow[]).map((p) => [p.id, p]),
  );

  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        Every message the profanity filter altered — ordinary swears and
        bypass attempts alike — with what everyone saw next to what the
        sender actually typed. Other users only ever see the masked
        version. Latest 200.
      </p>
      {originals.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing has been masked yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {originals.map((original) => {
            const sender = names[original.sender_id];
            return (
              <li key={original.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <Link
                    href={`/profile/${original.sender_id}`}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    {adminPersonLabel(sender?.display_name, original.sender_id)}
                  </Link>
                  <Badge variant={original.message_kind === "group" ? "accent" : "outline"}>
                    {original.message_kind === "group" ? "group chat" : "DM"}
                  </Badge>
                  {formatDistanceToNow(new Date(original.created_at), { addSuffix: true })}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-cream px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                      Shown in chat
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">
                      {original.censored_content}
                    </p>
                  </div>
                  <div className="rounded-lg bg-danger/5 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-danger">
                      Original (uncensored)
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">
                      {original.original_content}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
