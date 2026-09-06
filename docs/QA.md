# QA — manual test checklist

Run through this before every release. Each line is a checkbox: mark it,
and if it fails, file it with the steps that broke it. "U1/U2/U3" means
distinct test accounts (use `yourname+1@umn.edu` style aliases).

## Marketing & SEO

- [ ] `/` renders: hero, two CTAs (Get started → /register, See how it
      works → scrolls to the section), 3-step how-it-works, features,
      closing CTA.
- [ ] `/about`, `/why`, `/testimonials` render; testimonials shows the
      "be the first" empty state.
- [ ] Header links + Sign in/Sign up work on all four pages; footer shows
      team, contact, and the "not officially affiliated" disclaimer.
- [ ] `/sitemap.xml` lists only public pages; `/robots.txt` disallows
      /dashboard, /groups, /people, /messages, etc.
- [ ] Everything usable at 375px, 768px, 1024px, 1440px.

## Sign-in — UMN Google (the only method)

- [ ] /login and /register both show ONLY "Continue with UMN Google" —
      no password fields anywhere in the app.
- [ ] The button opens Google's chooser with UMN accounts surfaced first.
- [ ] A umn.edu Google account lands directly in onboarding on first
      sign-in (no verification step), /dashboard on later sign-ins.
- [ ] A personal Gmail is REJECTED and the login page shows "Only
      @umn.edu accounts can join" — not a raw database error.
- [ ] Cancelling at Google's screen lands on the friendly "didn't
      finish" page, with a working "try again".
- [ ] Signed-in users hitting /login or /register are bounced to
      /dashboard; signed-out users hitting /dashboard are bounced to
      /login and return to their target after signing in.
- [ ] Old bookmarks to /forgot-password, /reset-password, /verify-email
      404 (the routes are gone, nothing crashes).

## Onboarding

- [ ] Exactly 3 steps; only display name is required; optional fields
      are labeled optional and never block Next.
- [ ] Pressing Enter in a text field advances the step — it must NOT
      submit the wizard.
- [ ] Course picker searches by code and by name; skipping it is fine.
- [ ] Avatar: a 6 MB file and a .txt renamed to .png are both rejected
      with the format/size message; a real JPEG under 5 MB previews and
      saves.
- [ ] Refresh mid-wizard: no crash, no half-saved account; the wizard
      restarts cleanly.
- [ ] After Finish you land on /dashboard; revisiting /onboarding
      redirects back to /dashboard.

## Dashboard

- [ ] Empty state (fresh account): every section shows encouraging copy
      with an action, not blank space.
- [ ] With data: my groups show course code, members/capacity,
      open/closed badge, and next meetup; courses show group counts;
      explore lists most-active courses.
- [ ] Search box with ≥2 chars goes to /people?q=…
- [ ] Suggested people: only course-sharers and grad-year-sharers, max
      10, course-sharers first.

## Courses

- [ ] Catalog search matches department (CSCI), number (1301), and name
      (physics); department + college filters narrow the list.
- [ ] Empty search results offer "Add a missing course" prominently.
- [ ] Adding a duplicate course routes to the existing page with the
      "already in the catalog" note — never a raw error.
- [ ] Course page lists active groups, each with the correct join
      control; "Create a group for this course" works.

## Groups — creating & joining

- [ ] Creation form: capacity outside 2–50 and empty name give inline
      per-field errors; open/closed difference is explained.
- [ ] Invite picker only offers CURRENT classmates, caps at
      capacity − 1, and re-checks on submit.
- [ ] "My course isn't listed" path creates course + group together.
- [ ] Duplicate group name within one course → inline NAME_TAKEN error
      on the name field.
- [ ] Join button states: Join (open), Request to join (closed),
      Requested ✓ (click withdraws), Member, Manager, Full, Unavailable
      — and a member of a full group sees Member, not Full.
