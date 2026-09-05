/**
 * Conversation list (/messages) — spec §5.12: every person you've
 * exchanged DMs with, latest message preview, and a live unread count
 * per conversation (cleared when the thread is opened).
 */
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getSessionProfile } from "@/lib/supabase/server";
import type { ConversationSummary } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshOnDirectMessages } from "@/components/app/unread-messages-badge";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile) return null;

  const { data } = await supabase.rpc("get_conversations");
  const conversations = (data ?? []) as ConversationSummary[];

  return (
    <div className="mx-auto max-w-2xl">
      {/* New DM to me → conversation list + unread counts update live.
          Rides the nav badge's channel — see RefreshOnDirectMessages. */}
      <RefreshOnDirectMessages userId={profile.id} />
      <h1 className="mb-6 font-display text-3xl text-ink">Messages</h1>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Open a classmate's profile and select Message to start a conversation."
          action={
            <Button asChild>
              <Link href="/people">Find people</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {conversations.map((conversation) => (
            <li key={conversation.other_id}>
              <Link
                href={`/messages/${conversation.other_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              >
                <Avatar
                  src={conversation.avatar_url}
                  name={conversation.display_name}
                  size="lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm text-ink",
                        conversation.unread_count > 0 ? "font-semibold" : "font-medium",
                      )}
                    >
                      {conversation.display_name ?? "A student"}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatDistanceToNow(new Date(conversation.last_message_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "block truncate text-sm",
                      conversation.unread_count > 0
                        ? "font-medium text-ink"
                        : "text-ink-muted",
                    )}
                  >
                    {conversation.last_message_mine && "You: "}
                    {conversation.last_message}
                  </span>
                </span>
                {conversation.unread_count > 0 && (
                  <span
                    className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white"
                    aria-label={`${conversation.unread_count} unread`}
                  >
                    {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
