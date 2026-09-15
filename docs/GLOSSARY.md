# Glossary

Plain-English definitions of the product's terms, for teammates joining the
project. When code, UI copy, and this file disagree, fix the disagreement —
these words are the contract.

## People

- **Student / user** — anyone with an account. Every account belongs to a
  verified `@umn.edu` email address; there are no outside accounts.
- **Profile** — a user's public page: name, picture, college, major, class
  standing, bio, classes, graduation date, friend count, social links.
  Almost every field can be individually hidden (see *privacy flags*).
- **Display name** — the name others see: the student's first and last name,
  joined by the database (migration 0042). Entering both is the only
  REQUIRED step of onboarding; until a display name exists, the app keeps
  redirecting to the onboarding wizard.
- **Onboarding** — the three-step wizard after first sign-in (identity →
  courses → bio/picture). Finishing it (display name saved) unlocks the app.
- **Friend** — a mutual connection created when one student's friend request
  is accepted by the other. Both see each other in their friends list, or
  neither does — there is no one-way friendship.
- **Study buddy** — a mutual 1-on-1 connection for studying together,
  separate from friendship. Created by accepting a *buddy request*. A student
  only receives buddy requests while their **availability toggle** is on.
- **Block** — a one-click severing: any friendship and buddy connection are
  removed, pending requests both ways are cancelled, and the blocked person
  can no longer message, send requests, find the blocker in search, or view
  their profile. Silent — the blocked person is never told.
- **Privacy flags** — per-field "hide this" switches (college, major,
  standing, bio, graduation, social links, each of the three class lists).
  A hidden field is stripped from API responses in the database itself AND
  excludes the user from that field's search filter — otherwise showing up
  in "major = X" results would leak the hidden major.
- **Account deletion** — self-service, typed-DELETE-confirmed, irreversible.
  Immediately: leaves every group (normal succession/disband), cancels
  pending requests both ways, drops RSVPs, poll votes, the notification
  inbox and any pending course request, scrubs all profile PII to a
  "Deleted User" tombstone, and frees the Google identity so signing in
  again starts a brand-new account. The tombstone plus the account's
  course list, friendships, buddy connections, blocks, and retained email
  are then deleted by the nightly purge once the retention grace period
  has passed (see *data retention*).
- **Admin** — an account with `is_admin` set (by hand, in the database).
  Admins can read reports. There is no admin UI yet.
- **Suspended / banned** — account statuses set by the team after reviewing
  reports. Both lock the account out at the app shell and remove it from
  search, filters, and suggestions. Suspension implies "maybe temporary";
  ban implies "permanent" — functionally identical in code today.

## Courses

- **Course** — one catalog entry per (university, department code, number),
  e.g. `CSCI 1133`. Seeded with verified UMN courses; students add missing
  ones ("Add a missing course"), and admins bulk-import terms via CSV.
- **Course lists** — each profile has three: **current** (taking now),
  **taken**, and **future** (planned). Only the *current* list drives
  matching: group invites, people filters, suggestions.
- **Classmate** — someone whose *current* list shares a course with yours.

## Study groups

- **Study group** — a named group attached to exactly one course, with a
  capacity of 2–50 seats. Has chat, meetups, polls, and a member list.
- **Manager** — the group's admin (crown icon). Creates the group (or
  inherits it — see *succession*), approves/denies requests, removes
  members, renames, switches mode, disbands.
- **Open group** — anyone can join instantly while seats remain.
- **Closed group** — joining requires a **join request** the manager
  approves or denies. One pending request per person per group, withdrawable.
- **Invitation** — a seat offered by the creator at group creation, sent to
  current classmates only. Accepting seats you even in a closed group.
- **Capacity** — the hard seat limit (2–50). Enforced in the database under
  a row lock, so simultaneous joins can never overfill a group.
- **Manager succession** — when the manager leaves a non-empty group, the
  member with the earliest `joined_at` (ties: earliest account creation)
  becomes manager automatically. Deterministic, never random.
- **Disband** — the manager's typed-name-confirmed teardown: all members
  removed, future meetups cancelled, pending requests declined, everyone
  notified — one transaction. The group row stays as a tombstone for the
  retention grace period (old links explain themselves, and admins can
  still review the chat if something was reported); then the nightly purge
  deletes the group and everything inside it — chat, meetups, polls,
  resources, and request history — from the database for good.

## Data retention

- **Retention grace period** — the fixed number of days
  (`retention_grace_days()`, currently 365) after which every kind of
  stored data is deleted from the database. One knob governs almost
  everything; `courses` and `universities` are the only tables kept
  forever. Enforced nightly by `purge_stale_rows()`. Full rules, and how
  to change the number, in [RETENTION.md](RETENTION.md).
- **Tombstone** — a row kept only so something else still renders: a
  disbanded group (so old links explain themselves), or a scrubbed
  "Deleted User" profile (so other people's old chat keeps a name on it).
  Deleted by the nightly purge once the grace period passes and nothing
  points at it any more.

## Scheduling

- **Meetup** — a scheduled study session: title, future date/time, format
  (**online** with a required meeting link, or **in person** with a required
  location). Stored in UTC, displayed in each viewer's local time.
- **RSVP** — a member's answer to a meetup: attending / maybe / can't make
  it. The attendee count is COUNTED from RSVP rows at read time, never
  cached (cached counters drift).
- **Upcoming vs. past** — derived by comparing the meetup's time to "now"
  whenever it's displayed. There is no status column to flip and no cron
  job — on purpose.
- **Availability poll** — our built-in When2Meet. A member picks a date
  range and daily hours ("next week, 9 AM–9 PM"); the poll becomes a
  **grid** of 30-minute slots (days across, times down). Members **drag
  across the grid** to paint when they're free; cells shade darker as
  more people can make it, and hovering shows who. The slot most people
  can make is highlighted with a one-click "Schedule this time" button
  that opens the meetup form prefilled. Built natively (no When2Meet
  embed) so it stays inside the single sign-in and feeds straight into
  meetups.
- **Slot** — one 30-minute cell of a poll's grid. A vote is one row per
  (slot, member); "I'm free 2–4 PM" is four slot votes.

## Messaging & notifications

- **Group chat** — realtime messages inside a group, members only, full
  history kept. 1–2,000 characters per message, enforced in the form, the
  server action, AND a database constraint.
- **Direct message (DM)** — 1-to-1 chat, same limits. The conversation list
  shows an **unread count** per thread that clears when the thread opens.
- **Notification** — an in-app inbox row (bell icon). Created only by
  database functions (group invites, request outcomes, meetup changes,
  friend/buddy events…). Clicking one marks it read and navigates.

## Moderation

- **Report** — a student flagging another (fixed category + optional
  description ≤1,000 chars). Stored for team review; emailed to the admin
  address only if email is configured. False reports can boomerang on the
  reporter — the form says so.

## Technical terms teammates will meet in the code

- **RLS (row-level security)** — Postgres rules deciding which ROWS each
  user's queries can see. Our realtime channels respect it too.
- **SECURITY DEFINER function** — a database function running with the
  database owner's rights instead of the caller's. Every state change with
  a correctness rule (joins, approvals, blocks…) is one of these; clients
  have no direct write access to those tables.
- **Error code** — the SCREAMING_SNAKE string our functions fail with
  (`GROUP_FULL`, `NOT_MANAGER`…). Mapped to friendly copy in
  `lib/errors.ts`; students never see raw database errors.
