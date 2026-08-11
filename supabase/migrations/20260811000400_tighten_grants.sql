-- Grants the schema had been carrying since `grant all`, which nothing in the app
-- ever needed.
--
-- TRUNCATE is the one that matters. It is not subject to row level security at
-- all — a policy cannot refuse it — so `truncate public.rooms` would have emptied
-- the app for everyone. The only thing standing in front of it was that PostgREST
-- has no way to say TRUNCATE, which is protection by API surface, not by policy,
-- and this codebase's whole claim is that every write is a policy.
revoke truncate, references, trigger
  on public.profiles, public.rooms, public.room_pins,
     public.room_members, public.room_updates, public.reports
  from authenticated;

-- DELETE was granted on all six, but only `room_members` has a delete policy, so
-- the other five were grants for a statement that could never match a row. A
-- grant nobody can use is a grant waiting for a policy to be added carelessly.
revoke delete
  on public.profiles, public.rooms, public.room_pins,
     public.room_updates, public.reports
  from authenticated;

-- INSERT by column, never by table — the rule everything else here already
-- follows, applied to the two tables that were still granted wholesale. A table
-- level INSERT makes every column writable, `id` and `created_at` included, and a
-- column level REVOKE on top of it is a silent no-op.
revoke insert on public.rooms, public.room_pins from authenticated;

grant insert(title, place, host_id, starts_at, capacity, access, years,
             approx_lat, approx_lng)
  on public.rooms to authenticated;

grant insert(room_id, lat, lng) on public.room_pins to authenticated;
