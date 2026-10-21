-- VIA COMPLETE ONBOARDING v11. Apply ONCE after v10.
-- Preserves legacy answers, reports, academic records and stage history.
-- SOURCE: supabase/migrations/20261020001700_complete_journey_onboarding.sql
-- Complete onboarding v11. Apply after v10. Historical answers/migrations remain intact.
begin;
alter table public.via_profiles drop constraint via_profiles_education_stage_check;
alter table public.via_profiles add constraint via_profiles_education_stage_check check(education_stage in ('grade_9','grade_10','grade_11','grade_12','post_matric','accepted','tertiary','graduate'));
alter table public.via_learner_selections drop constraint via_learner_selections_education_stage_check;
alter table public.via_learner_selections add constraint via_learner_selections_education_stage_check check(education_stage in ('grade_9','grade_10','grade_11','grade_12','post_matric','accepted','tertiary','graduate'));
alter table public.via_academic_records drop constraint via_academic_records_education_stage_check;
alter table public.via_academic_records add constraint via_academic_records_education_stage_check check(education_stage in ('grade_9','grade_10','grade_11','grade_12','post_matric','accepted','tertiary','graduate'));
alter table public.via_onboarding drop constraint via_onboarding_flow_version_check;
alter table public.via_onboarding add constraint via_onboarding_flow_version_check check(flow_version in (2,3,4));
alter table public.via_onboarding drop constraint via_onboarding_current_step_check;
alter table public.via_onboarding add constraint via_onboarding_current_step_check check(current_step in ('welcome','current','interests','results','personality','study-plan','preferences','building','ready','school-subjects','future-curiosity','stage-pending','career-interests','study-interests','programmes','study-location','applications','funding','matric-year','current-activity','institution','enrolled-programme','campus','starting-year','year-of-study','accommodation-status','registration','support'));
alter table public.via_onboarding add column journey_answers jsonb not null default '{}' check(jsonb_typeof(journey_answers)='object'), add column carried_steps text[] not null default '{}';

create function via_private.journey_defaults() returns jsonb language sql immutable set search_path='' as $$
select '{"school_subject_ids":[],"school_subjects_unknown":false,"future_interest_ids":[],"future_exploring":false,"report_grade":null,"report_type":null,"current_id":"","interest_ids":[],"personality_ids":[],"goal_ids":[],"preference_ids":[],"institution_type_ids":[],"location_mode":"anywhere","province_ids":[],"school_name":"","academic_year":null,"results":[],"report_id":null,"journey":{"interests":[],"interests_unsure":false,"careers":[],"careers_unsure":false,"fields":[],"programme_ids":[],"study_unsure":false,"programmes_exploring":false,"preferred_institution_ids":[],"matric_year":null,"current_activity":"","application_progress":"","applications":[],"funding_methods":[],"funding_situation":"","institution_id":"","programme_id":"","programme_name":"","campus":"","starting_year":null,"year_of_study":"","accommodation_status":"","registration_status":"","support":[]}}'::jsonb;
$$;
create function via_private.journey_steps(stage text) returns text[] language sql immutable set search_path='' as $$
select case stage
when 'grade_9' then array['results','interests','career-interests']
when 'grade_10' then array['school-subjects','results','interests','career-interests']
when 'grade_11' then array['results','study-interests','programmes','study-location']
when 'grade_12' then array['results','study-interests','study-location','applications','funding']
when 'post_matric' then array['matric-year','results','current-activity','study-interests','study-location','applications','funding']
when 'accepted' then array['institution','enrolled-programme','campus','starting-year','funding','accommodation-status','registration']
when 'tertiary' then array['institution','campus','enrolled-programme','year-of-study','funding','support']
when 'graduate' then '{}'::text[] else null end;
$$;
create function via_private.journey_missing(stage text,a jsonb) returns text[] language plpgsql immutable set search_path='' as $$
declare missing text[]:='{}'; s text; j jsonb:=a->'journey'; valid boolean;
begin
 foreach s in array via_private.journey_steps(stage) loop
  valid:=case s
   when 'results' then jsonb_array_length(a->'results')>0 or nullif(a->>'report_id','') is not null
   when 'school-subjects' then jsonb_array_length(a->'school_subject_ids')>0
   when 'interests' then jsonb_array_length(j->'interests')>0 or (j->>'interests_unsure')::boolean
   when 'career-interests' then jsonb_array_length(j->'careers')>0 or (j->>'careers_unsure')::boolean
   when 'study-interests' then jsonb_array_length(j->'fields')>0 or jsonb_array_length(j->'programme_ids')>0 or (j->>'study_unsure')::boolean
   when 'programmes' then jsonb_array_length(j->'programme_ids')>0 or (j->>'programmes_exploring')::boolean
   when 'study-location' then a->>'location_mode'='anywhere' or jsonb_array_length(a->'province_ids')>0 or jsonb_array_length(j->'preferred_institution_ids')>0
   when 'matric-year' then j->>'matric_year' is not null
   when 'current-activity' then nullif(j->>'current_activity','') is not null
   when 'applications' then nullif(j->>'application_progress','') is not null and
    (not ((stage='post_matric' and j->>'application_progress'='Yes') or j->>'application_progress' in ('I''ve started applying','I''ve submitted applications')) or
     (jsonb_array_length(j->'applications')>0 and not exists(select 1 from jsonb_array_elements(j->'applications') r where coalesce(r->>'institution_id','')='' or btrim(coalesce(r->>'programme',''))='' or coalesce(r->>'status','')='')))
   when 'funding' then case when stage='post_matric' then nullif(j->>'funding_situation','') is not null else jsonb_array_length(j->'funding_methods')>0 end
   when 'institution' then nullif(j->>'institution_id','') is not null
   when 'enrolled-programme' then nullif(j->>'programme_id','') is not null or nullif(btrim(j->>'programme_name'),'') is not null
   when 'campus' then nullif(btrim(j->>'campus'),'') is not null
   when 'starting-year' then j->>'starting_year' is not null
   when 'year-of-study' then nullif(j->>'year_of_study','') is not null
   when 'accommodation-status' then nullif(j->>'accommodation_status','') is not null
   when 'registration' then nullif(j->>'registration_status','') is not null
   when 'support' then jsonb_array_length(j->'support')>0 else false end;
  if not coalesce(valid,false) then missing:=array_append(missing,s); end if;
 end loop;
 return missing;
