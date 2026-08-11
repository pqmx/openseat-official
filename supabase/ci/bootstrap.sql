-- The bit of Supabase the migrations assume but don't own: three roles, a users
-- table, and `auth.uid()`. Enough to replay `supabase/migrations/` on a stock
-- Postgres so `policies.check.sql` can run in CI, and nothing more — this is not
-- a copy of Supabase's auth schema and must never be applied to the real project.
--
-- `auth.uid()` reads `request.jwt.claims` exactly the way the hosted one does,
-- because that is the handle `policies.check.sql` already turns to become a
-- signed-in student:
--
--   set_config('role', 'authenticated', true);
--   set_config('request.jwt.claims', '{"sub":"..."}', true);

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Only the columns this app actually reads. `email` and `raw_user_meta_data` are
-- what `handle_new_user()` gates and names people from; `id` is what every
-- policy compares against.
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), '')::uuid;
$$;

create or replace function auth.role() returns text
  language sql stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
$$;

grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid(), auth.role() to public;
