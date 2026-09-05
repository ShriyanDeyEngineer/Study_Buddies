/**
 * The avatar menu in the app header: view/edit profile, sign out.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Settings, UserRound, Users } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  userId,
  displayName,
  avatarUrl,
}: {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Avatar src={avatarUrl} name={displayName} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/profile/${userId}`}>
            <UserRound aria-hidden className="h-4 w-4" />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <Settings aria-hidden className="h-4 w-4" />
            Edit profile &amp; privacy
          </Link>
        </DropdownMenuItem>
        {/* Friends, buddies, pending requests, AND the blocked list with its
            Unblock buttons. Blocked people vanish from search on purpose, so
            without this link there was no way to find the unblock action. */}
        <DropdownMenuItem asChild>
          <Link href="/friends">
            <Users aria-hidden className="h-4 w-4" />
            Friends &amp; Buddies
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            // Server action via the dropdown: fire and let it redirect.
            void signOutAction();
          }}
        >
          <LogOut aria-hidden className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