end;
$$;
revoke all on function via_private.journey_defaults(),via_private.journey_steps(text),via_private.journey_missing(text,jsonb) from public,anon,authenticated;

-- Snapshot every previous implementation before adopting the new flow. Keep the
-- released answers column and all report/academic/history rows unchanged.
insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot)
select o.user_id,p.education_stage,'legacy_import',to_jsonb(o) from public.via_onboarding o join public.via_profiles p on p.id=o.user_id;
update public.via_onboarding o set journey_answers=via_private.journey_defaults()||o.answers;
update public.via_onboarding o set journey_answers=journey_answers||jsonb_build_object(
 'interest_ids',coalesce((select jsonb_agg(s.option_id) from public.via_learner_selections s join public.via_profiles p on p.id=s.user_id where s.user_id=o.user_id and s.education_stage=p.education_stage and s.kind='interest'),'[]'::jsonb),
 'personality_ids',coalesce((select jsonb_agg(s.option_id) from public.via_learner_selections s join public.via_profiles p on p.id=s.user_id where s.user_id=o.user_id and s.education_stage=p.education_stage and s.kind='strength'),'[]'::jsonb),
 'school_subject_ids',coalesce((select jsonb_agg(s.option_id) from public.via_learner_selections s join public.via_profiles p on p.id=s.user_id where s.user_id=o.user_id and s.education_stage=p.education_stage and s.kind='available_subject'),'[]'::jsonb),
 'future_interest_ids',coalesce((select jsonb_agg(s.option_id) from public.via_learner_selections s join public.via_profiles p on p.id=s.user_id where s.user_id=o.user_id and s.education_stage=p.education_stage and s.kind='future_interest'),'[]'::jsonb),
 'results',coalesce((select jsonb_agg(jsonb_build_object('subject_id',r.subject_id,'mark',r.mark)) from public.via_academic_results r where r.user_id=o.user_id and r.record_id=o.academic_record_id),'[]'::jsonb),
 'school_name',coalesce(a.school_name,''),'academic_year',a.academic_year,'report_grade',a.grade,'report_type',a.report_type,'report_id',a.report_id)
from public.via_academic_records a where o.flow_version=3 and a.id=o.academic_record_id and a.user_id=o.user_id;
update public.via_onboarding set flow_version=4,current_step=case when completed_at is not null then 'ready' else 'current' end,answered_steps=array['welcome','current'],skipped_steps='{}',revision=revision+1;

