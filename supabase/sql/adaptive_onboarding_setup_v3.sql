-- VIA ADAPTIVE ONBOARDING v3. Apply ONCE after onboarding_setup_v2.sql.
-- Preserves legacy answers, users, private reports and completion history.
begin;
-- SOURCE: supabase/migrations/20261016000500_adaptive_onboarding_foundation.sql
-- Adaptive onboarding foundation. Requires onboarding v2. Apply once.
alter table public.via_profiles
  add column education_stage text check (education_stage in ('grade_9','grade_10','grade_11','grade_12','post_matric','tertiary','graduate')),
  add column education_stage_confirmation_required boolean not null default true;

-- Stable legacy IDs only. Never infer an exact grade from a display label.
update public.via_profiles p set
  education_stage = case o.answers->>'current_id' when 'current-2' then 'grade_11' when 'current-3' then 'grade_12' when 'current-4' then 'post_matric' when 'current-5' then 'tertiary' end,
  education_stage_confirmation_required = o.answers->>'current_id' not in ('current-2','current-3','current-4','current-5') or o.answers->>'current_id' is null
from public.via_onboarding o where o.user_id = p.id;

alter table public.via_onboarding_options
  drop constraint via_onboarding_options_category_check,
  add constraint via_onboarding_options_category_check check (category in ('current','interest','personality','preference','institution_type','province','study_goal','subject','journey','future_interest')),
  add column education_stages text[];

alter table public.via_onboarding
  drop constraint via_onboarding_current_step_check,
  add constraint via_onboarding_current_step_check check (current_step in ('welcome','current','interests','results','personality','study-plan','preferences','school-subjects','future-curiosity','stage-pending','building','ready')),
  add column flow_version integer not null default 2 check (flow_version in (2,3)),
  add column answered_steps text[] not null default '{}',
  add column skipped_steps text[] not null default '{}',
  add column branch_state jsonb not null default '{}' check (jsonb_typeof(branch_state) = 'object');

create table public.via_onboarding_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  education_stage text,
  reason text not null check (reason in ('legacy_import','stage_change','completion')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot)
select o.user_id,p.education_stage,'legacy_import',to_jsonb(o) from public.via_onboarding o join public.via_profiles p on p.id=o.user_id;

create table public.via_learner_selections (
  user_id uuid not null references auth.users(id) on delete cascade,
  education_stage text not null check (education_stage in ('grade_9','grade_10','grade_11','grade_12','post_matric','tertiary','graduate')),
  kind text not null check (kind in ('interest','strength','available_subject','future_interest')),
  option_id text not null references public.via_onboarding_options(id),
  primary key(user_id,education_stage,kind,option_id)
);
create table public.via_academic_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  education_stage text not null check (education_stage in ('grade_9','grade_10','grade_11','grade_12','post_matric','tertiary','graduate')),
  school_name text not null default '' check (char_length(school_name) <= 200),
  academic_year integer check (academic_year between 2000 and 2100),
  grade smallint check (grade between 9 and 12),
  report_type text check (report_type in ('latest','term_1','term_2','term_3','term_4','final')),
  report_id uuid references public.via_onboarding_reports(id),
  created_at timestamptz not null default now()
);
create index via_academic_records_owner_stage on public.via_academic_records(user_id,education_stage,created_at desc);
create table public.via_academic_results (
  record_id uuid not null references public.via_academic_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null references public.via_onboarding_options(id),
  mark numeric not null check (mark between 0 and 100),
  primary key(record_id,subject_id)
);
alter table public.via_onboarding add column academic_record_id uuid references public.via_academic_records(id);

alter table public.via_onboarding_history enable row level security;
alter table public.via_learner_selections enable row level security;
alter table public.via_academic_records enable row level security;
alter table public.via_academic_results enable row level security;
revoke all on public.via_onboarding_history,public.via_learner_selections,public.via_academic_records,public.via_academic_results from public,anon,authenticated;
grant select on public.via_onboarding_history,public.via_learner_selections,public.via_academic_records,public.via_academic_results to authenticated;
grant all on public.via_onboarding_history,public.via_learner_selections,public.via_academic_records,public.via_academic_results to service_role;
create policy via_history_owner on public.via_onboarding_history for select to authenticated using ((select auth.uid())=user_id);
create policy via_selections_owner on public.via_learner_selections for select to authenticated using ((select auth.uid())=user_id);
create policy via_academic_records_owner on public.via_academic_records for select to authenticated using ((select auth.uid())=user_id);
create policy via_academic_results_owner on public.via_academic_results for select to authenticated using ((select auth.uid())=user_id);

