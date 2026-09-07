-- Payload limits alone do not bound repeated reports or host updates.
create or replace function private.limit_content_writes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  used bigint;
begin
  -- Trusted backend maintenance does not have a user JWT. Client inserts still
  -- require a matching authenticated account under the table policies.
  if me is null then return new; end if;
  perform 1 from auth.users where id = me for no key update;
  if not found then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;
  if tg_table_name = 'reports' then
    select count(*) into used from public.reports
    where reporter_id = me and created_at > now() - interval '1 hour';
    if used >= 20 then
      raise exception 'Too many reports in the last hour.' using errcode = 'check_violation';
    end if;
  else
    select count(*) into used from public.room_updates
    where author_id = me and created_at > now() - interval '1 hour';
    if used >= 120 then
      raise exception 'Too many room updates in the last hour.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.limit_content_writes() from public, anon, authenticated;
create trigger limit_reports before insert on public.reports
for each row execute function private.limit_content_writes();
create trigger limit_room_updates before insert on public.room_updates
for each row execute function private.limit_content_writes();
