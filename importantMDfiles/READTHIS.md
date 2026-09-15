Never study alone at the U again. A website for University of Minnesota
students to find study partners and create or join study groups for their
specific courses — built by students, for students, with the big intro
STEM courses (physics, chem, calc, intro CS) front and center.

**Not officially affiliated with the University of Minnesota.**

## What this website does

- **Verified UMN accounts, Google-only** — one button: "Continue with
  UMN Google". No passwords to forget, no verification emails to chase.
  The @umn.edu rule is enforced by a database trigger reading an
  allow-list table (it rejects personal Gmails no matter what the Google
  account chooser says), so launching at a second university is one
  inserted row, not a code change.
- **Study groups per course** — open (join instantly) or closed (manager
  approves), 2–50 seats, invite classmates at creation. Capacity and
  approvals are enforced under database row locks, so simultaneous clicks
  can never overfill a group.
- **Group chat** — realtime, full history, 2,000-character limit enforced
  in three layers (form counter, server validation, DB constraint).
- **Meetups** — online (link required) or in person (location required),
  RSVP with live attending counts derived from rows, add-to-Google-Calendar
  links, cancellation with notifications. Times stored UTC, shown local.
- **Availability polls** — built-in When2Meet-style voting; the winning
  slot converts to a meetup in one click.
- **Find people** — search + server-side filters (course, major, college,
  standing, grad year, study-buddy availability) that live in the URL;
  suggestions ranked shared-courses-first; 1-on-1 study-buddy matching.
- **Per-field privacy** — hide college, major, standing, bio, graduation,
  links, or any class list. Hidden fields are stripped in the database AND
  exclude you from that filter (so filtering can't leak them either).
- **Friends, DMs, blocking** — mutual friendships, realtime direct
  messages with unread counts, and blocking that atomically severs
  everything (spec'd and invariant-tested).
- **Notifications** — realtime bell, full inbox page, every group/social
  event covered.
- **Moderation** — categorized reports (optionally emailed to the team),
  suspended/banned lockout screens, `is_admin` groundwork.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Components + Server Actions), TypeScript strict |
| Styling | Tailwind CSS v4 (CSS-first `@theme` in `app/globals.css` — no JS config) |
| UI | Hand-rolled shadcn-style components on Radix primitives (`components/ui/`) |
| Validation | Zod — one schema per form, shared by client and server |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) — no separate API server |
| Tests | Vitest (pure logic) + a SQL invariant script (`supabase/tests/`) |
| Email (optional) | Resend via REST — silent no-op when unconfigured |
| Hosting | Vercel (`main` → production, PRs → previews) |

**Architecture in one paragraph:** reads happen in Server Components with
the user's session (row-level security scopes every query). Writes go
through Server Actions that validate with Zod, then call `SECURITY
DEFINER` Postgres functions for anything with a correctness rule — those
functions lock the group row first, re-check invariants inside the lock,
and fail with machine codes (`GROUP_FULL`, `NOT_MANAGER`…) that
`lib/errors.ts` maps to friendly copy. Realtime subscriptions (chat, DMs,
notifications) respect RLS, so the websocket can't leak what a query
couldn't return.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys — see SETUP.md
npm run dev                  # http://localhost:3000
```

Full instructions — creating the Supabase project, migrations, auth
settings, Google OAuth, course imports, Vercel — live in **[SETUP.md](SETUP.md)**.

Quality gates:

```bash
npm run typecheck   # tsc, zero errors
npm test            # 94 unit tests
npm run build       # production build
# database invariants (needs a database; rolls itself back):
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
```

## Repo map

```
app/                  Routes: (marketing) public pages, (auth) sign-in/up,
                      (app) the signed-in product, onboarding/, auth/ callbacks