create or replace function public.set_my_education_stage(p_stage text,p_expected_revision bigint)
returns public.via_onboarding language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); previous public.via_onboarding; saved public.via_onboarding; old_stage text; a jsonb; j jsonb; missing text[]; carried text[]; expected_grade integer; academic_id uuid;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_stage is null or via_private.journey_steps(p_stage) is null then raise exception 'Invalid stage' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
 select * into previous from public.via_onboarding where user_id=owner_id for update;
 if p_expected_revision is null or coalesce(previous.revision,0)<>p_expected_revision then raise exception 'Progress changed. Reload.' using errcode='40001'; end if;
 select education_stage into old_stage from public.via_profiles where id=owner_id;
 if old_stage=p_stage and previous.flow_version=4 then
  update public.via_profiles set education_stage_confirmation_required=false where id=owner_id;
  return previous;
 end if;
 if previous.user_id is not null then insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot) values(owner_id,old_stage,'stage_change',to_jsonb(previous)); end if;
 a:=via_private.journey_defaults()||coalesce(previous.journey_answers,'{}'); j:=a->'journey'; academic_id:=previous.academic_record_id;
 expected_grade:=case p_stage when 'grade_9' then 9 when 'grade_10' then 10 when 'grade_11' then 11 when 'grade_12' then 11 when 'post_matric' then 12 end;
 if expected_grade is not null and ((a->>'report_grade')::integer is distinct from expected_grade or (p_stage in ('grade_12','post_matric') and a->>'report_type' is distinct from 'final')) then
  a:=a||jsonb_build_object('results','[]'::jsonb,'report_id',null,'academic_year',null,'report_grade',expected_grade,'report_type',case when p_stage in ('grade_12','post_matric') then 'final' else 'latest' end); academic_id:=null;
 end if;
 if p_stage='post_matric' and j->>'application_progress' in ('Not yet','I''m preparing to apply','I''ve started applying','I''ve submitted applications') then
  j:=j||jsonb_build_object('application_progress',case when j->>'application_progress' in ('I''ve started applying','I''ve submitted applications') then 'Yes' else 'No' end);
 elsif p_stage='grade_12' and j->>'application_progress' in ('Yes','No') then j:=j||jsonb_build_object('application_progress',case when j->>'application_progress'='Yes' then 'I''ve submitted applications' else 'Not yet' end); end if;
 if p_stage in ('accepted','tertiary','grade_12') then
  j:=j||jsonb_build_object('funding_methods',coalesce((select jsonb_agg(v) from jsonb_array_elements_text(j->'funding_methods') v where v in ('NSFAS','Bursary','Scholarship','Student loan','Family / Self-funded') or (p_stage='accepted' and v in ('Funding not confirmed','Other')) or (p_stage='tertiary' and v in ('Other','I currently need funding')) or (p_stage='grade_12' and v in ('I''m looking for funding','I''m not sure yet'))),'[]'::jsonb));
 end if;
 a:=a||jsonb_build_object('journey',j);missing:=via_private.journey_missing(p_stage,a);
 select coalesce(array_agg(s),'{}') into carried from unnest(via_private.journey_steps(p_stage)) s where s=any(coalesce(previous.answered_steps,'{}')||coalesce(previous.carried_steps,'{}')) and not(s=any(missing)) and not(s='funding' and (not(old_stage='accepted' and p_stage='tertiary') or (previous.journey_answers->'journey'->'funding_methods') ? 'Funding not confirmed'));
 update public.via_profiles set education_stage=p_stage,education_stage_confirmation_required=false where id=owner_id;
 if not found then raise exception 'Profile missing' using errcode='22023'; end if;
 insert into public.via_onboarding(user_id,current_step,flow_version,answered_steps,carried_steps,journey_answers,academic_record_id,completed_at)
 values(owner_id,'current',4,array['welcome','current']||carried,carried,a,academic_id,case when p_stage='graduate' then now() else null end)
 on conflict(user_id) do update set current_step='current',flow_version=4,answered_steps=array['welcome','current']||carried,carried_steps=carried,skipped_steps='{}',journey_answers=a,academic_record_id=academic_id,completed_at=case when p_stage='graduate' then now() else null end,revision=public.via_onboarding.revision+1,updated_at=now()
 returning * into saved;
 return saved;
end;
$$;

