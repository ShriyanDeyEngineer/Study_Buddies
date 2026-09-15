/**
 * Shared product constants — the single source of truth for every
 * fixed list and limit the UI and validation both need.
 *
 * If a number here looks arbitrary, check docs/BUILD_PROMPT.md: most are
 * spec requirements (capacity 2–50, bio 500, message 2,000…), and tests
 * assert the exact boundaries. Changing one is a product decision, not a
 * refactor.
 */

/**
 * Email domains allowed to register, for CLIENT-SIDE validation messages
 * only. The real, unbypassable gate is the database trigger reading the
 * `universities` table — this constant just gives students a friendly
 * error before they submit. When a second school launches, add its domain
 * to the universities table (required) and here (for the nicer message).
 */
export const ALLOWED_EMAIL_DOMAINS = ["umn.edu"];

/** Colleges for the profile dropdown and the people filter. Keys are what
 *  the database stores; labels are what students see. */
export const COLLEGES = [
  { value: "cse", label: "Science & Engineering (CSE)" },
  { value: "cla", label: "Liberal Arts (CLA)" },
  { value: "carlson", label: "Carlson School of Management" },
  { value: "cbs", label: "Biological Sciences (CBS)" },
  { value: "cfans", label: "Food, Agricultural & Natural Resource Sciences" },
  { value: "design", label: "College of Design" },
  { value: "education", label: "Education & Human Development" },
  { value: "nursing", label: "School of Nursing" },
  { value: "other", label: "Other" },
] as const;

export const CLASS_STANDINGS = [
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
  { value: "graduate", label: "Graduate student" },
] as const;

export const COLLEGE_VALUES = COLLEGES.map((c) => c.value);
export const STANDING_VALUES = CLASS_STANDINGS.map((s) => s.value);

/** Graduation years the forms/filters accept (mirrors the DB CHECK). */
export const GRAD_YEAR_MIN = 2020;
export const GRAD_YEAR_MAX = 2040;

/** Study groups (spec §5.6). */
export const GROUP_CAPACITY_MIN = 2;
export const GROUP_CAPACITY_MAX = 50;
export const GROUP_CAPACITY_DEFAULT = 8;
export const GROUP_NAME_MAX = 100;
export const GROUP_DESCRIPTION_MAX = 2000;

/** Chat and DMs share one limit (spec §5.8/§5.12). */
export const MESSAGE_MAX_LENGTH = 2000;

/** Group chat and DM threads load this many messages at a time — the
 *  initial view, and each "load earlier" page after it. Keeps a single
 *  fetch bounded no matter how long-lived or busy the conversation is,
 *  instead of pulling the entire history on every page load. */
export const CHAT_PAGE_SIZE = 50;

/** Group resources (shared notes + links) load newest-first, capped here.
 *  There is no "load older" for resources — this ceiling sits far above
 *  any realistic group's count, so it only ever bounds the pathological
 *  case (years of accumulation, scripted inserts). The group page and its
 *  RLS check re-run this query on every member's every visit and every
 *  post-action refresh, so it cannot be left unbounded. If a real group
 *  ever hits this, that is the signal to paginate it like the chat. */
export const GROUP_RESOURCES_LIMIT = 200;

/** Profiles (spec §5.11). */
export const BIO_MAX_LENGTH = 500;
/** Per part — first_name and last_name each. The database joins them into
 *  display_name (migration 0042). */
export const NAME_PART_MAX = 50;
export const SOCIAL_LINKS_MAX = 5;

/** People search box (spec §5.4). */
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** Report categories (spec §5.14) — fixed list, mirrored by a DB CHECK. */
export const REPORT_CATEGORIES = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "academic_dishonesty", label: "Academic dishonesty" },
  { value: "other", label: "Something else" },
] as const;

export const REPORT_CATEGORY_VALUES = REPORT_CATEGORIES.map((c) => c.value);
export const REPORT_DESCRIPTION_MAX = 1000;

/** Content flagging (spec §5.14 companion) — a per-item "a human should
 *  look at this" signal, mirrored by a DB CHECK. Flagging is invisible to
 *  everyone but the flagger and admins. */
export const FLAG_CONTENT_TYPES = [
  "group_message",
  "direct_message",
  "group_resource",
] as const;
export type FlagContentType = (typeof FLAG_CONTENT_TYPES)[number];
export const FLAG_REASON_MAX = 1000;

/** Meetup duration in minutes (bug report #2): 15 min to 8 hours. */
export const MEETUP_DURATION_MIN = 15;
export const MEETUP_DURATION_MAX = 480;
export const MEETUP_DURATION_DEFAULT = 60;
/** Slider snaps to these so nobody schedules a 37-minute session. */
export const MEETUP_DURATION_STEP = 15;

/** Availability polls. */
export const POLL_SLOTS_MIN = 2;
export const POLL_SLOTS_MAX = 400; // ~2 weeks of 30-min grid cells (was 20 hand-typed slots)
