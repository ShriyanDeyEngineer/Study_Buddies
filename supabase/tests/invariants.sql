-- ============================================================================
-- Database invariant tests (spec §7 / §11).
--
-- WHAT THIS IS
--   A self-contained script that creates throwaway users, exercises the
--   SECURITY DEFINER functions, ASSERTS every §7 invariant, and ROLLS
--   BACK — the database is left exactly as it was found.
--
-- HOW TO RUN
--   Local stack:   supabase db start   (once), then:
--                  psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
--                       -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
--   Hosted (fine — it rolls back): psql "<connection string>" \
--                       -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql
--
--   Success looks like a series of "NOTICE: PASS: …" lines and a final
--   ROLLBACK. ANY failed assertion raises an exception and aborts the
--   script — with ON_ERROR_STOP that means a non-zero exit code.
--
-- HOW IT IMPERSONATES USERS
--   auth.uid() reads the JWT claims from a session setting. Setting
--   request.jwt.claims to '{"sub": "<uuid>"}' makes every function
--   believe that user is calling — the same mechanism PostgREST uses.
-- ============================================================================

begin;

-- Freeze a helper to switch the "current user".
create or replace function pg_temp.impersonate(p_user uuid)
returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true); $$;

-- ── Fixtures ────────────────────────────────────────────────────────────────

insert into public.universities (name, email_domain)
values ('University of Minnesota', 'umn.edu')
on conflict (email_domain) do nothing;

-- Five test students. Inserting into auth.users fires our triggers:
-- the domain gate (these pass) and profile auto-creation.
do $$
declare
  ids uuid[] := array[
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000004',
    '00000000-0000-4000-a000-000000000005'
  ];
  i int;
begin
  for i in 1..5 loop
    insert into auth.users (id, email)
    values (ids[i], 'invariant-test-' || i || '@umn.edu');
    -- "Finish onboarding" so assert_active_caller lets them act.
    update public.profiles set display_name = 'Test Student ' || i where id = ids[i];
  end loop;
end $$;

-- Short names for readability below.
-- (psql doesn't have variables inside DO blocks, so each block redeclares.)

-- ── INVARIANT: the email-domain gate (both signup methods) ──────────────────
do $$
begin
  begin
    insert into auth.users (id, email)
    values ('00000000-0000-4000-a000-00000000dead', 'intruder@gmail.com');
    raise exception 'FAIL: non-umn.edu signup was allowed';
  exception when others then
    if sqlerrm like '%EMAIL_DOMAIN_NOT_ALLOWED%' then
      raise notice 'PASS: domain gate rejects non-allow-listed signups';
    else
      raise;
    end if;
  end;
end $$;

-- A course for the groups below.
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
begin
  perform pg_temp.impersonate(u1);
  perform public.create_course('TEST', '1001', 'Invariant Testing I');
end $$;

-- ── INVARIANT 1: capacity can never be exceeded ─────────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_course uuid;
  v_group uuid;
  v_count int;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Capacity Test', null, 2, 'open');

  perform pg_temp.impersonate(u2);
  if public.join_group(v_group) <> 'joined' then
    raise exception 'FAIL: open-group join did not return joined';
  end if;

  -- Group is now 2/2. A third join must refuse with GROUP_FULL.
  perform pg_temp.impersonate(u3);
  begin
    perform public.join_group(v_group);
    raise exception 'FAIL: join succeeded on a full group';
  exception when others then
    if sqlerrm not like '%GROUP_FULL%' then raise; end if;
  end;

  select member_count into v_count from public.study_groups where id = v_group;
  if v_count <> 2 then
    raise exception 'FAIL: member_count % after fill (expected 2)', v_count;
  end if;
  if v_count <> (select count(*) from public.study_group_members where group_id = v_group) then
    raise exception 'FAIL: member_count drifted from actual membership rows';
  end if;

  raise notice 'PASS: capacity is enforced and the cached count matches reality';
end $$;

-- ── INVARIANTS 2 & 3: approval re-check + duplicate requests ────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_course uuid;
  v_group uuid;
  v_req_u2 uuid;
  v_req_u3 uuid;
  v_status text;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Approval Test', null, 2, 'closed');

  perform pg_temp.impersonate(u2);
  if public.join_group(v_group) <> 'requested' then
    raise exception 'FAIL: closed-group join did not create a request';
  end if;

  -- Duplicate pending request must be refused (invariant 3).
  begin
    perform public.join_group(v_group);
    raise exception 'FAIL: duplicate join request was allowed';
  exception when others then
    if sqlerrm not like '%DUPLICATE_REQUEST%' then raise; end if;
  end;

  perform pg_temp.impersonate(u3);
  perform public.join_group(v_group);

  select id into v_req_u2 from public.join_requests
    where group_id = v_group and user_id = u2 and status = 'pending';
  select id into v_req_u3 from public.join_requests
    where group_id = v_group and user_id = u3 and status = 'pending';

  -- Approving U2 fills the group (creator + U2 = 2/2). The sweep must
  -- cancel U3's still-pending request and notify them (invariant 2's
  -- "the group filled while you waited" path).
  perform pg_temp.impersonate(u1);
  if public.approve_join_request(v_req_u2) <> 'approved' then
    raise exception 'FAIL: first approval did not return approved';
  end if;

  select status into v_status from public.join_requests where id = v_req_u3;
  if v_status <> 'cancelled' then
    raise exception 'FAIL: pending request on a full group is % (expected cancelled)', v_status;
  end if;
  if not exists (
    select 1 from public.notifications
    where recipient_id = u3 and type = 'request_cancelled_group_full'
  ) then
    raise exception 'FAIL: no cancelled-because-full notification for the requester';
  end if;

  -- Approving the already-cancelled request must refuse and change nothing.
  begin
    perform public.approve_join_request(v_req_u3);
    raise exception 'FAIL: approving a resolved request succeeded';
  exception when others then
    if sqlerrm not like '%ALREADY_RESOLVED%' then raise; end if;
  end;

  raise notice 'PASS: approval re-checks capacity; duplicates and stale approvals refused';
