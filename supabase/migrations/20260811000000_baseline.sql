-- Baseline: the schema as it stood in project odewffansajnakyeyzvu on 2026-08-11,
-- captured by introspection because it was only ever built by hand.
--
-- Nothing here is new. It is the existing database written down so that it can be
-- rebuilt, reviewed and tested — `policies.check.sql` verifies these rules but has
-- never been able to *create* them, so until now a lost project meant rewriting the
-- whole ruleset from memory.
--
-- Replaying this on an empty Postgres needs the Supabase preamble (the three roles,
-- `auth.users`, `auth.uid()`); `supabase/ci/bootstrap.sql` is that, for CI and for
-- a scratch cluster. On the real project this file is already applied.

create schema if not exists private;

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid not null,
  name text not null,
  short text not null,
  initials text not null,
  year text,
  major text,
  tone text,
  interests text[] default '{}'::text[] not null,
  prompts jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.rooms (
  id uuid default gen_random_uuid() not null,
  title text not null,
  place text not null,
  host_id uuid not null,
  starts_at timestamp with time zone not null,
  canceled_at timestamp with time zone,
  capacity integer not null,
  access text default 'open'::text not null,
  casual boolean default false not null,
  years text[],
  created_at timestamp with time zone default now() not null,
  approx_lat double precision not null,
  approx_lng double precision not null
);

-- Exact coordinates, split out because RLS hides rows and not columns.
create table public.room_pins (
  room_id uuid not null,
  lat double precision not null,
  lng double precision not null
);

