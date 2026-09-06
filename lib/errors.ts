/**
 * Error-code → friendly-copy mapping.
 *
 * Our database functions fail with short machine codes ('GROUP_FULL',
 * 'NOT_MANAGER'…) instead of prose. This file is the ONLY place those
 * codes become sentences, which guarantees the spec's rule that a raw
 * database error ("duplicate key value violates unique constraint…")
 * never reaches a student's screen.
 *
 * To add a new database error: raise 'YOUR_CODE' in SQL, add one line to
 * FRIENDLY_MESSAGES here. That's the whole workflow.
 */

export const FRIENDLY_MESSAGES: Record<string, string> = {
  // ── Auth / accounts ──────────────────────────────────────────────────
  EMAIL_DOMAIN_NOT_ALLOWED:
    "Only @umn.edu accounts can join right now. Pick your university Google account and try again.",
  NOT_AUTHENTICATED: "You need to be signed in to do that.",
  NOT_ONBOARDED: "Finish setting up your profile first.",
  ACCOUNT_DISABLED: "Your account is currently suspended.",

  // ── Groups ───────────────────────────────────────────────────────────
  GROUP_FULL: "This group is full.",
  GROUP_NOT_FOUND: "We couldn't find that group. It may have been disbanded.",
  GROUP_UNAVAILABLE: "This group isn't active anymore.",
  NAME_TAKEN: "A group with that name already exists for this course — pick another name.",
  NOT_MANAGER: "Only the group's manager can do that.",
  NOT_MEMBER: "You're not a member of this group.",
  ALREADY_MEMBER: "You're already in this group.",
  DUPLICATE_REQUEST: "You already have a pending request.",
  NO_PENDING_REQUEST: "There's no pending request to withdraw.",
  INVALID_NAME: "Group names need to be 1–100 characters.",
  INVALID_DESCRIPTION: "Keep the description under 2000 characters.",
  INVALID_CAPACITY: "Capacity must be between 2 and 50.",
  CAPACITY_BELOW_MEMBER_COUNT:
    "Capacity can't be lower than the group's current member count.",
  INVALID_MODE: "Choose open or closed.",
  TOO_MANY_INVITES: "You can't invite more people than the group can hold.",
  INVALID_INVITEE: "One of your invitees isn't enrolled in this course.",
  COURSE_NOT_FOUND: "We couldn't find that course.",

  // ── Requests / invitations ───────────────────────────────────────────
  REQUEST_NOT_FOUND: "That request doesn't exist anymore.",
  ALREADY_RESOLVED: "This was already handled. Refresh to see the latest.",
  NOT_ALLOWED: "You don't have permission to do that.",

  // ── Meetups & polls ──────────────────────────────────────────────────
  MEETUP_NOT_FOUND: "We couldn't find that meetup.",
  MEETUP_IN_PAST: "Meetups must be scheduled in the future.",
  MEETUP_PAST: "That meetup already happened.",
  MEETUP_CANCELLED: "That meetup was cancelled.",
  INVALID_TITLE: "Titles need to be 1–100 characters.",
  INVALID_FORMAT: "Choose online or in person.",
  MISSING_LINK: "Online meetups need a meeting link.",
  MISSING_LOCATION: "In-person meetups need a location.",
  INVALID_RSVP: "Pick attending, maybe, or can't make it.",
  INVALID_DURATION: "Sessions run between 15 minutes and 8 hours.",
  POLL_NOT_FOUND: "We couldn't find that poll.",
  POLL_CLOSED: "This poll is closed.",
  INVALID_SLOTS: "Polls need 2–400 future time slots, each ending after it starts.",

  // ── Resources ────────────────────────────────────────────────────────
  RESOURCE_NOT_FOUND: "That resource is already gone.",
  INVALID_KIND: "Choose a note or a link.",
  INVALID_LINK: "Links must start with http:// or https://.",
  INVALID_NOTE: "Notes need 1\u20135,000 characters.",

  // ── Messages ─────────────────────────────────────────────────────────
  EMPTY_MESSAGE: "Type a message first.",
  MESSAGE_TOO_LONG: "Messages max out at 2,000 characters.",
  RATE_LIMITED: "You're sending messages too fast — wait a few seconds and try again.",

  // ── People ───────────────────────────────────────────────────────────
  USER_NOT_FOUND: "We couldn't find that person.",
  SELF_ACTION: "You can't do that to yourself.",
  ALREADY_FRIENDS: "You're already friends.",
  NOT_FRIENDS: "You're not friends with this person.",
  ALREADY_CONNECTED: "You're already study buddies.",
  NOT_CONNECTED: "You're not study buddies with this person.",
  NOT_AVAILABLE: "This person isn't looking for a study buddy right now.",
  BLOCKED: "You can't send that request.",
  NOT_BLOCKED: "You haven't blocked this person.",

  // ── Courses ──────────────────────────────────────────────────────────
  INVALID_DEPARTMENT: "Department codes look like CSCI or MATH (2–8 letters).",
  INVALID_COURSE_NUMBER: "Course numbers look like 1133 or 1301W.",
  // Approving a request into the catalog still requires a real name.
  INVALID_COURSE_NAME: "Course names need to be 1–200 characters.",
  // Filing a request does not — course_name is optional there; this only
  // fires if someone typed more than the limit.
  COURSE_NAME_TOO_LONG: "Keep the course name under 200 characters.",

  // ── Admin / course requests ──────────────────────────────────────────
  MUTED:
    "An admin has muted your account, so you can't post or create things right now. Email studybuddiesmn@gmail.com if you think this is a mistake.",
  NOT_ADMIN: "Only admins can do that.",
  COURSE_EXISTS: "That course is already in the catalog — search for it instead.",

  // ── Reports ──────────────────────────────────────────────────────────
  INVALID_CATEGORY: "Pick the reason that fits best.",
  DESCRIPTION_TOO_LONG: "Keep the description under 1,000 characters.",

  // ── Content flags ────────────────────────────────────────────────────
  CONTENT_NOT_FOUND: "That content isn't available anymore.",
  INVALID_CONTENT_TYPE: "That can't be flagged.",
  REASON_TOO_LONG: "Keep the note under 1,000 characters.",
};

export const GENERIC_ERROR =
  "Something went wrong on our end. Try again in a moment.";

/**
 * Turns anything a Supabase call can throw/return into friendly copy.
 *
 * Handles the three shapes we actually see:
 *   1. our own codes — the error message IS the code ("GROUP_FULL")
 *   2. Supabase auth wrapping a trigger rejection — the domain trigger
 *      surfaces as "Database error saving new user", which we translate
 *      to the friendly domain message (spec pitfall #10)
 *   3. anything else — the generic apology, never raw database text.
 */
export function friendlyError(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "";

  // Exact code match first (PostgREST passes our RAISE message through).
  if (message in FRIENDLY_MESSAGES) return FRIENDLY_MESSAGES[message];

  // Sometimes the code arrives embedded in a longer string.
  for (const code of Object.keys(FRIENDLY_MESSAGES)) {
    if (message.includes(code)) return FRIENDLY_MESSAGES[code];
  }

  // Supabase Auth masks our domain trigger's exception with its own text —
  // during signup, that masked error can only mean the domain check fired.
  if (message.includes("Database error saving new user")) {
    return FRIENDLY_MESSAGES.EMAIL_DOMAIN_NOT_ALLOWED;
  }

  return GENERIC_ERROR;
}