end $$;

-- ── INVARIANT 4: manager-only actions refuse and change nothing ─────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u4 uuid := '00000000-0000-4000-a000-000000000004';
  v_course uuid;
  v_group uuid;
  v_req uuid;
  v_before public.study_groups%rowtype;
  v_after public.study_groups%rowtype;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Authority Test', null, 5, 'closed');

  perform pg_temp.impersonate(u2);
  perform public.join_group(v_group);
  select id into v_req from public.join_requests
    where group_id = v_group and user_id = u2 and status = 'pending';

  select * into v_before from public.study_groups where id = v_group;

  -- U4 (not the manager) tries everything; each must refuse.
  perform pg_temp.impersonate(u4);
  begin
    perform public.approve_join_request(v_req);
    raise exception 'FAIL: non-manager approved a request';
  exception when others then
    if sqlerrm not like '%NOT_MANAGER%' then raise; end if;
  end;
  begin
    perform public.update_group_settings(v_group, 'Hijacked', 'open');
    raise exception 'FAIL: non-manager changed settings';
  exception when others then
    if sqlerrm not like '%NOT_MANAGER%' then raise; end if;
  end;
  begin
    perform public.disband_group(v_group);
    raise exception 'FAIL: non-manager disbanded the group';
  exception when others then
    if sqlerrm not like '%NOT_MANAGER%' then raise; end if;
  end;

  select * into v_after from public.study_groups where id = v_group;
  if row(v_before.*) is distinct from row(v_after.*) then
    raise exception 'FAIL: refused manager actions still changed the group row';
  end if;
  if (select status from public.join_requests where id = v_req) <> 'pending' then
    raise exception 'FAIL: refused approval changed the request';
  end if;

  raise notice 'PASS: manager-only actions refuse non-managers and leave state untouched';
end $$;

