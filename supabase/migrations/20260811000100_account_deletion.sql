-- Account deletion. Apple requires it before review, and there was no way to do
-- it at all.
--
-- The whole design is forced by one fact: `rooms.host_id -> profiles -> auth.users`
-- was CASCADE the entire way down, so deleting the login deleted the person's
-- rooms, everyone's membership of them, and every report they had ever filed —
-- which silently unblocked anyone they had blocked, in both directions, because
-- `private.blocked_with` reads those rows. Someone who joined a room starting in
-- an hour would have watched it vanish with no explanation.
--
-- So a profile now outlives its login. `delete_me()` removes the account and
-- scrubs the row to a tombstone; the room stays and reads as called off, which is
-- the thing an attendee actually needs to know. No personal data survives it: the
-- name is gone, the year, major, interests and prompts are gone, and the login is
-- gone. What is left is "someone opened this room and called it off".

-- A profile is no longer a shadow of an auth user; it is the record a roster
-- points at, and it has to be able to outlive the login it started from.
alter table public.profiles drop constraint profiles_id_fkey;

-- The tombstone must stay *selectable*, or `api.ts` breaks on the room it hosts:
-- `profiles_select` reaches a stranger through `private.shares_room`, which reads
-- `room_members`. That is why the host's own membership row is the one membership
-- deletion below deliberately leaves alone — take it away and `toRoom` gets a null
-- host for a room it can still see.
create or replace function public.delete_me()
  returns void
  language plpgsql
  security definer
  set search_path to ''
as $function$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;

  -- Rooms you host end rather than disappear, so the people who joined find out.
  update public.rooms
     set canceled_at = coalesce(canceled_at, now())
   where host_id = me;

  -- Your own posts are your words; the rooms holding them are called off anyway.
  delete from public.room_updates where author_id = me;

  -- Off everyone else's roster. The rooms you host keep your membership — see
  -- the note above about `shares_room`.
  delete from public.room_members
   where profile_id = me
     and room_id not in (select id from public.rooms where host_id = me);

  update public.profiles
     set name = 'Former student',
         short = 'Former',
         initials = '--',
         year = null,
         major = null,
         tone = null,
         interests = '{}',
         prompts = '[]'
   where id = me;

  -- Reports you filed are left standing on purpose. They are the block, and the
  -- block protects the other person as much as you — deleting your account must
  -- not quietly make you visible to someone who blocked you, or them to you.
  delete from auth.users where id = me;
end;
$function$;

-- Postgres hands EXECUTE to PUBLIC on every new function, which would make this
-- an `anon` endpoint that deletes accounts.
revoke all on function public.delete_me() from public;
grant execute on function public.delete_me() to authenticated;
