/**
 * Clickable notification rows: clicking marks read (if needed) then
 * navigates to the destination renderNotification() decided. The icon at
 * the row's edge toggles read/unread without navigating.
 *
 * Read state is OPTIMISTIC — the row restyles on click and the server
 * write happens behind it. It used to await the action and then
 * router.refresh() the whole 200-row page, so a single toggle took a
 * visible beat. Server data still wins whenever it arrives (LiveRefresh,
 * a new notification, a navigation): the effect below re-syncs on every
 * new `notifications` prop, so a failed write self-corrects.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Mail, MailOpen } from "lucide-react";
import {
  markNotificationReadAction,
  setNotificationReadAction,
} from "@/lib/actions/notifications";
import { renderNotification } from "@/lib/notifications";
import type { NotificationRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();

  /** id → read_at, for rows this tab has changed since the last server
   *  render. Cleared whenever fresh server data arrives. */
  const [pending, setPending] = React.useState<Record<string, string | null>>({});
  React.useEffect(() => setPending({}), [notifications]);

  function readAtOf(notification: NotificationRow): string | null {
    return notification.id in pending
      ? pending[notification.id]
      : notification.read_at;
  }

  async function open(notification: NotificationRow) {
    const { href } = renderNotification(notification);
    if (!readAtOf(notification)) {
      setPending((p) => ({ ...p, [notification.id]: new Date().toISOString() }));
      // Not awaited: navigation shouldn't wait on a bookkeeping write.
      void markNotificationReadAction(notification.id);
    }
    router.push(href);
  }

  async function toggleRead(notification: NotificationRow) {
    const wasRead = readAtOf(notification);
    const makeRead = !wasRead;
    setPending((p) => ({
      ...p,
      [notification.id]: makeRead ? new Date().toISOString() : null,
    }));
    await setNotificationReadAction(notification.id, makeRead);
    // No router.refresh(): the row already shows the new state, and the
    // bell recounts over realtime. The next server render reconciles.
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      {notifications.map((notification) => {
        const { message } = renderNotification(notification);
        const readAt = readAtOf(notification);
        return (
          <li
            key={notification.id}
            className={cn("flex items-stretch", !readAt && "bg-accent-light/30")}
          >
            <button
              type="button"
              onClick={() => open(notification)}
              className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span className="block text-sm text-ink">{message}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                {!readAt && <span className="ml-2 font-medium text-primary">· new</span>}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleRead(notification)}
              aria-label={readAt ? "Mark as unread" : "Mark as read"}
              title={readAt ? "Mark as unread" : "Mark as read"}
              className="flex shrink-0 items-center px-4 text-ink-muted hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              {readAt ? (
                <Mail aria-hidden className="h-4 w-4" />
              ) : (
                <MailOpen aria-hidden className="h-4 w-4" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
