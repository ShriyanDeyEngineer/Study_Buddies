-- ============================================================================
-- 0041 — moderation: MUTE and PAUSE, driven from the admin People page.
--
-- Two independent controls, deliberately not one status column:
--
--   MUTE (profiles.is_muted) — the account still works. The person can
--   browse, join groups, RSVP, vote in polls, add friends, and read
--   everything. They just cannot CREATE anything other people see:
--   group messages, DMs, meetups, availability polls, study groups, and
--   group resources. Enforced inside the writing functions, which is the
--   only path clients have to those tables.
--
--   PAUSE (account_status = 'paused') — the account is locked out
--   entirely but NOT deleted: no scrub, no data loss, fully reversible.
--   assert_active_caller() already rejects any status other than
--   'active', so every write path refuses a paused caller for free; the
--   app shell shows the explanation screen.
--
-- Why mute is not a status: the status column means "can this account be
-- used at all", and a muted account very much can. Overloading it would
-- have made every existing `account_status = 'active'` check silently
-- exclude muted users from search, DMs and group previews — which is the
-- opposite of the intent.
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'paused', 'suspended', 'banned', 'deleted'));

alter table public.profiles
  add column if not exists is_muted boolean not null default false;

comment on column public.profiles.is_muted is
  'Admin mute: account works normally except it cannot create content '
  '(messages, DMs, meetups, polls, groups, resources). See 0041.';

create index if not exists profiles_muted_idx on public.profiles (id) where is_muted;

-- Muted is a moderation decision, so it is NOT in the user-updatable
-- column grant (0001/0011) — set_user_muted() is the only write path.

-- ── The mute gate ───────────────────────────────────────────────────────────
create or replace function public.assert_not_muted(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.profiles where id = p_uid and is_muted) then
    raise exception 'MUTED';
  end if;
end;
$$;

revoke execute on function public.assert_not_muted(uuid) from public, anon, authenticated;

