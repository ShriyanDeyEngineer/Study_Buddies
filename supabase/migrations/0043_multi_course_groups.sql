-- ============================================================================
-- 0043 — a study group can be tagged with MORE THAN ONE course.
--
-- WHY
--   UMN teaches the same material under different numbers: CSE calculus
--   (MATH 1371/1372) and CLA calculus (MATH 1271/1272) cover the same
--   ground for different colleges. Under the old one-course-per-group
--   schema, a "Calc 2" group had to pick a side, and students in the
--   equivalent course could neither find it nor be invited to it.
--
-- WHAT CHANGES
--   study_group_courses becomes the truth about which courses a group is
--   for. study_groups.course_id STAYS as the group's PRIMARY course (the
--   first one tagged at creation) — see the column comment below for why
--   it isn't being dropped.
--
-- NAME UNIQUENESS — the decision this migration had to make:
--   Old rule: names are unique per course, case-insensitively, via
--   study_groups_unique_name_per_course (course_id, lower(name)).
--   New rule: A NAME COLLIDES ONLY WITH GROUPS THAT SHARE AT LEAST ONE
--   TAGGED COURSE. That is the same rule as before, generalized — inside
--   any single course you still never see two "Homework Grinders", but
--   CSCI 1133 and MATH 1271 can each have one, exactly as today.
--
--   Rejected alternatives: global uniqueness (one index on lower(name))
--   would be simpler but would let one group reserve "Exam 2 Cram"
--   university-wide — generic names collide constantly across 4000
--   courses. Uniqueness on the primary course alone would make the rule
--   arbitrary: the same name would be blocked or allowed depending on
--   which course happened to be listed first in the form.
--
--   Enforcing it needs a UNIQUE INDEX, not an IF EXISTS check inside the
--   function: two students submitting the same name in the same course at
--   the same millisecond must not both pass, and a check-then-insert
--   cannot promise that (same reasoning as the capacity locks in 0004).
--   An index can't reach into another table, so study_group_courses
--   carries a denormalized name_lower kept in sync by triggers, and the
--   unique index sits on (course_id, name_lower). Renames therefore fail
--   with unique_violation just like inserts, which is exactly what
--   update_group_settings already catches and turns into NAME_TAKEN.
--
--   Unchanged from 0004: disbanded groups keep reserving their name (the
--   old index had no status filter either). Their rows stay as tombstones.
--
-- BACKFILL
--   Every existing group has exactly one course and keeps working: one
--   join row per group, copied from course_id, before the constraints go
--   on. Nothing about existing groups' behavior changes.
-- ============================================================================

-- ── 1. the join table ───────────────────────────────────────────────────────

create table if not exists public.study_group_courses (
  group_id   uuid not null references public.study_groups (id) on delete cascade,
  course_id  uuid not null references public.courses (id),
  -- Denormalized lower(study_groups.name), maintained by the two triggers
  -- below. It exists ONLY so the per-course name uniqueness rule can be a
  -- real unique index; never read it as the group's name, read the group.
  name_lower text not null,
  primary key (group_id, course_id)
);

comment on table public.study_group_courses is
  'Which courses a study group is for — one row per (group, course). The '
  'truth about a group''s courses; study_groups.course_id is only the '
  'primary one. A group tagged with equivalent courses (MATH 1271 and '
  'MATH 1371) is findable and joinable from either.';

comment on column public.study_group_courses.name_lower is
  'Denormalized lower(study_groups.name), kept in sync by triggers. Sole '
  'purpose: make "names are unique within a course" enforceable as a '
  'unique index across the join. Not a display field.';

-- Backfill BEFORE the unique index goes on: every existing group has one
-- course, so this can never collide (the old per-course unique index
-- already guaranteed it).
insert into public.study_group_courses (group_id, course_id, name_lower)
select g.id, g.course_id, lower(g.name)
from public.study_groups g
on conflict do nothing;

-- The new home of "unique name per course" (see the header).
create unique index if not exists study_group_courses_unique_name_per_course
  on public.study_group_courses (course_id, name_lower);

-- "Which groups are in this course?" — the lookup every course page, the
-- catalog counts, and the new groups list all make. Replaces the partial
-- index on study_groups (course_id), which no reader uses any more.
create index if not exists study_group_courses_course_idx
  on public.study_group_courses (course_id);

drop index if exists public.study_groups_course_active_idx;