create function public.set_my_education_stage(p_stage text,p_expected_revision bigint)
returns public.via_onboarding language plpgsql security definer set search_path=''
as $$
declare owner_id uuid:=auth.uid(); previous public.via_onboarding; previous_stage text; saved public.via_onboarding; academic_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_stage is null or p_stage not in ('grade_9','grade_10','grade_11','grade_12','post_matric','tertiary','graduate') then raise exception 'Invalid education stage' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  select * into previous from public.via_onboarding where user_id=owner_id for update;
  if p_expected_revision is null or coalesce(previous.revision,0)<>p_expected_revision then raise exception 'Progress changed. Reload before saving.' using errcode='40001'; end if;
  select education_stage into previous_stage from public.via_profiles where id=owner_id;
  if previous_stage=p_stage and previous.user_id is not null then return previous; end if;
  if previous.user_id is not null then
    insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot) values(owner_id,previous_stage,'stage_change',to_jsonb(previous));
  end if;
  update public.via_profiles set education_stage=p_stage,education_stage_confirmation_required=false where id=owner_id;
  if not found then raise exception 'Profile missing' using errcode='22023'; end if;
  select id into academic_id from public.via_academic_records where user_id=owner_id and education_stage=p_stage order by created_at desc,id desc limit 1;
  insert into public.via_onboarding(user_id,current_step,flow_version,answered_steps,branch_state,academic_record_id)
  values(owner_id,'current',3,array['welcome','current'],'{}',academic_id)
  on conflict(user_id) do update set current_step='current',flow_version=3,answered_steps=array['welcome','current'],skipped_steps='{}',
    branch_state=coalesce((select h.snapshot->'branch_state' from public.via_onboarding_history h where h.user_id=owner_id and h.education_stage=p_stage and h.snapshot->>'flow_version'='3' order by h.created_at desc,h.id desc limit 1),'{}'::jsonb),
    academic_record_id=academic_id,completed_at=null,revision=public.via_onboarding.revision+1,updated_at=now()
  returning * into saved;
  -- Legacy answers remain byte-for-byte unchanged, including on stage changes.
  return saved;
end;
$$;
revoke all on function public.set_my_education_stage(text,bigint) from public,anon,authenticated;
grant execute on function public.set_my_education_stage(text,bigint) to authenticated;

