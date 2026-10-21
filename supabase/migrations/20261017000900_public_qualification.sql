-- v5: public, read-only minimum-requirements checker. No marks are persisted.
begin;
create table public.via_admission_rules (
 programme_id uuid not null references public.via_programmes(id) on delete cascade,
 academic_year integer not null check(academic_year between 2000 and 2200),
 scoring_system text not null check(scoring_system in ('uj_nsc_six_v1','unsupported','no_aps')),
 minimum_aps numeric check(minimum_aps>0),
 subject_rules jsonb not null default '[]' check(jsonb_typeof(subject_rules)='array'),
 requirements_complete boolean not null default false,
 requires_bachelor_pass boolean not null default true,
 notes text not null,
 source_url text not null check(source_url ~ '^https://'), source_name text not null,
 last_verified_at timestamptz not null,
 primary key(programme_id,academic_year)
);
alter table public.via_admission_rules enable row level security;
revoke all on public.via_admission_rules from public,anon,authenticated;
grant select on public.via_admission_rules to anon,authenticated;
grant all on public.via_admission_rules to service_role;
create policy admission_rule_published on public.via_admission_rules for select to anon,authenticated
 using(exists(select 1 from public.via_programmes p where p.id=programme_id));

-- Expose only public subject names, not the private onboarding catalogue/answers.
create function public.public_qualification_subjects()
returns table(id text,label text) language sql stable security definer set search_path=''
as $$ select o.id,o.label from public.via_onboarding_options o where o.category='subject' and o.active order by o.sort_order,o.id $$;
revoke all on function public.public_qualification_subjects() from public;
grant execute on function public.public_qualification_subjects() to anon,authenticated;

create function public.check_public_qualification(p_results jsonb,p_nsc boolean,p_bachelor_pass boolean,p_year integer default 2027,p_page integer default 1,p_page_size integer default 12)
returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare
 row jsonb; subject_ids text[]:='{}'; family_ids text[]:='{}'; family text; subject_id text; mark numeric;
 programme record; rule public.via_admission_rules; requirement jsonb; checks jsonb; outcomes jsonb:='[]';
 actual numeric; score numeric; countable integer:=0; calculated_score integer:=0; failed integer; unknowns integer;
 status text; reason text; supported boolean; bucket text; grouped jsonb:='{}';
