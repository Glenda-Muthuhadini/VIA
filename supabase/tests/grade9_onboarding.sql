-- Apply v12 first. All fixtures and saves roll back. No email is sent.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('73000000-0000-4000-8000-000000000001','grade9-a@example.invalid','{"first_name":"Grade9","last_name":"A"}'),
('73000000-0000-4000-8000-000000000002','grade9-b@example.invalid','{"first_name":"Grade9","last_name":"B"}');
insert into public.via_onboarding_reports(id,user_id,storage_path,file_name,mime_type,file_size) values
('74000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001/original.pdf','original.pdf','application/pdf',100),
('74000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002/private.png','private.png','image/png',100);
select set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare r public.via_onboarding;response jsonb;a jsonb;g jsonb;draft jsonb;subject text;elective text;original integer;stage text;institution text;programme text;
begin
 if has_table_privilege('authenticated','public.via_grade9_onboarding','update') or has_table_privilege('authenticated','public.via_grade9_onboarding','insert') then raise exception 'Direct Grade 9 mutation allowed';end if;
 if has_function_privilege('anon','public.save_my_grade9_onboarding(text,jsonb,jsonb,text,text[],text[],bigint,boolean,boolean)','execute') then raise exception 'Anonymous Grade 9 writes allowed';end if;
 if (select count(*) from public.via_schools)<15000 then raise exception 'Real school directory missing';end if;
 select id into subject from public.via_onboarding_options where id='subject-1';
 select id into elective from public.via_onboarding_options where id='subject-17';
 r:=public.set_my_education_stage('grade_9',0);a:=r.journey_answers;
 g:='{"current_grade":9,"province":"Gauteng","school_name":"Learner-entered School","school_id":null,"school_manual":true,"curriculum":"CAPS","results_draft":null,"results_confirmed":false,"subject_experience":{},"subject_choice_status":"","subjects_considering":[],"future_clarity":"","future_interest_areas":[],"future_unsure":false}'::jsonb;

 response:=public.save_my_grade9_onboarding('grade_9',a,g,'results',array['welcome','current','school-details'],'{}',r.revision,false,false);
 r:=jsonb_populate_record(null::public.via_onboarding,response);g:=response->'grade9';g:=g-array['user_id','school_name','legacy_completed','updated_at'];
 if not exists(select 1 from public.via_grade9_onboarding where user_id=auth.uid() and province='Gauteng' and curriculum='CAPS') then raise exception 'School details not persisted';end if;
 begin perform public.save_my_grade9_onboarding('grade_9',a,g,'ready','{}','{}',r.revision,true,false);raise exception 'Empty branch completed';exception when invalid_parameter_value then null;end;
 begin perform public.save_my_journey_onboarding('grade_9',a,'ready','{}','{}',r.revision,true);raise exception 'Old browser bypassed Grade 9 flow';exception when serialization_failure then null;end;
 select count(*) into original from public.via_academic_records where user_id=auth.uid();
 draft:=jsonb_build_object('report_id','74000000-0000-4000-8000-000000000001','school_name','Learner-entered School','academic_year','2026','report_period','term_3','detected_grade',9,'grade_corrected',false,'rows',jsonb_build_array(jsonb_build_object('subject_id',subject,'mark','72')));
 g:=g||jsonb_build_object('results_draft',draft);
 response:=public.save_my_grade9_onboarding('grade_9',a,g,'confirm-results',array['welcome','current','school-details','results'],'{}',r.revision,false,false);
 r:=jsonb_populate_record(null::public.via_onboarding,response);
 if jsonb_array_length(r.journey_answers->'results')<>0 or (select count(*) from public.via_academic_records where user_id=auth.uid())<>original then raise exception 'Draft or upload became academic results';end if;
 begin perform public.save_my_grade9_onboarding('grade_9',a,jsonb_set(g,'{results_draft,report_id}','"74000000-0000-4000-8000-000000000002"'),'confirm-results','{}','{}',r.revision,false,false);raise exception 'Another user report accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_my_grade9_onboarding('grade_9',jsonb_set(a,'{results}',jsonb_build_array(jsonb_build_object('subject_id',subject,'mark',99))),g,'results','{}','{}',r.revision,false,false);raise exception 'Unconfirmed marks accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_my_grade9_onboarding('grade_9',a,jsonb_set(g,'{results_draft,rows}',jsonb_build_array(jsonb_build_object('subject_id',subject,'mark','101'))),'subject-experience','{}','{}',r.revision,false,true);raise exception 'Mark over 100 accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_my_grade9_onboarding('grade_9',a,jsonb_set(g,'{results_draft,rows}',(draft->'rows')||(draft->'rows')),'subject-experience','{}','{}',r.revision,false,true);raise exception 'Duplicate mark accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_my_grade9_onboarding('grade_9',a,jsonb_set(g,'{results_draft,detected_grade}','10'),'subject-experience','{}','{}',r.revision,false,true);raise exception 'Grade 10 silently treated as Grade 9';exception when invalid_parameter_value then null;end;
 response:=public.save_my_grade9_onboarding('grade_9',a,g,'subject-experience',array['welcome','current','school-details','results','confirm-results'],'{}',r.revision,false,true);
 r:=jsonb_populate_record(null::public.via_onboarding,response);a:=r.journey_answers;
 if a->>'report_grade'<>'9' or a->'results'->0->>'mark'<>'72' or (select count(*) from public.via_academic_records where user_id=auth.uid())<>original+1 then raise exception 'Confirmation did not create academic results';end if;
 if a->>'report_id'<>'74000000-0000-4000-8000-000000000001' then raise exception 'Original report link lost';end if;
 g:=(response->'grade9')-array['user_id','school_name','legacy_completed','updated_at'];
 -- Editing current school details must not mint another academic record.
 g:=g||jsonb_build_object('school_name','New current school, not yet on a confirmed report');
 response:=public.save_my_grade9_onboarding('grade_9',a,g,'school-details',r.answered_steps,'{}',r.revision,false,false);
 r:=jsonb_populate_record(null::public.via_onboarding,response);
 if (select count(*) from public.via_academic_records where user_id=auth.uid())<>original+1 or r.journey_answers->>'school_name'<>'Learner-entered School' then raise exception 'Unconfirmed school change modified academic records';end if;
 g:=g||jsonb_build_object('school_name','Learner-entered School');
 begin perform public.save_my_grade9_onboarding('grade_9',a,g,'ready','{}','{}',r.revision-1,false,false);raise exception 'Stale draft overwrote saved progress';exception when serialization_failure then null;end;
 g:=g||jsonb_build_object('subject_experience',jsonb_build_object(subject,'I enjoy it'),'subject_choice_status','I have some ideas','subjects_considering',jsonb_build_array(elective),'future_clarity','Yes, I have some ideas','future_interest_areas',jsonb_build_array('Technology & Computing'));
 a:=jsonb_set(a,'{journey,interests}','["Technology"]');
 response:=public.save_my_grade9_onboarding('grade_9',a,g,'ready',array['welcome','current','school-details','results','confirm-results','subject-experience','interests','subject-choice','subjects-considering','future-interests'],'{}',r.revision,false,false);
 r:=jsonb_populate_record(null::public.via_onboarding,response);a:=r.journey_answers;
 if r.completed_at is not null then raise exception 'Completion happened before final CTA';end if;
 if a->'school_subject_ids'<>jsonb_build_array(subject) then raise exception 'Grade 10 considerations replaced current Grade 9 subjects';end if;
 response:=public.save_my_grade9_onboarding('grade_9',a,g,'ready',r.answered_steps,'{}',r.revision,true,false);
 r:=jsonb_populate_record(null::public.via_onboarding,response);
 if r.completed_at is null then raise exception 'Final CTA did not complete onboarding';end if;
 if (select subject_experience->>subject from public.via_grade9_onboarding where user_id=auth.uid())<>'I enjoy it' then raise exception 'Experience lost';end if;
 -- All six other branches still use the unchanged v11 implementation.
 select document->>'institution_id',id::text into institution,programme from public.via_public_opportunities where kind='programmes' and document->>'institution_id' is not null limit 1;
 foreach stage in array array['grade_10','grade_11','grade_12','post_matric','accepted','tertiary'] loop
  r:=public.set_my_education_stage(stage,r.revision);a:=r.journey_answers||jsonb_build_object('school_subject_ids',jsonb_build_array(subject),'results',jsonb_build_array(jsonb_build_object('subject_id',subject,'mark',62)));
  a:=jsonb_set(a,'{journey}',(a->'journey')||jsonb_build_object('interests',jsonb_build_array('Technology'),'careers',jsonb_build_array('Software developer'),'fields',jsonb_build_array('Technology & Computing'),'programme_ids',jsonb_build_array(programme),'matric_year',2025,'current_activity','Preparing to apply','application_progress',case when stage='post_matric' then 'No' else 'Not yet' end,'funding_methods',jsonb_build_array('NSFAS'),'funding_situation','I''m looking for funding','institution_id',institution,'programme_id',programme,'campus','User campus','starting_year',2027,'year_of_study','First year','accommodation_status','Not yet','registration_status','Not yet','support',jsonb_build_array('Academic support')));
  r:=public.save_my_journey_onboarding(stage,a,'ready',r.answered_steps,'{}',r.revision,true);
  if r.completed_at is null then raise exception 'Other stage changed: %',stage;end if;
 end loop;
end;$$;
reset role;
select set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.via_grade9_onboarding where user_id<>auth.uid()) or exists(select 1 from public.via_academic_records where user_id<>auth.uid()) then raise exception 'Cross-user Grade 9 data exposed';end if;
end;$$;
reset role;
select 'PASS: Grade 9 school/draft persistence, explicit confirmation, separate academic records, original report ownership, validation, conflicts, subject experience, Grade 10 considerations, final-CTA completion, owner access and all six unchanged branches' as result;
rollback;
