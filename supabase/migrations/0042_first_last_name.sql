-- ============================================================================
-- 0042 — required first and last name.
--
-- Students now give a real first AND last name (onboarding step 1,
-- prefilled from their Google account). The name classmates see stays
-- display_name — every search, chat, roster and email already reads that
-- column — but it is now DERIVED as "First Last" instead of typed freehand:
--
--   * first_name / last_name are the self-editable columns.
--   * A BEFORE trigger rebuilds display_name from them on every write, so
--     the three can never disagree.
--   * display_name loses its UPDATE grant: the names are the only way to
--     change what classmates see.
--
-- Existing accounts keep their current display_name with NULL names until
-- they confirm them — the app layout holds them on a "confirm your name"
-- screen. Deliberately no backfill from Google metadata: silently turning
-- a chosen "Alex" into "Alex Rivera" is a change the student should see.
--
-- display_name IS NULL is still the "hasn't finished onboarding" signal.
-- ============================================================================

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- The trigger trims before these run, so a whitespace-only name arrives
-- here as '' and is rejected.
alter table public.profiles drop constraint if exists profiles_first_name_check;
alter table public.profiles add constraint profiles_first_name_check
  check (first_name is null or char_length(first_name) between 1 and 50);

alter table public.profiles drop constraint if exists profiles_last_name_check;
alter table public.profiles add constraint profiles_last_name_check
  check (last_name is null or char_length(last_name) between 1 and 50);

-- "First Last" is up to 50 + 1 + 50. The old 50 cap (0001) was sized for
-- a single freehand field.
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (display_name is null or char_length(display_name) between 1 and 101);

comment on column public.profiles.first_name is
  'Required at onboarding (0042). Private to the owner; the public name is '
  'display_name, which derive_display_name() builds from first + last.';
comment on column public.profiles.last_name is
  'Required at onboarding (0042). See first_name.';

create or replace function public.derive_display_name()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Account deletion (scrub_account_core) stamps account_status 'deleted'
  -- and display_name 'Deleted User' in one update. A real name is PII like
  -- everything else it scrubs, so drop it here and keep the tombstone name
  -- — this way the deletion functions need no changes.
  if new.account_status = 'deleted' then
    new.first_name := null;
    new.last_name := null;
    return new;
  end if;

  new.first_name := btrim(new.first_name);
  new.last_name := btrim(new.last_name);

  if new.first_name is not null and new.last_name is not null then
    new.display_name := new.first_name || ' ' || new.last_name;
  end if;

  return new;
end;
$$;

drop trigger if exists derive_display_name on public.profiles;
create trigger derive_display_name
  before insert or update on public.profiles
  for each row execute function public.derive_display_name();

-- Column grants (see 0001): names in, freehand display_name out.
grant update (first_name, last_name) on public.profiles to authenticated;
revoke update (display_name) on public.profiles from authenticated;