create table public.room_members (
  room_id uuid not null,
  profile_id uuid not null,
  state text default 'member'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.room_updates (
  id uuid default gen_random_uuid() not null,
  room_id uuid not null,
  author_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null
);

create table public.reports (
  id uuid default gen_random_uuid() not null,
  reporter_id uuid not null,
  room_id uuid,
  profile_id uuid,
  reason text not null,
  detail text,
  blocked boolean default false not null,
  created_at timestamp with time zone default now() not null,
  reviewed_at timestamp with time zone,
  reviewed_note text
);

-- ---------------------------------------------------------------- keys

alter table public.profiles add constraint profiles_pkey primary key (id);
alter table public.rooms add constraint rooms_pkey primary key (id);
alter table public.room_pins add constraint room_pins_pkey primary key (room_id);
alter table public.room_members add constraint room_members_pkey primary key (room_id, profile_id);
alter table public.room_updates add constraint room_updates_pkey primary key (id);
alter table public.reports add constraint reports_pkey primary key (id);

alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
alter table public.rooms add constraint rooms_host_id_fkey
  foreign key (host_id) references profiles(id) on delete cascade;
alter table public.room_pins add constraint room_pins_room_id_fkey
  foreign key (room_id) references rooms(id) on delete cascade;
alter table public.room_members add constraint room_members_room_id_fkey
  foreign key (room_id) references rooms(id) on delete cascade;
alter table public.room_members add constraint room_members_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;
alter table public.room_updates add constraint room_updates_room_id_fkey
  foreign key (room_id) references rooms(id) on delete cascade;
alter table public.room_updates add constraint room_updates_author_id_fkey
  foreign key (author_id) references profiles(id) on delete cascade;
alter table public.reports add constraint reports_room_id_fkey
  foreign key (room_id) references rooms(id) on delete set null;
-- Both of these are dropped by 20260811000100; they are here because this file is
-- a record of what was, not of what should be.
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references profiles(id) on delete cascade;
alter table public.reports add constraint reports_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete set null;

-- ---------------------------------------------------------------- checks

alter table public.profiles add constraint profiles_tone_check
  check ((tone = any (array['fill'::text, 'water'::text, 'park'::text])));
alter table public.profiles add constraint profiles_interests_sane
  check (((coalesce(array_length(interests, 1), 0) <= 6)
     and (length(array_to_string(interests, ','::text)) <= 200)));
alter table public.profiles add constraint profiles_prompts_sane
  check (((jsonb_typeof(prompts) = 'array'::text)
     and (jsonb_array_length(prompts) <= 3)
     and (length((prompts)::text) <= 800)));

alter table public.rooms add constraint rooms_access_check
  check ((access = any (array['open'::text, 'approve'::text])));
alter table public.rooms add constraint rooms_capacity_check check ((capacity > 0));
alter table public.rooms add constraint rooms_capacity_max check ((capacity <= 100));
alter table public.rooms add constraint rooms_title_len
  check (((length(title) >= 1) and (length(title) <= 80)));
alter table public.rooms add constraint rooms_place_len
  check (((length(place) >= 1) and (length(place) <= 80)));
alter table public.rooms add constraint rooms_approx_lat_range
  check (((approx_lat >= (-90)::double precision) and (approx_lat <= (90)::double precision)));
alter table public.rooms add constraint rooms_approx_lng_range
  check (((approx_lng >= (-180)::double precision) and (approx_lng <= (180)::double precision)));

alter table public.room_pins add constraint room_pins_lat_range
  check (((lat >= (-90)::double precision) and (lat <= (90)::double precision)));
alter table public.room_pins add constraint room_pins_lng_range
  check (((lng >= (-180)::double precision) and (lng <= (180)::double precision)));

alter table public.room_members add constraint room_members_state_check
  check ((state = any (array['member'::text, 'requested'::text])));

alter table public.room_updates add constraint room_updates_body_len
  check (((length(body) >= 1) and (length(body) <= 500)));

alter table public.reports add constraint reports_target
  check (((room_id is not null) or (profile_id is not null)));
alter table public.reports add constraint reports_reason_len
  check (((length(reason) >= 1) and (length(reason) <= 80)));
alter table public.reports add constraint reports_detail_len
  check (((detail is null) or (length(detail) <= 1000)));
alter table public.reports add constraint reports_reviewed_note_len
  check (((reviewed_note is null) or (length(reviewed_note) <= 2000)));

-- ---------------------------------------------------------------- indexes

create index rooms_host_id_idx on public.rooms using btree (host_id);
create index rooms_starts_at_idx on public.rooms using btree (starts_at);
create index room_members_profile_id_idx on public.room_members using btree (profile_id);
create index room_updates_room_id_created_at_idx
  on public.room_updates using btree (room_id, created_at desc);
create index room_updates_author_id_idx on public.room_updates using btree (author_id);
create index reports_reporter_id_idx on public.reports using btree (reporter_id);
create index reports_profile_id_idx on public.reports using btree (profile_id);
create index reports_room_id_idx on public.reports using btree (room_id);
-- The reverse half of the symmetric block lookup.
create index reports_blocked_pair_rev_idx
  on public.reports using btree (profile_id, reporter_id) where blocked;

-- ---------------------------------------------------------------- helpers
--
-- Every one is `security definer` with an empty search_path. That is not
-- decoration: `can_see_room` in particular must not decide access by reading the
-- room's own columns back through the caller's RLS, or hiding a room unlocks it.

create or replace function private.my_year()
 returns text language sql stable security definer set search_path to ''
as $function$
  select year from public.profiles where id = (select auth.uid());
$function$;

create or replace function private.is_member(room uuid)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1 from public.room_members m
    where m.room_id = room
      and m.profile_id = (select auth.uid())
      and m.state = 'member'
  );
$function$;

create or replace function private.seats_left(p_room uuid)
 returns integer language sql stable security definer set search_path to ''
as $function$
  select r.capacity - (select count(*) from public.room_members m
                       where m.room_id = p_room and m.state = 'member')
  from public.rooms r where r.id = p_room;
$function$;

create or replace function private.blocked_with(other uuid)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1 from public.reports r
    where r.blocked
      and ((r.reporter_id = (select auth.uid()) and r.profile_id = other)
        or (r.reporter_id = other and r.profile_id = (select auth.uid())))
  );
$function$;

create or replace function private.can_see_room(p_room uuid, p_host uuid, p_years text[])
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select not private.blocked_with(p_host)
     and (p_host = (select auth.uid())
          or p_years is null
          or private.my_year() = any(p_years)
          or private.is_member(p_room));
$function$;

create or replace function private.can_see_room(room uuid)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1 from public.rooms r
    where r.id = room and private.can_see_room(r.id, r.host_id, r.years)
  );
$function$;

create or replace function private.shares_room(who uuid)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1
    from public.room_members m
    join public.rooms r on r.id = m.room_id
    where m.profile_id = who
      and private.can_see_room(m.room_id)
      and (m.state = 'member' or r.host_id = (select auth.uid()))
  );
$function$;

create or replace function private.enforce_capacity()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  cap int;
  seated int;
