/**
 * Header for every signed-in page: logo → dashboard, nav links (desktop),
 * the notification bell, and the avatar menu. The mobile bottom bar is
 * rendered by the app layout, not here.
 *
 * The initial unread counts (notifications for the bell, DMs for the
 * Messages badge) are fetched ONCE by the app layout and passed down, so
 * the header and the mobile bar can't disagree and we don't pay for the
 * same query twice per page. Realtime keeps both live after first paint.
 */
import Link from "next/link";
import { LogoLockup } from "@/components/buddies-logo";
import { AppNavLinks } from "@/components/app/app-nav";
import { NotificationBell } from "@/components/app/notification-bell";
import { UserMenu } from "@/components/app/user-menu";
import type { ProfileRow } from "@/lib/types";

export function AppHeader({
  profile,
  unreadNotifications,
  unreadMessages,
}: {
  profile: ProfileRow;
  unreadNotifications: number;
  unreadMessages: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link
          href="/dashboard"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <LogoLockup className="text-lg" />
        </Link>
        <div className="flex-1">
          <AppNavLinks
            userId={profile.id}
            initialUnreadMessages={unreadMessages}
            isAdmin={profile.is_admin}
          />
        </div>
        <NotificationBell userId={profile.id} initialUnread={unreadNotifications} />
        <UserMenu
          userId={profile.id}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
        />
      </div>
    </header>
  );
}
