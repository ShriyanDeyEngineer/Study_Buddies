/**
 * Row shapes for the tables and functions we read.
 *
 * WHY HAND-WRITTEN: Supabase can generate types from a live database
 * (`supabase gen types`), but that ties every checkout to a running
 * instance. Until the team adopts that, these interfaces are the contract
 * — if you change a column in supabase/migrations, update it here too.
 * Query results come back untyped from supabase-js, so call sites cast:
 *   const groups = (data ?? []) as StudyGroupRow[];
 * That cast is the one place we tell TypeScript "trust the migration".
 */
import type { PrivacyFlags } from "@/lib/validation/profile";

export interface ProfileRow {
  id: string;
  university_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  college: string | null;
  major: string | null;
  class_standing: string | null;
  graduation_month: number | null;
  graduation_year: number | null;
  social_links: string[];
  privacy: PrivacyFlags;
  is_available_for_buddies: boolean;
  /** Email me about group/friend events (webhook honors this). */
  email_notifications: boolean;
  account_status: "active" | "paused" | "suspended" | "banned" | "deleted";
  /** Admin mute: account works, but cannot create content (0041). */
  is_muted: boolean;
  is_admin: boolean;
  onboarded_at: string | null;
  last_login_at: string | null;
  /** When / which version of the legal terms this user accepted
   *  (migration 0039). NULL for accounts that onboarded before it. */
  terms_accepted_at: string | null;
  terms_version: string | null;
  /** When the account was deleted; drives the retention purge (0035). */
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseRow {
  id: string;
  university_id: string;
  department_code: string;
  course_number: string;
  course_name: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

/** "CSCI 1133" — the way a course is referred to everywhere in the UI. */
export function courseCode(course: Pick<CourseRow, "department_code" | "course_number">) {
  return `${course.department_code} ${course.course_number}`;
}

export interface StudyGroupRow {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  manager_id: string;
  mode: "open" | "closed";
  capacity: number;
  member_count: number;
  status: "active" | "inactive" | "archived" | "disbanded";
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberRow {
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface JoinRequestRow {
  id: string;
  group_id: string;
  user_id: string;
  status: "pending" | "approved" | "denied" | "withdrawn" | "cancelled";
  created_at: string;
  resolved_at: string | null;
}

export interface GroupInvitationRow {
  id: string;
  group_id: string;
  invited_user_id: string;
  inviter_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  resolved_at: string | null;
}

export interface MeetupRow {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  scheduled_at: string;
  format: "online" | "in_person";
  location: string | null;
  meeting_link: string | null;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  /** 15–480 whole minutes; drives the shown end time + calendar link. */
  duration_minutes: number;
  created_at: string;
}

export interface MeetupAttendanceRow {
  meetup_id: string;
  user_id: string;
  status: "attending" | "maybe" | "not_attending";
  updated_at: string;
}

export interface AvailabilityPollRow {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  status: "open" | "closed";
  created_at: string;
}

export interface AvailabilitySlotRow {
  id: string;
  poll_id: string;
  starts_at: string;
  ends_at: string;
}

export interface CourseRequestRow {
  id: string;
  university_id: string;
  requester_id: string;
  department_code: string;
  course_number: string;
  course_name: string;
  status: "pending" | "approved" | "declined";
  course_id: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  category: string;
  description: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolution: string | null;
  /** Set when status becomes resolved/dismissed; drives the purge (0035). */
  resolved_at: string | null;
  created_at: string;
}

export interface MessageOriginalRow {
  id: string;
  message_kind: "group" | "direct";
  message_id: string;
  sender_id: string;
  original_content: string;
  /** The masked text everyone actually saw, captured at send time. */
  censored_content: string;
  created_at: string;
}

export interface GroupResourceRow {
  id: string;
  group_id: string;
  author_id: string;
  kind: "note" | "link";
  title: string;
  /** Note body, or the URL for links. */
  content: string;
  created_at: string;
}

export interface ContentFlagRow {
  id: string;
  flagger_id: string;
  content_type: "group_message" | "direct_message" | "group_resource";
  content_id: string;
  /** Who posted the flagged item; null once that account is deleted. */
  content_author_id: string | null;
  /** The group for message/resource flags; null for DM flags. */
  group_id: string | null;
  /** The text the flagger saw, captured at flag time (migration 0040). */
  content_snapshot: string;
  content_created_at: string | null;
  reason: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  /** Set when status becomes resolved/dismissed; drives the purge (0035). */
  resolved_at: string | null;
  created_at: string;
}

export interface GroupMessageRow {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface DirectMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  payload: Record<string, string | undefined>;
  read_at: string | null;
  created_at: string;
}

/** The id/name/avatar triple from the public_profiles view. */
export interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** One row from the search_people() function. */
export interface PersonSearchResult {
  id: string;
  display_name: string;
  avatar_url: string | null;
  college: string | null;
  major: string | null;
  class_standing: string | null;
  graduation_year: number | null;
  is_available_for_buddies: boolean;
  shared_courses: number;
  total_count: number;
}

/** One row from get_conversations(). */
export interface ConversationSummary {
  other_id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  last_message_mine: boolean;
  unread_count: number;
}
