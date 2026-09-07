-- A name nobody chose was the claim. It was true for Google and false for Apple.
--
-- `on_auth_user_meta_updated` fired `handle_new_user()` on any change to
-- `raw_user_meta_data` — and `supabase.auth.updateUser({ data: { full_name } })`
-- is a client call with a client payload. The guard
--
--   where public.profiles.name = split_part(new.email, '@', 1)
--
-- only holds while the profile still carries the email's local part, and Apple
-- sends no name, so every Apple account starts in exactly that state. Sign in as
-- `jsmith@ucla.edu`, call `updateUser` with `full_name: 'Maya Jones'`, and the
-- roster credits a room to a student who doesn't exist. Once, per account, with
-- an arbitrary string — which is once more than a roster can survive in an app
-- whose whole purpose is meeting a stranger somewhere in person.
--
-- The backfill can't be fixed, only bounded, because Apple's sign-in sheet lets
-- the user *edit* the name before submitting it. There was never a verified name
-- on that path to protect. So it goes, and Apple accounts keep the email's local
-- part — which UCLA assigned and nobody chose, the only version of the claim
-- that was ever true.

drop trigger if exists on_auth_user_meta_updated on auth.users;

-- The lengths that were never there. `rooms_title_len`, `reports_reason_len`,
-- `profiles_interests_sane` — every other free-text column on this schema is
-- bounded, and the three that appear on every roster row were not. Google's
-- payload is not this app's to bound either, so this holds for the insert path
-- that remains.
alter table public.profiles add constraint profiles_name_len check (length(name) <= 40);
alter table public.profiles add constraint profiles_short_len check (length(short) <= 20);
alter table public.profiles add constraint profiles_initials_len check (length(initials) <= 4);

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
  -- Clamped here rather than checked, because the constraints above are the
  -- floor and a provider sending a long name must not fail the signup. Twenty
  -- characters of the first token bounds all three columns at once: `short` is
  -- this, `name` is this plus two, `initials` is two.
  first_part := left(parts[1], 20);
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
  -- Was `do update ... where name = the email's local part`, which existed only
  -- to let the dropped trigger backfill Apple's name. Nothing reaches this now:
  -- GoTrue mints a fresh uuid per signup, so a returning student gets a new row
  -- rather than their tombstone. Leaving an existing row alone is the safe half
  -- of what it used to do, and all of what it still needs to do.
  on conflict (id) do nothing;

  return new;
end;
$function$;
