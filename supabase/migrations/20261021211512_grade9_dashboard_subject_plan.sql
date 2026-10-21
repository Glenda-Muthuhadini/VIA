-- Grade 9 dashboard planning only. Apply once after v12.
-- This does not update onboarding, academic records, interests or other stages.
begin;

create table public.via_grade9_plans (
 user_id uuid primary key references public.via_profiles(id) on delete cascade,
 shortlisted_subject_ids text[] not null default '{}',
 explored_subject_ids text[] not null default '{}',
 reviewed_results boolean not null default false,
 reviewed_results_key text not null default '' check(char_length(reviewed_results_key)<=200),
 maths_reviewed boolean not null default false,
 explored_pathway_ids text[] not null default '{}',
 plan_reviewed boolean not null default false,
 algebra_feeling text not null default '' check(algebra_feeling in ('','I enjoy it / I''m prepared to work at it','It''s okay','I struggle with it','I''m not sure')),
 dream_areas text not null default '' check(char_length(dream_areas)<=1000),
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz not null default now(),
 check(cardinality(shortlisted_subject_ids)<=20),
 check(cardinality(explored_subject_ids)<=50),
 check(cardinality(explored_pathway_ids)<=30)
);
alter table public.via_grade9_plans enable row level security;
create policy via_grade9_plan_owner_read on public.via_grade9_plans
 for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.via_grade9_plans from public,anon,authenticated;
grant select on public.via_grade9_plans to authenticated;
grant all on public.via_grade9_plans to service_role;

-- Keep privileged validation in a non-exposed schema. The public RPC is an
-- invoker wrapper; only this authenticated function can write planning state.
create schema via_grade9_private;
revoke all on schema via_grade9_private from public,anon,authenticated;
grant usage on schema via_grade9_private to authenticated,service_role;

create function via_grade9_private.save_plan(p_patch jsonb,p_expected_revision bigint)
returns public.via_grade9_plans language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); previous public.via_grade9_plans; saved public.via_grade9_plans;
 field text; item jsonb; ids text[]; initial_ids text[]; key text;
