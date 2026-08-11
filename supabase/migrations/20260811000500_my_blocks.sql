-- The blocked list can't be a select.
--
-- `profiles_select` reaches a stranger only through `private.shares_room`, and
-- `private.can_see_room` refuses anything involving someone you've blocked — so
-- blocking a person is exactly what makes their profile unreadable to you. Ask
-- PostgREST to embed `reports -> profiles` and every blocked row comes back with
-- a null profile, which is a screen listing "someone, on 3 August" and an Unblock
-- button next to it.
--
-- So this is a definer function, and it is narrow on purpose: it returns the
-- three columns a row needs to render, for rows you filed, and nothing else.
create or replace function public.my_blocks()
  returns table (report_id uuid, profile_id uuid, name text, initials text, tone text, at timestamptz)
  language sql
  stable
  security definer
  set search_path to ''
as $function$
  select r.id, p.id, p.name, p.initials, p.tone, r.created_at
    from public.reports r
    join public.profiles p on p.id = r.profile_id
   where r.reporter_id = (select auth.uid())
     and r.blocked
   order by r.created_at desc;
$function$;

revoke all on function public.my_blocks() from public;
grant execute on function public.my_blocks() to authenticated;
