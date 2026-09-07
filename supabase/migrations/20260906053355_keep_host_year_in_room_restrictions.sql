-- Restrictions narrow who discovers a room; they must not exclude its host.
-- Normalize here as well as in the UI because the RPC is a public API and can
-- be called without this app. NULL remains unrestricted.
update public.rooms as room
set years = array_append(room.years, profile.year)
from public.profiles as profile
where profile.id = room.host_id
  and room.years is not null
  and profile.year is not null
  and not profile.year = any(room.years);

create or replace function public.create_room(
  p_title text, p_place text, p_starts_at timestamp with time zone,
  p_capacity integer, p_access text, p_years text[],
  p_lat double precision, p_lng double precision)
 returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  new_id uuid;
  me uuid := (select auth.uid());
  host_year text;
  allowed_years text[] := p_years;
begin
  if me is null then
    raise exception 'Sign in to open a room';
  end if;

  if p_starts_at < now() - interval '1 hour'
     or p_starts_at > now() + interval '1 year' then
    raise exception 'That start time is not a time you can open a room for.'
      using errcode = 'check_violation';
  end if;

  select year into host_year from public.profiles where id = me;
  if allowed_years is not null
     and host_year is not null
     and not host_year = any(allowed_years) then
    allowed_years := array_append(allowed_years, host_year);
  end if;

  if (select count(*) from public.rooms
       where host_id = me and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have opened too many rooms in the last hour.'
      using errcode = 'check_violation';
  end if;

  insert into public.rooms
    (title, place, host_id, starts_at, capacity, access, years, approx_lat, approx_lng)
  values
    (p_title, p_place, me, p_starts_at, p_capacity, p_access, allowed_years,
     round(p_lat::numeric, 3)::double precision,
     round(p_lng::numeric, 3)::double precision)
  returning id into new_id;

  insert into public.room_pins (room_id, lat, lng) values (new_id, p_lat, p_lng);
  insert into public.room_members (room_id, profile_id, state)
  values (new_id, me, 'member');
  return new_id;
end;
$function$;