- [ ] U2 joining an open group lands them in it instantly; joining a
      full group is refused with the friendly full message.
- [ ] Closed group: U2's second request attempt → "already have a
      request waiting"; withdraw works.
- [ ] Invitee sees the Accept/Decline banner on the group page;
      accepting seats them even though the group is closed.

## Group page

- [ ] Non-member preview: name, course, member count, manager, mode,
      join control — and NO chat/meetups/member list.
- [ ] Chat: U1's message appears for U2 within ~2s without refresh; own
      messages right-aligned maroon; sender name+avatar on others';
      date separators correct.
- [ ] Counter turns red at 2,001 chars and Send is disabled; a 2,000-char
      message sends.
- [ ] Scroll up during incoming messages → "New messages" pill appears,
      clicking jumps to newest; at bottom it auto-scrolls.
- [ ] Meetups: creating with everything invalid shows ALL field errors
      at once; online requires link, in-person requires location.
- [ ] Times display in local time; RSVP's three states stick; attending
      count equals the people attending, always.
- [ ] Add to Google Calendar opens a prefilled event (right title, time,
      location).
- [ ] Cancel meetup (creator or manager only): reason optional, card
      struck through, members notified.
- [ ] Poll: 2–20 future slots, votes toggle live, top slot highlighted
      with Schedule button (prefilled), close poll works.
- [ ] Members panel: crown on manager; manager sees pending requests
      with Approve/Deny; Remove asks for confirmation and notifies the
      removed member; Leave explains consequences.

## Group management

- [ ] /groups/[id]/settings as NON-manager → 404 (not 403, not redirect).
- [ ] Rename re-checks uniqueness; mode switch works.
- [ ] Closed→open with 3 waiting and 2 seats: exactly the 2 OLDEST
      approved, the third cancelled + notified.
- [ ] Disband requires typing the exact group name; after: members and
      pending requesters notified, meetups cancelled, group page shows
      unavailable. The nightly purge deletes the group and all its content
      from Supabase once the retention grace period passes (see Data cleanup).
- [ ] Manager leaves → longest-tenured member becomes manager (crown
      moves, notification arrives). Last member leaving disbands.

## People, filters, buddies

- [ ] Search needs 2+ chars; matches names case-insensitively; matching
      by email finds the person but their email is NEVER displayed.
- [ ] Every filter narrows server-side; combinations AND together;
      result count updates.
- [ ] Filters appear in the URL; copy the URL into a new tab → same
      filtered view; chips remove single values; Clear all resets.
- [ ] Empty result state suggests loosening filters.
- [ ] PRIVACY: U2 hides their major → filtering by that major no longer
      returns U2 at all; unhiding brings them back.
- [ ] Buddy toggle on /people flips your availability; buddies-only
      filter shows only available students; buddy request → accept →
      both notified; disconnect works.

## Profiles & privacy

- [ ] Own profile shows everything + Edit; other profiles show
      add-friend / message / block / report.
- [ ] Each privacy switch hides its field from ANOTHER account's view
      (absent, not blank) — spot-check college, graduation, current
      classes.
- [ ] Save failure (e.g. 501-char bio) keeps everything you typed in
      the form.
- [ ] Social links: 6th link refused; `notaurl` refused; links open in
      new tabs.

## Friends, DMs, blocking

- [ ] Friend request: send → recipient notified → accept → both in each
      other's lists + sender notified. Decline: silent, sender NOT
      notified.
- [ ] Duplicate pending request refused; crossing requests (A→B while
      B→A pending) just connects them.
- [ ] DMs deliver in realtime both directions; unread badge counts per
      conversation and clears on open; history survives refresh.
- [ ] U1 blocks U2 → friendship gone, buddy link gone, pending requests
      gone; U2 can't message U1 ("can't send that request"-style error),
      can't friend-request, can't see U1's profile (404), and neither
      appears in the other's search. Unblock restores visibility but
      NOT the old friendship.