-- ── INVARIANT 5: deterministic manager succession ───────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_course uuid;
  v_group uuid;
  v_manager uuid;
  v_status text;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Succession Test', null, 5, 'open');
  perform pg_temp.impersonate(u2);
  perform public.join_group(v_group);
  perform pg_temp.impersonate(u3);
  perform public.join_group(v_group);

  -- Stagger tenure explicitly (in one transaction now() is frozen, so
  -- the join timestamps would otherwise tie).
  update public.study_group_members set joined_at = now() - interval '2 hours'
    where group_id = v_group and user_id = u2;
  update public.study_group_members set joined_at = now() - interval '1 hour'
    where group_id = v_group and user_id = u3;

  perform pg_temp.impersonate(u1);
  perform public.leave_group(v_group);

  select manager_id into v_manager from public.study_groups where id = v_group;
  if v_manager <> u2 then
    raise exception 'FAIL: crown went to %, expected longest-tenured u2', v_manager;
  end if;
  if not exists (
    select 1 from public.notifications
    where recipient_id = u2 and type = 'manager_transferred'
  ) then
    raise exception 'FAIL: new manager was not notified';
  end if;

  -- Everyone leaves → the group disbands itself: a tombstone stamped
  -- with disbanded_at, which the purge deletes seven days later (0022).
  perform pg_temp.impersonate(u2);
  perform public.leave_group(v_group);
  perform pg_temp.impersonate(u3);
  perform public.leave_group(v_group);

  select status into v_status from public.study_groups where id = v_group;
  if v_status <> 'disbanded' then
    raise exception 'FAIL: empty group is % (expected disbanded)', v_status;
  end if;
  if (select disbanded_at from public.study_groups where id = v_group) is null then
    raise exception 'FAIL: disbanded_at not stamped on self-disband';
  end if;

  raise notice 'PASS: succession is longest-tenured-first; last member out disbands';
end $$;

-- ── INVARIANT 6: disband completeness ───────────────────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u4 uuid := '00000000-0000-4000-a000-000000000004';
  v_course uuid;
  v_group uuid;
  v_req uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Disband Test', null, 5, 'closed');

  perform pg_temp.impersonate(u2);
  perform public.join_group(v_group);
  select id into v_req from public.join_requests
    where group_id = v_group and user_id = u2 and status = 'pending';
  perform pg_temp.impersonate(u1);
  perform public.approve_join_request(v_req);

  -- One still-pending request and one future meetup to be cleaned up.
  perform pg_temp.impersonate(u4);
  perform public.join_group(v_group);
  perform pg_temp.impersonate(u1);
  perform public.create_meetup(v_group, 'Doomed meetup', now() + interval '2 days',
                               'in_person', 'Walter Library', null);

  perform public.disband_group(v_group);

  -- Right after disband: the classic tombstone assertions.
  if exists (select 1 from public.study_group_members where group_id = v_group) then
    raise exception 'FAIL: members remain after disband';
  end if;
  if exists (select 1 from public.join_requests where group_id = v_group and status = 'pending') then
    raise exception 'FAIL: pending requests remain after disband';
  end if;
  if exists (
    select 1 from public.meetups
    where group_id = v_group and scheduled_at > now() and not is_cancelled
  ) then
    raise exception 'FAIL: future meetups not cancelled by disband';
  end if;
  if (select member_count from public.study_groups where id = v_group) <> 0 then
    raise exception 'FAIL: member_count nonzero after disband';
  end if;
  if not exists (
    select 1 from public.notifications where recipient_id = u2 and type = 'group_disbanded'
  ) then
    raise exception 'FAIL: members were not notified of disband';
  end if;
  if not exists (
    select 1 from public.notifications where recipient_id = u4 and type = 'group_disbanded'
  ) then
    raise exception 'FAIL: pending requester was not notified of disband';
  end if;

  -- The grace-period rule (0022 window, 0035 duration): a disbanded group
  -- one day INSIDE the window survives; one day PAST it, the purge deletes
  -- the group and EVERY child row.
  update public.study_groups
    set disbanded_at = now() - make_interval(days => public.retention_grace_days() - 1)
    where id = v_group;
  perform public.purge_stale_rows();
  if not exists (select 1 from public.study_groups where id = v_group) then
    raise exception 'FAIL: purge deleted a disbanded group still inside the grace period';
  end if;

  update public.study_groups
    set disbanded_at = now() - make_interval(days => public.retention_grace_days() + 1)
    where id = v_group;
  perform public.purge_stale_rows();

  if exists (select 1 from public.study_groups where id = v_group) then
    raise exception 'FAIL: purge kept a disbanded group past the grace period';
  end if;
  if exists (select 1 from public.join_requests where group_id = v_group) then
    raise exception 'FAIL: join-request rows survived the purge';
  end if;
  if exists (select 1 from public.meetups where group_id = v_group) then
    raise exception 'FAIL: meetup rows survived the purge';
  end if;

  raise notice 'PASS: disband tombstones for the grace period, then the purge deletes everything';
