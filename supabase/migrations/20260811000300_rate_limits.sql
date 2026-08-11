-- Rate limits. There were none anywhere, and one of these paths spends money.
--
-- `resolvePlace` is the billed half of place search: typing is free inside an
-- autocomplete session, and the closing `places/{id}` lookup is the one charge.
-- The edge function checked that you were signed in and then spent freely, so any
-- student could hold a loop open against the Google bill all night. Autocomplete
-- being free is what makes this the only counter worth keeping.

create table private.place_lookups (
  profile_id uuid not null,
  day date not null,
  n integer not null default 0,
  primary key (profile_id, day)
);

-- Lives in `public` because that is the only schema PostgREST exposes, so the
-- edge function can reach it; the table it writes stays in `private`.
create or replace function public.spend_place_lookup()
  returns boolean
  language plpgsql
  security definer
  set search_path to ''
as $function$
declare
  me uuid := (select auth.uid());
  used integer;
begin
  if me is null then
    return false;
  end if;

  insert into private.place_lookups (profile_id, day, n)
  values (me, current_date, 1)
  on conflict (profile_id, day)
    do update set n = private.place_lookups.n + 1
  returning n into used;

  -- ponytail: a per-day counter with no sweeper, so one row per user per active
  -- day accumulates forever. At this scale that is nothing; add a pg_cron delete
  -- of `day < current_date - 30` if the table ever gets big enough to notice.
  return used <= 60;
end;
$function$;

revoke all on function public.spend_place_lookup() from public;
grant execute on function public.spend_place_lookup() to authenticated;

-- `create_room` gets the same treatment inline: it is the other endpoint a signed
-- in student can call in a loop, and every call writes three rows. Unchanged from
-- the baseline apart from the guard — still `security invoker`, so the insert
-- policies remain the thing that authorises every row it writes.
create or replace function public.create_room(
  p_title text, p_place text, p_starts_at timestamp with time zone,
  p_capacity integer, p_access text, p_years text[],
  p_lat double precision, p_lng double precision)
 returns uuid language plpgsql set search_path to ''
as $function$
declare
  new_id uuid;
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in to open a room';
  end if;

  -- Own rooms are always visible to their host under `rooms_select`, so this
  -- count is not filtered out from underneath the check by RLS.
  if (select count(*) from public.rooms
       where host_id = me and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have opened too many rooms in the last hour.'
      using errcode = 'check_violation';
  end if;

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