## Notifications

- [ ] Bell badge increments live (have U2 trigger something while U1
      watches); dropdown lists latest; clicking navigates AND marks
      read; badge decrements.
- [ ] /notifications lists all; Mark all as read zeroes the badge.

## Reporting & moderation

- [ ] Report requires a category; description caps at 1,000; the
      false-report warning is visible; confirmation shows after submit.
- [ ] With ADMIN_EMAIL configured, the report emails the team; without
      any email config, submitting still succeeds silently.
- [ ] Setting U2's account_status to `suspended` locks them to the
      explanation screen with working sign-out, and removes them from
      U1's search/suggestions.

## The three states, everywhere

- [ ] Loading: dashboard and course pages show skeletons on slow
      connections (throttle to verify).
- [ ] Empty: every list has designed copy + an action (dashboard
      sections, catalog search, group page, people results, messages,
      notifications, friends).
- [ ] Error: kill the network mid-navigation → the error boundary offers
      Try again, and it works.

## Accessibility spot-checks

- [ ] Tab through registration, group creation, and chat: every control
      reachable, gold focus ring always visible, dialogs trap focus and
      close on Escape.
- [ ] Icon-only buttons (bell, send, close, remove) announce sensible
      labels in a screen reader.
- [ ] New chat messages are announced (aria-live) without stealing focus.

## Bug-report batch (2026-08-18) — regression checks

- [ ] **Meetup duration**: New meetup shows a "How long?" slider, 15 min →
      8 h in 15-min steps, live label ("1 h 30 min"). Card shows
      "3:00 – 4:30 PM (1 h 30 min)"; Add to Google Calendar carries the
      real end time. 14 and 481 minutes are refused by the server.
- [ ] **Poll voting**: the poll's CREATOR can tick/untick slots; the box
      flips instantly and stays after the page settles; other members'
      votes appear without a manual refresh.
- [ ] **Avatar save**: a 3–5 MB JPEG/PNG saves (was silently dropped
      >1 MB). A 6 MB file or a PDF gets an instant inline message and the
      Save button disables. Major/bio changes save alongside the picture.
      The picker is an "Upload photo" button + preview circle (onboarding
      step 3 and Edit profile); choosing a file shows its name and swaps
      the button label to "Change photo".
- [ ] **Unblock**: avatar menu → "Friends & blocked" lists blocked people
      with an Unblock button; a blocked person's profile also offers it.
- [ ] **Live notifications**: with /notifications open in one tab, an
      event from a second account appears WITHOUT refresh; same for the
      conversation list on /messages.
- [ ] **Unread DM badge**: red count on "Messages" (desktop nav + mobile
      bar). Increments live on a new DM; clears when the thread is opened
      (no reload). Shows "99+" past 99.
- [ ] **Email notifications** (only with RESEND + webhook configured):
      friend request from another account → email within seconds. Toggle
      off under Edit profile → no email, bell still fires.
- [ ] **Meetup email detail**: scheduling a meetup emails every OTHER
      member a detailed message: who scheduled it, the meetup title, the
      time window labeled Central Time with the duration, the location
      (or the join link for online), who's RSVP'd attending so far (the
      creator at minimum), a link to the group page, and a prefilled
      Google Calendar link. Other notification types keep the one-line
      email.
- [ ] **Onboarding start**: every account opens the wizard on step 1
      ("Tell us about you"). A Google-named account has the display name
      prefilled there with the "from your Google account" hint; the field
      is still shown so the student can confirm or shorten it.

## Availability grid (When2Meet-style) — 2026-08-18

- [ ] **Create**: New poll → pick From/To dates and daily hours; the live
      line reads "N days × 9 AM–9 PM = M half-hour slots". Past times on
      today are skipped. End hour ≤ start hour shows an inline error and
      disables Open. Over 400 slots shows the cap and disables Open.
