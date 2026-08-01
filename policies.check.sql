-- Every write policy, exercised as a real signed-in student.
--
-- The other three checks are plain node because `time.ts`/`data.ts`/`snap.ts` are
-- pure. These rules are not in the app at all -- they are in Postgres -- so the
-- only honest test runs there:
--
--   psql "$DATABASE_URL" -f policies.check.sql
--
-- Every row of the output must read ok = t.
--
-- It builds its own world -- four students and six rooms, inserted into
-- `auth.users` so the signup trigger seeds their profiles -- and the whole
-- script ends in `rollback`, so it leaves nothing behind and depends on no seed
-- data. That matters: it used to run against the demo rows, which are gone.
--
-- A refused write is not always an error, which is the trap this is really for.
-- An insert that fails `with check` raises, but an update or delete whose
-- `using` clause matches no row simply succeeds having touched nothing. Judge a
-- write by its effect: "allowed" below means the statement neither raised *nor*
-- quietly did nothing.

begin;

-- ---------------------------------------------------------------- fixtures --

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-000000000001', 'hana@ucla.edu', '{"full_name":"Hana Okafor"}'),
  ('11111111-1111-4111-8111-000000000002', 'mo@ucla.edu',   '{"full_name":"Mo Reyes"}'),
  ('11111111-1111-4111-8111-000000000003', 'ash@ucla.edu',  '{"full_name":"Ash Baptiste"}'),
  ('11111111-1111-4111-8111-000000000004', 'ivy@ucla.edu',  '{"full_name":"Ivy Nakamura"}');

update public.profiles set year = '''27' where id in (
  '11111111-1111-4111-8111-000000000001',
  '11111111-1111-4111-8111-000000000002',
  '11111111-1111-4111-8111-000000000004');
update public.profiles set year = '''29' where id = '11111111-1111-4111-8111-000000000003';

insert into public.rooms
  (id, title, place, street, walk_minutes, host_id, starts_at, capacity, access, years,
   canceled_at, approx_lat, approx_lng)
