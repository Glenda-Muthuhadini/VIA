-- Development SQL Editor test. Temporary test users/answers roll back; no emails.
begin;
select set_config('via_test.owner', gen_random_uuid()::text, true);
select set_config('via_test.other', gen_random_uuid()::text, true);
insert into auth.users(id,email,aud,role,created_at,updated_at) values
  (current_setting('via_test.owner')::uuid,current_setting('via_test.owner')||'@example.invalid','authenticated','authenticated',now(),now()),
  (current_setting('via_test.other')::uuid,current_setting('via_test.other')||'@example.invalid','authenticated','authenticated',now(),now());
select set_config('via_test.answers', '{"current_id":"current-2","interest_ids":["interest-2"],"personality_ids":["personality-1"],"goal_ids":["study_goal-1"],"preference_ids":[],"institution_type_ids":["institution_type-1"],"location_mode":"anywhere","province_ids":[],"school_name":"Test school","academic_year":2026,"results":[{"subject_id":"subject-1","mark":64}],"report_id":null}', true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('via_test.owner'),'role','authenticated')::text,true);
do $$
declare saved public.via_onboarding;
begin
  saved := public.save_my_onboarding(current_setting('via_test.answers')::jsonb,'interests',0,false);
  if saved.revision <> 1 or saved.user_id <> auth.uid() or saved.completed_at is not null then raise exception 'FAIL: draft save'; end if;
  begin
    perform public.save_my_onboarding(current_setting('via_test.answers')::jsonb,'interests',0,false);
    raise exception 'FAIL: stale save accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_my_onboarding(jsonb_set(current_setting('via_test.answers')::jsonb,'{current_id}','"Other"'),'interests',1,false);
    raise exception 'FAIL: removed option accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_my_onboarding(jsonb_set(current_setting('via_test.answers')::jsonb,'{results,0,mark}','101'),'interests',1,false);
    raise exception 'FAIL: invalid mark accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_my_onboarding(jsonb_set(current_setting('via_test.answers')::jsonb,'{goal_ids}','[]'),'building',1,true);
    raise exception 'FAIL: incomplete answers completed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_my_onboarding(jsonb_set(current_setting('via_test.answers')::jsonb,'{report_id}',to_jsonb(gen_random_uuid()::text)),'interests',1,false);
    raise exception 'FAIL: foreign/missing report accepted';
  exception when invalid_parameter_value then null; end;
  saved := public.save_my_onboarding(current_setting('via_test.answers')::jsonb,'building',1,true);
  if saved.revision <> 2 or saved.completed_at is null then raise exception 'FAIL: completion'; end if;
  if (select count(*) from public.via_onboarding) <> 1 then raise exception 'FAIL: owner read'; end if;
  begin
    update public.via_onboarding set completed_at = now();
    raise exception 'FAIL: direct write allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('via_test.other'),'role','authenticated')::text,true);
do $$
begin
  if exists(select 1 from public.via_onboarding) then raise exception 'FAIL: another user answers visible'; end if;
  perform public.save_my_onboarding(current_setting('via_test.answers')::jsonb,'current',0,false);
  if exists(select 1 from public.via_onboarding where user_id <> auth.uid()) then raise exception 'FAIL: cross-user access'; end if;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform public.save_my_onboarding('{}','current',0,false);
    raise exception 'FAIL: anonymous save allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
select 'PASS: draft, revision conflicts, validation, completion, owner isolation and anonymous denial' as result;