begin
 if owner_id is null then raise exception 'Sign in before saving a plan' using errcode='42501';end if;
 if not exists(select 1 from public.via_profiles where id=owner_id and education_stage='grade_9') then
  raise exception 'Grade 9 planning requires a Grade 9 profile' using errcode='42501';end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid plan revision' using errcode='22023';end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or octet_length(p_patch::text)>16384 then
  raise exception 'Invalid planning update' using errcode='22023';end if;
 for key in select jsonb_object_keys(p_patch) loop
  if key not in ('shortlisted_subject_ids','explored_subject_ids','reviewed_results','reviewed_results_key','maths_reviewed','explored_pathway_ids','plan_reviewed','algebra_feeling','dream_areas') then
   raise exception 'Unknown planning field' using errcode='22023';end if;
 end loop;
 foreach field in array array['reviewed_results','maths_reviewed','plan_reviewed'] loop
  if p_patch ? field and jsonb_typeof(p_patch->field)<>'boolean' then raise exception 'Invalid planning acknowledgement' using errcode='22023';end if;
 end loop;
 foreach field in array array['algebra_feeling','dream_areas','reviewed_results_key'] loop
  if p_patch ? field and jsonb_typeof(p_patch->field)<>'string' then raise exception 'Invalid planning answer' using errcode='22023';end if;
 end loop;
 foreach field in array array['shortlisted_subject_ids','explored_subject_ids','explored_pathway_ids'] loop
  if p_patch ? field then
   if jsonb_typeof(p_patch->field)<>'array' then raise exception 'Invalid planning list' using errcode='22023';end if;
   if jsonb_array_length(p_patch->field)>50 then raise exception 'Planning list is too long' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(p_patch->field) loop
    if jsonb_typeof(item)<>'string' then raise exception 'Invalid planning list item' using errcode='22023';end if;
   end loop;
   select array_agg(value) into ids from jsonb_array_elements_text(p_patch->field);
   if cardinality(ids)<>(select count(distinct value) from unnest(ids) value) then
    raise exception 'Planning lists cannot contain duplicates' using errcode='22023';end if;
   if field='explored_pathway_ids' then
    if exists(select 1 from unnest(ids) value where value not in ('technology','engineering','health','business','creative','humanities','agriculture','education','law','services','environment')) then
     raise exception 'Unknown study pathway' using errcode='22023';end if;
   elsif exists(select 1 from unnest(ids) value where not exists(
    select 1 from public.via_onboarding_options o where o.id=value and o.category='subject' and o.active
     and (o.education_stages is null or 'grade_10'=any(o.education_stages))
     and o.id not like 'subject-g9-%' and o.label !~* 'home language|additional language|life orientation'
   )) then raise exception 'Choose valid Grade 10 planning subjects' using errcode='22023';end if;
  end if;
 end loop;

 -- Serialize one learner's first save as well as subsequent revisions. This
 -- never locks other learners or updates their onboarding revision.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('grade9-plan:'||owner_id::text,0));
 select * into previous from public.via_grade9_plans where user_id=owner_id for update;
 if not found then
  if p_expected_revision<>0 then raise exception 'Plan changed. Reload before saving.' using errcode='40001';end if;
  select coalesce(array_agg(o.id order by o.sort_order),'{}') into initial_ids
  from public.via_grade9_onboarding g join public.via_onboarding_options o on o.id=any(g.subjects_considering)
  where g.user_id=owner_id and o.category='subject' and o.active
   and (o.education_stages is null or 'grade_10'=any(o.education_stages))
   and o.id not like 'subject-g9-%' and o.label !~* 'home language|additional language|life orientation';
  insert into public.via_grade9_plans(user_id,shortlisted_subject_ids) values(owner_id,initial_ids) returning * into previous;
 elsif previous.revision<>p_expected_revision then
  raise exception 'Plan changed. Reload before saving.' using errcode='40001';
 end if;
 saved:=jsonb_populate_record(previous,p_patch);
 saved.user_id:=owner_id;
 saved.dream_areas:=btrim(saved.dream_areas);
 if saved.shortlisted_subject_ids is distinct from previous.shortlisted_subject_ids then saved.plan_reviewed:=false;end if;
 if saved.reviewed_results and (saved.reviewed_results_key='' or not exists(
  select 1 from public.via_academic_records a join public.via_academic_results r on r.record_id=a.id
   where a.user_id=owner_id and a.grade=9
 )) then raise exception 'Add and review saved Grade 9 results first' using errcode='22023';end if;
 if saved.plan_reviewed and (cardinality(saved.shortlisted_subject_ids)=0 or not saved.maths_reviewed) then
  raise exception 'Explore Maths and add subjects before reviewing your plan' using errcode='22023';end if;
 saved.revision:=previous.revision+1;saved.updated_at:=now();
 update public.via_grade9_plans set
  shortlisted_subject_ids=saved.shortlisted_subject_ids,explored_subject_ids=saved.explored_subject_ids,
  reviewed_results=saved.reviewed_results,reviewed_results_key=saved.reviewed_results_key,maths_reviewed=saved.maths_reviewed,
  explored_pathway_ids=saved.explored_pathway_ids,plan_reviewed=saved.plan_reviewed,
  algebra_feeling=saved.algebra_feeling,dream_areas=saved.dream_areas,revision=saved.revision,updated_at=saved.updated_at
 where user_id=owner_id returning * into saved;
 return saved;
end;$$;
revoke all on function via_grade9_private.save_plan(jsonb,bigint) from public,anon,authenticated;
grant execute on function via_grade9_private.save_plan(jsonb,bigint) to authenticated;

create function public.save_my_grade9_plan(p_patch jsonb,p_expected_revision bigint)
returns public.via_grade9_plans language sql security invoker set search_path='' as $$
 select via_grade9_private.save_plan(p_patch,p_expected_revision);
$$;
revoke all on function public.save_my_grade9_plan(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.save_my_grade9_plan(jsonb,bigint) to authenticated;
comment on table public.via_grade9_plans is 'Owner-only Grade 9 planning actions, separate from confirmed school subjects and onboarding.';
notify pgrst,'reload schema';
commit;
