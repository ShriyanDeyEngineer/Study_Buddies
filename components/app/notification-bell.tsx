/**
 * The header notification bell: live unread badge, dropdown preview of
 * the latest notifications, "see all" link. Clicking an item marks it
 * read and navigates to the relevant page (spec §5.13). Reading is
 * always explicit: the per-item mail toggle, clicking through, or the
 * "Mark all as read" button at the bottom of the dropdown — nothing is
 * marked read just because the dropdown was open.
 *
 * Realtime: subscribes to INSERTs on MY notifications (server-side
 * filter; RLS also guards delivery). Subscribed on mount, UNSUBSCRIBED on
 * unmount — and this component is mounted exactly once in the app header,
 * never duplicated for mobile (spec §8's duplicate-subscription rule).
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Mail, MailOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { renderNotification } from "@/lib/notifications";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  setNotificationReadAction,
} from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function NotificationBell({
  userId,
  initialUnread,
}: {
  userId: string;
  initialUnread: number;
}) {
  const router = useRouter();
  const [unread, setUnread] = React.useState(initialUnread);
  const [items, setItems] = React.useState<NotificationRow[] | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const fresh = payload.new as NotificationRow;
          setUnread((count) => count + 1);
          // If the dropdown is already populated, prepend so an open
          // panel updates live too.
          setItems((existing) => (existing ? [fresh, ...existing].slice(0, 8) : existing));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        // Read-states change from the notifications page, mark-all, or
        // another tab. The UPDATE payload doesn't carry the old row, so
        // recount instead of guessing the delta.
        async () => {
          const { count } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .is("read_at", null);
          setUnread(count ?? 0);
        },
      )
      .subscribe();

    // Unsubscribe on unmount — a leaked channel would double-count
    // every future notification.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  /** "Mark all as read" — the one bulk action, always explicit. */
  async function markAllRead() {
    setUnread(0);
    const now = new Date().toISOString();
    setItems((existing) =>
      existing
        ? existing.map((n) => (n.read_at ? n : { ...n, read_at: now }))
        : existing,
    );
    await markAllNotificationsReadAction();
  }

  /** The read/unread toggle beside each item. */
  async function toggleRead(notification: NotificationRow) {
    const makeRead = !notification.read_at;
    setUnread((count) => Math.max(0, count + (makeRead ? -1 : 1)));
    setItems((existing) =>
      existing
        ? existing.map((n) =>
            n.id === notification.id
              ? { ...n, read_at: makeRead ? new Date().toISOString() : null }
              : n,
          )
        : existing,
    );
    await setNotificationReadAction(notification.id, makeRead);
  }

  /** Load the dropdown's contents the first time it opens (not before —
   *  most page views never open the bell). */
  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && items === null) {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      setItems((data ?? []) as NotificationRow[]);
    }
  }

  async function handleClick(notification: NotificationRow) {
    const { href } = renderNotification(notification);
    setOpen(false);
    if (!notification.read_at) {
      setUnread((count) => Math.max(0, count - 1));
      setItems((existing) =>
        existing
          ? existing.map((n) =>
              n.id === notification.id
                ? { ...n, read_at: new Date().toISOString() }
                : n,
            )
          : existing,
      );
      await markNotificationReadAction(notification.id);
    }
    router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <Bell aria-hidden className="h-5 w-5" />
          {/* The visible badge below is aria-hidden (its info is already
              in the button's aria-label); this is the actual announcer,
              so a live arrival is heard even while the bell isn't
              focused. */}
          <span aria-live="polite" className="sr-only">
            {unread > 0
              ? `${unread} unread notification${unread === 1 ? "" : "s"}`
              : "No unread notifications"}
          </span>
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm font-medium text-ink">Notifications</span>
          <Link
            href="/notifications"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => setOpen(false)}
          >
            See all
          </Link>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items === null ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">Loading…</li>
          ) : items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              Nothing yet — when groups invite you or meetups change, it shows up here.
            </li>
          ) : (
            items.map((notification) => {
              const { message } = renderNotification(notification);
              return (
                <li
                  key={notification.id}
                  className={cn(
                    "flex items-stretch",
                    !notification.read_at && "bg-accent-light/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleClick(notification)}
                    className="min-w-0 flex-1 px-4 py-3 text-left text-sm hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="block text-ink">{message}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRead(notification)}
                    aria-label={
                      notification.read_at ? "Mark as unread" : "Mark as read"
                    }
                    title={notification.read_at ? "Mark as unread" : "Mark as read"}
                    className="flex shrink-0 items-center px-3 text-ink-muted hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    {notification.read_at ? (
                      <Mail aria-hidden className="h-4 w-4" />
                    ) : (
                      <MailOpen aria-hidden className="h-4 w-4" />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {unread > 0 && (
          <div className="border-t border-line p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-primary"
              onClick={() => void markAllRead()}
            >
              Mark all as read
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
