-- Isolated fixtures; run after migrations alongside policies.check.sql.
begin;
do $$
declare
  host uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  viewer uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  hidden uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  target uuid := md5('launch-active-1')::uuid;
  expired uuid := md5('launch-active-2')::uuid;
  cursor_at timestamptz;
  cursor_id uuid;
  page jsonb[];
  item jsonb;
  seen uuid[] := '{}';
  n integer;
  rejected boolean;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (host,'launch-host@ucla.edu','{"full_name":"Launch Host"}'),
    (viewer,'launch-viewer@ucla.edu','{"full_name":"Launch Viewer"}'),
    (hidden,'launch-hidden@ucla.edu','{"full_name":"Hidden Host"}');
  update public.profiles set year = '''30' where id in (host, viewer, hidden);

  insert into public.rooms(id,title,place,host_id,starts_at,capacity,access,approx_lat,approx_lng)
    select md5('launch-old-' || i)::uuid,'Old room','Campus',host,now()-interval '7 days',10,'open',34.07,-118.44
    from generate_series(1,240) i;
  insert into public.rooms(id,title,place,host_id,starts_at,capacity,access,approx_lat,approx_lng)
    select md5('launch-active-' || i)::uuid,'Active room','Campus',host,
      now()-interval '30 minutes'+ (i/3)*interval '1 second',10,'approve',34.07,-118.44
    from generate_series(1,85) i;
  insert into public.room_members(room_id,profile_id,state)
    select md5('launch-active-' || i)::uuid,host,'member' from generate_series(1,85) i;
  insert into public.room_members(room_id,profile_id,state) values(target,viewer,'requested');
  insert into public.room_pins(room_id,lat,lng) values(target,34.0701,-118.4401);
  insert into public.rooms(id,title,place,host_id,starts_at,capacity,access,years,approx_lat,approx_lng)
    values(hidden,'Other year','Campus',hidden,now(),10,'open',array['Grad'],34.07,-118.44);
  insert into public.room_members(room_id,profile_id,state) values(hidden,hidden,'member');

  if exists(select 1 from public.rooms where host_id=host and ends_at <> starts_at+interval '4 hours') then
    raise exception 'duration is not four hours';
  end if;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',viewer)::text,true);

  loop
    select array_agg(value) into page from public.room_summary_page(
      p_scope=>'discover',p_cursor_at=>cursor_at,p_cursor_id=>cursor_id,p_limit=>40) value;
    exit when page is null;
    foreach item in array page loop
      if (item->>'id')::uuid = any(seen) then raise exception 'duplicate room across pages'; end if;
      if item ? 'updates' or jsonb_array_length(item->'members') > 3 then raise exception 'summary payload unbounded'; end if;
      if (item->'host') ? 'prompts' or (item->'host') ? 'interests' then raise exception 'summary leaks profile detail'; end if;
      seen := array_append(seen,(item->>'id')::uuid);
    end loop;
    cursor_at := (item->>'starts_at')::timestamptz;
    cursor_id := (item->>'id')::uuid;
  end loop;
  if cardinality(seen) <> 85 then raise exception 'pagination lost active rooms: %',cardinality(seen); end if;
  if hidden = any(seen) then raise exception 'summary bypasses year RLS'; end if;
  select count(*) into n from public.room_summary_page(p_scope=>'host',p_host=>host,p_limit=>41) value;
  if n<>41 then raise exception 'host summary pagination incorrect'; end if;
  if exists(select 1 from public.room_summary_page(p_scope=>'host',p_host=>host) value
    where (value->>'ends_at')::timestamptz<=now()) then raise exception 'host page wasted on expired rooms'; end if;
  select count(*) into n from public.room_summary_page(p_scope=>'discover',p_window=>'Tonight',p_before=>now()-interval '1 hour') value;
  if n<>0 then raise exception 'time window ignored'; end if;

  select count(*) into n from public.room_summary_page(p_scope=>'mine') value
    where value->>'id'=target::text and value->>'viewer_state'='requested';
  if n<>1 then raise exception 'pending request missing from personal rooms'; end if;
  select count(*) into n from public.room_pins where room_id=target;
  if n<>1 then raise exception 'preapproval location visibility unexpectedly changed'; end if;

  update public.rooms set ended_at=now() where id=target;
  get diagnostics n = row_count;
  if n<>0 then raise exception 'nonhost ended room'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',host)::text,true);
  update public.rooms set ended_at=now() where id=target;
  get diagnostics n = row_count;
  if n<>1 then raise exception 'approve-room host cannot end room'; end if;
  rejected := false;
  begin
    update public.rooms set ended_at=null where id=target;
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'ended room reopened'; end if;
  rejected := false;
  begin
    update public.room_members set state='member' where room_id=target and profile_id=viewer;
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'approved request after room ended'; end if;
  rejected := false;
  begin
    insert into public.room_updates(room_id,author_id,body) values(target,host,'late update');
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'posted after room ended'; end if;
  -- Detail reads still find an ended room even though it is absent from Discover.
  if not exists(select 1 from public.rooms where id=target) then raise exception 'ended detail disappeared'; end if;

  perform set_config('role',session_user,true);
  update public.rooms set starts_at=now()-interval '5 hours',ends_at=now()-interval '1 hour' where id=expired;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',viewer)::text,true);
  rejected:=false;
  begin
    insert into public.room_members(room_id,profile_id,state) values(expired,viewer,'requested');
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'requested an expired room'; end if;
  delete from public.room_members where room_id=target and profile_id=viewer;
  get diagnostics n = row_count;
  if n<>1 then raise exception 'cannot withdraw pending request'; end if;

  perform set_config('role',session_user,true);
  delete from auth.users where id=viewer;
  perform set_config('role','authenticated',true);
  select count(*) into n from public.room_summary_page();
  if n<>0 then raise exception 'deleted-account token can read summary'; end if;
  perform set_config('role','anon',true);
  rejected:=false;
  begin perform public.room_summary_page(); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'anonymous summary access'; end if;
  perform set_config('role',session_user,true);
  raise notice 'Launch checks passed: pagination, payload bounds, RLS, pending, ending, expiry, withdrawal, deleted and anonymous access';
end;
$$;
rollback;