create function public.save_my_adaptive_onboarding(p_stage text,p_answers jsonb,p_current_step text,p_answered_steps text[],p_skipped_steps text[],p_expected_revision bigint,p_complete boolean default false)
returns public.via_onboarding language plpgsql security definer set search_path=''
as $$
declare
  owner_id uuid:=auth.uid(); stage text; previous public.via_onboarding; saved public.via_onboarding;
  active_steps text[]; field_name text; category_name text; kind_name text; selected jsonb; item jsonb;
  academic_id uuid; existing_academic public.via_academic_records; existing_results jsonb; new_results jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  select education_stage into stage from public.via_profiles where id=owner_id;
  if stage is null or p_stage is distinct from stage then raise exception 'Education stage changed. Reload.' using errcode='40001'; end if;
  select * into previous from public.via_onboarding where user_id=owner_id for update;
  if previous.flow_version is distinct from 3 or p_expected_revision is null or previous.revision<>p_expected_revision then raise exception 'Progress changed. Reload.' using errcode='40001'; end if;
  active_steps:=case when stage='grade_9' then array['welcome','current','interests','personality','results','school-subjects','future-curiosity'] else array['welcome','current','stage-pending'] end;
  if p_current_step is null or not(p_current_step=any(active_steps) or p_current_step=any(array['building','ready'])) then raise exception 'Inactive step' using errcode='22023'; end if;
  if p_complete is null or (p_current_step in ('building','ready') and not p_complete) or (p_complete and (stage<>'grade_9' or p_current_step not in ('building','ready'))) then raise exception 'This branch cannot complete at this step' using errcode='22023'; end if;
  if p_answered_steps is null or p_skipped_steps is null or cardinality(p_answered_steps)>20 or cardinality(p_skipped_steps)>20 then raise exception 'Invalid step tracking' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_answered_steps||p_skipped_steps) s where s is null or not(s=any(active_steps))) or
    exists(select 1 from unnest(p_skipped_steps) s where s in ('welcome','current','stage-pending') or s=any(p_answered_steps)) then raise exception 'Invalid answered/skipped step' using errcode='22023'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>32768 then raise exception 'Invalid answers' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_answers) k where k not in ('interest_ids','personality_ids','school_subject_ids','school_subjects_unknown','future_interest_ids','future_exploring','school_name','academic_year','report_grade','report_type','results','report_id')) then raise exception 'Hidden or unknown answer' using errcode='22023'; end if;
  if stage<>'grade_9' and p_answers<>'{}'::jsonb then raise exception 'This branch is pending; do not submit Grade 9 answers' using errcode='22023'; end if;
  academic_id:=previous.academic_record_id;
  if stage='grade_9' then
    for field_name,category_name,kind_name in select * from (values ('interest_ids','interest','interest'),('personality_ids','personality','strength'),('school_subject_ids','subject','available_subject'),('future_interest_ids','future_interest','future_interest')) f(a,b,c) loop
      selected:=p_answers->field_name;
      if jsonb_typeof(selected) is distinct from 'array' then raise exception 'Invalid selections' using errcode='22023'; end if;
      if jsonb_array_length(selected)>100 or exists(select 1 from jsonb_array_elements(selected) v where jsonb_typeof(v)<>'string') then raise exception 'Invalid selections' using errcode='22023'; end if;
      if exists(select 1 from jsonb_array_elements_text(selected) v where not exists(select 1 from public.via_onboarding_options o where o.id=v and o.category=category_name and o.active and (o.education_stages is null or stage=any(o.education_stages)))) then raise exception 'Inactive or unsupported option' using errcode='22023'; end if;
      if jsonb_array_length(selected)<>(select count(distinct v) from jsonb_array_elements_text(selected) v) then raise exception 'Duplicate selections' using errcode='22023'; end if;
      delete from public.via_learner_selections where user_id=owner_id and education_stage=stage and kind=kind_name;
      insert into public.via_learner_selections(user_id,education_stage,kind,option_id) select owner_id,stage,kind_name,v from jsonb_array_elements_text(selected) v;
    end loop;
    if jsonb_typeof(p_answers->'school_subjects_unknown') is distinct from 'boolean' or jsonb_typeof(p_answers->'future_exploring') is distinct from 'boolean' then raise exception 'Invalid uncertainty flags' using errcode='22023'; end if;
    if ((p_answers->>'school_subjects_unknown')::boolean and jsonb_array_length(p_answers->'school_subject_ids')>0) or ((p_answers->>'future_exploring')::boolean and jsonb_array_length(p_answers->'future_interest_ids')>0) then raise exception 'Choose options or uncertainty, not both' using errcode='22023'; end if;
    if jsonb_typeof(p_answers->'school_name') is distinct from 'string' or char_length(p_answers->>'school_name')>200 then raise exception 'Invalid school' using errcode='22023'; end if;
    if p_answers->'academic_year' is distinct from 'null'::jsonb and (jsonb_typeof(p_answers->'academic_year') is distinct from 'number' or (p_answers->>'academic_year')::numeric not between 2000 and 2100 or trunc((p_answers->>'academic_year')::numeric)<>(p_answers->>'academic_year')::numeric) then raise exception 'Invalid academic year' using errcode='22023'; end if;
    if p_answers->'report_grade' is distinct from 'null'::jsonb and p_answers->'report_grade' is distinct from '9'::jsonb then raise exception 'Confirm Grade 9 results for this flow' using errcode='22023'; end if;
    if p_answers->'report_type' is distinct from 'null'::jsonb and (jsonb_typeof(p_answers->'report_type') is distinct from 'string' or p_answers->>'report_type' not in ('latest','term_1','term_2','term_3','term_4','final')) then raise exception 'Invalid report type' using errcode='22023'; end if;
    if p_answers->'report_id' is distinct from 'null'::jsonb and (jsonb_typeof(p_answers->'report_id') is distinct from 'string' or not exists(select 1 from public.via_onboarding_reports r where r.id::text=p_answers->>'report_id' and r.user_id=owner_id)) then raise exception 'Invalid report owner' using errcode='22023'; end if;
    if jsonb_typeof(p_answers->'results') is distinct from 'array' then raise exception 'Invalid results' using errcode='22023'; end if;
    if jsonb_array_length(p_answers->'results')>20 then raise exception 'Too many results' using errcode='22023'; end if;
    for item in select * from jsonb_array_elements(p_answers->'results') loop
      if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'subject_id') is distinct from 'string' or jsonb_typeof(item->'mark') is distinct from 'number' or not exists(select 1 from public.via_onboarding_options o where o.id=item->>'subject_id' and o.category='subject' and o.active) then raise exception 'Invalid subject/mark' using errcode='22023'; end if;
      if (item->>'mark')::numeric not between 0 and 100 then raise exception 'Invalid mark' using errcode='22023'; end if;
    end loop;
    if jsonb_array_length(p_answers->'results')<>(select count(distinct r->>'subject_id') from jsonb_array_elements(p_answers->'results') r) then raise exception 'Duplicate subjects' using errcode='22023'; end if;
    select coalesce(jsonb_agg(r order by r->>'subject_id'),'[]') into new_results from jsonb_array_elements(p_answers->'results') r;
    select * into existing_academic from public.via_academic_records where id=academic_id and user_id=owner_id and education_stage=stage;
    select coalesce(jsonb_agg(jsonb_build_object('subject_id',r.subject_id,'mark',r.mark) order by r.subject_id),'[]') into existing_results from public.via_academic_results r where r.record_id=academic_id and r.user_id=owner_id;
    if new_results is distinct from existing_results or existing_academic.school_name is distinct from p_answers->>'school_name' or existing_academic.academic_year is distinct from (p_answers->>'academic_year')::integer or existing_academic.grade is distinct from (p_answers->>'report_grade')::smallint or existing_academic.report_type is distinct from p_answers->>'report_type' or existing_academic.report_id is distinct from (p_answers->>'report_id')::uuid then
      insert into public.via_academic_records(user_id,education_stage,school_name,academic_year,grade,report_type,report_id) values(owner_id,stage,p_answers->>'school_name',(p_answers->>'academic_year')::integer,(p_answers->>'report_grade')::smallint,p_answers->>'report_type',(p_answers->>'report_id')::uuid) returning id into academic_id;
      insert into public.via_academic_results(record_id,user_id,subject_id,mark) select academic_id,owner_id,r->>'subject_id',(r->>'mark')::numeric from jsonb_array_elements(p_answers->'results') r;
    end if;
  end if;
  update public.via_onboarding set current_step=p_current_step,answered_steps=p_answered_steps,skipped_steps=p_skipped_steps,
    branch_state=case when stage='grade_9' then jsonb_build_object('school_subjects_unknown',p_answers->'school_subjects_unknown','future_exploring',p_answers->'future_exploring') else '{}'::jsonb end,
    academic_record_id=academic_id,completed_at=case when p_complete then now() else null end,revision=revision+1,updated_at=now()
  where user_id=owner_id returning * into saved;
  if p_complete then insert into public.via_onboarding_history(user_id,education_stage,reason,snapshot) values(owner_id,stage,'completion',to_jsonb(saved)); end if;
  return saved;
