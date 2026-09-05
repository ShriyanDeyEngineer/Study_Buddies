/**
 * Group chat panel (spec §5.8): realtime delivery, full history in
 * chronological order with date separators, own messages right-aligned
 * in primary, a live character counter that blocks over-limit sends,
 * auto-scroll with a "New messages ↓" pill when scrolled up.
 *
 * Realtime notes (each guards a real bug — spec §8/§9):
 *   - DE-DUPLICATION by message id: our own send comes back twice (once
 *     from the action's response, once over the websocket). A Set of
 *     seen ids keeps each message rendered once.
 *   - SENDER PROFILES LIVE IN A REF, not state captured by the
 *     subscription callback. The callback closes over its first render's
 *     scope; a ref always reads current data, so we don't refetch the
 *     same profile on every message (stale-closure pitfall #6).
 *   - The channel is subscribed on mount and REMOVED on unmount.
 */
"use client";

import * as React from "react";
import { format, isSameDay } from "date-fns";
import { ArrowDown, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { sendGroupMessageAction } from "@/lib/actions/messages";
import { censorProfanity } from "@/lib/profanity";
import { CHAT_PAGE_SIZE, MESSAGE_MAX_LENGTH } from "@/lib/constants";
import type { GroupMessageRow, PublicProfile } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FlagControl } from "@/components/moderation/flag-control";
import { cn } from "@/lib/utils";