end $$;

-- ── INVARIANT 7: closed→open approves min(pending, space), oldest first ─────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  u4 uuid := '00000000-0000-4000-a000-000000000004';
  v_course uuid;
  v_group uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Mode Switch Test', null, 3, 'closed');

  perform pg_temp.impersonate(u2); perform public.join_group(v_group);
  perform pg_temp.impersonate(u3); perform public.join_group(v_group);
  perform pg_temp.impersonate(u4); perform public.join_group(v_group);

  -- Stagger request ages: u2 oldest, then u3, then u4.
  update public.join_requests set created_at = now() - interval '3 hours'
    where group_id = v_group and user_id = u2;
  update public.join_requests set created_at = now() - interval '2 hours'
    where group_id = v_group and user_id = u3;
  update public.join_requests set created_at = now() - interval '1 hour'
    where group_id = v_group and user_id = u4;

  -- Capacity 3, 1 member, 3 pending → exactly 2 approvals (u2, u3);
  -- u4 is cancelled-with-notification, never over capacity.
  perform pg_temp.impersonate(u1);
  perform public.update_group_settings(v_group, 'Mode Switch Test', 'open');

  if (select member_count from public.study_groups where id = v_group) <> 3 then
    raise exception 'FAIL: closed->open ended at %/3 members',
      (select member_count from public.study_groups where id = v_group);
  end if;
  if not exists (select 1 from public.study_group_members where group_id = v_group and user_id = u2)
     or not exists (select 1 from public.study_group_members where group_id = v_group and user_id = u3) then
    raise exception 'FAIL: oldest two requests were not the ones approved';
  end if;
  if exists (select 1 from public.study_group_members where group_id = v_group and user_id = u4) then
    raise exception 'FAIL: capacity exceeded — newest requester was seated';
  end if;
  if (select status from public.join_requests where group_id = v_group and user_id = u4) <> 'cancelled' then
    raise exception 'FAIL: overflow request was not cancelled';
  end if;

  raise notice 'PASS: closed->open approves exactly min(pending, space), oldest first';
end $$;

-- ── INVARIANT 8: the 2,000-character message wall ───────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  v_course uuid;
  v_group uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');
  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Message Test', null, 5, 'open');

  -- Exactly 2,000 is fine…
  perform public.send_group_message(v_group, repeat('x', 2000));
  -- …2,001 is not, in group chat…
  begin
    perform public.send_group_message(v_group, repeat('x', 2001));
    raise exception 'FAIL: 2,001-char group message was persisted';
  exception when others then
    if sqlerrm not like '%MESSAGE_TOO_LONG%' then raise; end if;
  end;
  -- …and not in DMs either.
  begin
    perform public.send_direct_message(u2, repeat('x', 2001));
    raise exception 'FAIL: 2,001-char direct message was persisted';
  exception when others then
    if sqlerrm not like '%MESSAGE_TOO_LONG%' then raise; end if;
  end;

  if exists (select 1 from public.group_messages where char_length(content) > 2000)
     or exists (select 1 from public.direct_messages where char_length(content) > 2000) then
    raise exception 'FAIL: an over-limit message exists in the database';
  end if;

  raise notice 'PASS: no message over 2,000 characters is ever persisted';
end $$;

-- ── INVARIANT 9: block completeness ─────────────────────────────────────────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u2 uuid := '00000000-0000-4000-a000-000000000002';
  v_req uuid;