begin
 if p_results is null or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results) not between 1 and 20
  or octet_length(p_results::text)>10000 or p_nsc is null or p_bachelor_pass is null
  or p_year is null or p_year not between 2000 and 2200 or p_page is null or p_page not between 1 and 10000
  or p_page_size is null or p_page_size not between 1 and 24 then
  raise exception 'Enter confirmed subjects and marks between 0 and 100.' using errcode='22023';
 end if;
 for row in select value from jsonb_array_elements(p_results) loop
  if jsonb_typeof(row)<>'object' or jsonb_typeof(row->'subject_id') is distinct from 'string'
   or jsonb_typeof(row->'mark') is distinct from 'number'
   or exists(select 1 from jsonb_object_keys(row) k where k not in ('subject_id','mark')) then
   raise exception 'Invalid subject result.' using errcode='22023'; end if;
  subject_id:=row->>'subject_id'; mark:=(row->>'mark')::numeric;
  if mark<0 or mark>100 or subject_id=any(subject_ids) or not exists(select 1 from public.public_qualification_subjects() s where s.id=subject_id) then
   raise exception 'Choose each recognised subject once and a mark between 0 and 100.' using errcode='22023'; end if;
  -- Alternative levels of the same subject must never double-count towards APS.
  family:=case when subject_id in ('subject-1','subject-2') then 'mathematics'
    when subject_id in ('subject-3','subject-4') then 'english'
    when subject_id in ('subject-5','subject-6') then 'afrikaans' else subject_id end;
  if family=any(family_ids) then raise exception 'Enter only one level of each language or Mathematics subject.' using errcode='22023'; end if;
  subject_ids:=array_append(subject_ids,subject_id); family_ids:=array_append(family_ids,family);
  if subject_id<>'subject-16' then
   countable:=countable+1;
   calculated_score:=calculated_score+case when mark>=80 then 7 when mark>=70 then 6 when mark>=60 then 5 when mark>=50 then 4 when mark>=40 then 3 when mark>=30 then 2 else 1 end;
  end if;
 end loop;
 -- Evaluate in the database; only a bounded page from each result category leaves it.
 for programme in select v.id,v.title,v.document from public.via_public_opportunities v where v.kind='programmes' order by v.title,v.id loop
  select * into rule from public.via_admission_rules r where r.programme_id=programme.id and r.academic_year=p_year;
  supported:=found and rule.requirements_complete and rule.scoring_system in ('uj_nsc_six_v1','no_aps');
  checks:='[]'; failed:=0; unknowns:=0; score:=null;
  if supported then
   if not p_nsc then unknowns:=unknowns+1; end if;
   checks:=checks||jsonb_build_array(jsonb_build_object('label','NSC / IEB results','status',case when p_nsc then 'met' else 'unknown' end,'actual',null,'minimum',null));
   if rule.requires_bachelor_pass then
    if not p_bachelor_pass then unknowns:=unknowns+1; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('label','Bachelor admission endorsement confirmed','status',case when p_bachelor_pass then 'met' else 'unknown' end,'actual',null,'minimum',null));
   end if;
   if rule.scoring_system='uj_nsc_six_v1' then
    if p_nsc and countable=6 then
     score:=calculated_score;
     if score<rule.minimum_aps then failed:=failed+1; end if;
    else unknowns:=unknowns+1; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('label','UJ APS (six subjects; excludes Life Orientation)','actual',score,'minimum',rule.minimum_aps,'status',case when score is null then 'unknown' when score>=rule.minimum_aps then 'met' else 'not_met' end));
   end if;
   for requirement in select value from jsonb_array_elements(rule.subject_rules) loop
    select max((r->>'mark')::numeric) into actual from jsonb_array_elements(p_results) r where (requirement->'subject_ids') ? (r->>'subject_id');
    if actual is null then unknowns:=unknowns+1; elsif actual<(requirement->>'minimum_percentage')::numeric then failed:=failed+1; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('label',requirement->>'label','actual',actual,'minimum',(requirement->>'minimum_percentage')::numeric,'status',case when actual is null then 'unknown' when actual>=(requirement->>'minimum_percentage')::numeric then 'met' else 'not_met' end));
   end loop;
   if unknowns>0 then status:='unverified'; reason:='Confirm the missing subjects, NSC/IEB qualification and bachelor endorsement. UJ APS requires exactly six academic subjects, excluding Life Orientation.';
   elsif failed=0 then status:='meets'; reason:='Your confirmed results meet every listed subject threshold and the programme-specific APS minimum.';
   elsif failed=1 then status:='close'; reason:='One listed requirement needs attention. This is not an eligibility approval.';
   else status:='not_met'; reason:='More than one listed minimum requirement is not met.'; end if;
  else status:='unverified'; reason:='Check institution requirements. Complete admissions rules or a supported score calculation are not verified for this intake.'; end if;
  outcomes:=outcomes||jsonb_build_array(jsonb_build_object('programme',programme.document,'status',status,'learner_aps',score,'required_aps',rule.minimum_aps,'checks',checks,'reason',reason,'rule_source_url',rule.source_url,'rule_source_name',rule.source_name,'notes',rule.notes));
 end loop;
 foreach bucket in array array['meets','close','not_met','unverified'] loop
  grouped:=grouped||jsonb_build_object(bucket,jsonb_build_object('total',(select count(*) from jsonb_array_elements(outcomes) x where x->>'status'=bucket),'items',coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(outcomes) x where x->>'status'=bucket offset (p_page-1)*p_page_size limit p_page_size) paged),'[]'::jsonb)));
 end loop;
 return jsonb_build_object('groups',grouped,'academic_year',p_year,'page',p_page,'page_size',p_page_size);
end $$;
revoke all on function public.check_public_qualification(jsonb,boolean,boolean,integer,integer,integer) from public;
grant execute on function public.check_public_qualification(jsonb,boolean,boolean,integer,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
