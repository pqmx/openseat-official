-- `revoke from public` was never what kept `anon` out.
--
-- The rule in CLAUDE.md — "Postgres grants EXECUTE to PUBLIC on every new
-- function, so revoke from public, then grant to authenticated by name" — is
-- true and insufficient, and every function added since has been shipping with
-- an `anon` grant nobody asked for. Supabase sets
--
--   alter default privileges in schema public
--     grant all on tables to anon, authenticated, service_role;
--   alter default privileges in schema public
--     grant execute on functions to anon, authenticated, service_role;
--
-- so `anon` is granted *by name*, separately from PUBLIC, the moment an object
-- is created. Revoking PUBLIC leaves it untouched. The existing tables and
-- helpers look clean only because each one was revoked by hand afterwards.
--
-- Nothing leaked: `delete_me` and `my_blocks` return early on a null
-- `auth.uid()` and `spend_place_lookup` returns false, so an anonymous call did
-- nothing. They were still three unauthenticated endpoints on a project whose
-- premise is that there is no signed-out surface at all.
--
-- CI cannot catch this: `supabase/ci/bootstrap.sql` is a stock Postgres with no
-- default privileges, so a fresh replay grants `anon` nothing either way. The
-- linter is what catches it — `get_advisors(type: 'security')`.

-- The three added today.
revoke execute on function
  public.delete_me(), public.my_blocks(), public.spend_place_lookup()
  from anon;

-- And the default, so the next `create` doesn't reintroduce it. This only
-- affects objects created by `postgres`, which is the role migrations run as;
-- the identical defaults owned by `supabase_admin` belong to the platform and
-- can't be altered from here.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;