-- ── Admin controls ──────────────────────────────────────────────────────────
create or replace function public.set_user_muted(p_user uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  if p_user = v_uid then
    raise exception 'SELF_ACTION';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'USER_NOT_FOUND';
  end if;
  update public.profiles set is_muted = coalesce(p_muted, false) where id = p_user;
end;
$$;

revoke execute on function public.set_user_muted(uuid, boolean) from public, anon;
grant execute on function public.set_user_muted(uuid, boolean) to authenticated;

-- Pausing never touches anything but the status, so unpausing restores
-- the account exactly as it was. A deleted account cannot be paused.
create or replace function public.set_user_paused(p_user uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  if p_user = v_uid then
    raise exception 'SELF_ACTION';
  end if;
  select account_status into v_status from public.profiles where id = p_user;
  if v_status is null then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_status = 'deleted' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_paused then
    update public.profiles set account_status = 'paused' where id = p_user;
  else
    -- Only lift a pause; never quietly un-suspend or un-ban.
    if v_status = 'paused' then
      update public.profiles set account_status = 'active' where id = p_user;
    end if;
  end if;
end;
$$;

revoke execute on function public.set_user_paused(uuid, boolean) from public, anon;
grant execute on function public.set_user_paused(uuid, boolean) to authenticated;


-- ============================================================================
-- The six creation paths, restated verbatim from their latest migrations
-- with ONE line added after each BEGIN:
--
--     perform public.assert_not_muted(v_uid);
--
-- It sits first so a muted caller is refused before any work happens, and
-- it raises MUTED, which lib/errors.ts maps to friendly copy. Everything
-- else in these bodies is byte-identical to what it replaces.
--
-- NOT gated (deliberately): joining groups, RSVPs, poll VOTES, friend and
-- buddy requests, profile edits, reports, course requests. Mute stops you
-- creating things other students see; it does not stop you participating.
-- ============================================================================

-- ── send_group_message: unchanged except the mute gate ──
create or replace function public.send_group_message(p_group_id uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid      uuid := public.assert_active_caller();
  v_content  text := coalesce(p_content, '');
  v_original text;
  v_msg_id   uuid;
  v_msg_at   timestamptz;
begin
  perform public.assert_not_muted(v_uid);
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;
  if not exists (
    select 1 from public.study_groups g
    where g.id = p_group_id and g.status = 'active'
  ) then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if (
    -- Table-qualified NAMES REQUIRED here: this function RETURNS TABLE
    -- (id, created_at), so bare created_at is a PL/pgSQL variable and
    -- the unqualified reference is ambiguous — same trap 0006 documents
    -- for study_groups.id. Unqualified, EVERY send raised and chat was
    -- completely down.
    select count(*) from public.group_messages gm
    where gm.sender_id = v_uid and gm.created_at > now() - interval '10 seconds'
  ) >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  v_original := v_content;
  v_content := public.censor_profanity(v_content);

  update public.study_groups
    set last_activity_at = now()
    where study_groups.id = p_group_id;

  insert into public.group_messages (group_id, sender_id, content)
  values (p_group_id, v_uid, v_content)
  returning group_messages.id, group_messages.created_at into v_msg_id, v_msg_at;

  if v_content <> v_original then
    insert into public.message_originals
      (message_kind, message_id, sender_id, original_content, censored_content)
    values ('group', v_msg_id, v_uid, v_original, v_content);
  end if;

  return query select v_msg_id, v_msg_at;
end;
$fn$;

-- ── send_direct_message: unchanged except the mute gate ──
create or replace function public.send_direct_message(p_recipient uuid, p_content text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid      uuid := public.assert_active_caller();
  v_content  text := coalesce(p_content, '');
  v_original text;
  v_msg_id   uuid;
  v_msg_at   timestamptz;
begin
  perform public.assert_not_muted(v_uid);
  if p_recipient = v_uid then
    raise exception 'SELF_ACTION';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient and p.account_status = 'active' and p.display_name is not null
  ) then
    raise exception 'USER_NOT_FOUND';
  end if;
  if public.are_blocked(v_uid, p_recipient) then
    raise exception 'BLOCKED';
  end if;
  if (
    -- Table-qualified for the same RETURNS TABLE reason as above.
    select count(*) from public.direct_messages dm
    where dm.sender_id = v_uid and dm.created_at > now() - interval '10 seconds'
  ) >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  if char_length(trim(v_content)) < 1 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  v_original := v_content;
  v_content := public.censor_profanity(v_content);

  insert into public.direct_messages (sender_id, recipient_id, content)
  values (v_uid, p_recipient, v_content)
  returning direct_messages.id, direct_messages.created_at into v_msg_id, v_msg_at;

  if v_content <> v_original then
    insert into public.message_originals
      (message_kind, message_id, sender_id, original_content, censored_content)
    values ('direct', v_msg_id, v_uid, v_original, v_content);
  end if;

  return query select v_msg_id, v_msg_at;
end;
$fn$;

-- ── create_meetup: unchanged except the mute gate ──
create or replace function public.create_meetup(
  p_group_id         uuid,
  p_title            text,
  p_scheduled_at     timestamptz,
  p_format           text,
  p_location         text default null,
  p_meeting_link     text default null,
  p_duration_minutes int  default 60
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public.assert_active_caller();
  v_group  public.study_groups%rowtype;
  v_title  text := trim(coalesce(p_title, ''));
  v_id     uuid;
  r record;
begin
  perform public.assert_not_muted(v_uid);
  select * into v_group from public.study_groups where id = p_group_id for update;
  if not found or v_group.status <> 'active' then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;

  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'MEETUP_IN_PAST';
  end if;
  if p_format not in ('online','in_person') then
    raise exception 'INVALID_FORMAT';
  end if;
  if p_format = 'online' then
    if nullif(trim(coalesce(p_meeting_link, '')), '') is null then
      raise exception 'MISSING_LINK';
    end if;
    -- Web schemes only: the link is rendered as a clickable anchor, so a
    -- `javascript:` (or `data:` …) URI here would be stored XSS.
    if trim(p_meeting_link) !~* '^https?://' then
      raise exception 'INVALID_LINK';
    end if;
  end if;
  if p_format = 'in_person' and nullif(trim(coalesce(p_location, '')), '') is null then
    raise exception 'MISSING_LOCATION';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 15 or p_duration_minutes > 480 then
    raise exception 'INVALID_DURATION';
  end if;

  insert into public.meetups
    (group_id, creator_id, title, scheduled_at, format, location, meeting_link, duration_minutes)
  values (
    p_group_id, v_uid, v_title, p_scheduled_at, p_format,
    case when p_format = 'in_person' then trim(p_location) end,
    case when p_format = 'online' then trim(p_meeting_link) end,
    p_duration_minutes
  )
  returning id into v_id;

  insert into public.meetup_attendance (meetup_id, user_id, status)
  values (v_id, v_uid, 'attending');

  update public.study_groups set last_activity_at = now() where id = p_group_id;

  for r in
    select m.user_id from public.study_group_members m
    where m.group_id = p_group_id and m.user_id <> v_uid
  loop
    perform public.app_notify(r.user_id, 'meetup_created',
      jsonb_build_object('group_id', p_group_id, 'group_name', v_group.name,
                         'meetup_id', v_id, 'title', v_title));
  end loop;

  return v_id;
end;
$$;

-- ── create_availability_poll: unchanged except the mute gate ──
create or replace function public.create_availability_poll(
  p_group_id uuid,
  p_title    text,
  p_slots    jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := public.assert_active_caller();
  v_title  text := trim(coalesce(p_title, ''));
  v_poll   uuid;
  v_slot   jsonb;
  v_starts timestamptz;
  v_ends   timestamptz;
begin
  perform public.assert_not_muted(v_uid);
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;
  if not exists (
    select 1 from public.study_groups g
    where g.id = p_group_id and g.status = 'active'
  ) then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE';
  end if;
  -- 2..400 (was 2..20). Mirrors POLL_SLOTS_MAX in lib/constants.ts.
  if p_slots is null or jsonb_typeof(p_slots) <> 'array'
     or jsonb_array_length(p_slots) < 2 or jsonb_array_length(p_slots) > 400 then
    raise exception 'INVALID_SLOTS';
  end if;

  insert into public.availability_polls (group_id, creator_id, title)
  values (p_group_id, v_uid, v_title)
  returning id into v_poll;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    begin
      v_starts := (v_slot->>'starts_at')::timestamptz;
      v_ends   := (v_slot->>'ends_at')::timestamptz;
    exception when others then
      raise exception 'INVALID_SLOTS';
    end;
    if v_starts is null or v_ends is null or v_ends <= v_starts or v_starts <= now() then
      raise exception 'INVALID_SLOTS';
    end if;
    insert into public.availability_slots (poll_id, starts_at, ends_at)
    values (v_poll, v_starts, v_ends);
  end loop;

  return v_poll;
end;
$$;

-- ── create_study_group: unchanged except the mute gate ──
create or replace function public.create_study_group(
  p_course_id   uuid,
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
  v_invitees uuid[] := (
    -- de-duplicate and drop the creator if someone sneaks them in
    select coalesce(array_agg(distinct x), '{}')
    from unnest(coalesce(p_invitee_ids, '{}')) as x
    where x <> auth.uid()
  );
begin
  perform public.assert_not_muted(v_uid);
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
  if not exists (select 1 from public.courses c where c.id = p_course_id and c.is_active) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if array_length(v_invitees, 1) > p_capacity - 1 then
    raise exception 'TOO_MANY_INVITES';
  end if;

  -- Every invitee must be a current classmate (spec §5.6). Checked in the
  -- database so a hand-crafted request can't invite arbitrary users.
  foreach v_invitee in array v_invitees loop
    if not exists (
      select 1
      from public.user_courses uc
      join public.profiles p on p.id = uc.user_id
      where uc.user_id = v_invitee
        and uc.course_id = p_course_id
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

  begin
    insert into public.study_groups
      (course_id, name, description, manager_id, mode, capacity, member_count)
    values (p_course_id, v_name, v_desc, v_uid, p_mode, p_capacity, 1)
    returning id into v_group_id;
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

-- ── add_group_resource: unchanged except the mute gate ──
create or replace function public.add_group_resource(
  p_group_id uuid,
  p_kind     text,
  p_title    text,
  p_content  text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := public.assert_active_caller();
  v_title   text := trim(coalesce(p_title, ''));
  v_content text := trim(coalesce(p_content, ''));
  v_id      uuid;
begin
  perform public.assert_not_muted(v_uid);
  if not exists (
    select 1 from public.study_group_members m
    where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_MEMBER';
  end if;
  if not exists (
    select 1 from public.study_groups g
    where g.id = p_group_id and g.status = 'active'
  ) then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if p_kind not in ('note', 'link') then
    raise exception 'INVALID_KIND';
  end if;
  if char_length(v_title) not between 1 and 100 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_kind = 'link' then
    if char_length(v_content) not between 1 and 500
       or v_content !~* '^https?://' then
      raise exception 'INVALID_LINK';
    end if;
  else
    if char_length(v_content) not between 1 and 5000 then
      raise exception 'INVALID_NOTE';
    end if;
    -- Notes are shared prose — same masking rule as chat.
    v_content := public.censor_profanity(v_content);
  end if;
  v_title := public.censor_profanity(v_title);

  insert into public.group_resources (group_id, author_id, kind, title, content)
  values (p_group_id, v_uid, p_kind, v_title, v_content)
  returning id into v_id;

  update public.study_groups set last_activity_at = now() where id = p_group_id;
  return v_id;
end;
$$;
