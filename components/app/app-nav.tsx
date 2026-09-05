/**
 * Signed-in navigation, rendered twice from ONE source of truth:
 *   - <AppNavLinks>  — inline links in the desktop header
 *   - <MobileNav>    — the fixed bottom bar on phones (the spec's "top
 *                      nav collapses to a bottom row of links")
 * Both highlight the active section, and both show the live unread-DM
 * count on "Messages" (one shared subscription — see
 * unread-messages-badge.tsx for why that matters).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UnreadMessagesBadge } from "@/components/app/unread-messages-badge";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Join & Create", icon: GraduationCap },
  { href: "/people", label: "Students", icon: UsersRound },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

/** The Admin section, appended only for is_admin accounts. */
const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldCheck };

function navLinks(isAdmin: boolean) {
  return isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Props both nav copies need for the unread badge. */
export interface NavBadgeProps {
  userId: string;
  initialUnreadMessages: number;
  /** Shows the Admin nav item (server-verified; the pages 404 anyway). */
  isAdmin?: boolean;
}

export function AppNavLinks({ userId, initialUnreadMessages, isAdmin = false }: NavBadgeProps) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {navLinks(isAdmin).map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary",
            isActive(pathname, link.href)
              ? "bg-primary text-white"
              : "text-ink-muted hover:bg-line/50 hover:text-ink",
          )}
        >
          {link.label}
          {link.href === "/messages" && (
            <UnreadMessagesBadge userId={userId} initial={initialUnreadMessages} />
          )}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav({ userId, initialUnreadMessages, isAdmin = false }: NavBadgeProps) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {navLinks(isAdmin).map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
            // font-semibold is a second, non-color cue for the active tab —
            // color alone (aria-current covers screen readers, but a
            // low-vision/colorblind sighted user needs more than hue).
            isActive(pathname, link.href) ? "font-semibold text-primary" : "text-ink-muted",
          )}
        >
          {/* relative wrapper so the badge can sit on the icon's corner */}
          <span className="relative">
            <link.icon aria-hidden className="h-5 w-5" />
            {link.href === "/messages" && (
              <UnreadMessagesBadge
                userId={userId}
                initial={initialUnreadMessages}
                className="absolute -right-2.5 -top-1.5"
              />
            )}
          </span>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
