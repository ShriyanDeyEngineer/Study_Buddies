/**
 * The Admin section (/admin/*): reports, course requests, the uncensored
 * message log, and the group browser. NON-ADMINS GET A 404 — same rule
 * as group settings (§ existence of the area is not advertised). The
 * database enforces everything again underneath (is_admin() policies and
 * functions), so this guard is UX, not the security boundary.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types";

const SECTIONS = [
  { href: "/admin", label: "Reports" },
  { href: "/admin/requests", label: "Course requests" },
  { href: "/admin/messages", label: "Flagged messages" },
  { href: "/admin/flags", label: "Flagged content" },
  { href: "/admin/groups", label: "Groups" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSessionProfile();
  if (!profile || !(profile as ProfileRow).is_admin) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink">Admin</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Observation only: nothing you view here joins you to a group or
          leaves a trace for members. To participate somewhere, join it
          normally as yourself.
        </p>
        <nav aria-label="Admin sections" className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
