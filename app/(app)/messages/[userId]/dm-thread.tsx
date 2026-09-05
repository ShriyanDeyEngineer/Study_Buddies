/**
 * The realtime DM thread. Same chat mechanics as group chat (dedupe by
 * id, 2,000-char counter, chronological order with date separators,
 * auto-scroll) with one difference: the subscription filters on
 * "messages TO me" — my own sends render from the action's response, so
 * I only need to hear about incoming ones. Messages that arrive while
 * the thread is open are marked read immediately.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { format, isSameDay } from "date-fns";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  markThreadReadAction,
  sendDirectMessageAction,
} from "@/lib/actions/messages";
import { CHAT_PAGE_SIZE, MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { censorProfanity } from "@/lib/profanity";
import type { DirectMessageRow, PublicProfile } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FlagControl } from "@/components/moderation/flag-control";
import { cn } from "@/lib/utils";

export function DmThread({
  currentUserId,
  other,
  initialMessages,
  initialHasMore,
  flaggedMessageIds = [],
}: {
  currentUserId: string;
  other: PublicProfile;
  initialMessages: DirectMessageRow[];
  /** Whether the server's initial fetch filled a whole page — a hint,
   *  not a guarantee, that older history exists (see loadOlder below). */
  initialHasMore: boolean;
  /** Ids of messages the current viewer has already flagged (0040). */
  flaggedMessageIds?: string[];
}) {
  const flaggedIds = React.useMemo(
    () => new Set(flaggedMessageIds),
    [flaggedMessageIds],
  );
  const [messages, setMessages] = React.useState<DirectMessageRow[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const seenIds = React.useRef(new Set(initialMessages.map((m) => m.id)));
  const listRef = React.useRef<HTMLDivElement>(null);
  // Set right before an older-history prepend so the auto-scroll effect
  // below skips scrolling to the bottom for it — that's for new incoming
  // messages, not history just loaded above the fold.
  const prependingOlder = React.useRef(false);

  const overLimit = draft.length > MESSAGE_MAX_LENGTH;
  const empty = draft.trim().length === 0;

  const appendMessage = React.useCallback(
    (message: DirectMessageRow) => {
      if (seenIds.current.has(message.id)) return;
      // This thread only shows messages with THIS person — the incoming
      // subscription hears about every sender, so filter here.
      if (message.sender_id !== other.id && message.sender_id !== currentUserId) return;
      seenIds.current.add(message.id);
      setMessages((current) => [...current, message]);
      if (message.sender_id === other.id) {
        // They messaged while I'm looking — it's read the moment it lands.
        void markThreadReadAction(other.id);
      }
    },
    [other.id, currentUserId],
  );

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dm:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => appendMessage(payload.new as DirectMessageRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, appendMessage]);

  // Keep the newest message in view — unless this change was an
  // older-history prepend, which loadOlder handles its own scroll
  // position for.
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prependingOlder.current) {
      prependingOlder.current = false;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages]);

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
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${other.id}),` +
          `and(sender_id.eq.${other.id},recipient_id.eq.${currentUserId})`,
      )
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE_SIZE);
    setLoadingOlder(false);

    if (error) {
      toast.error("Couldn't load earlier messages.");
      return;
    }

    const older = ((data ?? []) as DirectMessageRow[]).reverse();
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
    // Send the RAW text: the database censors authoritatively and logs the
    // pre-censorship original to the flagged-message log — it can only do
    // that if it receives the original. Mask locally only for the
    // optimistic echo, which mirrors the server filter (lib/profanity.ts).
    const raw = draft;
    const echo = censorProfanity(raw);
    setSending(true);
    const { message, error } = await sendDirectMessageAction(other.id, raw);
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDraft("");
    if (message) {
      appendMessage({
        id: message.id,
        sender_id: currentUserId,
        recipient_id: other.id,
        content: echo,
        is_read: false,
        created_at: message.created_at,
      });
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] max-w-2xl flex-col rounded-xl border border-line bg-surface shadow-sm md:h-[calc(100dvh-10rem)]">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link
          href="/messages"
          aria-label="Back to all messages"
          className="rounded-lg p-1 text-ink-muted hover:bg-cream focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <Avatar src={other.avatar_url} name={other.display_name} />
        <Link
          href={`/profile/${other.id}`}
          className="font-medium text-ink hover:underline"
        >
          {other.display_name ?? "A student"}
        </Link>
      </div>

      {/* History */}
      <div ref={listRef} aria-live="polite" className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            This is the very start of your conversation. Even a &ldquo;hey&rdquo; works.
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
                <div className={cn("group mb-2 flex", mine && "justify-end")}>
                  <div className={cn("max-w-[80%]", mine && "text-right")}>
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
                          contentType="direct_message"
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

      {/* Composer */}
      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={`Message ${other.display_name ?? "them"}…`}
            aria-label={`Message ${other.display_name ?? "this person"}`}
            aria-describedby="dm-counter"
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
        <p
          id="dm-counter"
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
    </div>
  );
}