values
  -- Hana hosts, Mo is in: leaving, posting, ending.
  ('22222222-2222-4222-8222-00000000000a', 'Open room', 'A place', 'A street', 5,
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 4, 'open', null,
   null, 34.07, -118.44),
  -- Hana hosts, nobody else in: joining.
  ('22222222-2222-4222-8222-00000000000b', 'Joinable room', 'A place', 'A street', 5,
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 4, 'open', null,
   null, 34.07, -118.44),
  -- Hana hosts, Ash is waiting: approving and declining.
  ('22222222-2222-4222-8222-00000000000c', 'Approve room', 'A place', 'A street', 5,
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 3, 'approve', null,
   null, 34.07, -118.44),
  -- Same, but every seat is taken: approving must still refuse.
  ('22222222-2222-4222-8222-00000000000d', 'Approve room, full', 'A place', 'A street', 5,
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 1, 'approve', null,
   null, 34.07, -118.44),
  -- Ivy hosts these three: full, year-gated, and called off.
  ('22222222-2222-4222-8222-00000000000e', 'Full room', 'A place', 'A street', 5,
   '11111111-1111-4111-8111-000000000004', now() + interval '1 hour', 1, 'open', null,
   null, 34.07, -118.44),
  ('22222222-2222-4222-8222-00000000000f', 'Gated room', 'A place', 'A street', 5,
   '11111111-1111-4111-8111-000000000004', now() + interval '1 hour', 8, 'open', array['''29'],
   null, 34.07, -118.44),
  ('22222222-2222-4222-8222-000000000010', 'Canceled room', 'A place', 'A street', 5,
   '11111111-1111-4111-8111-000000000004', now() + interval '1 hour', 8, 'open', null,
   now(), 34.07, -118.44);

insert into public.room_members (room_id, profile_id, state) values
  ('22222222-2222-4222-8222-00000000000a', '11111111-1111-4111-8111-000000000001', 'member'),
  ('22222222-2222-4222-8222-00000000000a', '11111111-1111-4111-8111-000000000002', 'member'),
  ('22222222-2222-4222-8222-00000000000b', '11111111-1111-4111-8111-000000000001', 'member'),
  ('22222222-2222-4222-8222-00000000000c', '11111111-1111-4111-8111-000000000001', 'member'),
  ('22222222-2222-4222-8222-00000000000c', '11111111-1111-4111-8111-000000000003', 'requested'),
  ('22222222-2222-4222-8222-00000000000d', '11111111-1111-4111-8111-000000000001', 'member'),
  ('22222222-2222-4222-8222-00000000000d', '11111111-1111-4111-8111-000000000003', 'requested'),
  ('22222222-2222-4222-8222-00000000000e', '11111111-1111-4111-8111-000000000004', 'member'),
  ('22222222-2222-4222-8222-00000000000f', '11111111-1111-4111-8111-000000000004', 'member'),
  ('22222222-2222-4222-8222-000000000010', '11111111-1111-4111-8111-000000000004', 'member');

-- ------------------------------------------------------------------- cases --

create temp table check_result(
  test text, ok boolean, got text, expected text, detail text
) on commit drop;

do $$
declare
  t      record;
  orig   text := session_user;
  passed boolean;
  rows   bigint;
  err    text;
  hana constant text := '11111111-1111-4111-8111-000000000001';  -- '27, hosts a b c d
  mo   constant text := '11111111-1111-4111-8111-000000000002';  -- '27, in a
  ash  constant text := '11111111-1111-4111-8111-000000000003';  -- '29, waiting on c and d
  ivy  constant text := '11111111-1111-4111-8111-000000000004';  -- '27, hosts e f g
  ra   constant text := '22222222-2222-4222-8222-00000000000a';  -- open, Hana, Mo in
  rb   constant text := '22222222-2222-4222-8222-00000000000b';  -- open, Hana, seats free
  rc   constant text := '22222222-2222-4222-8222-00000000000c';  -- approve, Hana
  rd   constant text := '22222222-2222-4222-8222-00000000000d';  -- approve, Hana, no seats
  re   constant text := '22222222-2222-4222-8222-00000000000e';  -- open, Ivy, no seats
  rf   constant text := '22222222-2222-4222-8222-00000000000f';  -- open, Ivy, '29 only
  rg   constant text := '22222222-2222-4222-8222-000000000010';  -- open, Ivy, canceled
begin
  for t in
    select * from (values

      -- Join and ask to join
      ('join an open room', null, mo,
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'member')$q$, rb, mo), true),
      ('ask to join a room the host approves', null, mo,
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'requested')$q$, rc, mo), true),
      ('cannot take a seat in an approve room', null, mo,
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'member')$q$, rc, mo), false),
      ('cannot join a room with no seats left', null, mo,
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'member')$q$, re, mo), false),
      ('cannot join a canceled room', null, mo,
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'member')$q$, rg, mo), false),
      -- Regression: the room's `years` was once read with an RLS-filtered
      -- subselect, so an invisible room yielded null -- "any year" -- and let
      -- you in. Hiding the row must never be the thing that unlocks it.
      ('cannot join a room your year cannot see', null, mo,
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'member')$q$, rf, mo), false),
      ('cannot enrol somebody else', null, mo,
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'member')$q$, rb, ash), false),

      -- Approve and decline
      ('host approves a request', null, hana,
       format($q$update public.room_members set state='member' where room_id=%L and profile_id=%L$q$, rc, ash), true),
      ('non-host cannot approve', null, mo,
       format($q$update public.room_members set state='member' where room_id=%L and profile_id=%L$q$, rc, ash), false),
      ('host cannot approve past capacity', null, hana,
       format($q$update public.room_members set state='member' where room_id=%L and profile_id=%L$q$, rd, ash), false),
      ('host declines a request', null, hana,
       format($q$delete from public.room_members where room_id=%L and profile_id=%L$q$, rc, ash), true),

      -- Leave
      ('leave a room you are in', null, mo,
       format($q$delete from public.room_members where room_id=%L and profile_id=%L$q$, ra, mo), true),
      ('host cannot leave their own room', null, hana,
       format($q$delete from public.room_members where room_id=%L and profile_id=%L$q$, ra, hana), false),
      ('cannot remove somebody from a room you do not host', null, mo,
       format($q$delete from public.room_members where room_id=%L and profile_id=%L$q$, ra, hana), false),

      -- Updates
      ('host posts an update', null, hana,
       format($q$insert into public.room_updates(room_id,author_id,body) values (%L,%L,'we are on the roof')$q$, ra, hana), true),
      ('member cannot post an update', null, mo,
       format($q$insert into public.room_updates(room_id,author_id,body) values (%L,%L,'hello')$q$, ra, mo), false),
      ('cannot post as somebody else', null, hana,
       format($q$insert into public.room_updates(room_id,author_id,body) values (%L,%L,'not me')$q$, ra, mo), false),
      ('cannot post to a canceled room', null, ivy,
       format($q$insert into public.room_updates(room_id,author_id,body) values (%L,%L,'still on?')$q$, rg, ivy), false),

      -- Ending a room, and the column grants behind it
      ('host ends their room', null, hana,
       format($q$update public.rooms set canceled_at=now() where id=%L$q$, ra), true),
      ('non-host cannot end a room', null, mo,
       format($q$update public.rooms set canceled_at=now() where id=%L$q$, ra), false),
      ('host cannot rewrite the room, only end it', null, hana,
       format($q$update public.rooms set title='something else' where id=%L$q$, ra), false),
      ('cannot rename yourself', null, mo,
       format($q$update public.profiles set name='Hana O' where id=%L$q$, mo), false),
      ('onboarding may still set year', null, mo,
       format($q$update public.profiles set year='''28' where id=%L$q$, mo), true),

      -- Reports, and the blocking they can carry. These two read a row rather
      -- than write one: "allowed" means the room came back.
      ('file a report', null, mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Spam or scam',true)$q$, mo, ivy), true),
      ('cannot file a report as somebody else', null, mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason) values (%L,%L,'Spam or scam')$q$, ash, ivy), false),
      ('a host''s room is visible before any block', null, mo,
       format($q$select 1 from public.rooms where id=%L$q$, re), true),
      ('blocking hides that host''s rooms',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Unsafe or threatening',true)$q$, mo, ivy), mo,
       format($q$select 1 from public.rooms where id=%L$q$, re), false),
      ('blocking is symmetric',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Unsafe or threatening',true)$q$, ivy, mo), mo,
       format($q$select 1 from public.rooms where id=%L$q$, re), false)

    ) as v(name, setup, uid, sql, expect)
  loop
    begin
      if t.setup is not null then execute t.setup; end if;
      perform set_config('role', 'authenticated', true);
      perform set_config('request.jwt.claims', json_build_object('sub', t.uid)::text, true);
      execute t.sql;
      get diagnostics rows = row_count;
      -- Touching nothing is a refusal, not a success.
      passed := rows > 0;
      err := case when rows > 0 then null else 'statement affected no rows' end;
      -- Undo the write and leave the subtransaction in one move.
      raise exception 'OPENSEAT_DONE';
    exception when others then
      if sqlerrm <> 'OPENSEAT_DONE' then passed := false; err := sqlerrm; end if;
    end;
    perform set_config('role', orig, true);

    insert into check_result values (
      t.name, passed = t.expect,
      case when passed then 'allowed' else 'refused' end,
      case when t.expect then 'allowed' else 'refused' end,
      case when passed = t.expect then null else err end
    );
  end loop;
end $$;

select test, ok, got, expected, detail from check_result order by ok, test;

rollback;