begin
  -- Ordering point for the room. Concurrent joiners queue here, so the second
  -- one counts the first instead of racing it.
  select capacity into cap from public.rooms where id = new.room_id for update;
  select count(*) into seated from public.room_members
    where room_id = new.room_id and state = 'member';
  if seated > cap then
    raise exception 'That room is full.' using errcode = 'check_violation';
  end if;
  return null;
end $function$;

create or replace function private.may_join_as(p_room uuid, p_state text)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room
      and r.canceled_at is null
      and (
        (r.host_id = (select auth.uid()) and p_state = 'member')
        or (r.access = 'approve' and p_state = 'requested')
        or (r.access = 'open' and p_state = 'member' and private.seats_left(p_room) > 0)
      )
  );
$function$;

-- ---------------------------------------------------------------- auth trigger
--
-- The UCLA rule, and the only place it exists. Neither SDK can enforce two
-- domains, so this is what refuses everything else — Apple's Hide My Email relay
-- included, on purpose.

create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  full_name text;
  parts text[];
  first_part text;
  last_part text;
begin
  if new.email !~* '@(g\.)?ucla\.edu$' then
    raise exception 'Openseat is UCLA-only. Sign in with your @ucla.edu account.'
      using errcode = 'check_violation';
  end if;

  full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  parts := regexp_split_to_array(trim(full_name), '\s+');
  first_part := parts[1];
  last_part := parts[array_length(parts, 1)];

  insert into public.profiles (id, name, short, initials)
  values (
    new.id,
    -- "Maya J", the way a host is credited on a room.
    case when array_length(parts, 1) > 1
         then first_part || ' ' || upper(left(last_part, 1))
         else first_part end,
    first_part,
    case when array_length(parts, 1) > 1
         then upper(left(first_part, 1) || left(last_part, 1))
         else upper(left(first_part, 1)) end
  )
  on conflict (id) do update
    set name = excluded.name,
        short = excluded.short,
        initials = excluded.initials
    -- Only while the columns still hold the email's local part: a name a roster
    -- has already shown must not be rewritable by a later metadata update.
    where public.profiles.name = split_part(new.email, '@', 1);

  return new;
end;
$function$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Apple sends no name on first sign-in; `signInWithApple` follows up with
-- `updateUser` and this backfills the three columns.
create trigger on_auth_user_meta_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.handle_new_user();

create trigger room_members_capacity
  after insert or update of state on public.room_members
  for each row when (new.state = 'member')
  execute function private.enforce_capacity();

-- ---------------------------------------------------------------- create_room
--
-- `security invoker` deliberately: the insert policies still authorise every row
-- it writes. It exists to make the three inserts one transaction, not to escape
-- them — three separate client inserts could half-succeed and leave a room
-- nobody is in.

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

-- ---------------------------------------------------------------- triage view

create view private.report_queue as
  select r.id, r.created_at, r.reason, r.detail, r.blocked,
         reporter.name as reporter, reporter.id as reporter_id,
         reported.name as reported, reported.id as reported_id,
         room.title as room, room.id as room_id,
         r.reviewed_at, r.reviewed_note
    from public.reports r
    join public.profiles reporter on reporter.id = r.reporter_id
    left join public.profiles reported on reported.id = r.profile_id
    left join public.rooms room on room.id = r.room_id
   where r.reviewed_at is null
   order by r.created_at desc;

-- ---------------------------------------------------------------- policies

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_pins enable row level security;
alter table public.room_members enable row level security;
alter table public.room_updates enable row level security;
alter table public.reports enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (((id = (select auth.uid())) or private.shares_room(id)));

create policy profiles_update_own on public.profiles for update to authenticated
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

create policy rooms_select on public.rooms for select to authenticated
  using (private.can_see_room(id, host_id, years));

create policy rooms_insert_own on public.rooms for insert to authenticated
  with check ((host_id = (select auth.uid())));

create policy rooms_update_host on public.rooms for update to authenticated
  using ((host_id = (select auth.uid())))
  with check ((host_id = (select auth.uid())));

create policy room_pins_select on public.room_pins for select to authenticated
  using ((exists ( select 1 from public.rooms r
                   where ((r.id = room_pins.room_id)
                     and ((not r.casual) or private.is_member(r.id))))));

create policy room_pins_insert_host on public.room_pins for insert to authenticated
  with check ((exists ( select 1 from public.rooms r
                        where ((r.id = room_pins.room_id)
                          and (r.host_id = (select auth.uid()))))));

