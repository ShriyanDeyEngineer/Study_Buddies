-- ============================================================================
-- 0045 — let the service-role client actually READ the tables it reads.
--
-- THE BUG THIS FIXES
--   On a freshly reset database, /courses and /dashboard show no courses
--   and no group counts at all. The rows are there; nothing can read
--   them.
--
--   Three facts collide:
--     1. lib/data/course-catalog.ts caches the catalog with
--        unstable_cache, and a cached function may not read cookies, so
--        it must use the SERVICE-ROLE client rather than the ordinary
--        per-request one. Same for the two webhook routes under
--        app/api/hooks, which have no user session at all.
--     2. Modern Supabase grants the service_role role NOTHING by default
--        — only REFERENCES/TRIGGER/TRUNCATE, not SELECT.
--     3. No migration ever granted it any. Every earlier migration grants
--        to `authenticated` only (0002, 0004, …), which is why the app
--        works when a signed-in student reads a table directly and fails
--        the moment the same read goes through the cached path.
--
--   Bypassing RLS is not the same as having a grant: service_role skips
--   the POLICY check but still needs the table privilege, so the read
--   fails with "permission denied for table courses" before RLS is ever
--   consulted. That error is swallowed — getCourseCatalog() returns an
--   empty array, the page renders "no courses", and nothing looks broken
--   except the missing content.
--
--   Hosted projects created before this default changed already carry
--   these grants, which is why production has been fine and only local
--   development (and any newly created project) shows the empty catalog.
--   Stating them here makes the two agree, and makes `supabase db reset`
--   produce a working app.
--
-- SCOPE: SELECT only, and only on the tables the server-side clients
--   actually read. Nothing here widens what a STUDENT can see — every
--   one of these tables is already selectable by `authenticated`, most of
--   them under `using (true)` (0002's "any signed-in student can browse
--   the whole catalog", 0004's "groups are previewable"). The writes
--   still go exclusively through the SECURITY DEFINER functions.
-- ============================================================================

-- Read by lib/data/course-catalog.ts (the cached catalog + group counts).
grant select on public.courses      to service_role;
grant select on public.study_groups to service_role;

-- Read by app/api/hooks/notification-email (recipient address + the
-- detailed meetup email). profiles.email is RLS-hidden from other
-- students, which is exactly why that route runs as service_role.
grant select on public.profiles           to service_role;
grant select on public.meetups            to service_role;
grant select on public.meetup_attendance  to service_role;

-- Read by app/api/hooks/chat-digest through pending_chat_digests(). The
-- function is SECURITY DEFINER so it doesn't strictly need these, but a
-- definer function that reads tables the caller can't touch is a
-- footgun the moment anyone adds a direct query to that route.
grant select on public.study_group_members to service_role;
grant select on public.group_messages      to service_role;
