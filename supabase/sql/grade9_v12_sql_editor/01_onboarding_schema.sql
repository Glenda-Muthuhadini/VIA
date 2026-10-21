-- Apply ONCE after v11. Alternative to the combined v12 bundle.
-- Grade 9 only. Apply after complete onboarding v11; retain every older release.
begin;
create table public.via_schools(
 id text primary key,name text not null check(char_length(name) between 1 and 200),
 province text not null check(province in ('Gauteng','Limpopo','Mpumalanga','North West','Free State','KwaZulu-Natal','Eastern Cape','Western Cape','Northern Cape')),
 source_url text not null,source_year integer not null,active boolean not null default true
);
create index via_schools_province_name on public.via_schools(province,name) where active;
alter table public.via_schools enable row level security;
create policy via_school_directory_read on public.via_schools for select to anon,authenticated using(active);
grant select on public.via_schools to anon,authenticated;
grant all on public.via_schools to service_role;

create table public.via_grade9_onboarding(
 user_id uuid primary key references public.via_profiles(id) on delete cascade,
 current_grade smallint not null default 9 check(current_grade=9),
 province text not null default '' check(province in ('','Gauteng','Limpopo','Mpumalanga','North West','Free State','KwaZulu-Natal','Eastern Cape','Western Cape','Northern Cape')),
 school_id text references public.via_schools(id),school_name text not null default '' check(char_length(school_name)<=200),school_manual boolean not null default false,
 curriculum text not null default '' check(curriculum in ('','CAPS','IEB','Other','I''m not sure')),
 results_draft jsonb check(results_draft is null or jsonb_typeof(results_draft)='object'),
 results_confirmed boolean not null default false,
 subject_experience jsonb not null default '{}' check(jsonb_typeof(subject_experience)='object'),
 subject_choice_status text not null default '',subjects_considering text[] not null default '{}',
 future_clarity text not null default '',future_interest_areas text[] not null default '{}',future_unsure boolean not null default false,
 legacy_completed boolean not null default false,updated_at timestamptz not null default now()
);
alter table public.via_grade9_onboarding enable row level security;
create policy via_grade9_owner_read on public.via_grade9_onboarding for select to authenticated using(user_id=auth.uid());
revoke all on public.via_grade9_onboarding from anon,authenticated;
grant select on public.via_grade9_onboarding to authenticated;
grant all on public.via_grade9_onboarding to service_role;
alter table public.via_onboarding drop constraint via_onboarding_current_step_check;
alter table public.via_onboarding add constraint via_onboarding_current_step_check check(current_step in ('welcome','current','interests','results','personality','study-plan','preferences','building','ready','school-subjects','future-curiosity','stage-pending','career-interests','study-interests','programmes','study-location','applications','funding','matric-year','current-activity','institution','enrolled-programme','campus','starting-year','year-of-study','accommodation-status','registration','support','school-details','confirm-results','subject-experience','subject-choice','subjects-considering','future-interests'));

-- Preserve completed users, confirmed marks, private originals and old answers.
insert into public.via_grade9_onboarding(user_id,school_name,school_manual,results_confirmed,results_draft,legacy_completed)
select o.user_id,coalesce(o.journey_answers->>'school_name',''),nullif(o.journey_answers->>'school_name','') is not null,
 coalesce(o.journey_answers->>'report_grade','')='9' and jsonb_array_length(coalesce(o.journey_answers->'results','[]'))>0,
 case when jsonb_array_length(coalesce(o.journey_answers->'results','[]'))>0 then jsonb_build_object('report_id',o.journey_answers->'report_id','school_name',coalesce(o.journey_answers->>'school_name',''),'academic_year',coalesce(o.journey_answers->>'academic_year',''),'report_period',coalesce(o.journey_answers->>'report_type',''),'detected_grade',o.journey_answers->'report_grade','grade_corrected',false,'rows',(select jsonb_agg(jsonb_build_object('subject_id',r->>'subject_id','mark',r->>'mark')) from jsonb_array_elements(o.journey_answers->'results') r)) end,
 o.completed_at is not null
