-- Run after v11 in a disposable/local DB or SQL Editor; all fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('71000000-0000-4000-8000-000000000001','journey-a@example.invalid','{"first_name":"Journey","last_name":"A"}'),
('71000000-0000-4000-8000-000000000002','journey-b@example.invalid','{"first_name":"Journey","last_name":"B"}');
insert into public.via_onboarding_reports(id,user_id,storage_path,file_name,mime_type,file_size)
values('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002/fixture.pdf','fixture.pdf','application/pdf',10);
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare r public.via_onboarding; a jsonb; j jsonb; stage text; institution text; programme text; subject text; old_answers jsonb; before_count integer;
begin
 if has_function_privilege('anon','public.save_my_journey_onboarding(text,jsonb,text,text[],text[],bigint,boolean)','execute') then raise exception 'Anonymous journey writes allowed'; end if;
 if has_table_privilege('authenticated','public.via_onboarding','update') then raise exception 'Direct onboarding updates allowed'; end if;
 select document->>'institution_id',id::text into institution,programme from public.via_public_opportunities where kind='programmes' and document->>'institution_id' is not null order by id limit 1;
 select id into subject from public.via_onboarding_options where category='subject' and active and education_stages is null order by id limit 1;
 if institution is null or programme is null or subject is null then raise exception 'Catalogue fixtures unavailable'; end if;
 foreach stage in array array['grade_9','grade_10','grade_11','grade_12','post_matric','accepted','tertiary'] loop
  select * into r from public.via_onboarding where user_id=auth.uid();
  r:=public.set_my_education_stage(stage,coalesce(r.revision,0));
  if r.flow_version<>4 then raise exception 'Wrong flow version'; end if;
  if old_answers is not null and r.answers<>old_answers then raise exception 'Legacy answers overwritten'; end if;
  old_answers:=r.answers;
  if stage='grade_10' and jsonb_array_length(r.journey_answers->'results')<>0 then raise exception 'Previous-grade marks reused as current marks'; end if;
  if stage='grade_10' and not('interests'=any(r.carried_steps) and 'career-interests'=any(r.carried_steps)) then raise exception 'Known interests/careers repeated'; end if;
  if stage='tertiary' and not('institution'=any(r.carried_steps) and 'enrolled-programme'=any(r.carried_steps) and 'campus'=any(r.carried_steps)) then raise exception 'Accepted student asked to repeat institution/programme/campus'; end if;
  a:=r.journey_answers||jsonb_build_object('school_subject_ids',jsonb_build_array(subject),'results',jsonb_build_array(jsonb_build_object('subject_id',subject,'mark',62)),'report_grade',case stage when 'grade_9' then 9 when 'grade_10' then 10 when 'grade_11' then 11 else 12 end,'report_type','final','academic_year',2026);
  j:=(a->'journey')||jsonb_build_object('interests',jsonb_build_array('Technology'),'careers',jsonb_build_array('Software developer'),'fields',jsonb_build_array('Technology & Computing'),'programme_ids',jsonb_build_array(programme),'matric_year',2025,'current_activity','Preparing to apply','application_progress',case when stage='post_matric' then 'Yes' else 'I''ve submitted applications' end,'applications',jsonb_build_array(jsonb_build_object('institution_id',institution,'programme','Fixture programme','status','Submitted')),'funding_methods',jsonb_build_array('NSFAS'),'funding_situation','I''m looking for funding','institution_id',institution,'programme_id',programme,'campus','User-confirmed campus','starting_year',2027,'year_of_study','First year','accommodation_status','Not yet','registration_status','Not yet','support',jsonb_build_array('Academic support'));
  a:=a||jsonb_build_object('journey',j);
  r:=public.save_my_journey_onboarding(stage,a,'ready',r.answered_steps,'{}',r.revision,true);
  if r.completed_at is null or r.journey_answers<>a then raise exception 'Branch did not complete or reload exactly: %',stage; end if;
  begin
   perform public.save_my_journey_onboarding(stage,a,'ready',r.answered_steps,'{}',r.revision-1,true);
   raise exception 'Stale revision accepted';
  exception when serialization_failure then null; end;
 end loop;
 a:=jsonb_set(r.journey_answers,'{journey,year_of_study}','"Second year"');
 r:=public.save_my_journey_onboarding('tertiary',a,'year-of-study',r.answered_steps,'{}',r.revision,false);
 if r.completed_at is null or r.journey_answers->'journey'->>'year_of_study'<>'Second year' then raise exception 'Year progression repeated onboarding'; end if;
 if not exists(select 1 from public.via_onboarding_history where user_id=auth.uid() and reason='stage_change' and snapshot->'journey_answers'->'journey'->>'year_of_study'='First year') then raise exception 'Previous student year not preserved'; end if;
 select count(*) into before_count from public.via_academic_records where user_id=auth.uid();
 if before_count<4 then raise exception 'Academic history lost'; end if;
 if not exists(select 1 from public.via_academic_records a join public.via_academic_results m on m.record_id=a.id where a.user_id=auth.uid() and a.education_stage='grade_9' and m.mark=62) then raise exception 'Grade 9 academic history missing'; end if;
 if exists(select 1 from public.via_onboarding_reports where user_id<>auth.uid()) or exists(select 1 from public.via_onboarding_history where user_id<>auth.uid()) then raise exception 'Owner policy failed'; end if;
 begin
  perform public.save_my_journey_onboarding('tertiary',r.journey_answers||'{"report_id":"72000000-0000-4000-8000-000000000002"}'::jsonb,'ready',r.answered_steps,'{}',r.revision,true);
  raise exception 'Another user report accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_my_onboarding(r.answers,'current',r.revision,false);
  raise exception 'Old browser overwrote journey';
 exception when serialization_failure then null; end;
 r:=public.set_my_education_stage('graduate',r.revision);
 if r.completed_at is null or r.answers<>old_answers then raise exception 'Graduate transition lost completion/history'; end if;
 if (select count(*) from public.via_academic_records where user_id=auth.uid())<>before_count then raise exception 'Graduate transition changed academic history'; end if;