export function GroupChat({
  groupId,
  currentUserId,
  initialMessages,
  initialHasMore,
  initialProfiles,
  flaggedMessageIds = [],
}: {
  groupId: string;
  currentUserId: string;
  initialMessages: GroupMessageRow[];
  /** Whether the server's initial fetch filled a whole page — a hint,
   *  not a guarantee, that older history exists (see loadOlder below). */
  initialHasMore: boolean;
  initialProfiles: Record<string, PublicProfile>;
  /** Ids of messages the current viewer has already flagged (0040). */
  flaggedMessageIds?: string[];
}) {
  const flaggedIds = React.useMemo(
    () => new Set(flaggedMessageIds),
    [flaggedMessageIds],
  );
  const [messages, setMessages] = React.useState<GroupMessageRow[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [showNewPill, setShowNewPill] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  // Bump when profile cache gains entries so names render without
  // making the cache itself state (see header comment).
  const [, setProfileVersion] = React.useState(0);

  const seenIds = React.useRef(new Set(initialMessages.map((m) => m.id)));
  const profilesRef = React.useRef<Record<string, PublicProfile>>({ ...initialProfiles });
  const listRef = React.useRef<HTMLDivElement>(null);
  const pinnedToBottom = React.useRef(true);
  // Set right before an older-history prepend so the scroll-position
  // effect below skips its normal "stick to bottom / show the new-
  // messages pill" logic — that's for genuinely new incoming messages,
  // not history we just loaded above the fold.
  const prependingOlder = React.useRef(false);

  const overLimit = draft.length > MESSAGE_MAX_LENGTH;
  const empty = draft.trim().length === 0;

  /** Append if unseen; resolve unknown senders through the ref cache. */
  const appendMessage = React.useCallback((message: GroupMessageRow) => {
    if (seenIds.current.has(message.id)) return;
    seenIds.current.add(message.id);
    setMessages((current) => [...current, message]);

    if (!profilesRef.current[message.sender_id]) {
      // Unknown sender (joined after page load). Fetch once, cache in the
      // ref — later messages from them hit the cache, not the network.
      const supabase = createClient();
      void supabase
        .from("public_profiles")
        .select("*")
        .eq("id", message.sender_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            profilesRef.current[message.sender_id] = data as PublicProfile;
            setProfileVersion((v) => v + 1);
          }
        });
    }
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-chat:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          appendMessage(payload.new as GroupMessageRow);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, appendMessage]);

  /** Track whether the user is at the bottom; drives auto-scroll vs pill. */
  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pinnedToBottom.current = nearBottom;
    if (nearBottom) setShowNewPill(false);
  }

  // After messages change: stick to bottom if we were there, otherwise
  // offer the pill instead of yanking the reader away (spec §5.8) — unless
  // this change was an older-history prepend, which loadOlder handles its
  // own scroll position for.
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prependingOlder.current) {
      prependingOlder.current = false;
      return;
    }
    if (pinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setShowNewPill(true);
    }
  }, [messages]);

  function jumpToNewest() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setShowNewPill(false);
  }

  /** Fetches the page of messages just before the oldest one currently
   *  loaded (client-side, RLS-scoped — same read the initial server fetch
   *  does, just further back), and prepends it without disturbing scroll
   *  position. */
  async function loadOlder() {
    const el = listRef.current;
    const oldest = messages[0];
    if (!el || !oldest || loadingOlder || !hasMore) return;

    setLoadingOlder(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE_SIZE);
    setLoadingOlder(false);

    if (error) {
      toast.error("Couldn't load earlier messages.");
      return;
    }

    const older = ((data ?? []) as GroupMessageRow[]).reverse();
    if (older.length < CHAT_PAGE_SIZE) setHasMore(false);
    if (older.length === 0) return;

    older.forEach((m) => seenIds.current.add(m.id));
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;
    prependingOlder.current = true;
    setMessages((current) => [...older, ...current]);
    // Restore scroll position once the DOM has grown upward, so the
    // messages the reader was looking at don't jump.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop;
    });
  }

  async function send() {
    if (empty || overLimit || sending) return;
    // Send the RAW text: the database is the authoritative censor, and it
    // can only log the pre-censorship original to the flagged-message log
    // if it actually receives it. Mask locally only for the optimistic
    // echo, so what the sender sees matches what everyone else receives
    // (lib/profanity.ts mirrors the SQL filter).
    const raw = draft;
    const echo = censorProfanity(raw);
    setSending(true);
    const { message, error } = await sendGroupMessageAction(groupId, raw);
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDraft("");
    pinnedToBottom.current = true;
    if (message) {
      // Render immediately; the realtime echo of this id gets de-duped.
      appendMessage({
        id: message.id,
        group_id: groupId,
        sender_id: currentUserId,
        content: echo,
        created_at: message.created_at,
      });
    }
  }

  return (
    <section
      aria-label="Group chat"
      className="flex h-128 flex-col rounded-xl border border-line bg-surface shadow-sm"
    >
      <h2 className="border-b border-line px-4 py-3 font-display text-lg text-ink">Chat</h2>

      <div className="relative flex-1 overflow-hidden">
        {/* aria-live: screen readers announce new messages (WCAG req). */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          aria-live="polite"
          className="h-full overflow-y-auto px-4 py-3"
        >
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">
              No messages yet.
            </p>
          ) : (
            <>
              <div className="mb-2 flex justify-center">
                {hasMore ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void loadOlder()}
                    loading={loadingOlder}
                  >
                    Load earlier messages
                  </Button>
                ) : (
                  <p className="text-xs text-ink-muted">Beginning of the conversation</p>
                )}
              </div>
              {messages.map((message, index) => {
              const prev = messages[index - 1];
              const mine = message.sender_id === currentUserId;
              const sender = profilesRef.current[message.sender_id];
              const showDateSeparator =
                !prev ||
                !isSameDay(new Date(prev.created_at), new Date(message.created_at));

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className="my-3 flex items-center gap-3" role="separator">
                      <span className="h-px flex-1 bg-line" />
                      <span className="text-xs text-ink-muted">
                        {format(new Date(message.created_at), "EEEE, MMMM d")}
                      </span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <div className={cn("group mb-2 flex gap-2", mine && "justify-end")}>
                    {!mine && (
                      <Avatar
                        src={sender?.avatar_url}
                        name={sender?.display_name}
                        size="sm"
                        className="mt-1"
                      />
                    )}
                    <div className={cn("max-w-[80%]", mine && "text-right")}>
                      {!mine && (
                        <p className="mb-0.5 text-xs font-medium text-ink-muted">
                          {sender?.display_name ?? "Deleted User"}
                        </p>
                      )}
                      <div
                        className={cn(
                          "inline-block whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-left text-sm",
                          mine ? "bg-primary text-white" : "bg-cream text-ink",
                        )}
                      >
                        {message.content}
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-muted">
                        {format(new Date(message.created_at), "h:mm a")}
                        {!mine && (
                          <FlagControl
                            contentType="group_message"
                            contentId={message.id}
                            flagged={flaggedIds.has(message.id)}
                            label="this message"
                          />
                        )}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              );
              })}
            </>
          )}
        </div>

        {showNewPill && (
          <Button
            size="sm"
            variant="secondary"
            onClick={jumpToNewest}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"
          >
            <ArrowDown aria-hidden className="h-3.5 w-3.5" />
            New messages
          </Button>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter makes a newline — chat convention.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Message the group…"
            aria-label="Message the group"
            aria-describedby="chat-counter"
            className="min-h-0 resize-none"
          />
          <Button
            size="icon"
            onClick={() => void send()}
            disabled={empty || overLimit}
            loading={sending}
            aria-label="Send message"
          >
            {!sending && <SendHorizontal aria-hidden className="h-4 w-4" />}
          </Button>
        </div>
        {/* Live counter — red once over, and the send button is dead. */}
        <p
          id="chat-counter"
          aria-live="polite"
          className={cn(
            "mt-1 text-right text-xs",
            overLimit ? "font-medium text-danger" : "text-ink-muted",
          )}
        >
          {draft.length.toLocaleString()}/{MESSAGE_MAX_LENGTH.toLocaleString()}
          {overLimit && " — too long to send"}
        </p>
      </div>
    </section>
  );
}