create function public.save_my_journey_onboarding(p_stage text,p_answers jsonb,p_current_step text,p_answered_steps text[],p_skipped_steps text[],p_expected_revision bigint,p_complete boolean default false)
returns public.via_onboarding language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); stage text; previous public.via_onboarding; saved public.via_onboarding; a jsonb; j jsonb; defaults jsonb:=via_private.journey_defaults(); field text; item jsonb; allowed text[]; missing text[]; academic_id uuid;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
 select education_stage into stage from public.via_profiles where id=owner_id;
 select * into previous from public.via_onboarding where user_id=owner_id for update;
 if stage is null or stage is distinct from p_stage or previous.flow_version is distinct from 4 or p_expected_revision is null or previous.revision<>p_expected_revision then raise exception 'Progress changed. Reload.' using errcode='40001'; end if;
 allowed:=array['welcome','current']||via_private.journey_steps(stage);
 if p_current_step is null or not(p_current_step=any(allowed||array['ready','building'])) then raise exception 'Inactive step' using errcode='22023'; end if;
 if p_complete is null or (p_complete and p_current_step not in ('ready','building')) then raise exception 'Invalid completion step' using errcode='22023'; end if;
 if p_answered_steps is null or p_skipped_steps is null or cardinality(p_answered_steps)>30 or cardinality(p_skipped_steps)>0 or exists(select 1 from unnest(p_answered_steps) s where s is null or not(s=any(allowed))) then raise exception 'Invalid step tracking' using errcode='22023'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>65536 or exists(select 1 from jsonb_object_keys(p_answers) k where not(defaults ? k)) then raise exception 'Invalid answers' using errcode='22023'; end if;
 a:=defaults||p_answers;j:=a->'journey';
 if jsonb_typeof(j) is distinct from 'object' or exists(select 1 from jsonb_object_keys(j) k where not(defaults->'journey' ? k)) then raise exception 'Invalid journey' using errcode='22023'; end if;
 j:=(defaults->'journey')||j;a:=a||jsonb_build_object('journey',j);
 for field in select jsonb_object_keys(defaults->'journey') loop
  if jsonb_typeof(defaults->'journey'->field)='array' then
   if jsonb_typeof(j->field) is distinct from 'array' or jsonb_array_length(j->field)>100 then raise exception 'Invalid selection list' using errcode='22023'; end if;
   if field<>'applications' and exists(select 1 from jsonb_array_elements(j->field) v where jsonb_typeof(v)<>'string' or char_length(v#>>'{}')>200) then raise exception 'Invalid selection' using errcode='22023'; end if;
  elsif jsonb_typeof(defaults->'journey'->field)='boolean' then
   if jsonb_typeof(j->field) is distinct from 'boolean' then raise exception 'Invalid uncertainty flag' using errcode='22023'; end if;
  elsif field in ('matric_year','starting_year') then
   if j->field<>'null'::jsonb and (jsonb_typeof(j->field)<>'number' or (j->>field)::numeric not between 2000 and 2100 or trunc((j->>field)::numeric)<>(j->>field)::numeric) then raise exception 'Invalid year' using errcode='22023'; end if;
  elsif jsonb_typeof(j->field) is distinct from 'string' or char_length(j->>field)>200 then raise exception 'Invalid text' using errcode='22023'; end if;
 end loop;
 for field in select jsonb_object_keys(defaults) loop
  if jsonb_typeof(defaults->field)='array' then
   if jsonb_typeof(a->field) is distinct from 'array' or jsonb_array_length(a->field)>100 then raise exception 'Invalid answer list' using errcode='22023'; end if;
  elsif jsonb_typeof(defaults->field)='boolean' then
   if jsonb_typeof(a->field) is distinct from 'boolean' then raise exception 'Invalid flag' using errcode='22023'; end if;
  elsif jsonb_typeof(defaults->field)='string' and (jsonb_typeof(a->field) is distinct from 'string' or char_length(a->>field)>200) then raise exception 'Invalid answer text' using errcode='22023'; end if;
 end loop;
 if a->>'location_mode' not in ('anywhere','provinces') then raise exception 'Invalid location mode' using errcode='22023'; end if;
 if a->'academic_year'<>'null'::jsonb and (jsonb_typeof(a->'academic_year')<>'number' or (a->>'academic_year')::numeric not between 2000 and 2100 or trunc((a->>'academic_year')::numeric)<>(a->>'academic_year')::numeric) then raise exception 'Invalid academic year' using errcode='22023'; end if;
 if a->'report_grade'<>'null'::jsonb and a->'report_grade' not in ('9'::jsonb,'10'::jsonb,'11'::jsonb,'12'::jsonb) then raise exception 'Invalid grade' using errcode='22023'; end if;
 if a->'report_type'<>'null'::jsonb and a->>'report_type' not in ('latest','term_1','term_2','term_3','term_4','final') then raise exception 'Invalid report type' using errcode='22023'; end if;
 if a->'report_id'<>'null'::jsonb and not exists(select 1 from public.via_onboarding_reports r where r.id::text=a->>'report_id' and r.user_id=owner_id) then raise exception 'Invalid report owner' using errcode='42501'; end if;
 for field in select unnest(array['school_subject_ids','province_ids']) loop
  if exists(select 1 from jsonb_array_elements_text(a->field) v where not exists(select 1 from public.via_onboarding_options o where o.id=v and o.active and o.category=case field when 'school_subject_ids' then 'subject' else 'province' end)) then raise exception 'Invalid subject/province' using errcode='22023'; end if;
 end loop;
 for field in select unnest(array['programme_ids','preferred_institution_ids']) loop
  if exists(select 1 from jsonb_array_elements_text(j->field) v where not exists(select 1 from public.via_public_opportunities o where o.id::text=v and o.kind=case field when 'programme_ids' then 'programmes' else 'institutions' end)) then raise exception 'Invalid catalogue selection' using errcode='22023'; end if;
 end loop;
 if j->>'institution_id'<>'' and not exists(select 1 from public.via_public_opportunities o where o.id::text=j->>'institution_id' and o.kind='institutions') then raise exception 'Invalid institution' using errcode='22023'; end if;
 if j->>'programme_id'<>'' and not exists(select 1 from public.via_public_opportunities o where o.id::text=j->>'programme_id' and o.kind='programmes' and o.document->>'institution_id'=j->>'institution_id') then raise exception 'Programme belongs to another institution' using errcode='22023'; end if;
 if jsonb_array_length(j->'applications')>20 then raise exception 'Too many applications' using errcode='22023'; end if;
 for item in select * from jsonb_array_elements(j->'applications') loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'institution_id') is distinct from 'string' or jsonb_typeof(item->'programme') is distinct from 'string' or char_length(item->>'programme')>200 or jsonb_typeof(item->'status') is distinct from 'string' or item->>'status' not in ('','Preparing','Submitted','Awaiting outcome','Accepted','Waitlisted','Unsuccessful') then raise exception 'Invalid application' using errcode='22023'; end if;
  if item->>'institution_id'<>'' and not exists(select 1 from public.via_public_opportunities o where o.id::text=item->>'institution_id' and o.kind='institutions') then raise exception 'Invalid application institution' using errcode='22023'; end if;
 end loop;
 if j->>'application_progress' not in ('','Not yet','I''m preparing to apply','I''ve started applying','I''ve submitted applications','Yes','No') then raise exception 'Invalid application progress' using errcode='22023'; end if;
 if j->>'current_activity' not in ('','Looking for something to study','Preparing to apply','Improving my results','Looking for funding','Waiting for application outcomes') or j->>'funding_situation' not in ('','I''m looking for funding','I''ve applied for funding','I already have funding','I''m not sure yet') or j->>'year_of_study' not in ('','First year','Second year','Third year','Fourth year','Fifth year+','Postgraduate') or j->>'accommodation_status' not in ('','Yes','Not yet','I don''t need accommodation') or j->>'registration_status' not in ('','Yes','Not yet','Registration hasn''t opened yet') then raise exception 'Unsupported status' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements_text(j->'funding_methods') v where v not in ('NSFAS','Bursary','Scholarship','Student loan','Family / Self-funded','I''m looking for funding','I''m not sure yet','Funding not confirmed','Other','I currently need funding')) or exists(select 1 from jsonb_array_elements_text(j->'support') v where v not in ('Academic progress','Funding','Managing study costs','Academic support','Student wellness','Societies & student life','Opportunities & events','Accommodation')) then raise exception 'Unsupported funding/support selection' using errcode='22023'; end if;
 if ((j->>'interests_unsure')::boolean and jsonb_array_length(j->'interests')>0) or ((j->>'careers_unsure')::boolean and jsonb_array_length(j->'careers')>0) or ((j->>'study_unsure')::boolean and (jsonb_array_length(j->'fields')>0 or jsonb_array_length(j->'programme_ids')>0)) or ((j->>'programmes_exploring')::boolean and jsonb_array_length(j->'programme_ids')>0) then raise exception 'Select choices or uncertainty, not both' using errcode='22023'; end if;
 if jsonb_array_length(a->'results')>20 then raise exception 'Too many marks' using errcode='22023'; end if;
 for item in select * from jsonb_array_elements(a->'results') loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'subject_id') is distinct from 'string' or jsonb_typeof(item->'mark') is distinct from 'number' or (item->>'mark')::numeric not between 0 and 100 or not exists(select 1 from public.via_onboarding_options o where o.id=item->>'subject_id' and o.active and o.category='subject') then raise exception 'Invalid mark/subject' using errcode='22023'; end if;
 end loop;
 if jsonb_array_length(a->'results')<>(select count(distinct r->>'subject_id') from jsonb_array_elements(a->'results') r) then raise exception 'Duplicate subjects' using errcode='22023'; end if;
 missing:=via_private.journey_missing(stage,a);
 if stage='tertiary' and nullif(previous.journey_answers->'journey'->>'year_of_study','') is not null and nullif(j->>'year_of_study','') is not null and previous.journey_answers->'journey'->>'year_of_study' is distinct from j->>'year_of_study' then
  insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot) values(owner_id,stage,'stage_change',to_jsonb(previous));
 end if;
 if p_complete and cardinality(missing)>0 then raise exception 'Complete required questions: %',missing using errcode='22023'; end if;
 academic_id:=previous.academic_record_id;
 if (jsonb_array_length(a->'results')>0 or a->>'report_id' is not null) and (a->'results' is distinct from previous.journey_answers->'results' or a->'report_id' is distinct from previous.journey_answers->'report_id' or a->'report_grade' is distinct from previous.journey_answers->'report_grade' or a->'report_type' is distinct from previous.journey_answers->'report_type' or a->'academic_year' is distinct from previous.journey_answers->'academic_year' or a->'school_name' is distinct from previous.journey_answers->'school_name') then
  insert into public.via_academic_records(user_id,education_stage,school_name,academic_year,grade,report_type,report_id) values(owner_id,stage,a->>'school_name',(a->>'academic_year')::integer,(a->>'report_grade')::smallint,a->>'report_type',(a->>'report_id')::uuid) returning id into academic_id;
  insert into public.via_academic_results(record_id,user_id,subject_id,mark) select academic_id,owner_id,r->>'subject_id',(r->>'mark')::numeric from jsonb_array_elements(a->'results') r;
 end if;
 update public.via_onboarding set journey_answers=a,current_step=p_current_step,answered_steps=case when p_complete then allowed else p_answered_steps end,carried_steps=array(select s from unnest(previous.carried_steps) s where not(s=any(missing))),skipped_steps='{}',academic_record_id=academic_id,
  completed_at=case when p_complete then coalesce(previous.completed_at,now()) when cardinality(missing)=0 then previous.completed_at else null end,revision=revision+1,updated_at=now() where user_id=owner_id returning * into saved;
 if p_complete and previous.completed_at is null then insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot) values(owner_id,stage,'completion',to_jsonb(saved)); end if;
 return saved;