from public.via_onboarding o join public.via_profiles p on p.id=o.user_id where p.education_stage='grade_9';
insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot)
select o.user_id,'grade_9','legacy_import',to_jsonb(o) from public.via_onboarding o join public.via_profiles p on p.id=o.user_id where p.education_stage='grade_9';
update public.via_onboarding o set current_step=case when completed_at is not null then 'ready' else 'school-details' end,
 answered_steps=array['welcome','current'],skipped_steps='{}',carried_steps='{}',revision=revision+1
from public.via_profiles p where p.id=o.user_id and p.education_stage='grade_9';

-- Retain the v11 implementation privately and delegate all other stages intact.
alter function public.save_my_journey_onboarding(text,jsonb,text,text[],text[],bigint,boolean) set schema via_private;
alter function via_private.save_my_journey_onboarding(text,jsonb,text,text[],text[],bigint,boolean) rename to save_journey_v11;
revoke all on function via_private.save_journey_v11(text,jsonb,text,text[],text[],bigint,boolean) from public,anon,authenticated;
create function public.save_my_journey_onboarding(p_stage text,p_answers jsonb,p_current_step text,p_answered_steps text[],p_skipped_steps text[],p_expected_revision bigint,p_complete boolean default false)
returns public.via_onboarding language plpgsql security definer set search_path='' as $$
begin
 if p_stage='grade_9' then raise exception 'Grade 9 onboarding changed. Reload VIA.' using errcode='40001'; end if;
 return via_private.save_journey_v11(p_stage,p_answers,p_current_step,p_answered_steps,p_skipped_steps,p_expected_revision,p_complete);
end;$$;
revoke all on function public.save_my_journey_onboarding(text,jsonb,text,text[],text[],bigint,boolean) from public,anon;
grant execute on function public.save_my_journey_onboarding(text,jsonb,text,text[],text[],bigint,boolean) to authenticated;

create function via_private.grade9_missing(a jsonb,g public.via_grade9_onboarding) returns text[] language plpgsql stable set search_path='' as $$
declare missing text[]:='{}';
begin
 if g.province='' or btrim(g.school_name)='' or g.curriculum='' or (g.school_id is null and not g.school_manual) then missing:=array_append(missing,'school-details');end if;
 if not g.results_confirmed or jsonb_array_length(a->'results')=0 or a->>'report_grade'<>'9' or a->>'academic_year' is null or a->>'report_type' is null then missing:=array_append(missing,'confirm-results');end if;
 if jsonb_array_length(a->'results')=0 or exists(select 1 from jsonb_array_elements(a->'results') r where coalesce(g.subject_experience->>(r->>'subject_id'),'') not in ('I enjoy it','It''s okay','I find it difficult')) then missing:=array_append(missing,'subject-experience');end if;
 if jsonb_array_length(a->'journey'->'interests')=0 and not (a->'journey'->>'interests_unsure')::boolean then missing:=array_append(missing,'interests');end if;
 if g.subject_choice_status='' then missing:=array_append(missing,'subject-choice');end if;
 if g.subject_choice_status in ('Yes, I already know what I want to choose','I have some ideas') and cardinality(g.subjects_considering)=0 then missing:=array_append(missing,'subjects-considering');end if;
 if g.future_clarity='' or (g.future_clarity in ('Yes, I have some ideas','I have a few interests but I''m not sure') and cardinality(g.future_interest_areas)=0 and not g.future_unsure) then missing:=array_append(missing,'future-interests');end if;
 return missing;
end;$$;
revoke all on function via_private.grade9_missing(jsonb,public.via_grade9_onboarding) from public,anon,authenticated;

