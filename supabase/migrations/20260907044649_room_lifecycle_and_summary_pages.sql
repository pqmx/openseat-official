-- Rooms finish four hours after starting, even if their host never returns.
-- Version matches the migration recorded on the staging project.
-- This migration does not remove rooms or alter exact-location visibility.
alter table public.rooms add column ends_at timestamptz;
alter table public.rooms add column ended_at timestamptz;
update public.rooms set ends_at = starts_at + interval '4 hours';
alter table public.rooms alter column ends_at set not null;
alter table public.rooms add constraint rooms_end_after_start check (ends_at > starts_at);

create function private.room_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.ends_at := new.starts_at + interval '4 hours';
  else
    if (old.ended_at is not null and new.ended_at is distinct from old.ended_at)
       or (old.canceled_at is not null and new.canceled_at is distinct from old.canceled_at) then
      raise exception 'This room is already closed.' using errcode = 'check_violation';
    end if;
    if new.ended_at is distinct from old.ended_at and new.ended_at is not null then
      new.ended_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.room_lifecycle() from public, anon, authenticated;
create trigger room_lifecycle before insert or update on public.rooms
for each row execute function private.room_lifecycle();
grant update(ended_at) on public.rooms to authenticated;

-- Existing join/approve grants cannot be used to enroll people after closure.
-- An invoker trigger retains the caller's room visibility and account policies.
create function private.require_open_room()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.rooms r where r.id = new.room_id
      and r.canceled_at is null and r.ended_at is null and r.ends_at > now()) then
    raise exception 'This room is closed.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.require_open_room() from public, anon, authenticated;
create trigger membership_requires_open_room before insert or update of state on public.room_members
for each row execute function private.require_open_room();
create trigger update_requires_open_room before insert on public.room_updates
for each row execute function private.require_open_room();

-- Extend the existing privileged integrity check, not the caller's visibility.
-- AFTER triggers run after row-policy checks. Taking the same row lock as a
-- host's close prevents a write that started earlier from committing after it.
create or replace function private.enforce_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cap integer; seated integer; still_open boolean;
begin
  if (select auth.uid()) is not null and not private.can_see_room(new.room_id) then
    raise exception 'This room is closed.' using errcode = 'insufficient_privilege';
  end if;
  select r.capacity, r.canceled_at is null and r.ended_at is null and r.ends_at > clock_timestamp()
    into cap, still_open from public.rooms r where r.id = new.room_id for update;
  if not coalesce(still_open, false) then
    raise exception 'This room is closed.' using errcode = 'check_violation';
  end if;
  select count(*) into seated from public.room_members where room_id=new.room_id and state='member';
  if seated > cap then raise exception 'That room is full.' using errcode = 'check_violation'; end if;
  return null;
end;
$$;
revoke all on function private.enforce_capacity() from public, anon, authenticated;
drop trigger room_members_capacity on public.room_members;
create trigger room_members_capacity after insert or update of state on public.room_members
for each row execute function private.enforce_capacity();
create trigger room_updates_open_locked after insert on public.room_updates
for each row execute function private.enforce_capacity();

create index rooms_active_start_id_idx on public.rooms (starts_at, id)
where canceled_at is null and ended_at is null;
create index rooms_host_start_id_idx on public.rooms (host_id, starts_at desc, id desc);

-- Small RLS-respecting pages. No full rosters, request queues, or host updates
-- are downloaded by feed/profile screens. Exact pins retain their existing RLS.
create function public.room_summary_page(
  p_scope text default 'discover', p_host uuid default null,
  p_window text default 'Live', p_before timestamptz default null,
  p_open_only boolean default false,
  p_cursor_at timestamptz default null, p_cursor_id uuid default null,
  p_limit integer default 41
)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with page as materialized (
    select r.* from public.rooms r
    where (select auth.uid()) is not null
      and (
        (p_scope = 'discover' and r.canceled_at is null and r.ended_at is null and r.ends_at > now()
          and ((p_window = 'Live' and r.starts_at <= now())
            or (p_window in ('Tonight', 'This week') and r.starts_at < p_before)))
        or (p_scope = 'mine' and (r.host_id = (select auth.uid()) or exists (
          select 1 from public.room_members mine where mine.room_id = r.id and mine.profile_id = (select auth.uid()))))
        or (p_scope = 'host' and r.host_id = p_host
          and r.canceled_at is null and r.ended_at is null and r.ends_at > now())
      )
      and (not p_open_only or (select count(*) from public.room_members m
        where m.room_id = r.id and m.state = 'member') < r.capacity)
      and (p_cursor_at is null or (p_cursor_id is not null and (
        (p_scope = 'discover' and (r.starts_at, r.id) > (p_cursor_at, p_cursor_id))
        or (p_scope <> 'discover' and (r.starts_at, r.id) < (p_cursor_at, p_cursor_id)))))
    order by
      case when p_scope = 'discover' then r.starts_at end asc,
      case when p_scope = 'discover' then r.id end asc,
      case when p_scope <> 'discover' then r.starts_at end desc,
      case when p_scope <> 'discover' then r.id end desc
    limit greatest(1, least(coalesce(p_limit, 41), 41))
  )
  select jsonb_build_object(
    'id', r.id, 'title', r.title, 'place', r.place, 'starts_at', r.starts_at,
    'ends_at', r.ends_at, 'ended_at', r.ended_at, 'canceled_at', r.canceled_at,
    'capacity', r.capacity, 'access', r.access, 'years', r.years,
    'approx_lat', r.approx_lat, 'approx_lng', r.approx_lng,
    'host', (select jsonb_build_object('id', h.id, 'name', h.name, 'short', h.short,
      'initials', h.initials, 'year', h.year, 'major', h.major, 'tone', h.tone)
      from public.profiles h where h.id = r.host_id),
    'pin', (select jsonb_build_object('lat', p.lat, 'lng', p.lng) from public.room_pins p where p.room_id = r.id),
    'attendee_count', (select count(*) from public.room_members m where m.room_id = r.id and m.state = 'member'),
    'viewer_id', (select auth.uid()),
    'viewer_state', (select m.state from public.room_members m where m.room_id = r.id and m.profile_id = (select auth.uid())),
    'members', coalesce((select jsonb_agg(preview.item) from (
      select jsonb_build_object('state', 'member', 'profile', jsonb_build_object(
        'id', p.id, 'name', p.name, 'short', p.short, 'initials', p.initials,
        'year', p.year, 'major', p.major, 'tone', p.tone)) as item
      from public.room_members m join public.profiles p on p.id = m.profile_id
      where m.room_id = r.id and m.state = 'member'
      order by m.created_at, m.profile_id limit 3
    ) preview), '[]'::jsonb)
  ) from page r
  order by
    case when p_scope = 'discover' then r.starts_at end asc,
    case when p_scope = 'discover' then r.id end asc,
    case when p_scope <> 'discover' then r.starts_at end desc,
    case when p_scope <> 'discover' then r.id end desc;
$$;
revoke all on function public.room_summary_page(text,uuid,text,timestamptz,boolean,timestamptz,uuid,integer) from public, anon;
grant execute on function public.room_summary_page(text,uuid,text,timestamptz,boolean,timestamptz,uuid,integer) to authenticated;