- [ ] **Grid renders**: days as columns (Thu · Aug 20 …), half-hour rows
      with hour labels; cells with no slot are greyed/disabled.
- [ ] **Room to breathe**: polls sit in their own full-width row UNDER the
      Chat/Meetups/Members columns, not inside Meetups. On a laptop a
      poll of up to 8 days shows every column with NO horizontal scroll
      (requirement: at least 5); columns stretch to fill the width, so a
      3-day poll has three wide columns. On a phone 3 days fit without
      scrolling; a 5-day poll is one short sideways swipe of the grid
      only — the page itself never scrolls sideways. Cells are 36 px
      tall.
- [ ] **Drag to paint**: press on an empty cell and drag → every cell in
      the rectangle marks instantly (maroon outline), one request on
      release. Start on a MARKED cell → the drag REMOVES instead. Works
      with a finger on mobile (page doesn't scroll under the drag).
- [ ] **Keyboard**: Tab to a cell, Space/Enter toggles it.
- [ ] **Heat map**: with two+ voters, overlap cells are darker green;
      hover a cell → "Free: You, Grid Buddy"; aria-label reads "2 people
      free, including you".
- [ ] **Winner**: banner shows the best time and "works for N people —
      everyone!" when unanimous; "Schedule this time" opens the meetup
      form prefilled to that slot.
- [ ] **Live**: a second member's painting appears without refresh.
- [ ] **Security**: sending a slot id from ANOTHER poll to
      set_availability_votes is ignored (not an error, not a vote).

## Chat filter & account deletion — 2026-08-20

- [ ] **Chat filter**: sending "this is bullshit" in group chat shows
      "this is ****" instantly for the sender AND for a second account;
      same in DMs. "fucking" masks as "****" (whole word), and spaced
      dodges ("f u c k", "f-u-c-k") are caught too. "assessment",
      "cockpit", "Dickens", "Dickson" pass through untouched. The
      database row stores the masked text; the ORIGINAL text of any
      masked message lands in message_originals (dashboard-only — not
      readable through the API by any account).
- [ ] **Names reject swears**: a display name, group name, course name,
      meetup title, or poll title containing a swear (spaced tricks
      included) shows "That name contains language that isn't allowed —
      please choose another." inline, and nothing is saved. "Dickson"
      as a display name is accepted.
- [ ] **Delete account**: Edit profile → Delete account requires typing
      DELETE. After confirming: signed out, landed on the home page.
- [ ] **After deletion (check from U2)**: U1 gone from U2's friends and
      buddies lists; pending requests between them cancelled; U1 absent
      from search and suggestions; U1's profile URL 404s; U1's old group
      and DM messages still visible, sender shown as "Deleted User" with no
      avatar; groups U1 managed got a new manager (or disbanded if U1
      was the only member).
- [ ] **After deletion (as U1)**: signing in with the same Google account
      creates a BRAND-NEW account — onboarding wizard, empty profile, no
      old groups/friends/DMs. Old messages from before the deletion still
      show "Deleted User", not the new account's name.

## Terms-of-service gate — 2026-08-20

- [ ] /login and /register both show "I agree to the Terms of Service"
      with the link opening /terms_of_service in a new tab; the Google
      button is disabled until checked.
- [ ] Checking the box enables the button; the flow reaches Google's
      account chooser as before.
- [ ] Bypass check: submitting the form without the box (e.g. re-enabling
      the button in devtools) bounces back to the same page with "Please
      accept the Terms of Service to continue." — it never reaches Google.

## Feature round 2 — 2026-08-23

- [ ] **Android course request**: on an Android phone, submitting the
      add-course request opens the default mail app (Gmail) with the
      prefilled email — NOT the Play Store. iPhone still opens the Gmail
      app when installed, falling back to Apple Mail.
- [ ] **Resources**: group page shows a Resources section; members add a
      note (5,000-char cap) or a link (http/https only, opens in a new
      tab); a profane title is refused inline; the author and the manager
      see a delete button, other members don't; deletion asks first.
- [ ] **Filter hardening**: "f4ck", "fvck", "f*ck", "fuuuck", and
      "f u c k" all mask as **** in chat; whole word masked ("fucking" →
      "****"). "Dickson"/"assessment" still pass everywhere.
- [ ] **Sex at onboarding**: step 1 requires Male / Female / Prefer not
      to say, with the permanence note. After finishing, Edit profile
      shows it read-only. People page has an "Any sex" dropdown —
      filtering by Male/Female excludes prefer-not-to-say students; the
      chip removes it. Server refuses changing a chosen Male/Female
      (SEX_LOCKED).
- [ ] **Catalog expansion**: `npm run import-courses --
      scripts/course-catalog-expansion.csv` loads ~120 registrar-verified
      courses; re-running reports skips, no duplicates; ACCT 2051 (not
      2050) and CHEM 1071/1072 exist; catalog search finds SPAN 1001.
- [ ] **Mobile**: at 375px the marketing header is two rows (logo +
      buttons, then nav); a 50-character group name wraps on the group
      page instead of scrolling the page sideways.

## Icon & notification controls — 2026-08-24

- [ ] **Icon**: hero/header icon shows two featureless silhouettes (no
      eye dots) over a shared book — no pencils or other props. Still
      recognizable at favicon size.
- [ ] **Bell stays unread until you act**: with unread notifications,
      open the bell and leave it open — the red count NEVER clears on its
      own. It clears only via the per-row mail toggle, clicking a
      notification, or "Mark all as read".
- [ ] **Mark all as read (bell)**: with unread notifications, the bottom
      of the bell dropdown shows a "Mark all as read" button; clicking it
      zeroes the badge, un-highlights every row, and the button
      disappears. The same button on /notifications still works.
- [ ] **Read/unread toggle**: every notification row (bell dropdown AND
      /notifications) has a mail icon that flips read state without
      navigating; the badge count follows, including from the
      /notifications page (bell recounts via realtime).

## Data cleanup — retention grace period (migration 0035)

Checks that "no longer useful" means "deleted in Supabase after the grace
period" (`retention_grace_days()`, 365 days). These need the Supabase
dashboard (Table Editor / Storage) open beside the app. See docs/RETENTION.md.

- [ ] **Preview**: `select * from public.preview_stale_purge();` returns a
      per-table count of what the next purge would delete. On a young
      database every count is 0.
- [ ] **Disband**: disband a group with chat, a meetup, a poll, and a
      resource. Immediately after: `study_groups` shows status `disbanded`
      with `disbanded_at` stamped; members got their notification; an
      admin can still open the group under /admin/groups and read its chat.
- [ ] **Disband, past the grace period**: backdate `disbanded_at` by
      `retention_grace_days() + 1` days and run
      `select public.purge_stale_rows();` — the `study_groups` row is GONE,
      and so are its rows in `group_messages`, `meetups`,
      `meetup_attendance`, `availability_polls`, `availability_slots`,
      `availability_votes`, `group_resources`, `join_requests`,
      `group_invitations`. Backdated by less → still there.
- [ ] **Old content**: backdate a `direct_messages` / `group_messages` /
      `group_resources` row's `created_at`, and a `meetups` row's
      `scheduled_at`, past the grace period → the purge deletes each.
      A meetup old by `created_at` but still upcoming by `scheduled_at`
      survives.
- [ ] **Close poll**: closing a poll still deletes its `availability_polls`
      row and every slot and vote immediately (unchanged).
- [ ] **Pending backstop**: a `friend_requests` row with `created_at` past
      the grace period is purged even while still `pending`.
- [ ] **Reports**: an `open` report is never purged, however old. Mark it
      `resolved` (→ `resolved_at` stamped by trigger), backdate `resolved_at`
      past the grace period → purged.
- [ ] **Avatar sweep**: change your profile picture three times — the
      Storage `avatars/<your-id>/` folder holds exactly ONE file.
- [ ] **Delete account (immediate)**: delete an account — its `profiles`
      row is now a scrubbed "Deleted User" tombstone with `deleted_at`
      stamped (NOT removed outright, even for a fresh account); its RSVPs,
      poll votes, notifications, and pending course requests are gone;
      its `friends`, `user_courses`, and `deleted_account_emails` row
      REMAIN for now; the Google login is freed (re-signup works).
- [ ] **Delete account (past grace)**: backdate that profile's `deleted_at`
      past the grace period and purge → `friends`, `study_buddy_connections`,
      `blocks`, `user_courses`, `deleted_account_emails` gone; the
      `profiles` tombstone gone too, UNLESS old chat / a report / created
      content still references it (then it goes once that ages out).

## Responsiveness — 2026-08-25

Every check here is "the UI moves on the click, not after a round trip."
Throttle the network (DevTools → Slow 3G) to make failures obvious.

- [ ] **RSVP**: Attending / Maybe / Can't make it highlights the moment you
      click, on a throttled connection, with no page refresh. The
      "N people attending" line moves with it. Clicking rapidly between
      all three settles on the last one you picked.
- [ ] **RSVP failure**: with the network offline, clicking an RSVP shows an
      error toast AND the highlight snaps back to the previous answer.
- [ ] **Notification read toggle**: the mail icon flips and the row
      un-highlights instantly on /notifications; the bell badge follows.
- [ ] **Course lists**: adding/removing a course in Edit courses updates
      the chips and the tab counts instantly; other controls stay
      clickable throughout (they used to all freeze).
- [ ] **Per-tab search**: typing in "Taking now" then switching to
      "Already taken" shows an EMPTY search box, not the carried-over
      query and results.
- [ ] **Buddy toggle** on /people flips instantly.
- [ ] **Resources**: deleting a resource removes the row immediately; a
      failed delete puts it back with an error toast.
- [ ] **Members**: Approve/Deny removes the request row immediately;
      removing a member drops them from the roster immediately.
- [ ] **Report status** (/admin): the chip changes immediately.
- [ ] **Join / invitation / friend / buddy buttons**: these change the
      whole page shape, so they are NOT instant — but the button must stay
      in its loading state until the new state appears. It must never go
      back to an idle button still reading "Join" after a successful join.
- [ ] **Closed polls**: a group with several closed polls loads as fast as
      one with none (closed polls are no longer fetched at all). Open
      polls still render, vote, and refresh live.
- [ ] **Skeletons**: navigating to a group, people, friends, messages,
      notifications, or a profile shows a skeleton, not a blank screen.

## Admin dashboard — 2026-08-25

- [ ] **Gate**: a non-admin visiting /admin (or any subpage) gets a 404;
      no Admin item in their nav. An is_admin account sees "Admin" in the
      desktop nav and mobile bar.
- [ ] **Observation**: admin opens /admin/groups → any group → sees full
      chat log, members, meetups, resources of a group they never joined;
      the group's member list does NOT include the admin, and members see
      nothing. The observation page has no composer/RSVP/add buttons.
- [ ] **Still a normal user**: the same admin can join a group the normal
      way, chat, and RSVP like anyone else.
- [ ] **Reports**: /admin lists reports with reporter/reported names
      (suspended accounts still show names + a status chip); Start
      review/Resolve/Dismiss move the status.
- [ ] **Flagged messages**: /admin/messages logs EVERY message the filter
      altered — sending a plain "this is shit" appears just like a
      "s h i t" dodge. Each row shows BOTH versions side by side: "Shown
      in chat" (the masked text, e.g. "this is ****") and "Original
      (uncensored)". The `message_originals` table has both in their own
      columns (`censored_content` / `original_content`). A non-admin
      querying message_originals through the API gets zero rows.
- [ ] **Course requests**: "Add a Course" now files an in-app request (no
      Gmail); duplicate pending request refused; a course already in the
      catalog refused with the "search instead" message. Admin sees it
      under /admin/requests, can EDIT the fields, then Approve (course
      appears in catalog, student gets an approval notification linking
      to it) or Decline (student notified). Non-admin calling the
      approve/decline RPCs gets NOT_ADMIN.

## Content flagging — migration 0040

- [ ] **Flag a message**: in a group chat, U2 hovers one of U1's
      messages → a faint flag icon + "Flag" appears next to the
      timestamp → clicking opens a dialog (optional note) → "Flag for
      review" → toast, and the control switches to "Flagged — undo". U2's
      own messages have no flag control. Same on a DM thread (incoming
      messages only).
- [ ] **Flag a resource**: in a group's Resources, U2 sees a flag icon on
      resources they did NOT post; flagging works the same way.
- [ ] **Invisible to others**: reload as U1 (the author) and as U3
      (another member) — no flag control state, no badge, chat/resources
      look identical. Nothing in notifications. No realtime blip.
- [ ] **Unflag**: U2 clicks "Flagged — undo" / the filled flag icon →
      confirm → it reverts; flagging again re-adds it (one row, never
      two).
- [ ] **Admin queue**: U3 (admin) → /admin shows "Open content flags: N"
      → /admin/flags lists each flag with the content snapshot, the
      "group chat / direct message / resource" badge, author + flagger
      names, the note, "also flagged by N others" when more than one
      person flagged the same item, and a "View in group" link for group
      content. Start review / Resolve / Dismiss move the status.
- [ ] **Admin context**: /admin/groups → the group → flagged messages and
      resources carry a red "🚩 flagged" badge (open/reviewing only).
- [ ] **Boundaries**: a non-member RPC-calling `flag_content` on a
      group's message gets CONTENT_NOT_FOUND; flagging your own content
      gets SELF_ACTION; a non-admin visiting /admin/flags gets a 404; a
      non-admin querying `content_flags` through the API sees only their
      own rows.
- [ ] **Retention**: `select * from public.preview_stale_purge();` lists
      a `content_flags` row; a flag resolved over
      `retention_grace_days_moderation()` days ago is deleted by
      `purge_stale_rows()`, an open one is kept.

## Forest & Clay palette — 2026-09-03

- [ ] No maroon or gold anywhere: marketing pages, dashboard, group page,
      admin, onboarding, auth screens. Hero and footer are forest green,
      buttons and badges are clay.
- [ ] **Contrast**: the hero's "It's FREE to use" highlight, the dark logo
      lockup, and every footer link use accent-LIGHT on the dark green and
      are comfortably readable. Plain accent (clay) must never appear as
      text on green — it measures 2.78:1.
- [ ] Focus rings still visible on both light and dark surfaces (tab
      through the marketing header, then the footer links).

## Admin People, mute & pause — 2026-09-03

- [ ] **People list**: /admin/people shows every account including paused,
      suspended and deleted ones; search by name or email narrows it and
      the ?q= is linkable. Names link to the profile; each group chip
      links to that group's admin observation view.
- [ ] **Mute**: after muting a test account, that account CAN still browse,
      join a group, RSVP and vote in a poll — and CANNOT send a group
      message or DM, or create a meetup, poll, group or resource. Each
      refusal shows the friendly "an admin has muted your account" message,
      not a raw error. Unmute restores everything.
- [ ] **Pause**: a paused account is locked to the "Your account is paused"
      screen naming studybuddiesmn@gmail.com, with a working sign-out.
      Nothing is deleted — unpausing restores the account exactly, groups
      and messages intact.
- [ ] **Guards**: an admin cannot mute or pause themselves (the buttons are
      absent); a non-admin calling set_user_muted / set_user_paused
      directly gets NOT_ADMIN; a deleted account cannot be paused.
