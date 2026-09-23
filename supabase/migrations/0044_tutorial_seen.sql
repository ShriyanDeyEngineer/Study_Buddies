-- ============================================================================
-- 0044 — remember that someone has been shown the walkthrough video.
--
-- New accounts get the tutorial offered once, automatically. "Once" has
-- to survive signing in on a phone after signing up on a laptop, so this
-- is a column on the profile rather than localStorage.
--
-- Nullable with no default on purpose: NULL means "never seen it", which
-- is the correct state for every account that already exists when this
-- ships, as well as for genuinely new ones. Existing users will therefore
-- be offered the tutorial once too — which is wanted, since none of them
-- has seen it either.
-- ============================================================================

alter table public.profiles
  add column if not exists tutorial_seen_at timestamptz;

comment on column public.profiles.tutorial_seen_at is
  'When this student was shown the walkthrough video. NULL = never, which '
  'is what makes the one-time prompt fire. Written only by '
  'mark_tutorial_seen().';

-- Like every other profile field that isn't in the column-update grant
-- (see 0019's note on set_sex), the only write path is this function —
-- clients have no direct update rights on profiles.
create or replace function public.mark_tutorial_seen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Bare auth check rather than assert_active_caller(): this can fire on
  -- the dashboard immediately after onboarding, and must not depend on
  -- any later profile state.
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  update public.profiles
    set tutorial_seen_at = now()
    where id = v_uid and tutorial_seen_at is null;
end;
$$;

revoke execute on function public.mark_tutorial_seen() from public, anon;
grant execute on function public.mark_tutorial_seen() to authenticated;