components/ui/        The design system (button, dialog, inputs, states…)
components/…          Feature components (chat, meetups, filters, panels)
lib/                  Validation schemas, server actions, pure logic, clients
supabase/migrations/  The database: schema, RLS, SECURITY DEFINER functions
supabase/seed.sql     Verified UMN course catalog starter
supabase/tests/       The §7 invariant test script
scripts/              Admin CSV course importer
docs/                 BUILD_PROMPT.md (the spec) + GLOSSARY.md
CodingDevelopmentPlans/  Early planning docs (pre-build history)
```

The old `frontEnd/`/`backEnd/` prototype this repo started with was
replaced wholesale by this app (it used a separate Express server, which
the spec explicitly rules out); see git history if you're curious.

## Changes after the original spec

- **Auth is Google-only** (team decision, 2026-08-06). The build prompt's
  §5.2 required email/password alongside Google; the team dropped
  email/password entirely, which removed the password policy UI, email
  verification, and reset flows. The database domain trigger — the real
  @umn.edu boundary — is unchanged and now guards the one remaining door.
- **First and last name are required** (2026-09-14). Onboarding asks for
  both, prefilled from the Google account; the database joins them into
  `display_name`, the name classmates see, which can no longer be set
  freehand. Accounts from before this confirm their name once on a gate
  screen. (`0042_first_last_name.sql`)

## Judgment calls (where the spec left room)

Decisions we made and why — each is also commented at the code site:

1. **Crossing requests auto-accept.** If A requests B while B's request to
   A is pending, we connect them instead of stacking two requests — both
   clearly want it. (Friends and buddies both; `0003_social_graph.sql`.)
2. **Full groups sweep their queues.** When a group hits capacity, ALL
   still-pending requests/invites are cancelled with the
   "group filled" notification, not left dangling forever. Re-requesting
   after someone leaves is allowed. (`cancel_pending_on_full`.)
3. **Buddy requests require the toggle.** You can only send a buddy
   request to someone currently marked available — the toggle is their
   consent to being asked. Friend requests have no such gate.
4. **Blocker can still see the blocked profile** (with an Unblock button);
   the blocked person gets a 404 for the blocker. One-way visibility lets
   the blocker manage the block where they expect to find it.
5. **Meetup creators auto-RSVP "attending"** — you planned it; making you
   click a second button is noise. (`create_meetup`.)
6. **Calendar links default to one hour** — meetups have no duration
   field; an hour is the least-wrong default. (`lib/calendar.ts`.)
7. **Manager succession ties break by user id** after account-creation
   date — guarantees full determinism even for same-instant signups.
8. **Course `term` labels: not implemented.** The spec made terms
   optional; uniqueness is per (university, department, number). Simpler
   to operate; revisit if per-term groups become a real need.
9. **College filter on the catalog is approximate** — UMN course numbers
   don't encode college, so `lib/courses.ts` keeps a hand-maintained
   department→college map. Unmapped departments just don't match college
   filters.
10. **Suspended vs. banned are functionally identical today** — different
    copy, same lockout. Distinction is groundwork for future moderation
    tooling.
11. **Invite-later (from an existing group's members panel) is future
    work** — invitations currently happen at group creation. The schema
    already supports more.
12. **Group previews are visible to any signed-in student** (name, course,
    counts, manager, mode) — that's what makes groups discoverable; chat,
    meetups, and the roster stay members-only via RLS.
13. **Emails are matched in people-search but never displayed** — the spec
    allows matching as a server-side convenience; output columns simply
    don't include email.
14. **Footer contact address is a placeholder** —
    `team@studybuddies.example` isn't routable; swap in the team's
    real shared inbox before launch (`components/marketing/site-footer.tsx`).

## Documentation

- **[SETUP.md](SETUP.md)** — zero-to-running runbook (Supabase, OAuth, Vercel).
- **[QA.md](QA.md)** — the manual test checklist for releases.
- **[docs/GLOSSARY.md](docs/GLOSSARY.md)** — the product's vocabulary.
- **[docs/BUILD_PROMPT.md](docs/BUILD_PROMPT.md)** — the full spec this app implements.