begin
  -- Build every kind of connection between u1 and u2 first.
  perform pg_temp.impersonate(u1);
  perform public.send_friend_request(u2);
  select id into v_req from public.friend_requests
    where sender_id = u1 and recipient_id = u2 and status = 'pending';
  perform pg_temp.impersonate(u2);
  perform public.respond_friend_request(v_req, true);

  update public.profiles set is_available_for_buddies = true where id in (u1, u2);
  perform pg_temp.impersonate(u1);
  perform public.send_buddy_request(u2);
  select id into v_req from public.study_buddy_requests
    where sender_id = u1 and recipient_id = u2 and status = 'pending';
  perform pg_temp.impersonate(u2);
  perform public.respond_buddy_request(v_req, true);

  -- One block call must sever all of it, atomically.
  perform pg_temp.impersonate(u1);
  perform public.block_user(u2);

  if exists (select 1 from public.friends
             where user_id_a = least(u1,u2) and user_id_b = greatest(u1,u2)) then
    raise exception 'FAIL: friendship survived the block';
  end if;
  if exists (select 1 from public.study_buddy_connections
             where user_id_a = least(u1,u2) and user_id_b = greatest(u1,u2)) then
    raise exception 'FAIL: buddy connection survived the block';
  end if;
  if exists (select 1 from public.friend_requests
             where status = 'pending'
               and ((sender_id = u1 and recipient_id = u2) or (sender_id = u2 and recipient_id = u1))) then
    raise exception 'FAIL: pending friend request survived the block';
  end if;

  -- And the blocked user can neither message nor re-request.
  perform pg_temp.impersonate(u2);
  begin
    perform public.send_direct_message(u1, 'hello?');
    raise exception 'FAIL: blocked user could send a DM';
  exception when others then
    if sqlerrm not like '%BLOCKED%' then raise; end if;
  end;
  begin
    perform public.send_friend_request(u1);
    raise exception 'FAIL: blocked user could send a friend request';
  exception when others then
    if sqlerrm not like '%BLOCKED%' then raise; end if;
  end;

  -- The blocked user cannot see the blocker's profile at all.
  if public.get_public_profile(u1) is not null then
    raise exception 'FAIL: blocked user can still view the blocker profile';
  end if;

  raise notice 'PASS: one block severs friendship, buddies, requests, DMs, and profile view';
end $$;

-- ── INVARIANT 10: hidden fields are stripped AND exclude from filters ───────
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';
  u3 uuid := '00000000-0000-4000-a000-000000000003';
  v_profile jsonb;
begin
  -- u3 declares a major, then hides it.
  update public.profiles
    set major = 'Secret Science', privacy = '{"major": true}'::jsonb
    where id = u3;

  perform pg_temp.impersonate(u1);

  -- Rule 1: the key is ABSENT from the profile payload.
  v_profile := public.get_public_profile(u3);
  if v_profile ? 'major' then
    raise exception 'FAIL: hidden major present in profile payload';
  end if;

  -- Rule 2: filtering by that major must NOT return them.
  if exists (
    select 1 from public.search_people(p_majors => array['Secret Science'])
    where id = u3
  ) then
    raise exception 'FAIL: hidden major still findable via the major filter';
  end if;

  -- Positive control: un-hide, and both behaviors flip.
  update public.profiles set privacy = '{}'::jsonb where id = u3;
  v_profile := public.get_public_profile(u3);
  if not (v_profile ? 'major') then
    raise exception 'FAIL: visible major missing from profile payload';
  end if;
  if not exists (
    select 1 from public.search_people(p_majors => array['Secret Science'])
    where id = u3
  ) then
    raise exception 'FAIL: visible major not findable via the major filter';
  end if;

  raise notice 'PASS: hidden fields are stripped and excluded from their filters';
end $$;

