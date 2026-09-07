-- `create_room`'s rate limit was a rule of one caller, not a rule of the table.
--
-- `authenticated` held INSERT on nine columns of `rooms` and three of `room_pins`,
-- and `rooms_insert_own` asked only for `host_id = auth.uid()`. So nothing made a
-- client go through `public.create_room()` at all:
--
--   POST /rest/v1/rooms {"title":"x","host_id":"<own uid>", ...}
--
-- in a loop opens unlimited rooms, skips the 5/hour cap entirely, and lands every
-- one of them in every student's feed. It also writes exactly the half-state the
-- function exists to prevent: a room with no pin and nobody in it.
--
-- The comment on the baseline already called `create_room` "one transaction", and
-- `security invoker` was how it stayed honest — the insert policies authorised
-- every row. That was the right instinct and the wrong lever: the policies did
-- authorise the rows, they just also authorised everyone who never called it.
--
-- So the grants go, and the function becomes the door rather than a convenience
-- in front of one. It runs as owner now, which means the policies no longer
-- authorise its writes — it authorises them itself, and always did: `host_id` is
-- `me`, never a parameter, and the other two rows are for the room it just made.
-- The policies stay anyway. A grant added carelessly later meets them again.

revoke insert on public.rooms, public.room_pins from authenticated;

-- Bounds on the two columns that had none. Every other free-text and numeric
-- column on this schema is bounded; `years` and `starts_at` were missed, and
-- with the direct insert above they were reachable.
--
-- The shape is `profiles_interests_sane`'s: a count and a total length, not a
-- vocabulary. `data.ts` holds the vocabulary (`classYears`), and it rolls over
-- every September — a CHECK naming "'27" is a migration due each autumn.
alter table public.rooms add constraint rooms_years_sane
  check (years is null
     or (array_length(years, 1) between 1 and 6
     and length(array_to_string(years, ',')) <= 40));

-- A sanity floor and ceiling, not the business rule. `now()` is not immutable so
-- it cannot appear here; "not in the past" lives in the function below, which is
-- the only thing that can write this column now.
alter table public.rooms add constraint rooms_starts_at_sane
  check (starts_at between '2020-01-01T00:00:00Z' and '2100-01-01T00:00:00Z');

create or replace function public.create_room(
  p_title text, p_place text, p_starts_at timestamp with time zone,
  p_capacity integer, p_access text, p_years text[],
  p_lat double precision, p_lng double precision)
 returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  new_id uuid;
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in to open a room';
  end if;

  -- Definer now, so this counts every room the host has, not the ones RLS would
  -- have shown them. Same answer — `rooms_select` always returned a host their
  -- own rooms — but it no longer depends on that being true.
  if (select count(*) from public.rooms
       where host_id = me and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have opened too many rooms in the last hour.'
      using errcode = 'check_violation';
  end if;

  -- The rule `rooms_starts_at_sane` can't express, because it needs `now()`. An
  -- hour of slack: a room opened for "now" is legitimately a moment in the past
  -- by the time this runs, and a phone's clock is its own opinion.
  if p_starts_at < now() - interval '1 hour'
     or p_starts_at > now() + interval '1 year' then
    raise exception 'That start time is not a time you can open a room for.'
      using errcode = 'check_violation';
  end if;

  -- `host_id` is `me` and has never been a parameter. That is what makes running
  -- as owner safe: there is no argument to this function that decides whose room
  -- this is.
  insert into public.rooms
    (title, place, host_id, starts_at, capacity, access, years, approx_lat, approx_lng)
  values
    (p_title, p_place, me, p_starts_at, p_capacity, p_access, p_years,
     round(p_lat::numeric, 3)::double precision,
     round(p_lng::numeric, 3)::double precision)
  returning id into new_id;

  insert into public.room_pins (room_id, lat, lng) values (new_id, p_lat, p_lng);

  insert into public.room_members (room_id, profile_id, state)
  values (new_id, me, 'member');

  return new_id;
end;
$function$;

-- `create or replace` keeps the old ACL, so this is belt and braces — but the
-- function just became `security definer`, which is the worst kind to leave a
-- stray grant on. Revoke from `public`, and from `anon` by name: Supabase's
-- default privileges grant `anon` separately and `revoke ... from public` has
-- never touched that.
revoke all on function
  public.create_room(text, text, timestamptz, integer, text, text[], double precision, double precision)
  from public, anon;

grant execute on function
  public.create_room(text, text, timestamptz, integer, text, text[], double precision, double precision)
  to authenticated, service_role;