end;
$$;
revoke all on function public.save_my_journey_onboarding(text,jsonb,text,text[],text[],bigint,boolean) from public,anon,authenticated;
grant execute on function public.save_my_journey_onboarding(text,jsonb,text,text[],text[],bigint,boolean) to authenticated;
-- Existing v3 RPC rejects version 4. Prevent legacy v2 writes as well.
create or replace function public.save_my_onboarding(p_answers jsonb,p_current_step text,p_expected_revision bigint,p_complete boolean default false)
returns public.via_onboarding language plpgsql security definer set search_path='' as $$
declare saved public.via_onboarding;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.via_onboarding where user_id=auth.uid() and flow_version>=3) then raise exception 'Onboarding changed. Reload VIA.' using errcode='40001'; end if;
 saved:=via_private.save_my_onboarding_v2(p_answers,p_current_step,p_expected_revision,p_complete);
 update public.via_profiles set education_stage=case p_answers->>'current_id' when 'current-2' then 'grade_11' when 'current-3' then 'grade_12' when 'current-4' then 'post_matric' when 'current-5' then 'tertiary' end,education_stage_confirmation_required=p_answers->>'current_id' is null or p_answers->>'current_id' not in ('current-2','current-3','current-4','current-5') where id=auth.uid();
 return saved;
end;
$$;
notify pgrst,'reload schema';
commit;