-- ── INVARIANT 11: content flags are private, permission-checked, toggleable ──
do $$
declare
  u1 uuid := '00000000-0000-4000-a000-000000000001';  -- manager + author
  u2 uuid := '00000000-0000-4000-a000-000000000002';  -- member + flagger
  u3 uuid := '00000000-0000-4000-a000-000000000003';  -- outsider
  u4 uuid := '00000000-0000-4000-a000-000000000004';  -- admin
  v_course uuid;
  v_group  uuid;
  v_msg    uuid;
  v_flag   uuid;
  v_n      int;
  v_seen_outsider int;
  v_seen_author   int;
  v_seen_flagger  int;
  v_seen_admin    int;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u1);
  v_group := public.create_study_group(v_course, 'Flag Test', null, 5, 'open');
  select id into v_msg from public.send_group_message(v_group, 'look at this');

  perform pg_temp.impersonate(u2);
  perform public.join_group(v_group);

  -- A non-member cannot flag the group's content — and gets the same
  -- error as a missing row (no existence probing).
  perform pg_temp.impersonate(u3);
  begin
    perform public.flag_content('group_message', v_msg, null);
    raise exception 'FAIL: a non-member flagged a group message';
  exception when others then
    if sqlerrm not like '%CONTENT_NOT_FOUND%' then raise; end if;
  end;

  -- You cannot flag your own content.
  perform pg_temp.impersonate(u1);
  begin
    perform public.flag_content('group_message', v_msg, null);
    raise exception 'FAIL: author flagged their own message';
  exception when others then
    if sqlerrm not like '%SELF_ACTION%' then raise; end if;
  end;

  -- u2 (a member) flags it, with a note.
  perform pg_temp.impersonate(u2);
  v_flag := public.flag_content('group_message', v_msg, 'not appropriate');
  select count(*) into v_n from public.content_flags
    where content_type = 'group_message' and content_id = v_msg;
  if v_n <> 1 then
    raise exception 'FAIL: flag_content did not create exactly one row (got %)', v_n;
  end if;

  -- Re-flagging is a no-op (unique on flagger + content).
  perform public.flag_content('group_message', v_msg, 'still not ok');
  select count(*) into v_n from public.content_flags
    where content_type = 'group_message' and content_id = v_msg;
  if v_n <> 1 then
    raise exception 'FAIL: re-flag created a second row';
  end if;

  -- RLS: the flag is invisible to a non-flagger non-admin, visible to the
  -- flagger, visible to an admin. Run the reads as the (non-superuser)
  -- `authenticated` role so the policies actually apply; capture every
  -- count first, restore the role, THEN assert — so a failure can never
  -- strand the session in the switched role.
  update public.profiles set is_admin = true where id = u4;

  set local role authenticated;
  perform pg_temp.impersonate(u3);
  select count(*) into v_seen_outsider from public.content_flags;
  perform pg_temp.impersonate(u1);  -- the flagged author is not privileged
  select count(*) into v_seen_author from public.content_flags;
  perform pg_temp.impersonate(u2);
  select count(*) into v_seen_flagger from public.content_flags where id = v_flag;
  perform pg_temp.impersonate(u4);
  select count(*) into v_seen_admin from public.content_flags where id = v_flag;
  reset role;

  if v_seen_outsider <> 0 then
    raise exception 'FAIL: an outsider can see content_flags rows';
  end if;
  if v_seen_author <> 0 then
    raise exception 'FAIL: the flagged author can see the flag on their content';
  end if;
  if v_seen_flagger <> 1 then
    raise exception 'FAIL: the flagger cannot see their own flag';
  end if;
  if v_seen_admin <> 1 then
    raise exception 'FAIL: an admin cannot see the flag';
  end if;

  -- Unflagging removes it (clean toggle, idempotent).
  perform pg_temp.impersonate(u2);
  perform public.unflag_content('group_message', v_msg);
  perform public.unflag_content('group_message', v_msg);  -- no error second time
  if exists (select 1 from public.content_flags where id = v_flag) then
    raise exception 'FAIL: unflag_content left the row behind';
  end if;

  raise notice 'PASS: content flags are private, permission-checked, and toggleable';
end $$;

-- ── RETENTION (0035): one grace period governs every bucket ─────────────────
-- The period is public.retention_grace_days(). These blocks age rows just
-- past it (or just inside it) and assert purge_stale_rows() acts correctly.
-- Fresh users u6–u9 so accumulated state above can't interfere.

do $$
declare
  ids uuid[] := array[
    '00000000-0000-4000-a000-000000000006',
    '00000000-0000-4000-a000-000000000007',
    '00000000-0000-4000-a000-000000000008',
    '00000000-0000-4000-a000-000000000009'
  ];
  i int;
begin
  for i in 1..4 loop
    insert into auth.users (id, email) values (ids[i], 'invariant-retention-' || i || '@umn.edu');
    update public.profiles set display_name = 'Retention Student ' || i where id = ids[i];
  end loop;
end $$;

