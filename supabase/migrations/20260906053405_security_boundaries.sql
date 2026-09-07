-- Tombstone profiles survive deletion; an unexpired JWT must not inherit them.
create or replace function private.has_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from auth.users where id = (select auth.uid()));
$$;
revoke all on function private.has_account() from public, anon;
grant execute on function private.has_account() to authenticated;

do $$
declare target text;
begin
  foreach target in array array['profiles', 'rooms', 'room_pins', 'room_members', 'room_updates', 'reports'] loop
    execute format('create policy account_required on public.%I as restrictive for all to authenticated using ((select private.has_account())) with check ((select private.has_account()))', target);
  end loop;
end $$;

-- Restore the privileged atomic entry point and time bounds lost in the
-- host-year migration. Lock one account while checking its 5/hour allowance.
create or replace function public.create_room(
  p_title text, p_place text, p_starts_at timestamptz,
  p_capacity integer, p_access text, p_years text[],
  p_lat double precision, p_lng double precision)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  new_id uuid;
  host_year text;
  allowed_years text[] := p_years;
begin
  perform 1 from auth.users where id = me for no key update;
  if not found then
    raise exception 'Sign in to open a room' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.rooms
      where host_id = me and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have opened too many rooms in the last hour.' using errcode = 'check_violation';
  end if;
  if p_starts_at is null or p_starts_at < now() - interval '1 hour'
     or p_starts_at > now() + interval '1 year' then
    raise exception 'That start time is not a time you can open a room for.' using errcode = 'check_violation';
  end if;
  select year into host_year from public.profiles where id = me;
  if allowed_years is not null and host_year is not null
     and not host_year = any(allowed_years) then
    allowed_years := array_append(allowed_years, host_year);
  end if;
  insert into public.rooms
    (title, place, host_id, starts_at, capacity, access, years, approx_lat, approx_lng)
  values (p_title, p_place, me, p_starts_at, p_capacity, p_access, allowed_years,
          round(p_lat::numeric, 3)::double precision, round(p_lng::numeric, 3)::double precision)
  returning id into new_id;
  insert into public.room_pins (room_id, lat, lng) values (new_id, p_lat, p_lng);
  insert into public.room_members (room_id, profile_id, state) values (new_id, me, 'member');
  return new_id;
end;
$$;
revoke all on function public.create_room(text,text,timestamptz,integer,text,text[],double precision,double precision) from public, anon;
grant execute on function public.create_room(text,text,timestamptz,integer,text,text[],double precision,double precision) to authenticated, service_role;

-- Autocomplete is billable too, including every abandoned search session.
-- Keep the existing 60 details/day allowance and add 300 predictions/day.
alter table private.place_lookups add column autocomplete_n integer not null default 0;
alter table private.place_lookups enable row level security;
revoke all on private.place_lookups from public, anon, authenticated;

create or replace function public.spend_place_lookup()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare used integer;
begin
  if not private.has_account() then return false; end if;
  insert into private.place_lookups (profile_id, day, n)
  values ((select auth.uid()), current_date, 1)
  on conflict (profile_id, day) do update set n = private.place_lookups.n + 1
    where private.place_lookups.n < 60
  returning n into used;
  return used is not null;
end;
$$;

create or replace function public.spend_place_autocomplete()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare used integer;
begin
  if not private.has_account() then return false; end if;
  insert into private.place_lookups (profile_id, day, autocomplete_n)
  values ((select auth.uid()), current_date, 1)
  on conflict (profile_id, day) do update set autocomplete_n = private.place_lookups.autocomplete_n + 1
    where private.place_lookups.autocomplete_n < 300
  returning autocomplete_n into used;
  return used is not null;
end;
$$;
revoke all on function public.spend_place_lookup(), public.spend_place_autocomplete() from public, anon;
grant execute on function public.spend_place_lookup(), public.spend_place_autocomplete() to authenticated, service_role;

create or replace function public.my_blocks()
returns table(report_id uuid, profile_id uuid, name text, initials text, tone text, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, p.id, p.name, p.initials, p.tone, r.created_at
  from public.reports r join public.profiles p on p.id = r.profile_id
  where r.reporter_id = (select auth.uid()) and r.blocked
    and (select private.has_account())
  order by r.created_at desc;
$$;

-- Refuse null/changed non-campus emails at the auth boundary as well as signup.
create or replace function private.require_campus_email()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.email is null or new.email !~* '^[^@[:space:]]+@(g[.])?ucla[.]edu$' then
    raise exception 'Openseat is UCLA-only. Sign in with your @ucla.edu account.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.require_campus_email() from public, anon, authenticated;
create trigger require_campus_email before insert or update of email on auth.users
for each row execute function private.require_campus_email();