end;
$$;
revoke all on function public.save_my_adaptive_onboarding(text,jsonb,text,text[],text[],bigint,boolean) from public,anon,authenticated;
grant execute on function public.save_my_adaptive_onboarding(text,jsonb,text,text[],text[],bigint,boolean) to authenticated;

-- Preserve the v2 implementation for existing users/clients, but prevent an old
-- browser tab from overwriting an adaptive profile after a stage transition.
alter function public.save_my_onboarding(jsonb,text,bigint,boolean) rename to save_my_onboarding_v2;
alter function public.save_my_onboarding_v2(jsonb,text,bigint,boolean) set schema via_private;
revoke all on function via_private.save_my_onboarding_v2(jsonb,text,bigint,boolean) from public,anon,authenticated;
create function public.save_my_onboarding(p_answers jsonb,p_current_step text,p_expected_revision bigint,p_complete boolean default false)
returns public.via_onboarding language plpgsql security definer set search_path=''
as $$
declare saved public.via_onboarding;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if exists(select 1 from public.via_onboarding where user_id=auth.uid() and flow_version=3) then raise exception 'Your onboarding has changed. Reload VIA.' using errcode='40001'; end if;
  saved:=via_private.save_my_onboarding_v2(p_answers,p_current_step,p_expected_revision,p_complete);
  update public.via_profiles set education_stage=case p_answers->>'current_id' when 'current-2' then 'grade_11' when 'current-3' then 'grade_12' when 'current-4' then 'post_matric' when 'current-5' then 'tertiary' end,
    education_stage_confirmation_required=p_answers->>'current_id' is null or p_answers->>'current_id' not in ('current-2','current-3','current-4','current-5') where id=auth.uid();
  return saved;
