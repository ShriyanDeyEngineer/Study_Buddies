-- ============================================================================
-- 0043 — "3 new messages in Algo Grinders": batched email for group chat.
--
-- THE PROBLEM
--   Nobody opens this site out of habit. A question asked in a group chat
--   at 2pm can sit unseen for days, which makes the chat feel dead and is
--   the difference between a group that works and one that quietly stops.
--
-- WHY THIS IS A DIGEST AND NOT AN EMAIL PER MESSAGE
--   0006's header and app/api/hooks/notification-email deliberately kept
--   chat OUT of email: messages arrive by the second, and one email each
--   would be unsubscribe-bait — people turn off ALL email, including the
--   invitations and meetups that actually matter. So this batches:
--     - nothing is sent while a conversation is still going (a message
--       must have sat QUIET for a while before it counts);
--     - a member hears about a given group at most once per cooldown;
--     - messages a member has already READ never generate an email.
--
--   That last rule needs read state, which the app didn't have for group
--   chat. Hence last_read_at below.
--
-- WHAT THIS FILE ADDS
--   1. study_group_members.last_read_at   — when this member last opened
--      the group (set by mark_group_read, called from the group page).
--   2. study_group_members.last_digest_at — how far the digest mailer has
--      already reported for this member, so it never repeats itself.
--   3. mark_group_read(group)             — the group page's "I'm looking
--      at this now" call.
--   4. pending_chat_digests(quiet, cooldown) — everything the mailer needs
--      in ONE query: who to email, about which group, how many messages,
--      and a short preview of the last few.
--   5. record_chat_digest(user, group, upto) — marks a digest as sent.
--
-- The mailer itself is app/api/hooks/chat-digest, run on a schedule.
-- Read state is per (member, group), so it lives on study_group_members —
-- the row already exists for exactly that pair, so this costs no new table
-- and no new join on the hot chat path.
-- ============================================================================

alter table public.study_group_members
  add column if not exists last_read_at   timestamptz,
  add column if not exists last_digest_at timestamptz;

comment on column public.study_group_members.last_read_at is
  'When this member last opened the group page. NULL = never opened since '
  'joining (joined_at is then the effective "unread since" mark). Drives '
  'the chat digest, and is the hook any future unread badge should use.';

comment on column public.study_group_members.last_digest_at is
  'Newest message this member has already been emailed about, by '
  'timestamp. Stops the digest repeating itself and paces it against the '
  'cooldown. NULL = never digested.';

-- ── mark_group_read ─────────────────────────────────────────────────────────