-- The old per-course name index on study_groups would now be WRONG: it
-- constrains only the primary course, so "same name, different primary,
-- overlapping secondary" would slip past it while the join-table index
-- correctly rejects it — and it would reject legitimate names that share
-- only a primary course. study_group_courses_unique_name_per_course is
-- strictly more correct in both directions.
drop index if exists public.study_groups_unique_name_per_course;

comment on column public.study_groups.course_id is
  'The group''s PRIMARY course — the first one tagged at creation. '
  'Denormalized: study_group_courses is the full list. Kept (not dropped) '
  'because notification payloads carry a single course_id that '
  'lib/notifications.ts turns into a /courses/<id> link, and because it '
  'gives every group a stable canonical course to fall back on.';

alter table public.study_group_courses enable row level security;

-- Same visibility as study_groups itself (0004: "Groups are previewable by
-- any signed-in student"). Course tags are exactly as public as the group.
drop policy if exists "authenticated users read group courses" on public.study_group_courses;
create policy "authenticated users read group courses"
  on public.study_group_courses for select
  to authenticated
  using (true);

-- No write policies: like the four tables in 0004, every write goes
-- through the SECURITY DEFINER functions below.
grant select on public.study_group_courses to authenticated;

-- ── 2. name_lower sync triggers ─────────────────────────────────────────────

-- Fills name_lower from the group on insert, so callers can't set it
-- wrong and no function has to remember to pass it.
create or replace function public.study_group_courses_set_name_lower()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select lower(g.name) into new.name_lower
  from public.study_groups g where g.id = new.group_id;
  if new.name_lower is null then
    raise exception 'GROUP_NOT_FOUND';
  end if;
  return new;
end;
$$;

drop trigger if exists study_group_courses_name_lower on public.study_group_courses;
create trigger study_group_courses_name_lower
  before insert on public.study_group_courses
  for each row execute function public.study_group_courses_set_name_lower();

-- A rename has to re-check uniqueness in every course the group is in.
-- This UPDATE is what raises unique_violation on a colliding rename —
-- update_group_settings already wraps its UPDATE in the handler that
-- turns that into NAME_TAKEN, and the trigger fires inside that UPDATE.
create or replace function public.study_groups_sync_name_lower()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.study_group_courses
    set name_lower = lower(new.name)
    where group_id = new.id;
  return new;
end;
$$;

drop trigger if exists study_groups_sync_name_lower on public.study_groups;
create trigger study_groups_sync_name_lower
  after update of name on public.study_groups
  for each row when (old.name is distinct from new.name)
  execute function public.study_groups_sync_name_lower();

-- ── 3. create_study_group takes a LIST of courses ───────────────────────────

-- Postgres identifies a function by its full argument list, so changing
-- p_course_id uuid → p_course_ids uuid[] creates a second overload rather
-- than replacing the old one. Dropped first, grants restated (0011/0019/
-- 0027 precedent).
drop function if exists public.create_study_group(uuid, text, text, int, text, uuid[]);

-- Creates a group tagged with one or more courses, makes the caller its
-- manager AND first member, and sends the optional immediate invitations.
--
-- Course rules: at least one, at most GROUP_COURSES_MAX (10 — a group
-- spanning more than ten courses isn't a study group, it's spam), each
-- must exist and be active. The first surviving id becomes the primary.
--
-- Invitee rules (re-validated here even though the UI enforces them,
-- because the UI can be bypassed): each invitee must be currently
-- enrolled in AT LEAST ONE of the tagged courses — the multi-course
-- generalization of 0004's "enrolled in the course". That is the whole
-- point of the feature: a student in MATH 1371 can invite their friend
-- in the equivalent MATH 1271. Blocks still apply either direction, and
-- at most capacity − 1 people may be invited (the creator takes a seat).
create or replace function public.create_study_group(
  p_course_ids  uuid[],
  p_name        text,
  p_description text,
  p_capacity    int,
  p_mode        text,
  p_invitee_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := public.assert_active_caller();
  v_name     text := trim(coalesce(p_name, ''));
  v_desc     text := nullif(trim(coalesce(p_description, '')), '');
  v_group_id uuid;
  v_invitee  uuid;
  v_course   uuid;
  -- De-duplicated, order preserved: the FIRST course the student picked
  -- stays first and becomes the primary.
  v_courses  uuid[] := (
    select coalesce(array_agg(x order by ord), '{}')
    from (
      select x, min(ord) as ord
      from unnest(coalesce(p_course_ids, '{}')) with ordinality as t(x, ord)
      where x is not null
      group by x
    ) deduped
  );
  v_invitees uuid[] := (
    -- de-duplicate and drop the creator if someone sneaks them in
    select coalesce(array_agg(distinct x), '{}')
    from unnest(coalesce(p_invitee_ids, '{}')) as x
    where x <> auth.uid()
  );
begin
  if char_length(v_name) not between 1 and 100 then
    raise exception 'INVALID_NAME';
  end if;
  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'INVALID_DESCRIPTION';
  end if;
  if p_capacity is null or p_capacity < 2 or p_capacity > 50 then
    raise exception 'INVALID_CAPACITY';
  end if;
  if p_mode not in ('open','closed') then
    raise exception 'INVALID_MODE';
  end if;
  if coalesce(array_length(v_courses, 1), 0) = 0 then
    raise exception 'NO_COURSES';
  end if;
  if array_length(v_courses, 1) > 10 then
    raise exception 'TOO_MANY_COURSES';
  end if;
  -- Every tagged course must exist and be active. Checked as a set so one
  -- bad id in a list of five is caught, not silently dropped.
  if (
    select count(*) from public.courses c
    where c.id = any (v_courses) and c.is_active
  ) <> array_length(v_courses, 1) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if array_length(v_invitees, 1) > p_capacity - 1 then
    raise exception 'TOO_MANY_INVITES';
  end if;

  foreach v_invitee in array v_invitees loop
    if not exists (
      select 1
      from public.user_courses uc
      join public.profiles p on p.id = uc.user_id
      where uc.user_id = v_invitee
        and uc.course_id = any (v_courses)
        and uc.enrollment_type = 'current'
        and p.account_status = 'active'
        and p.display_name is not null
    ) then
      raise exception 'INVALID_INVITEE';
    end if;
    if public.are_blocked(v_uid, v_invitee) then
      raise exception 'INVALID_INVITEE';
    end if;
  end loop;

  -- One BEGIN block around BOTH inserts: the name collision can now come
  -- from either the group row or (far more often) the join rows, and both
  -- have to read as NAME_TAKEN.
  begin
    insert into public.study_groups
      (course_id, name, description, manager_id, mode, capacity, member_count)
    values (v_courses[1], v_name, v_desc, v_uid, p_mode, p_capacity, 1)
    returning id into v_group_id;

    -- name_lower is filled by the before-insert trigger, which reads it
    -- from the group row just inserted above — one source, no drift.
    foreach v_course in array v_courses loop
      insert into public.study_group_courses (group_id, course_id)
      values (v_group_id, v_course);
    end loop;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;

  insert into public.study_group_members (group_id, user_id) values (v_group_id, v_uid);

  foreach v_invitee in array v_invitees loop
    insert into public.group_invitations (group_id, invited_user_id, inviter_id)
    values (v_group_id, v_invitee, v_uid);
    perform public.app_notify(v_invitee, 'group_invitation',
      jsonb_build_object('group_id', v_group_id, 'group_name', v_name, 'inviter_id', v_uid));
  end loop;

  return v_group_id;
end;
$$;

revoke execute on function public.create_study_group(uuid[], text, text, int, text, uuid[]) from public, anon;
grant execute on function public.create_study_group(uuid[], text, text, int, text, uuid[]) to authenticated;

-- ── 4. classmates across a SET of courses ───────────────────────────────────

-- The invite picker's source. Was get_course_classmates(uuid) (0008);
-- with multi-course groups the picker needs the UNION across everything
-- the student has tagged so far, de-duplicated (someone enrolled in two
-- of the tagged courses appears once). Every privacy and block rule from
-- 0008 is carried over unchanged: students who hid their current-courses
-- list are excluded, because being listed as "a classmate in MATH 1271"
-- is exactly the fact they hid.
drop function if exists public.get_course_classmates(uuid);

create or replace function public.get_courses_classmates(p_course_ids uuid[])
returns table (id uuid, display_name text, avatar_url text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select distinct p.id, p.display_name, p.avatar_url
  from public.user_courses uc
  join public.profiles p on p.id = uc.user_id
  where uc.course_id = any (coalesce(p_course_ids, '{}'))
    and uc.enrollment_type = 'current'
    and p.id <> auth.uid()
    and p.display_name is not null
    and p.account_status = 'active'
    and coalesce((p.privacy->>'courses_current')::boolean, false) = false
    and not public.are_blocked(auth.uid(), p.id)
  order by p.display_name
  limit 200;
$$;

revoke execute on function public.get_courses_classmates(uuid[]) from public, anon;
grant execute on function public.get_courses_classmates(uuid[]) to authenticated;
