-- Apply after v13. All fixtures, including auth users, roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('76000000-0000-4000-8000-000000000001','grade9-plan-a@example.invalid','{}'),
 ('76000000-0000-4000-8000-000000000002','grade9-plan-b@example.invalid','{}'),
 ('76000000-0000-4000-8000-000000000003','grade10-plan@example.invalid','{}');
update public.via_profiles set education_stage='grade_9',education_stage_confirmation_required=false
 where id in ('76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002');
update public.via_profiles set education_stage='grade_10',education_stage_confirmation_required=false where id='76000000-0000-4000-8000-000000000003';
insert into public.via_grade9_onboarding(user_id,subjects_considering) values
 ('76000000-0000-4000-8000-000000000001',array['subject-17','subject-24']);
insert into public.via_academic_records(id,user_id,education_stage,school_name,academic_year,grade,report_type)
 values('76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000001','grade_9','Fixture school',2026,9,'term_2');
insert into public.via_academic_results(record_id,user_id,subject_id,mark)
 values('76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000001','subject-1',64);
select set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare p public.via_grade9_plans; academic_count integer; old_subjects text[];
begin
 if has_function_privilege('anon','public.save_my_grade9_plan(jsonb,bigint)','execute')
  or has_function_privilege('anon','via_grade9_private.save_plan(jsonb,bigint)','execute') then raise exception 'Anonymous plan writes allowed';end if;
 if has_table_privilege('authenticated','public.via_grade9_plans','insert') or has_table_privilege('authenticated','public.via_grade9_plans','update') then raise exception 'Direct plan writes allowed';end if;
 select count(*) into academic_count from public.via_academic_records where user_id=auth.uid();
 select subjects_considering into old_subjects from public.via_grade9_onboarding where user_id=auth.uid();
 p:=public.save_my_grade9_plan('{"maths_reviewed":true,"algebra_feeling":"It''s okay","dream_areas":"Engineering"}',0);
 if p.shortlisted_subject_ids<>old_subjects or p.revision<>1 or p.reviewed_results or p.plan_reviewed then raise exception 'Initial onboarding shortlist lost or fake completion';end if;
 p:=public.save_my_grade9_plan('{"reviewed_results":true,"reviewed_results_key":"actual-report-fixture","explored_subject_ids":["subject-17"],"explored_pathway_ids":["engineering"],"plan_reviewed":true}',p.revision);
 if not p.reviewed_results or not p.plan_reviewed or p.explored_pathway_ids<>array['engineering'] then raise exception 'Real actions failed to persist';end if;
 if (select revision from public.via_grade9_plans where user_id=auth.uid())<>p.revision then raise exception 'Owner reload failed';end if;
 begin
  perform public.save_my_grade9_plan('{}',p.revision-1);raise exception 'Stale revision accepted';
 exception when serialization_failure then null;end;
 p:=public.save_my_grade9_plan('{"shortlisted_subject_ids":["subject-18"],"plan_reviewed":true}',p.revision);
 if p.plan_reviewed then raise exception 'Changed subject plan retained review';end if;
 begin
  perform public.save_my_grade9_plan('{"shortlisted_subject_ids":["subject-g9-1"]}',p.revision);raise exception 'Grade 9 subject accepted as Grade 10 choice';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.save_my_grade9_plan('{"shortlisted_subject_ids":["subject-17","subject-17"]}',p.revision);raise exception 'Duplicate choice accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.save_my_grade9_plan('{"shortlisted_subject_ids":["subject-3"]}',p.revision);raise exception 'Compulsory language accepted as elective';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.save_my_grade9_plan('{"explored_subject_ids":["not-in-catalogue"]}',p.revision);raise exception 'Unknown subject accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.save_my_grade9_plan('{"explored_pathway_ids":["made-up-pathway"]}',p.revision);raise exception 'Unknown pathway accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.save_my_grade9_plan('{"reviewed_results":"true"}',p.revision);raise exception 'Wrong JSON type accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.save_my_grade9_plan('{"user_id":"76000000-0000-4000-8000-000000000002"}',p.revision);raise exception 'Ownership assignment accepted';
 exception when invalid_parameter_value then null;end;
 if (select count(*) from public.via_academic_records where user_id=auth.uid())<>academic_count
  or (select subjects_considering from public.via_grade9_onboarding where user_id=auth.uid())<>old_subjects
 then raise exception 'Planning changed academics or onboarding';end if;
end;$$;
reset role;
select set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
declare p public.via_grade9_plans;
begin
 if exists(select 1 from public.via_grade9_plans where user_id<>auth.uid()) then raise exception 'Another learner plan visible';end if;
 begin
  perform public.save_my_grade9_plan('{"reviewed_results":true,"reviewed_results_key":"no-report"}',0);raise exception 'Missing results marked reviewed';
 exception when invalid_parameter_value then null;end;
 p:=public.save_my_grade9_plan('{"shortlisted_subject_ids":["subject-1"]}',0);
 if cardinality(p.explored_subject_ids)<>0 or p.reviewed_results or p.maths_reviewed or p.plan_reviewed then raise exception 'New learner progress fabricated';end if;
 begin
  perform public.save_my_grade9_plan('{"plan_reviewed":true}',p.revision);raise exception 'Unexplored plan marked reviewed';
 exception when invalid_parameter_value then null;end;
end;$$;
reset role;
select set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
 begin
  perform public.save_my_grade9_plan('{}',0);raise exception 'Other education stage wrote Grade 9 plan';
 exception when insufficient_privilege then null;end;
end;$$;
reset role;
select 'PASS: owner-only plans, original shortlist, actual actions, result acknowledgement, stage validation, catalogue validation, revision conflicts and unchanged academics/onboarding' as result;
rollback;