end;
$$;
revoke all on function public.save_my_onboarding(jsonb,text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.save_my_onboarding(jsonb,text,bigint,boolean) to authenticated;
notify pgrst,'reload schema';



-- SOURCE: supabase/migrations/20261016000600_grade9_catalog.sql
-- Existing catalog entries remain available to legacy flows, never deleted.
update public.via_onboarding_options set education_stages=array['grade_10','grade_11','grade_12','post_matric','tertiary','graduate'] where category in ('interest','personality');
insert into public.via_onboarding_options(id,category,label,description,icon,tone,sort_order,education_stages) values
('g9-interest-1','interest','Technology & Computing','', 'BookOpen','emerald',1,array['grade_9']),
('g9-interest-2','interest','Engineering & Building','', 'BookOpen','emerald',2,array['grade_9']),
('g9-interest-3','interest','Business & Money','', 'BookOpen','emerald',3,array['grade_9']),
('g9-interest-4','interest','Health & People','', 'BookOpen','emerald',4,array['grade_9']),
('g9-interest-5','interest','Science & Nature','', 'BookOpen','emerald',5,array['grade_9']),
('g9-interest-6','interest','Law & Society','', 'BookOpen','emerald',6,array['grade_9']),
('g9-interest-7','interest','Creative & Design','', 'BookOpen','emerald',7,array['grade_9']),
('g9-interest-8','interest','Teaching & Education','', 'BookOpen','emerald',8,array['grade_9']),
('g9-interest-9','interest','People & Communities','', 'BookOpen','emerald',9,array['grade_9']),
('g9-personality-1','personality','Solving problems','', 'BookOpen','emerald',1,array['grade_9']),
('g9-personality-2','personality','Working with numbers','', 'BookOpen','emerald',2,array['grade_9']),
('g9-personality-3','personality','Building or making things','', 'BookOpen','emerald',3,array['grade_9']),
('g9-personality-4','personality','Helping people','', 'BookOpen','emerald',4,array['grade_9']),
('g9-personality-5','personality','Using computers','', 'BookOpen','emerald',5,array['grade_9']),
('g9-personality-6','personality','Designing or creating','', 'BookOpen','emerald',6,array['grade_9']),
('g9-personality-7','personality','Understanding how things work','', 'BookOpen','emerald',7,array['grade_9']),
('g9-personality-8','personality','Leading or organising','', 'BookOpen','emerald',8,array['grade_9']),
('g9-personality-9','personality','Writing or communicating','', 'BookOpen','emerald',9,array['grade_9']),
('g9-future_interest-1','future_interest','Engineering','', 'BookOpen','emerald',1,array['grade_9']),
('g9-future_interest-2','future_interest','Computer Science & Technology','', 'BookOpen','emerald',2,array['grade_9']),
('g9-future_interest-3','future_interest','Health & Medicine','', 'BookOpen','emerald',3,array['grade_9']),
('g9-future_interest-4','future_interest','Business','', 'BookOpen','emerald',4,array['grade_9']),
('g9-future_interest-5','future_interest','Accounting & Finance','', 'BookOpen','emerald',5,array['grade_9']),
('g9-future_interest-6','future_interest','Law','', 'BookOpen','emerald',6,array['grade_9']),
('g9-future_interest-7','future_interest','Architecture & Built Environment','', 'BookOpen','emerald',7,array['grade_9']),
('g9-future_interest-8','future_interest','Education','', 'BookOpen','emerald',8,array['grade_9']),
('g9-future_interest-9','future_interest','Science','', 'BookOpen','emerald',9,array['grade_9']),
('g9-future_interest-10','future_interest','Creative fields','', 'BookOpen','emerald',10,array['grade_9']);


commit;