end;
$$;
-- The second user cannot complete an empty branch, fake a catalogue selection,
-- or read the first user's academic records and stage history.
reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
declare r public.via_onboarding;
begin
 r:=public.set_my_education_stage('grade_12',0);
 begin
  perform public.save_my_journey_onboarding('grade_12',r.journey_answers,'ready',r.answered_steps,'{}',r.revision,true);
  raise exception 'Incomplete branch completed';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_my_journey_onboarding('grade_12',jsonb_set(r.journey_answers,'{journey,institution_id}','"99999999-0000-4000-8000-000000000001"'),'applications',r.answered_steps,'{}',r.revision,false);
  raise exception 'Fake institution accepted';
 exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.via_academic_records where user_id<>auth.uid()) or exists(select 1 from public.via_onboarding_history where user_id<>auth.uid()) then raise exception 'Cross-user history read allowed'; end if;
 r:=public.set_my_education_stage('accepted',r.revision);
 r:=public.save_my_journey_onboarding('accepted',jsonb_set(r.journey_answers,'{journey,funding_methods}','["Funding not confirmed"]'),'funding',array['welcome','current','funding'],'{}',r.revision,false);
 r:=public.set_my_education_stage('tertiary',r.revision);
 if 'funding'=any(r.carried_steps) or jsonb_array_length(r.journey_answers->'journey'->'funding_methods')<>0 then raise exception 'Unconfirmed funding invented a current funding state'; end if;
end;
$$;
reset role;
select 'PASS: seven branches, completion, reload, revision conflicts, catalogue validation, private reports/history, legacy-tab rejection, carried answers and graduate progression' as result;
rollback;
