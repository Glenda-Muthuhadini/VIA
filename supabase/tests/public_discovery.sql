-- Run after v4 or the corrected v6 expansion. Temporary users/data roll back. No emails.
begin;
select set_config('via_test.owner',gen_random_uuid()::text,true);
select set_config('via_test.other',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role,created_at,updated_at) values
 (current_setting('via_test.owner')::uuid,current_setting('via_test.owner')||'@example.invalid','authenticated','authenticated',now(),now()),
 (current_setting('via_test.other')::uuid,current_setting('via_test.other')||'@example.invalid','authenticated','authenticated',now(),now());
insert into public.via_opportunities(id,kind,slug,title,overview,source_url,source_name,last_verified_at,published) values
 ('99999999-0000-4000-8000-000000000001','institutions','unpublished-test-'||current_setting('via_test.owner'),'Unpublished test','Must remain private','https://example.invalid/','Test',now(),false);
insert into public.via_institutions(id,institution_type) values('99999999-0000-4000-8000-000000000001','University');
set local role anon;
do $$ declare result jsonb; begin
 result:=public.search_public_opportunities('institutions','', '{}',1,2);
 if jsonb_array_length(result->'items')>2 or (result->>'total')::integer<4 then raise exception 'FAIL: public pagination'; end if;
 result:=public.search_public_opportunities('institutions','Unpublished test');
 if (result->>'total')::integer<>0 or exists(select 1 from public.via_institutions where id='99999999-0000-4000-8000-000000000001') then raise exception 'FAIL: unpublished data exposed'; end if;
 result:=public.search_public_opportunities('programmes','',jsonb_build_object('institution','10000000-0000-4000-8000-000000000001'));
 if (result->>'total')::integer<>1 then raise exception 'FAIL: institution programme relationship'; end if;
 result:=public.search_public_opportunities('programmes','', '{"aps_max":"35"}');
 if (result->>'total')::integer<>(select count(*) from public.via_programmes where minimum_aps<=35) or exists(select 1 from jsonb_array_elements(result->'items') r where r->>'minimum_aps' is null) then raise exception 'FAIL: unknown APS treated as zero'; end if;
 result:=public.search_public_opportunities('accommodation','', '{"nsfas":"true"}');
 if (result->>'total')::integer<>0 then raise exception 'FAIL: unverified funding compatibility'; end if;
 result:=public.search_public_opportunities('accommodation','', '{"price_max":"5200"}');
 if (result->>'total')::integer<>1 then raise exception 'FAIL: price filtering'; end if;
 result:=public.search_public_opportunities('programmes','', '{}',2,2);
 if jsonb_array_length(result->'items')<>2 then raise exception 'FAIL: second page'; end if;
 begin
  perform public.search_public_opportunities('programmes','', '{"aps_max":"0); DROP TABLE x"}');
  raise exception 'FAIL: invalid filter accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.search_public_opportunities('programmes','', '{}',1,10000);
  raise exception 'FAIL: unbounded page accepted';
 exception when invalid_parameter_value then null; end;
 begin
  insert into public.via_saved_opportunities(user_id,opportunity_id) values(current_setting('via_test.owner')::uuid,'10000000-0000-4000-8000-000000000001');
  raise exception 'FAIL: anonymous save';
 exception when insufficient_privilege then null; end;
end; $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('via_test.owner'),'role','authenticated')::text,true);
do $$ begin
 insert into public.via_saved_opportunities(user_id,opportunity_id) values(auth.uid(),'20000000-0000-4000-8000-000000000001');
 insert into public.via_saved_opportunities(user_id,opportunity_id) values(auth.uid(),'20000000-0000-4000-8000-000000000001') on conflict do nothing;
 if (select count(*) from public.via_saved_opportunities)<>1 then raise exception 'FAIL: owner save/idempotency'; end if;
 begin
  insert into public.via_saved_opportunities(user_id,opportunity_id) values(current_setting('via_test.other')::uuid,'20000000-0000-4000-8000-000000000001');
  raise exception 'FAIL: cross-owner save';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.via_saved_opportunities(user_id,opportunity_id) values(auth.uid(),'99999999-0000-4000-8000-000000000001');
  raise exception 'FAIL: unpublished opportunity saved';
 exception when insufficient_privilege then null; end;
 begin
  update public.via_opportunities set published=true;
  raise exception 'FAIL: catalogue editing granted';
 exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('via_test.other'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.via_saved_opportunities) then raise exception 'FAIL: another user saves visible'; end if;
 delete from public.via_saved_opportunities where user_id=current_setting('via_test.owner')::uuid;
end; $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('via_test.owner'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.via_saved_opportunities)<>1 then raise exception 'FAIL: cross-user delete'; end if;
 delete from public.via_saved_opportunities where user_id=auth.uid();
 if exists(select 1 from public.via_saved_opportunities) then raise exception 'FAIL: unsave'; end if;
end; $$;
reset role;
rollback;
select 'PASS: public browsing, bounded search, filters, unpublished isolation, private saves, owner isolation and unsave' as result;