-- Bucket 1: content is erased `grace` days after creation — but a meetup
-- ages off scheduled_at, so a booking made far ahead is never purged early.
do $$
declare
  u6 uuid := '00000000-0000-4000-a000-000000000006';
  u7 uuid := '00000000-0000-4000-a000-000000000007';
  v_course uuid;
  v_group  uuid;
  v_old_msg uuid;
  v_new_msg uuid;
  v_meetup uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');
  perform pg_temp.impersonate(u6);
  v_group := public.create_study_group(v_course, 'Retention Bucket One', null, 5, 'open');
  perform pg_temp.impersonate(u7); perform public.join_group(v_group);

  perform pg_temp.impersonate(u6);
  select id into v_old_msg from public.send_group_message(v_group, 'ancient history');
  select id into v_new_msg from public.send_group_message(v_group, 'said this today');
  v_meetup := public.create_meetup(v_group, 'Far-future meetup',
                now() + interval '30 days', 'in_person', 'Walter Library');

  update public.group_messages
    set created_at = now() - make_interval(days => public.retention_grace_days() + 5)
    where id = v_old_msg;
  update public.meetups
    set created_at = now() - make_interval(days => public.retention_grace_days() + 5)
    where id = v_meetup;

  perform public.purge_stale_rows();

  if exists (select 1 from public.group_messages where id = v_old_msg) then
    raise exception 'FAIL: a year-old group message survived the purge';
  end if;
  if not exists (select 1 from public.group_messages where id = v_new_msg) then
    raise exception 'FAIL: a fresh group message was purged';
  end if;
  if not exists (select 1 from public.meetups where id = v_meetup) then
    raise exception 'FAIL: an upcoming meetup was purged for being created long ago';
  end if;

  update public.meetups
    set scheduled_at = now() - make_interval(days => public.retention_grace_days() + 1)
    where id = v_meetup;
  perform public.purge_stale_rows();
  if exists (select 1 from public.meetups where id = v_meetup) then
    raise exception 'FAIL: a meetup a year past its date survived the purge';
  end if;
  if exists (select 1 from public.meetup_attendance where meetup_id = v_meetup) then
    raise exception 'FAIL: RSVP rows for a purged meetup were left behind';
  end if;

  raise notice 'PASS: bucket 1 erases old content; meetups age off scheduled_at';
end $$;

-- Bucket 2: a still-pending request is capped at `grace` days after
-- creation; a report is erased only after a human resolves it.
do $$
declare
  u6 uuid := '00000000-0000-4000-a000-000000000006';
  u7 uuid := '00000000-0000-4000-a000-000000000007';
  v_fr uuid;
  v_report uuid;
begin
  perform pg_temp.impersonate(u6);
  perform public.send_friend_request(u7);
  select id into v_fr from public.friend_requests
    where sender_id = u6 and recipient_id = u7 and status = 'pending';

  update public.friend_requests
    set created_at = now() - make_interval(days => public.retention_grace_days() + 1)
    where id = v_fr;
  perform public.purge_stale_rows();
  if exists (select 1 from public.friend_requests where id = v_fr) then
    raise exception 'FAIL: a year-old still-pending friend request survived the purge';
  end if;

  perform pg_temp.impersonate(u6);
  v_report := public.report_user(u7, 'harassment', 'test report');
  update public.reports
    set created_at = now() - make_interval(days => public.retention_grace_days() + 30)
    where id = v_report;
  perform public.purge_stale_rows();
  if not exists (select 1 from public.reports where id = v_report) then
    raise exception 'FAIL: an open report was auto-deleted for age';
  end if;

  update public.reports set status = 'resolved' where id = v_report;
  if (select resolved_at from public.reports where id = v_report) is null then
    raise exception 'FAIL: resolved_at not stamped when the report closed';
  end if;
  update public.reports
    set resolved_at = now() - make_interval(days => public.retention_grace_days() + 1)
    where id = v_report;
  perform public.purge_stale_rows();
  if exists (select 1 from public.reports where id = v_report) then
    raise exception 'FAIL: a report resolved over a year ago survived the purge';
  end if;

  raise notice 'PASS: bucket 2 caps pending rows at creation; reports wait for resolution';
end $$;

-- Bucket 3: deleting an account defers its satellite data to the grace
-- period; the tombstone is swept once the period is up AND nothing else
-- points at it.
do $$
declare
  u8 uuid := '00000000-0000-4000-a000-000000000008';
  u9 uuid := '00000000-0000-4000-a000-000000000009';
  v_course uuid;
  v_dm uuid;
