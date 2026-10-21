-- Run after v3 in SQL Editor. Temporary test accounts/data roll back. No emails.
begin;
select set_config('via_test.owner',gen_random_uuid()::text,true);
select set_config('via_test.other',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role,created_at,updated_at) values
 (current_setting('via_test.owner')::uuid,current_setting('via_test.owner')||'@example.invalid','authenticated','authenticated',now(),now()),
 (current_setting('via_test.other')::uuid,current_setting('via_test.other')||'@example.invalid','authenticated','authenticated',now(),now());
select set_config('via_test.answers','{"interest_ids":["g9-interest-1"],"personality_ids":["g9-personality-1"],"school_subject_ids":["subject-1"],"school_subjects_unknown":false,"future_interest_ids":["g9-future_interest-1"],"future_exploring":false,"school_name":"Test school","academic_year":2026,"report_grade":9,"report_type":"term_1","results":[{"subject_id":"subject-1","mark":64}],"report_id":null}',true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('via_test.owner'),'role','authenticated')::text,true);
do $$
declare saved public.via_onboarding; original_answers jsonb; original_academic uuid;
begin
 saved:=public.set_my_education_stage('grade_9',0);
 if saved.flow_version<>3 or (select education_stage from public.via_profiles where id=auth.uid())<>'grade_9' then raise exception 'FAIL: canonical stage'; end if;
 original_answers:=saved.answers;
 saved:=public.save_my_adaptive_onboarding('grade_9',current_setting('via_test.answers')::jsonb,'future-curiosity',array['welcome','current','interests','personality','results','school-subjects'],array[]::text[],saved.revision,false);
 original_academic:=saved.academic_record_id;
 if (select count(*) from public.via_learner_selections)<>4 or (select mark from public.via_academic_results where record_id=original_academic)<>64 then raise exception 'FAIL: structured save'; end if;
 begin
  perform public.save_my_adaptive_onboarding('grade_9',current_setting('via_test.answers')::jsonb,'results','{}','{}',0,false);
  raise exception 'FAIL: stale revision accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.save_my_adaptive_onboarding('grade_9',jsonb_set(current_setting('via_test.answers')::jsonb,'{results,0,mark}','101'),'results','{}','{}',saved.revision,false);
  raise exception 'FAIL: invalid mark accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_my_adaptive_onboarding('grade_9',current_setting('via_test.answers')::jsonb||'{"institution_type_ids":[]}', 'results','{}','{}',saved.revision,false);
  raise exception 'FAIL: hidden answers accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_my_adaptive_onboarding('grade_9',current_setting('via_test.answers')::jsonb,'preferences','{}','{}',saved.revision,false);
  raise exception 'FAIL: Grade 9 university step accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_my_adaptive_onboarding('grade_9',jsonb_set(current_setting('via_test.answers')::jsonb,'{report_id}',to_jsonb(gen_random_uuid()::text)),'results','{}','{}',saved.revision,false);
  raise exception 'FAIL: missing report accepted';
 exception when invalid_parameter_value then null; end;
 saved:=public.save_my_adaptive_onboarding('grade_9',current_setting('via_test.answers')::jsonb,'building',array['welcome','current','interests','personality','results','school-subjects','future-curiosity'],'{}',saved.revision,true);
 if saved.completed_at is null or not exists(select 1 from public.via_onboarding_history where reason='completion' and snapshot->>'completed_at' is not null) then raise exception 'FAIL: completion history'; end if;
 saved:=public.set_my_education_stage('grade_11',saved.revision);
 if saved.completed_at is not null or saved.academic_record_id is not null then raise exception 'FAIL: stage isolation'; end if;
 begin
  perform public.save_my_adaptive_onboarding('grade_11','{}','building','{}','{}',saved.revision,true);
  raise exception 'FAIL: unimplemented branch completed';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_my_onboarding('{}','current',saved.revision,false);
  raise exception 'FAIL: old tab overwrote adaptive answers';
 exception when serialization_failure then null; end;
 saved:=public.set_my_education_stage('grade_9',saved.revision);
 if saved.academic_record_id<>original_academic or saved.answers<>original_answers then raise exception 'FAIL: history/legacy preservation'; end if;
 begin
  update public.via_profiles set education_stage='graduate' where id=auth.uid();
  raise exception 'FAIL: direct stage update allowed';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.via_learner_selections;
  raise exception 'FAIL: direct selections write allowed';
 exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('via_test.other'),'role','authenticated')::text,true);
do $$
declare saved public.via_onboarding;
begin
 if exists(select 1 from public.via_learner_selections) or exists(select 1 from public.via_academic_records) or exists(select 1 from public.via_academic_results) or exists(select 1 from public.via_onboarding_history) then raise exception 'FAIL: cross-user access'; end if;
 saved:=public.set_my_education_stage('grade_9',0);
 saved:=public.save_my_adaptive_onboarding('grade_9','{"interest_ids":[],"personality_ids":[],"school_subject_ids":[],"school_subjects_unknown":false,"future_interest_ids":[],"future_exploring":false,"school_name":"","academic_year":null,"report_grade":null,"report_type":null,"results":[],"report_id":null}','building',array['welcome','current'],array['interests','personality','results','school-subjects','future-curiosity'],saved.revision,true);
 if saved.completed_at is null then raise exception 'FAIL: optional steps blocked completion'; end if;
end;
$$;
set local role anon;
do $$ begin
 begin
  perform public.set_my_education_stage('grade_9',0);
  raise exception 'FAIL: anonymous stage save';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
select 'PASS: adaptive saves, optional completion, validation, stage isolation, legacy preservation, revision conflicts, owner policies and anonymous denial' as result;
