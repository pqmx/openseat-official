-- Three things that were already not what they looked like.

-- ---------------------------------------------------------------- casual
--
-- `room_pins_select` hid exact coordinates unless `not r.casual`, and `casual`
-- has no INSERT grant, no UPDATE grant, and no line in `create_room` that sets
-- it. It is `false` on every row that can exist, so the clause has always been
-- `true` and every student who can see a room has always been able to read its
-- exact pin. `data.ts` and `Discover.tsx` describe the feature as live; nothing
-- has ever been able to turn it on.
--
-- Dropping it changes no behaviour — that is the point, and the reason it is
-- safe. A privacy control nobody can set is not a privacy control, it is a
-- comment claiming one, and the comment is what makes it dangerous: the next
-- person to read `room_pins_select` believes exact pins are already protected.
--
-- If hiding the door from non-members is wanted, it comes back as an argument
-- to `create_room`, which is the only writer of `rooms` now. It does not come
-- back as a column with a grant.

drop policy room_pins_select on public.room_pins;

-- What the policy always evaluated to. The subselect stays: it reads `rooms`
-- through the caller's own RLS, so a room you can't see yields no row and the
-- pin hides with it. That direction is fail-closed, which is why this one may
-- read the row it gates on and `private.can_see_room` may not.
create policy room_pins_select on public.room_pins for select to authenticated
  using (exists (select 1 from public.rooms r where r.id = room_pins.room_id));

alter table public.rooms drop column casual;

-- ---------------------------------------------------------------- blocks
--
-- `reports` had no uniqueness anywhere, so one student could insert unlimited
-- rows against arbitrary profile ids — the table, and `private.report_queue`
-- with it, flooded by a loop. A block in particular is idempotent by nature:
-- blocking the same person twice is the same state, and `private.blocked_with`
-- reads `exists`, so a second row was never anything but a second row.
--
-- Partial, on `blocked`, so it bounds the block list without touching reports.
-- Two reports about the same person are two things a human needs to read; two
-- blocks are one fact. `unblock` sets `blocked = false`, which drops the row out
-- of the index and lets the pair be blocked again later.
create unique index reports_one_block_per_pair
  on public.reports (reporter_id, profile_id) where blocked;

-- ---------------------------------------------------------------- stale FKs
--
-- The baseline says of these two: "Both of these are dropped by 20260811000100".
-- They were not — that migration drops `profiles_id_fkey` and stops. They are
-- still on the table, and `reports_reporter_id_fkey` is still ON DELETE CASCADE
-- to `profiles`.
--
-- Inert today, because `delete_me()` tombstones a profile rather than deleting
-- it and nothing else deletes one. Live as a trap: the first `delete from
-- profiles` anyone writes takes every report that person filed with it and
-- silently unblocks both directions — which is the exact bug 20260811000100 was
-- written to fix, waiting behind the comment that says it already was.
alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports drop constraint reports_profile_id_fkey;