begin
  select course_id into v_course from public.create_course('TEST','1001','x');

  perform pg_temp.impersonate(u8);
  perform public.send_friend_request(u9);
  perform pg_temp.impersonate(u9);
  perform public.respond_friend_request(
    (select id from public.friend_requests
       where sender_id = u8 and recipient_id = u9 and status = 'pending'), true);
  perform pg_temp.impersonate(u8);
  insert into public.user_courses (user_id, course_id, enrollment_type)
    values (u8, v_course, 'current') on conflict do nothing;
  select id into v_dm from public.send_direct_message(u9, 'bye for now');

  perform public.delete_account();

  if (select account_status from public.profiles where id = u8) <> 'deleted' then
    raise exception 'FAIL: account not marked deleted';
  end if;
  if (select deleted_at from public.profiles where id = u8) is null then
    raise exception 'FAIL: deleted_at not stamped on account deletion';
  end if;
  if not exists (select 1 from public.friends
                 where user_id_a = least(u8,u9) and user_id_b = greatest(u8,u9)) then
    raise exception 'FAIL: friendship was deleted immediately instead of deferred';
  end if;
  if not exists (select 1 from public.user_courses where user_id = u8) then
    raise exception 'FAIL: course list was deleted immediately instead of deferred';
  end if;
  if not exists (select 1 from public.deleted_account_emails where id = u8) then
    raise exception 'FAIL: retained email row not written on deletion';
  end if;

  perform public.purge_stale_rows();
  if not exists (select 1 from public.friends
                 where user_id_a = least(u8,u9) and user_id_b = greatest(u8,u9)) then
    raise exception 'FAIL: purge removed a deleted account''s data inside the grace period';
  end if;

  update public.profiles
    set deleted_at = now() - make_interval(days => public.retention_grace_days() + 1)
    where id = u8;
  perform public.purge_stale_rows();

  if exists (select 1 from public.friends
             where user_id_a = least(u8,u9) and user_id_b = greatest(u8,u9)) then
    raise exception 'FAIL: friendship survived past the grace period';
  end if;
  if exists (select 1 from public.user_courses where user_id = u8) then
    raise exception 'FAIL: course list survived past the grace period';
  end if;
  if exists (select 1 from public.deleted_account_emails where id = u8) then
    raise exception 'FAIL: retained email survived past the grace period';
  end if;
  if not exists (select 1 from public.profiles where id = u8) then
    raise exception 'FAIL: tombstone swept while a recent DM still referenced it';
  end if;

  update public.direct_messages
    set created_at = now() - make_interval(days => public.retention_grace_days() + 1)
    where id = v_dm;
  perform public.purge_stale_rows();
  if exists (select 1 from public.profiles where id = u8) then
    raise exception 'FAIL: an unreferenced tombstone survived past the grace period';
  end if;

  raise notice 'PASS: bucket 3 defers a deleted account''s data, then sweeps the tombstone';
end $$;

-- ── INVARIANT: display_name is derived from first + last name (0042) ────────
do $$
declare
  u10 uuid := '00000000-0000-4000-a000-000000000010';
begin
  insert into auth.users (id, email) values (u10, 'invariant-names@umn.edu');

  -- A freehand display_name in the same write loses to the names.
  update public.profiles
    set first_name = '  Alex ', last_name = 'Rivera', display_name = 'Someone Else'
    where id = u10;
  if (select display_name from public.profiles where id = u10) <> 'Alex Rivera' then
    raise exception 'FAIL: display_name not derived from trimmed first + last name';
  end if;

  begin
    update public.profiles set last_name = '   ' where id = u10;
    raise exception 'FAIL: a whitespace-only last name was accepted';
  exception when check_violation then
    null;
  end;

  if has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') then
    raise exception 'FAIL: students can still write display_name directly';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'last_name', 'UPDATE') then
    raise exception 'FAIL: students cannot edit their own first/last name';
  end if;

  perform pg_temp.impersonate(u10);
  perform public.delete_account();
  if exists (select 1 from public.profiles
             where id = u10
               and (first_name is not null or last_name is not null
                    or display_name <> 'Deleted User')) then
    raise exception 'FAIL: account deletion left the real name behind';
  end if;

  raise notice 'PASS: display_name follows first + last name, and deletion scrubs both';
end $$;

do $$ begin raise notice '=== ALL INVARIANT TESTS PASSED — rolling back ==='; end $$;

rollback;
