-- Every write policy, exercised as a real signed-in student.
--
-- The other three checks are plain node because `time.ts`/`data.ts`/`snap.ts` are
-- pure. These rules are not in the app at all -- they are in Postgres -- so the
-- only honest test runs there:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f policies.check.sql
--
-- Every row of the output must read ok = t, and the last block turns that into
-- an exit code so CI can gate on it. `.github/workflows/checks.yml` runs it
-- against a stock Postgres seeded from `supabase/ci/bootstrap.sql` and
-- `supabase/migrations/` -- which is the other reason those migrations exist.
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
  (id, title, place, host_id, starts_at, capacity, access, years,
   canceled_at, approx_lat, approx_lng)
values
  -- Hana hosts, Mo is in: leaving, posting, ending.
  ('22222222-2222-4222-8222-00000000000a', 'Open room', 'A place',
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 4, 'open', null,
   null, 34.07, -118.44),
  -- Hana hosts, nobody else in: joining.
  ('22222222-2222-4222-8222-00000000000b', 'Joinable room', 'A place',
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 4, 'open', null,
   null, 34.07, -118.44),
  -- Hana hosts, Ash is waiting: approving and declining.
  ('22222222-2222-4222-8222-00000000000c', 'Approve room', 'A place',
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 3, 'approve', null,
   null, 34.07, -118.44),
  -- Same, but every seat is taken: approving must still refuse.
  ('22222222-2222-4222-8222-00000000000d', 'Approve room, full', 'A place',
   '11111111-1111-4111-8111-000000000001', now() + interval '1 hour', 1, 'approve', null,
   null, 34.07, -118.44),
  -- Ivy hosts these three: full, year-gated, and called off.
  ('22222222-2222-4222-8222-00000000000e', 'Full room', 'A place',
   '11111111-1111-4111-8111-000000000004', now() + interval '1 hour', 1, 'open', null,
   null, 34.07, -118.44),
  ('22222222-2222-4222-8222-00000000000f', 'Gated room', 'A place',
   '11111111-1111-4111-8111-000000000004', now() + interval '1 hour', 8, 'open', array['''29'],
   null, 34.07, -118.44),
  ('22222222-2222-4222-8222-000000000010', 'Canceled room', 'A place',
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

      -- One statement, every requester at once. `seats_left()` runs inside a
      -- `with check`, and a `with check` cannot count the rows its own statement
      -- is writing -- so each of these rows saw the same two free seats and all
      -- three passed, seating four people in a room that holds three. api.ts
      -- approves one profile_id at a time, but the policy is what decides, and
      -- anyone can send this with their own token. `private.enforce_capacity()`
      -- is an after-row trigger for exactly this: it counts once the rows exist.
      -- The same blind spot is what let two joins race for one last seat; the
      -- `for update` in the trigger is the half that closes that.
      ('host cannot approve a roomful in one statement',
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'requested'),(%L,%L,'requested')$q$, rc, mo, rc, ivy), hana,
       format($q$update public.room_members set state='member' where room_id=%L$q$, rc), false),
      -- And the same statement inside capacity still goes through, or the
      -- trigger would just be a way to make approving fail.
      ('host approves two at once when both fit',
       format($q$insert into public.room_members(room_id,profile_id,state) values (%L,%L,'requested')$q$, rc, mo), hana,
       format($q$update public.room_members set state='member' where room_id=%L$q$, rc), true),

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
      ('room updates are rate limited at the table boundary',
       format($q$insert into public.room_updates(room_id,author_id,body)
         select %L,%L,'Update' from generate_series(1,120)$q$, ra, hana), hana,
       format($q$insert into public.room_updates(room_id,author_id,body) values (%L,%L,'Again')$q$, ra, hana), false),

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
      ('fill in your own tags and prompts', null, mo,
       format($q$update public.profiles set interests=array['Coffee','Film'],
               prompts='[{"q":"MY IDEAL FRIDAY IS","a":"the roof"}]'::jsonb where id=%L$q$, mo), true),
      -- RLS scopes this to your own row; the grant is what stops the columns
      -- Google owns. Both are load-bearing, so both get a case.
      ('cannot fill in somebody else''s profile', null, mo,
       format($q$update public.profiles set interests=array['Coffee'] where id=%L$q$, hana), false),
      -- The caps are the only thing standing between a profile everyone you
      -- share a room with can read and an unbounded blob in it.
      ('cannot store more tags than the cap', null, mo,
       format($q$update public.profiles set interests=array['a','b','c','d','e','f','g'] where id=%L$q$, mo), false),
      ('cannot store an oversized prompt blob', null, mo,
       format($q$update public.profiles set prompts=jsonb_build_array(jsonb_build_object('q','MY IDEAL FRIDAY IS','a',repeat('x',900))) where id=%L$q$, mo), false),
      ('cannot store objects as prompt text', null, mo,
       format($q$update public.profiles set prompts='[{"q":"Hello","a":{"bad":true}}]'::jsonb where id=%L$q$, mo), false),
      ('cannot store null prompt entries', null, mo,
       format($q$update public.profiles set prompts='[null]'::jsonb where id=%L$q$, mo), false),
      ('cannot store a prompt without an answer', null, mo,
       format($q$update public.profiles set prompts='[{"q":"Hello"}]'::jsonb where id=%L$q$, mo), false),
      ('cannot store an unbounded major', null, mo,
       format($q$update public.profiles set major=repeat('x',121) where id=%L$q$, mo), false),
      ('cannot store an unbounded year', null, mo,
       format($q$update public.profiles set year=repeat('x',9) where id=%L$q$, mo), false),

      -- Reports, and the blocking they can carry. These two read a row rather
      -- than write one: "allowed" means the room came back.
      ('file a report', null, mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Spam or scam',true)$q$, mo, ivy), true),
      ('reports are rate limited at the table boundary',
       format($q$insert into public.reports(reporter_id,profile_id,reason)
         select %L,%L,'Spam' from generate_series(1,20)$q$, mo, ivy), mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason) values (%L,%L,'Again')$q$, mo, ivy), false),
      ('bulk reports cannot bypass the rate limit', null, mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason)
         select %L,%L,'Spam' from generate_series(1,21)$q$, mo, ivy), false),
      ('bulk reports within the allowance succeed', null, mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason)
         select %L,%L,'Spam' from generate_series(1,20)$q$, mo, ivy), true),
      ('cannot file a report as somebody else', null, mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason) values (%L,%L,'Spam or scam')$q$, ash, ivy), false),
      -- `reviewed_at` is triage's column, and `private.report_queue` is the
      -- `reviewed_at is null` rows. INSERT was granted table-wide, so filing a
      -- report already stamped reviewed was how you filed one nobody would read.
      -- The revoke, not a policy, is what refuses this.
      ('cannot file a report already marked reviewed', null, mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason,reviewed_at) values (%L,%L,'Spam or scam',now())$q$, mo, ivy), false),
      ('a host''s room is visible before any block', null, mo,
       format($q$select 1 from public.rooms where id=%L$q$, re), true),
      ('blocking hides that host''s rooms',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Unsafe or threatening',true)$q$, mo, ivy), mo,
       format($q$select 1 from public.rooms where id=%L$q$, re), false),
      ('blocking is symmetric',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Unsafe or threatening',true)$q$, ivy, mo), mo,
       format($q$select 1 from public.rooms where id=%L$q$, re), false),

      -- The profile goes with the rooms, because `profiles_select` only reaches
      -- a stranger through `shares_room`, which walks `can_see_room`. This is
      -- what makes reporting-and-blocking from someone's profile land on "No
      -- room at that address" if the sheet goes `back` to it -- see the comment
      -- in `screens/Report.tsx`.
      ('a person you share a room with is readable', null, mo,
       format($q$select 1 from public.profiles where id=%L$q$, ivy), true),
      ('blocking hides that person''s profile too',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Unsafe or threatening',true)$q$, mo, ivy), mo,
       format($q$select 1 from public.profiles where id=%L$q$, ivy), false),

      -- Unblocking. `reports` had SELECT and INSERT for its author and nothing
      -- else, so a block was permanent in both directions and neither person
      -- could undo it. The grant is by column: `blocked` is the reporter's,
      -- `reviewed_at` stays triage's.
      ('a block can be lifted',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Unsafe or threatening',true)$q$, mo, ivy), mo,
       format($q$update public.reports set blocked=false where reporter_id=%L$q$, mo), true),
      ('cannot lift somebody else''s block',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked) values (%L,%L,'Unsafe or threatening',true)$q$, ivy, mo), mo,
       format($q$update public.reports set blocked=false where reporter_id=%L$q$, ivy), false),
      ('cannot mark your own report reviewed',
       format($q$insert into public.reports(reporter_id,profile_id,reason) values (%L,%L,'Spam or scam')$q$, mo, ivy), mo,
       format($q$update public.reports set reviewed_at=now() where reporter_id=%L$q$, mo), false),

      -- TRUNCATE answers to no policy, so the only thing that can refuse it is
      -- the absence of the grant. It was granted to `authenticated` on all six
      -- tables; PostgREST not being able to spell it was the whole defence.
      ('truncate is refused', null, mo, 'truncate public.rooms', false),
      -- INSERT on `rooms` was table-wide, which made `id` and `created_at`
      -- writable by anyone. Column grants are what refuse this.
      ('cannot choose a room''s own id', null, mo,
       format($q$insert into public.rooms(id,title,place,host_id,starts_at,capacity,access,approx_lat,approx_lng)
               values (gen_random_uuid(),'Study','Powell',%L,now()+interval '1 hour',4,'open',34.07,-118.44)$q$, mo), false),

      -- The cap below lives inside `create_room`, so it is only a cap if
      -- `create_room` is the only way in. It wasn't: `rooms_insert_own` asked
      -- for `host_id = auth.uid()` and the nine column grants supplied the rest,
      -- so a client could open unlimited rooms by never calling the function —
      -- each one with no pin and nobody in it. The grant is gone; this is what
      -- says so, and it is a room the student is perfectly entitled to host.
      ('cannot open a room without going through create_room', null, mo,
       format($q$insert into public.rooms(title,place,host_id,starts_at,capacity,access,approx_lat,approx_lng)
               values ('Study','Powell',%L,now()+interval '1 hour',4,'open',34.07,-118.44)$q$, mo), false),
      -- Same for the pin, which was the other half of the half-built room.
      ('cannot write a pin directly either', null, mo,
       format($q$insert into public.room_pins(room_id,lat,lng)
               select id,34.07,-118.44 from public.rooms where host_id = %L limit 1$q$, mo), false),

      -- A block is one fact, so filing it twice is the same fact. Without the
      -- partial unique index, `reports` had no uniqueness anywhere and a loop
      -- could flood both the table and the triage queue.
      ('cannot block the same person twice',
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked)
               values (%L,%L,'Made me uncomfortable',true)$q$, mo, ash), mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason,blocked)
               values (%L,%L,'Made me uncomfortable',true)$q$, mo, ash), false),

      -- The `create_room` cap. `setup` seeds rooms as the script's own role so
      -- the counter is already primed when the student calls the function.
      ('opening a room is allowed under the cap',
       format($q$insert into public.rooms(title,place,host_id,starts_at,capacity,access,approx_lat,approx_lng)
               select 'Seeded','Powell',%L,now()+interval '1 hour',4,'open',34.07,-118.44 from generate_series(1,4)$q$, mo), mo,
       $q$select public.create_room('Study','Powell',now()+interval '1 hour',4,'open',null,34.07,-118.44)$q$, true),
      ('cannot open a sixth room in an hour',
       format($q$insert into public.rooms(title,place,host_id,starts_at,capacity,access,approx_lat,approx_lng)
               select 'Seeded','Powell',%L,now()+interval '1 hour',4,'open',34.07,-118.44 from generate_series(1,5)$q$, mo), mo,
       $q$select public.create_room('Study','Powell',now()+interval '1 hour',4,'open',null,34.07,-118.44)$q$, false),
      ('cannot open a room two years in the future', null, mo,
       $q$select public.create_room('Study','Powell',now()+interval '2 years',4,'open',null,34.07,-118.44)$q$, false),
      ('cannot open a room in the distant past', null, mo,
       $q$select public.create_room('Study','Powell',now()-interval '2 days',4,'open',null,34.07,-118.44)$q$, false),
      ('cannot edit a tombstone with a deleted account token',
       format('delete from auth.users where id=%L', mo), mo,
       format('update public.profiles set major=''Reactivated'' where id=%L', mo), false),
      ('deleted account token cannot read rooms',
       format('delete from auth.users where id=%L', mo), mo,
       'select 1 from public.rooms', false),
      ('deleted account token cannot create a room',
       format('delete from auth.users where id=%L', mo), mo,
       $q$select public.create_room('Study','Powell',now(),4,'open',null,34.07,-118.44)$q$, false),
      ('deleted account token cannot file reports',
       format('delete from auth.users where id=%L', mo), mo,
       format($q$insert into public.reports(reporter_id,profile_id,reason) values (%L,%L,'Spam')$q$, mo, ivy), false)

      -- There were six cases here for `private.can_see_topic`, the `using`
      -- clause of the realtime topic policy. Realtime is out of the MVP and
      -- the function is dropped, so they went with it.

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

-- The RPC is callable without the app, so its normalization is tested at the
-- database boundary rather than relying only on the disabled host-year chip.
do $$
declare
  orig text := session_user;
  hana constant text := '11111111-1111-4111-8111-000000000001';
  opened uuid;
  got text[];
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', hana)::text, true);
  opened := public.create_room(
    'Other years', 'Powell', now() + interval '1 hour', 4, 'open', array['''29'], 34.07, -118.44);
  select years into got from public.rooms where id = opened;
  perform set_config('role', orig, true);
  insert into check_result values (
    'a host cannot exclude their own year',
    got = array['''29', '''27'], got::text, '{''29,''27}', null);
end $$;

-- ------------------------------------------------- the signup trigger --

-- Not policies. `handle_new_user()` is a trigger on `auth.users`, and both
-- halves of it are load-bearing now that the gate is Google and Apple: the
-- domain check is the only thing keeping non-UCLA accounts out, and the
-- backfill is the only reason an Apple account isn't named after its email.
--
-- These run as the script's own role rather than as a student, because writing
-- `auth.users` is GoTrue's job and never the client's.

do $$
declare
  apple constant uuid := '11111111-1111-4111-8111-000000000005';
  got   text;
begin
  -- Apple's identity token carries no name at all, so the row lands on the
  -- email's local part.
  insert into auth.users (id, email, raw_user_meta_data)
  values (apple, 'mjimenez@g.ucla.edu', '{}'::jsonb);
  select name into got from public.profiles where id = apple;
  insert into check_result values (
    'a signup with no name falls back to the email', got = 'mjimenez', got, 'mjimenez', null);

  -- This used to be the Apple backfill: `updateUser` wrote `full_name` and
  -- `on_auth_user_meta_updated` turned it into the three name columns, guarded
  -- by "only while the name is still the email's local part". But that guard
  -- lets it through exactly once, and an Apple account starts in exactly that
  -- state — so one client call set the roster name to any string it liked.
  --
  -- The trigger is dropped. `raw_user_meta_data` is a field the client writes,
  -- so this asserts the inverse of what it used to: writing it changes nothing.
  update auth.users set raw_user_meta_data = '{"full_name":"Maya Jimenez"}'::jsonb
   where id = apple;
  select name || ' / ' || short || ' / ' || initials into got
    from public.profiles where id = apple;
  insert into check_result values (
    'the client cannot name itself through user metadata',
    got = 'mjimenez / mjimenez / M', got, 'mjimenez / mjimenez / M', null);

  -- And the impersonation the guard used to permit, spelled out: a second
  -- account cannot take a name the first one is already shown under.
  update auth.users set raw_user_meta_data = '{"full_name":"Hana Okafor"}'::jsonb
   where id = apple;
  select name into got from public.profiles where id = apple;
  insert into check_result values (
    'a name stays the provider''s, however often metadata changes',
    got = 'mjimenez', got, 'mjimenez', null);
end $$;

-- The three name columns are bounded now. Every other free-text column on this
-- schema is, and these are the ones on every roster row: a provider sending a
-- long name must be clamped, not allowed through and not allowed to fail the
-- signup either.
do $$
declare
  long constant uuid := '11111111-1111-4111-8111-000000000008';
  got  record;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (long, 'longname@ucla.edu',
          jsonb_build_object('full_name', repeat('a', 300) || ' ' || repeat('b', 300)));
  select name, short, initials into got from public.profiles where id = long;
  insert into check_result values (
    'a very long provider name is clamped, not refused',
    length(got.name) <= 40 and length(got.short) <= 20 and length(got.initials) <= 4,
    format('%s/%s/%s', length(got.name), length(got.short), length(got.initials)),
    '<=40/<=20/<=4', null);
end $$;

do $$
declare
  t       record;
  refused boolean;
  err     text;
begin
  for t in
    select * from (values
      ('a non-UCLA address is refused at signup', 'maya@gmail.com'),
      -- Hide My Email is the likely Apple refusal, not the odd one: the relay
      -- address is what the app warns about before it ever sends the token.
      ('apple''s Hide My Email relay is refused too', 'x9k2h@privaterelay.appleid.com'),
      ('a lookalike domain is refused', 'maya@ucla.edu.example.com'),
      ('a missing email is refused', null)
    ) as v(name, email)
  loop
    begin
      insert into auth.users (id, email) values (gen_random_uuid(), t.email);
      refused := false;
      err := 'signup succeeded';
      raise exception 'OPENSEAT_DONE';
    exception when others then
      if sqlerrm <> 'OPENSEAT_DONE' then refused := true; err := null; end if;
    end;
    insert into check_result values (
      t.name, refused, case when refused then 'refused' else 'allowed' end, 'refused', err);
  end loop;
end $$;

-- --------------------------------------------------- deleting an account --

-- `public.delete_me()` is the one write in the app that a policy cannot express,
-- because it ends with a row in `auth.users` and no student may touch that table.
-- It is `security definer`, so what guards it is the code, and the code is only
-- as good as these assertions.
--
-- The shape being defended: a profile outlives its login. `rooms.host_id ->
-- profiles -> auth.users` used to cascade the whole way, so deleting an account
-- deleted the rooms other people had joined and every report the account had
-- filed -- which unblocked, symmetrically and silently, whoever it had blocked.

do $$
declare
  gone constant uuid := '11111111-1111-4111-8111-000000000006';
  stay constant uuid := '11111111-1111-4111-8111-000000000007';
  mine constant uuid := '22222222-2222-4222-8222-000000000011';  -- gone hosts
  theirs constant uuid := '22222222-2222-4222-8222-000000000012'; -- stay hosts
  orig text := session_user;
  got  text;
  n    bigint;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (gone, 'gone@ucla.edu', '{"full_name":"Gone Student"}'),
    (stay, 'stay@ucla.edu', '{"full_name":"Stay Student"}');

  insert into public.rooms
    (id, title, place, host_id, starts_at, capacity, access, approx_lat, approx_lng)
  values
    (mine,   'Their room', 'Powell', gone, now() + interval '1 hour', 4, 'open', 34.07, -118.44),
    (theirs, 'Other room', 'Powell', stay, now() + interval '1 hour', 4, 'open', 34.07, -118.44);

  insert into public.room_members (room_id, profile_id, state) values
    (mine, gone, 'member'), (mine, stay, 'member'),
    (theirs, stay, 'member'), (theirs, gone, 'member');

  -- The block that must survive the account that filed it. It names Ivy, not
  -- Stay, and that is the point: a block outliving its author keeps working, so
  -- pointing it at the guest below would correctly hide the room from them and
  -- the next two cases would be measuring the block instead of the tombstone.
  insert into public.reports (reporter_id, profile_id, reason, blocked)
  values (gone, '11111111-1111-4111-8111-000000000004', 'Unsafe or threatening', true);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', gone)::text, true);
  perform public.delete_me();
  perform set_config('role', orig, true);

  select count(*) into n from auth.users where id = gone;
  insert into check_result values (
    'deleting an account removes the login', n = 0, n::text, '0', null);

  select count(*) into n from public.rooms where id = mine and canceled_at is not null;
  insert into check_result values (
    'a room outlives its host and reads as called off', n = 1, n::text, '1', null);

  select name || ' / ' || coalesce(year, 'null') into got
    from public.profiles where id = gone;
  insert into check_result values (
    'the profile is scrubbed to a tombstone', got = 'Former student / null',
    got, 'Former student / null', null);

  -- Off other people's rosters, but still on the room it hosts -- that membership
  -- is what `private.shares_room` walks to make the tombstone selectable at all.
  select count(*) into n from public.room_members where profile_id = gone and room_id = theirs;
  insert into check_result values (
    'a deleted account leaves rooms it only joined', n = 0, n::text, '0', null);
  select count(*) into n from public.room_members where profile_id = gone and room_id = mine;
  insert into check_result values (
    'a deleted account stays on the room it hosts', n = 1, n::text, '1', null);

  select count(*) into n from public.reports where reporter_id = gone and blocked;
  insert into check_result values (
    'a block outlives the account that filed it', n = 1, n::text, '1', null);

  -- Still enforced, not merely still stored. This is the case that fails if the
  -- reports rows ever go back to cascading away with the account.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-1111-4111-8111-000000000004')::text, true);
  select count(*) into n from public.rooms where id = mine;
  perform set_config('role', orig, true);
  insert into check_result values (
    'a block filed by a deleted account still bites', n = 0, n::text, '0', null);

  -- The half that actually breaks the app if it regresses: `api.ts` embeds the
  -- host on every room, and a room it can see whose host it cannot read is a
  -- null `host` and a crash in `toRoom`.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', stay)::text, true);
  select count(*) into n from public.rooms where id = mine;
  perform set_config('role', orig, true);
  insert into check_result values (
    'the canceled room is still visible to who joined it', n = 1, n::text, '1', null);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', stay)::text, true);
  select count(*) into n from public.profiles where id = gone;
  perform set_config('role', orig, true);
  insert into check_result values (
    'the tombstone is still readable, so the room can render', n = 1, n::text, '1', null);
end $$;

-- Exercise the counter values, not merely whether the RPC returned a row.
do $$
declare
  orig text := session_user;
  who uuid := '11111111-1111-4111-8111-000000000002';
  lookup_ok boolean;
  autocomplete_ok boolean;
  lookup_denied boolean;
  autocomplete_denied boolean;
begin
  insert into private.place_lookups(profile_id, day, n, autocomplete_n)
  values (who, current_date, 59, 299);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', who)::text, true);
  lookup_ok := public.spend_place_lookup();
  autocomplete_ok := public.spend_place_autocomplete();
  lookup_denied := not public.spend_place_lookup();
  autocomplete_denied := not public.spend_place_autocomplete();
  perform set_config('role', orig, true);
  insert into check_result values
    ('last Places detail allowance is usable', lookup_ok, lookup_ok::text, 'true', null),
    ('last autocomplete allowance is usable', autocomplete_ok, autocomplete_ok::text, 'true', null),
    ('Places details stop at 60 per day', lookup_denied, lookup_denied::text, 'true', null),
    ('autocomplete stops at 300 per day', autocomplete_denied, autocomplete_denied::text, 'true', null);
  delete from auth.users where id = who;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', who)::text, true);
  lookup_denied := not public.spend_place_lookup();
  autocomplete_denied := not public.spend_place_autocomplete();
  perform set_config('role', orig, true);
  insert into check_result values
    ('deleted accounts cannot spend Places quota', lookup_denied and autocomplete_denied,
     (lookup_denied and autocomplete_denied)::text, 'true', null);
end $$;

select test, ok, got, expected, detail from check_result order by ok, test;

-- The table above is for reading; this is for exit codes. Run under
-- `psql -v ON_ERROR_STOP=1` and a failure leaves psql non-zero, which is what
-- lets CI gate on this file instead of somebody eyeballing the `ok` column.
-- Raising aborts the transaction, which is the rollback this was going to do.
do $$
declare
  bad int;
  all_of int;
begin
  select count(*) filter (where ok is not true), count(*) into bad, all_of from check_result;
  if bad > 0 then
    raise exception '% of % policy checks failed', bad, all_of;
  end if;
end $$;

rollback;