create policy room_members_select on public.room_members for select to authenticated
  using ((private.can_see_room(room_id)
     and ((state = 'member'::text)
       or (profile_id = (select auth.uid()))
       or (exists ( select 1 from public.rooms r
                    where ((r.id = room_members.room_id)
                      and (r.host_id = (select auth.uid()))))))));

create policy room_members_insert_self on public.room_members for insert to authenticated
  with check (((profile_id = (select auth.uid()))
     and private.can_see_room(room_id)
     and private.may_join_as(room_id, state)));

create policy room_members_update_host on public.room_members for update to authenticated
  using (((state = 'requested'::text)
     and (exists ( select 1 from public.rooms r
                   where ((r.id = room_members.room_id)
                     and (r.host_id = (select auth.uid())))))))
  with check (((state = 'member'::text) and (private.seats_left(room_id) > 0)));

-- You may remove yourself unless you host, and a host may remove anyone but
-- themselves. Leaving a room you host would orphan it.
create policy room_members_delete on public.room_members for delete to authenticated
  using ((exists ( select 1 from public.rooms r
                   where ((r.id = room_members.room_id)
                     and (((room_members.profile_id = (select auth.uid()))
                           and (r.host_id <> (select auth.uid())))
                       or ((r.host_id = (select auth.uid()))
                           and (room_members.profile_id <> (select auth.uid()))))))));

create policy room_updates_select on public.room_updates for select to authenticated
  using (private.is_member(room_id));

create policy room_updates_insert_host on public.room_updates for insert to authenticated
  with check (((author_id = (select auth.uid()))
     and (exists ( select 1 from public.rooms r
                   where ((r.id = room_updates.room_id)
                     and (r.host_id = (select auth.uid()))
                     and (r.canceled_at is null))))));

create policy reports_select_own on public.reports for select to authenticated
  using ((reporter_id = (select auth.uid())));

create policy reports_insert_own on public.reports for insert to authenticated
  with check ((reporter_id = (select auth.uid())));

-- ---------------------------------------------------------------- grants
--
-- `anon` gets nothing anywhere: there is no signed-out surface in this app.
--
-- INSERT and UPDATE are granted by column, never by table. A table-level INSERT
-- makes every column writable and a column-level REVOKE on top of it is a silent
-- no-op — that is how `reports` once let its own reporter set `reviewed_at`, the
-- column `private.report_queue` filters on.

grant all on public.profiles, public.rooms, public.room_pins,
             public.room_members, public.room_updates, public.reports
  to authenticated, service_role;

revoke insert, update on public.profiles, public.rooms, public.room_pins,
                         public.room_members, public.room_updates, public.reports
  from authenticated;

-- `create_room` runs as the caller, so the host's own inserts need these.
grant insert on public.rooms, public.room_pins to authenticated;

grant update(year, major, interests, prompts) on public.profiles to authenticated;
grant update(canceled_at) on public.rooms to authenticated;
grant update(state) on public.room_members to authenticated;

grant insert(room_id, profile_id, state) on public.room_members to authenticated;
grant insert(room_id, author_id, body) on public.room_updates to authenticated;
-- Everything except the two `reviewed_*` columns.
grant insert(reporter_id, room_id, profile_id, reason, detail, blocked)
  on public.reports to authenticated;

-- Postgres grants EXECUTE to PUBLIC on every new function, so each one is an
-- `anon` endpoint until revoked. Revoke, then grant by name.
revoke all on function
  private.my_year(), private.is_member(uuid), private.seats_left(uuid),
  private.blocked_with(uuid), private.can_see_room(uuid),
  private.can_see_room(uuid, uuid, text[]), private.shares_room(uuid),
  private.may_join_as(uuid, text), private.enforce_capacity(),
  public.handle_new_user(),
  public.create_room(text, text, timestamptz, integer, text, text[], double precision, double precision)
  from public;

grant execute on function
  private.my_year(), private.is_member(uuid), private.seats_left(uuid),
  private.blocked_with(uuid), private.can_see_room(uuid),
  private.can_see_room(uuid, uuid, text[]), private.shares_room(uuid),
  private.may_join_as(uuid, text)
  to authenticated;

grant execute on function
  public.create_room(text, text, timestamptz, integer, text, text[], double precision, double precision)
  to authenticated, service_role;

grant execute on function public.handle_new_user() to service_role;
