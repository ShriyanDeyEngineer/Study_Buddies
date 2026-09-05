/**
 * /admin — overview counts + the reports queue (spec §5.14 groundwork).
 * Names come from the profiles table directly (the admin RLS policy),
 * because reported accounts may be suspended and public_profiles hides
 * those.
 */
import { getSessionProfile } from "@/lib/supabase/server";
import type { ReportRow } from "@/lib/types";
import { REPORT_CATEGORIES } from "@/lib/constants";
import { adminPersonLabel } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { ReportStatusButtons } from "./report-actions";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Admin" };

type NameRow = { id: string; display_name: string | null; account_status: string };

export default async function AdminReportsPage() {
  const { supabase } = await getSessionProfile();

  const [reportsRes, pendingReqRes, flaggedRes, openFlagsRes, groupsRes] =
    await Promise.all([
      supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("course_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("message_originals").select("id", { count: "exact", head: true }),
      supabase
        .from("content_flags")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("study_groups")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);
  const reports = (reportsRes.data ?? []) as ReportRow[];

  const personIds = [
    ...new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user_id])),
  ];
  const namesRes = personIds.length
    ? await supabase.from("profiles").select("id, display_name, account_status").in("id", personIds)
    : { data: [] };
  const names = Object.fromEntries(
    ((namesRes.data ?? []) as NameRow[]).map((p) => [p.id, p]),
  );

  const openCount = reports.filter((r) => r.status === "open").length;
  const stats = [
    { label: "Open reports", value: openCount },
    { label: "Pending course requests", value: pendingReqRes.count ?? 0, href: "/admin/requests" },
    { label: "Flagged messages", value: flaggedRes.count ?? 0, href: "/admin/messages" },
    { label: "Open content flags", value: openFlagsRes.count ?? 0, href: "/admin/flags" },
    { label: "Active groups", value: groupsRes.count ?? 0, href: "/admin/groups" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="font-display text-2xl text-ink">{stat.value}</p>
              {stat.href ? (
                <Link href={stat.href} className="text-sm text-primary underline underline-offset-2">
                  {stat.label}
                </Link>
              ) : (
                <p className="text-sm text-ink-muted">{stat.label}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <section aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="mb-3 font-display text-xl text-ink">
          Reports
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-ink-muted">No reports filed yet.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => {
              const reporter = names[report.reporter_id];
              const reported = names[report.reported_user_id];
              const category =
                REPORT_CATEGORIES.find((c) => c.value === report.category)?.label ??
                report.category;
              return (
                <li key={report.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        <Link
                          href={`/profile/${report.reported_user_id}`}
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          {adminPersonLabel(reported?.display_name, report.reported_user_id)}
                        </Link>{" "}
                        was reported for <span className="font-medium">{category}</span> by{" "}
                        {adminPersonLabel(reporter?.display_name, report.reporter_id)}
                        {reported && reported.account_status !== "active" && (
                          <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                            account {reported.account_status}
                          </span>
                        )}
                      </p>
                      {report.description && (
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink-muted">
                          {report.description}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-ink-muted">
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ReportStatusButtons reportId={report.id} status={report.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