create function public.save_my_grade9_onboarding(p_stage text,p_answers jsonb,p_grade9 jsonb,p_current_step text,p_answered_steps text[],p_skipped_steps text[],p_expected_revision bigint,p_complete boolean default false,p_confirm_results boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();previous public.via_onboarding;saved public.via_onboarding;old_g public.via_grade9_onboarding;g public.via_grade9_onboarding;
 a jsonb:=p_answers;d jsonb;v jsonb;k text;field text;missing text[];mapped text;allowed text[]:=array['welcome','current','school-details','results','confirm-results','subject-experience','interests','subject-choice','subjects-considering','future-interests','ready'];new_rows jsonb;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
 select * into previous from public.via_onboarding where user_id=owner_id for update;
 if p_stage is distinct from 'grade_9' or not exists(select 1 from public.via_profiles where id=owner_id and education_stage='grade_9') or previous.flow_version is distinct from 4 or p_expected_revision is null or previous.revision<>p_expected_revision then raise exception 'Progress changed. Reload.' using errcode='40001';end if;
 if p_complete is null or p_confirm_results is null or p_current_step is null or not(p_current_step=any(allowed)) or (p_complete and p_current_step<>'ready') or p_answered_steps is null or cardinality(p_answered_steps)>30 or p_skipped_steps is null or cardinality(p_skipped_steps)>0 or exists(select 1 from unnest(p_answered_steps) s where s is null or not(s=any(allowed))) then raise exception 'Invalid Grade 9 step tracking' using errcode='22023';end if;
 if p_grade9 is null or jsonb_typeof(p_grade9)<>'object' or octet_length(p_grade9::text)>65536 or exists(select 1 from jsonb_object_keys(p_grade9) key where key not in ('current_grade','province','school_name','school_id','school_manual','curriculum','results_draft','results_confirmed','subject_experience','subject_choice_status','subjects_considering','future_clarity','future_interest_areas','future_unsure')) then raise exception 'Invalid Grade 9 answers' using errcode='22023';end if;
 select * into old_g from public.via_grade9_onboarding where user_id=owner_id for update;
 insert into public.via_grade9_onboarding(user_id) values(owner_id) on conflict(user_id) do nothing;
 select * into g from public.via_grade9_onboarding where user_id=owner_id;
 g:=jsonb_populate_record(g,p_grade9);g.user_id:=owner_id;g.legacy_completed:=coalesce(old_g.legacy_completed,false);
 if g.current_grade is distinct from 9 or g.province is null or g.province not in ('','Gauteng','Limpopo','Mpumalanga','North West','Free State','KwaZulu-Natal','Eastern Cape','Western Cape','Northern Cape') or g.curriculum is null or g.curriculum not in ('','CAPS','IEB','Other','I''m not sure') or g.school_name is null or char_length(g.school_name)>200 or g.school_manual is null or g.future_unsure is null then raise exception 'Invalid school details' using errcode='22023';end if;
 if g.school_id is not null and (g.school_manual or not exists(select 1 from public.via_schools s where s.id=g.school_id and s.active and s.province=g.province and s.name=g.school_name)) then raise exception 'Selected school does not match province/name' using errcode='22023';end if;
 if g.subject_choice_status is null or g.subject_choice_status not in ('','Yes, I already know what I want to choose','I have some ideas','Not yet','I need help choosing') or g.future_clarity is null or g.future_clarity not in ('','Yes, I have some ideas','I have a few interests but I''m not sure','Not yet — I want to explore') or g.subjects_considering is null or cardinality(g.subjects_considering)>50 or g.future_interest_areas is null or cardinality(g.future_interest_areas)>12 then raise exception 'Invalid planning choices' using errcode='22023';end if;
 if exists(select 1 from unnest(g.subjects_considering) id where id is null or not exists(select 1 from public.via_onboarding_options o where o.id=id and o.active and o.category='subject' and (o.education_stages is null or 'grade_10'=any(o.education_stages)) and o.id not like 'subject-g9-%' and o.label !~* '(home language|additional language|life orientation)')) then raise exception 'Invalid Grade 10 elective' using errcode='22023';end if;
 if cardinality(g.subjects_considering)<>(select count(distinct id) from unnest(g.subjects_considering) id) or cardinality(g.future_interest_areas)<>(select count(distinct area) from unnest(g.future_interest_areas) area) or exists(select 1 from unnest(g.future_interest_areas) area where area is null or area not in ('Technology & Computing','Engineering','Health Sciences','Science','Business & Commerce','Finance & Accounting','Law','Education','Humanities & Social Sciences','Creative fields','Agriculture','Environment')) then raise exception 'Invalid future interests' using errcode='22023';end if;
 if (g.subject_choice_status not in ('Yes, I already know what I want to choose','I have some ideas') and cardinality(g.subjects_considering)>0) or (g.future_clarity='Not yet — I want to explore' and (cardinality(g.future_interest_areas)>0 or g.future_unsure)) or (g.future_unsure and cardinality(g.future_interest_areas)>0) then raise exception 'Conflicting uncertainty answers' using errcode='22023';end if;
 d:=nullif(g.results_draft,'null'::jsonb);g.results_draft:=d;
 if d is not null then
  if jsonb_typeof(d)<>'object' or jsonb_typeof(d->'rows') is distinct from 'array' or jsonb_array_length(d->'rows')>20 or jsonb_typeof(d->'school_name') is distinct from 'string' or char_length(d->>'school_name')>200 or jsonb_typeof(d->'academic_year') is distinct from 'string' or char_length(d->>'academic_year')>20 or jsonb_typeof(d->'report_period') is distinct from 'string' or d->>'report_period' not in ('','latest','term_1','term_2','term_3','term_4','final') or jsonb_typeof(d->'grade_corrected') is distinct from 'boolean' then raise exception 'Invalid result review draft' using errcode='22023';end if;
  if d->'detected_grade'<>'null'::jsonb and d->'detected_grade' not in ('9'::jsonb,'10'::jsonb,'11'::jsonb,'12'::jsonb) then raise exception 'Invalid detected grade' using errcode='22023';end if;
  if nullif(d->>'report_id','') is not null and not exists(select 1 from public.via_onboarding_reports r where r.user_id=owner_id and r.id::text=d->>'report_id') then raise exception 'Invalid original report owner' using errcode='42501';end if;
  if exists(select 1 from jsonb_array_elements(d->'rows') row where jsonb_typeof(row)<>'object' or jsonb_typeof(row->'subject_id') is distinct from 'string' or jsonb_typeof(row->'mark') is distinct from 'string' or char_length(row->>'subject_id')>200 or char_length(row->>'mark')>20) then raise exception 'Invalid review row' using errcode='22023';end if;
 end if;
 g.results_confirmed:=coalesce(old_g.results_confirmed,false) and d is not distinct from old_g.results_draft;
 if p_confirm_results then
  if d is null or jsonb_array_length(d->'rows')=0 or btrim(d->>'school_name')='' or (d->>'academic_year') !~ '^[0-9]{4}$' or (d->>'academic_year')::integer not between 2000 and 2100 or d->>'report_period'='' or (d->>'detected_grade' is not null and d->>'detected_grade'<>'9' and not (d->>'grade_corrected')::boolean) then raise exception 'Confirm the school, Grade 9, academic year, report period and marks' using errcode='22023';end if;
  for v in select * from jsonb_array_elements(d->'rows') loop
   if (v->>'mark') !~ '^[0-9]+([.][0-9]+)?$' or (v->>'mark')::numeric not between 0 and 100 or not exists(select 1 from public.via_onboarding_options o where o.id=v->>'subject_id' and o.active and o.category='subject' and (o.education_stages is null or 'grade_9'=any(o.education_stages))) then raise exception 'Choose a Grade 9 subject and a mark from 0 to 100' using errcode='22023';end if;
  end loop;
  if jsonb_array_length(d->'rows')<>(select count(distinct row->>'subject_id') from jsonb_array_elements(d->'rows') row) then raise exception 'Duplicate subjects' using errcode='22023';end if;
  select jsonb_agg(jsonb_build_object('subject_id',row->>'subject_id','mark',(row->>'mark')::numeric)) into new_rows from jsonb_array_elements(d->'rows') row;
  a:=a||jsonb_build_object('results',new_rows,'school_subject_ids',(select jsonb_agg(row->>'subject_id') from jsonb_array_elements(d->'rows') row),'report_grade',9,'academic_year',(d->>'academic_year')::integer,'report_type',d->>'report_period','report_id',d->'report_id','school_name',btrim(d->>'school_name'));
  if g.school_name is distinct from btrim(d->>'school_name') then g.school_id:=null;g.school_manual:=true;end if;
  g.school_name:=btrim(d->>'school_name');g.results_confirmed:=true;
 else
  foreach field in array array['results','school_subject_ids','report_grade','academic_year','report_type','report_id','school_name'] loop
   if a->field is distinct from previous.journey_answers->field then raise exception 'Academic results require explicit confirmation' using errcode='42501';end if;
  end loop;
 end if;
 if jsonb_typeof(g.subject_experience) is distinct from 'object' or exists(select 1 from jsonb_each_text(g.subject_experience) experience where experience.value not in ('I enjoy it','It''s okay','I find it difficult')) then raise exception 'Invalid subject experience' using errcode='22023';end if;
 select coalesce(jsonb_object_agg(experience.key,experience.value),'{}'::jsonb) into g.subject_experience from jsonb_each_text(g.subject_experience) experience where exists(select 1 from jsonb_array_elements(a->'results') r where r->>'subject_id'=experience.key);
 if exists(select 1 from jsonb_array_elements_text(a->'journey'->'interests') interest where interest not in ('Technology','Science','Health','Engineering','Business','Finance','Law','Education','Creative fields','Agriculture','Environment','Social sciences')) then raise exception 'Invalid interest' using errcode='22023';end if;
 -- Existing dashboard consumes these actual study interests without any redesign.
 a:=jsonb_set(a,'{journey,fields}',to_jsonb(g.future_interest_areas));
 mapped:=case when p_current_step='interests' then 'interests' else 'results' end;
 saved:=via_private.save_journey_v11('grade_9',a,mapped,array['welcome','current'],'{}',p_expected_revision,false);
 missing:=via_private.grade9_missing(a,g);
 if p_complete and cardinality(missing)>0 and not(g.legacy_completed and previous.completed_at is not null) then raise exception 'Complete required questions: %',missing using errcode='22023';end if;
 update public.via_grade9_onboarding set province=g.province,school_id=g.school_id,school_name=g.school_name,school_manual=g.school_manual,curriculum=g.curriculum,results_draft=g.results_draft,results_confirmed=g.results_confirmed,subject_experience=g.subject_experience,subject_choice_status=g.subject_choice_status,subjects_considering=g.subjects_considering,future_clarity=g.future_clarity,future_interest_areas=g.future_interest_areas,future_unsure=g.future_unsure,updated_at=now() where user_id=owner_id returning * into g;
 update public.via_onboarding set current_step=p_current_step,answered_steps=p_answered_steps,carried_steps='{}',completed_at=case when p_complete then coalesce(previous.completed_at,now()) when g.legacy_completed then previous.completed_at when cardinality(missing)=0 then previous.completed_at else null end where user_id=owner_id returning * into saved;
 if p_complete and previous.completed_at is null then insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot) values(owner_id,'grade_9','completion',to_jsonb(saved)||jsonb_build_object('grade9',to_jsonb(g)));end if;
 return to_jsonb(saved)||jsonb_build_object('grade9',to_jsonb(g));
end;$$;
revoke all on function public.save_my_grade9_onboarding(text,jsonb,jsonb,text,text[],text[],bigint,boolean,boolean) from public,anon;
grant execute on function public.save_my_grade9_onboarding(text,jsonb,jsonb,text,text[],text[],bigint,boolean,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
