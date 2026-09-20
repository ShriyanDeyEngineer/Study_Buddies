/**
 * Create-a-group page (/groups/new). Three ways in (spec §5.6):
 *
 *   1. No parameter — from "Create a group" on Join & Create. The form
 *      asks which courses the group is for; nothing is pre-tagged. This
 *      is the main path now that a group can cover SEVERAL courses
 *      (0043), because there's no single course to start from.
 *   2. ?course=<id> — from a course page. That course starts tagged (and
 *      becomes the primary), and more can be added in the form.
 *   3. ?course=custom — "my course isn't listed": the student supplies
 *      the department, number, and name, and we find-or-create the course
 *      before creating the group. No invite picker in this path: a
 *      brand-new course has no enrolled classmates to invite.
 */
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourseCatalog } from "@/lib/data/course-catalog";
import type { PublicProfile } from "@/lib/types";
import { CreateGroupForm } from "./create-group-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Create a study group" };

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course: courseParam } = await searchParams;

  if (courseParam === "custom") {
    return <CreateGroupForm variant="custom" />;
  }

  // The catalog the picker searches. Cached and identical for everyone,
  // so this costs nothing per visit (lib/data/course-catalog.ts).
  const { courses } = await getCourseCatalog();

  // No course given: the ordinary path from Join & Create. The form asks.
  if (!courseParam) {
    return <CreateGroupForm courses={courses} />;
  }

  if (!UUID_RE.test(courseParam)) notFound();
  if (!courses.some((c) => c.id === courseParam)) notFound();

  // Arrived from a course page — pre-tag it, and pre-load the people that
  // course lets you invite so the picker is populated on first paint.
  const supabase = await createClient();
  const { data: classmates } = await supabase.rpc("get_courses_classmates", {
    p_course_ids: [courseParam],
  });

  return (
    <CreateGroupForm
      courses={courses}
      initialCourseIds={[courseParam]}
      initialClassmates={(classmates ?? []) as PublicProfile[]}
    />
  );
}