-- Called when a member opens the group page. Deliberately NOT a plain
-- client UPDATE: study_group_members has no update policy (0004 — every
-- write goes through a function), and this way the caller can only ever
-- move their OWN mark, on a group they're actually in.
create or replace function public.mark_group_read(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- No row updated simply means "not a member" — not an error worth
  -- raising. The group page renders the non-member preview in that case
  -- and this call is incidental to it.
  update public.study_group_members
    set last_read_at = now()
    where group_id = p_group_id and user_id = v_uid;
end;
$$;

revoke execute on function public.mark_group_read(uuid) from public, anon;
grant execute on function public.mark_group_read(uuid) to authenticated;

-- ── pending_chat_digests ────────────────────────────────────────────────────

-- Every (member, group) that has earned an email right now.
--
-- The four gates, in the order they matter:
--   1. UNREAD — messages newer than the member's read mark, not their own.
--   2. SETTLED — the newest such message is at least p_quiet_minutes old.
--      Without this, the mailer would catch people mid-conversation and
--      email them about a chat they're actively watching.
--   3. NOT ALREADY SENT — newer than last_digest_at.
--   4. COOLDOWN — this member hasn't been digested for this group inside
--      p_cooldown_minutes.
--
-- Callable only by the service role (the mailer): it returns other
-- people's email addresses, which RLS otherwise hides, and no ordinary
-- client has any reason to ask for it.
create or replace function public.pending_chat_digests(
  p_quiet_minutes    int default 30,
  p_cooldown_minutes int default 180,
  p_limit            int default 500
)
returns table (
  user_id        uuid,
  email          text,
  display_name   text,
  group_id       uuid,
  group_name     text,
  unread_count   bigint,
  newest_message timestamptz,
  previews       jsonb
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with candidate as (
    select
      m.user_id,
      m.group_id,
      -- Messages since the member last looked. Someone who has never
      -- opened the group is caught up only to when they joined — we
      -- never email about talk that predates their membership.
      greatest(
        coalesce(m.last_read_at,  m.joined_at),
        coalesce(m.last_digest_at, m.joined_at)
      ) as since
    from public.study_group_members m
    join public.study_groups g on g.id = m.group_id
    join public.profiles p on p.id = m.user_id
    where g.status = 'active'
      and p.account_status = 'active'
      and p.email_notifications
      and p.display_name is not null
      -- Cooldown: don't pester the same person about the same group.
      and (
        m.last_digest_at is null
        or m.last_digest_at < now() - make_interval(mins => p_cooldown_minutes)
      )
  ),
  scored as (
    select
      c.user_id,
      c.group_id,
      count(*)            as unread_count,
      max(gm.created_at)  as newest_message
    from candidate c
    join public.group_messages gm
      on gm.group_id = c.group_id
     and gm.created_at > c.since
     and gm.sender_id <> c.user_id
    group by c.user_id, c.group_id
    -- Settled: the last word was a while ago, so the conversation has
    -- paused and an email won't land on top of a live exchange.
    having max(gm.created_at) < now() - make_interval(mins => p_quiet_minutes)
  )
  select
    s.user_id,
    p.email,
    p.display_name,
    s.group_id,
    g.name as group_name,
    s.unread_count,
    s.newest_message,
    -- The last three messages, oldest first, for the preview block.
    -- Senders who blocked (or were blocked by) the recipient are left
    -- out of the preview: the digest must not become a way to put text
    -- in front of someone who blocked you. The COUNT above is unaffected
    -- — "3 new messages" stays true either way.
    (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
      from (
        select sp.display_name as author, gm.content as body, gm.created_at
        from public.group_messages gm
        join public.profiles sp on sp.id = gm.sender_id
        where gm.group_id = s.group_id
          and gm.created_at > (
            select c.since from candidate c
            where c.user_id = s.user_id and c.group_id = s.group_id
          )
          and gm.sender_id <> s.user_id
          and not public.are_blocked(s.user_id, gm.sender_id)
        order by gm.created_at desc
        limit 3
      ) x
    ) as previews
  from scored s
  join public.profiles p on p.id = s.user_id
  join public.study_groups g on g.id = s.group_id
  order by s.newest_message desc
  limit greatest(coalesce(p_limit, 500), 1);
$$;

-- Revoking from `public` also strips the implicit grant service_role got
-- when the function was created, so the mailer must be granted back
-- EXPLICITLY or it gets "permission denied for function" at runtime.
-- (Modern Supabase grants nothing by default — a function with no grant
-- is unreachable no matter which key is calling.)
revoke execute on function public.pending_chat_digests(int, int, int)
  from public, anon, authenticated;
grant execute on function public.pending_chat_digests(int, int, int) to service_role;

-- ── record_chat_digest ──────────────────────────────────────────────────────

-- Marks a digest as delivered, up to the newest message it covered.
-- Takes the timestamp the mailer actually reported on rather than now(),
-- so messages that arrived WHILE the email was being sent are still
-- picked up by the next run instead of being silently skipped.
create or replace function public.record_chat_digest(
  p_user_id  uuid,
  p_group_id uuid,
  p_upto     timestamptz
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.study_group_members
    set last_digest_at = p_upto
    where user_id = p_user_id and group_id = p_group_id;
$$;

revoke execute on function public.record_chat_digest(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_chat_digest(uuid, uuid, timestamptz) to service_role;

-- The digest's per-group scan is "messages in this group newer than X",
-- which group_messages_group_time_idx (0006) already serves. What it does
-- NOT serve is finding candidate members cheaply once the app has many
-- groups — this partial index keeps the mailer's member sweep off a full
-- table scan.
create index if not exists group_members_digest_idx
  on public.study_group_members (last_digest_at)
  where last_digest_at is not null;
