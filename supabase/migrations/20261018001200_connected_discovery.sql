-- Connected public discovery v7. Read-only analysis; never persists learner marks.
begin;
alter table public.via_admission_rules drop constraint via_admission_rules_scoring_system_check;
alter table public.via_admission_rules add constraint via_admission_rules_scoring_system_check
 check(scoring_system in ('uj_nsc_six_v1','nsc_six_v1','unsupported','no_aps'));
alter table public.via_admission_rules add column qualification_gate text not null default 'bachelor'
 check(qualification_gate in ('bachelor','diploma','certificate','unknown'));
alter table public.via_admission_rules add column aps_alternatives jsonb not null default '[]' check(jsonb_typeof(aps_alternatives)='array');
alter table public.via_admission_rules add column score_source_url text check(score_source_url ~ '^https://');

create table public.via_bursary_programmes (
 bursary_id uuid not null references public.via_bursaries(id) on delete cascade,
 programme_id uuid not null references public.via_programmes(id) on delete cascade,
 relationship_note text not null,
 source_url text not null check(source_url ~ '^https://'), source_name text not null, last_verified_at timestamptz not null,
 primary key(bursary_id,programme_id)
);
create table public.via_bursary_institutions (
 bursary_id uuid not null references public.via_bursaries(id) on delete cascade,
 institution_id uuid not null references public.via_institutions(id) on delete cascade,
 relationship_note text not null,
 source_url text not null check(source_url ~ '^https://'), source_name text not null, last_verified_at timestamptz not null,
 primary key(bursary_id,institution_id)
);
create table public.via_pathway_subjects (
 subject_id text primary key references public.via_onboarding_options(id),
 related_subject_ids text[] not null,
 source_url text not null check(source_url ~ '^https://'), source_name text not null, last_verified_at timestamptz not null
);
do $$ declare t text; begin
 foreach t in array array['via_bursary_programmes','via_bursary_institutions','via_pathway_subjects'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy published_bursary_programmes on public.via_bursary_programmes for select to anon,authenticated using(
 exists(select 1 from public.via_bursaries b where b.id=bursary_id) and exists(select 1 from public.via_programmes p where p.id=programme_id));
create policy published_bursary_institutions on public.via_bursary_institutions for select to anon,authenticated using(
 exists(select 1 from public.via_bursaries b where b.id=bursary_id) and exists(select 1 from public.via_institutions i where i.id=institution_id));
create policy public_pathway_subjects on public.via_pathway_subjects for select to anon,authenticated using(true);

create function public.related_public_opportunities(p_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare item record; institution_ids uuid[]:='{}'; result jsonb;
begin
 select * into item from public.via_public_opportunities where id=p_id;
 if not found then return null; end if;
 if item.kind='institutions' then institution_ids:=array[p_id];
 elsif item.kind='programmes' then select array[institution_id] into institution_ids from public.via_programmes where id=p_id;
 elsif item.kind='accommodation' then select array_agg(institution_id) into institution_ids from public.via_accommodation_institutions where accommodation_id=p_id;
 elsif item.kind='bursaries' then
  select array_agg(distinct institution_id) into institution_ids from (
   select institution_id from public.via_bursary_institutions where bursary_id=p_id
   union select p.institution_id from public.via_bursary_programmes bp join public.via_programmes p on p.id=bp.programme_id where bp.bursary_id=p_id
  ) linked;
 end if;
 select jsonb_build_object(
 'institutions',coalesce((select jsonb_agg(document order by title,id) from public.via_public_opportunities where kind='institutions' and id=any(institution_ids)),'[]'),
 'programmes',coalesce((select jsonb_agg(document order by title,id) from (
  select v.* from public.via_public_opportunities v join public.via_programmes p on p.id=v.id where
   (item.kind in ('institutions','accommodation') and p.institution_id=any(institution_ids))
   or (item.kind='bursaries' and exists(select 1 from public.via_bursary_programmes bp where bp.programme_id=p.id and bp.bursary_id=p_id))
  order by v.title,v.id limit 12
 ) programmes),'[]'),
 'funding',coalesce((select jsonb_agg(document order by title,id) from public.via_public_opportunities v where v.kind='bursaries' and (
  (item.kind='programmes' and exists(select 1 from public.via_bursary_programmes bp where bp.bursary_id=v.id and bp.programme_id=p_id))
  or (item.kind in ('institutions','accommodation') and exists(select 1 from public.via_bursary_institutions bi where bi.bursary_id=v.id and bi.institution_id=any(institution_ids)))
 )),'[]'),
 'accommodation',coalesce((select jsonb_agg(document order by title,id) from (
  select distinct v.* from public.via_public_opportunities v join public.via_accommodation_institutions ai on ai.accommodation_id=v.id
  where v.kind='accommodation' and ai.institution_id=any(institution_ids) and v.id<>p_id order by v.title,v.id limit 12
 ) housing),'[]')
 ) into result;
 return result;
end $$;
revoke all on function public.related_public_opportunities(uuid) from public;
grant execute on function public.related_public_opportunities(uuid) to anon,authenticated;

create function public.check_connected_qualification(p_results jsonb,p_grade integer,p_year integer default 2027,p_limit integer default 5)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 row jsonb; v_subject_id text; mark numeric; subject_ids text[]:='{}'; families text[]:='{}'; family text;
 academic_count integer:=0; points integer:=0; labels jsonb:='{}'; insights jsonb:='[]';
 home_pass boolean:=false; language_count integer:=0; pass30 integer:=0; pass40 integer:=0; academic40 integer:=0; academic50 integer:=0;
 nsc_pass boolean; diploma_pass boolean; bachelor_pass boolean; gate_ok boolean;
 programme record; rule public.via_admission_rules; requirement jsonb; alternative jsonb;
 actual numeric; minimum numeric; best_margin numeric; candidate numeric; score numeric; required_score numeric;
 checks jsonb; outcomes jsonb:='[]'; missing jsonb; failed integer; unknowns integer; status text; bucket text;
 grouped jsonb:='{}'; exact_count integer; related_ids text[]:='{}'; pathways jsonb:='[]'; subject_label text;
begin
 if p_results is null or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results) not between 1 and 20 or octet_length(p_results::text)>10000
 or p_grade is null or p_grade not in (9,10,11,12) or p_year is null or p_year not between 2000 and 2200 or p_limit is null or p_limit not between 3 and 5 then
  raise exception 'Choose a grade and enter valid subject marks.' using errcode='22023'; end if;
 for row in select value from jsonb_array_elements(p_results) loop
  if jsonb_typeof(row)<>'object' or jsonb_typeof(row->'subject_id') is distinct from 'string' or jsonb_typeof(row->'mark') is distinct from 'number'
   or exists(select 1 from jsonb_object_keys(row) k where k not in ('subject_id','mark')) then raise exception 'Invalid result.' using errcode='22023'; end if;
  v_subject_id:=row->>'subject_id';mark:=(row->>'mark')::numeric;
  select s.label into subject_label from public.public_qualification_subjects() s where s.id=v_subject_id;
  if not found or mark<0 or mark>100 or v_subject_id=any(subject_ids) or (p_grade>=10 and v_subject_id like 'subject-g9-%') then
   raise exception 'Choose recognised subjects for your grade, once each, with marks between 0 and 100.' using errcode='22023'; end if;
  family:=case when v_subject_id in ('subject-1','subject-2') then 'mathematics' when v_subject_id in ('subject-3','subject-4') then 'english' when v_subject_id in ('subject-5','subject-6') then 'afrikaans' else v_subject_id end;
  if family=any(families) then raise exception 'Choose one level of each language or Mathematics subject.' using errcode='22023'; end if;
  subject_ids:=array_append(subject_ids,v_subject_id);families:=array_append(families,family);
  labels:=labels||jsonb_build_object(v_subject_id,subject_label);
  insights:=insights||jsonb_build_array(jsonb_build_object('subject_id',v_subject_id,'subject',subject_label,'mark',mark,'insight',case when mark>=70 then 'Strong' when mark>=50 then 'On track' else 'Focus area' end));
  if mark>=30 then pass30:=pass30+1; end if;if mark>=40 then pass40:=pass40+1; end if;
  if subject_label like '%Home Language' or subject_label like '%First Additional Language' then language_count:=language_count+1; end if;
  if subject_label like '%Home Language' and mark>=40 then home_pass:=true; end if;
  if v_subject_id<>'subject-16' then
   academic_count:=academic_count+1;
   points:=points+case when mark>=80 then 7 when mark>=70 then 6 when mark>=60 then 5 when mark>=50 then 4 when mark>=40 then 3 when mark>=30 then 2 else 1 end;
   if mark>=40 then academic40:=academic40+1; end if;if mark>=50 then academic50:=academic50+1; end if;
  end if;
  select array_cat(related_ids,coalesce((select related_subject_ids from public.via_pathway_subjects ps where ps.subject_id=v_subject_id),array[v_subject_id])) into related_ids;
 end loop;
 nsc_pass:=cardinality(subject_ids)=7 and academic_count=6 and home_pass and language_count>=2 and pass40>=3 and pass30>=6 and ('subject-1'=any(subject_ids) or 'subject-2'=any(subject_ids));
 diploma_pass:=nsc_pass and academic40>=4;bachelor_pass:=nsc_pass and academic50>=4;
 if p_grade in (9,10) then
  -- Future pathways are ranked by observed subject connections, never eligibility.
  with candidates as (
   select v.document,v.title,v.id,p.field,count(distinct s.id) as connections,
    coalesce(jsonb_agg(distinct jsonb_build_object('subject_id',s.id,'subject',s.label)) filter(where s.id is not null),'[]') as future_subjects
   from public.via_public_opportunities v join public.via_programmes p on p.id=v.id
   join public.via_admission_rules r on r.programme_id=p.id and r.academic_year=p_year and r.requirements_complete
   cross join lateral jsonb_array_elements(r.subject_rules) req
   cross join lateral public.public_qualification_subjects() s
   where (coalesce(req->'subject_ids','[]') ? s.id or exists(select 1 from jsonb_array_elements(coalesce(req->'alternatives','[]')) a where a->>'subject_id'=s.id)) and s.id=any(related_ids)
   group by v.document,v.title,v.id,p.field
  ), diversified as (select *,row_number() over(partition by field order by connections desc,title,id) as field_rank from candidates)
  select coalesce(jsonb_agg(jsonb_build_object('programme',document,'status','pathway','future_subjects',future_subjects,'reason','Your current subjects connect to this future study pathway. This is not a university eligibility result.') order by field_rank,connections desc,title,id),'[]') into pathways
  from (select * from diversified order by field_rank,connections desc,title,id limit p_limit) chosen;
  return jsonb_build_object('grade',p_grade,'mode','pathways','academic_year',p_year,'score',null,'insights',insights,'pathways',pathways,'exact',jsonb_build_object('total',0,'items','[]'::jsonb),'close',jsonb_build_object('total',0,'items','[]'::jsonb));
 end if;
 for programme in select v.id,v.title,v.document from public.via_public_opportunities v where v.kind='programmes' order by v.title,v.id loop
  select * into rule from public.via_admission_rules r where r.programme_id=programme.id and r.academic_year=p_year;
  if not found or not rule.requirements_complete or rule.scoring_system not in ('uj_nsc_six_v1','nsc_six_v1','no_aps') then continue; end if;
  checks:='[]';failed:=0;unknowns:=0;score:=null;required_score:=rule.minimum_aps;
  for alternative in select value from jsonb_array_elements(rule.aps_alternatives) loop
   if alternative->>'subject_id'=any(subject_ids) then required_score:=(alternative->>'minimum_aps')::numeric; end if;
  end loop;
  gate_ok:=case rule.qualification_gate when 'bachelor' then bachelor_pass when 'diploma' then diploma_pass when 'certificate' then nsc_pass else false end;
  if cardinality(subject_ids)<>7 or academic_count<>6 then unknowns:=unknowns+1;
  elsif not gate_ok then failed:=failed+1; end if;
  checks:=checks||jsonb_build_array(jsonb_build_object('label',case rule.qualification_gate when 'bachelor' then 'Bachelor academic minimum' when 'diploma' then 'Diploma academic minimum' else 'NSC academic minimum' end,'status',case when cardinality(subject_ids)<>7 or academic_count<>6 then 'unknown' when gate_ok then 'met' else 'not_met' end,'actual',null,'minimum',null));
  if rule.scoring_system in ('uj_nsc_six_v1','nsc_six_v1') then
   if academic_count=6 then score:=points;if score<required_score then failed:=failed+1; end if;else unknowns:=unknowns+1;end if;
   checks:=checks||jsonb_build_array(jsonb_build_object('label','APS','status',case when score is null then 'unknown' when score>=required_score then 'met' else 'not_met' end,'actual',score,'minimum',required_score));
  end if;
  for requirement in select value from jsonb_array_elements(rule.subject_rules) loop
   actual:=null;minimum:=null;best_margin:=null;
   if requirement ? 'alternatives' then
    for alternative in select value from jsonb_array_elements(requirement->'alternatives') loop
     select (value->>'mark')::numeric into candidate from jsonb_array_elements(p_results) where value->>'subject_id'=alternative->>'subject_id';
     if found and (best_margin is null or candidate-(alternative->>'minimum_percentage')::numeric>best_margin) then
      actual:=candidate;minimum:=(alternative->>'minimum_percentage')::numeric;best_margin:=actual-minimum;
     end if;
    end loop;
   else
    select max((value->>'mark')::numeric) into actual from jsonb_array_elements(p_results) where (requirement->'subject_ids') ? (value->>'subject_id');minimum:=(requirement->>'minimum_percentage')::numeric;
   end if;
   if actual is null then unknowns:=unknowns+1;elsif actual<minimum then failed:=failed+1;end if;
   checks:=checks||jsonb_build_array(jsonb_build_object('label',requirement->>'label','status',case when actual is null then 'unknown' when actual>=minimum then 'met' else 'not_met' end,'actual',actual,'minimum',minimum,'subject_ids',coalesce(requirement->'subject_ids','[]'),'alternatives',coalesce(requirement->'alternatives','[]')));
  end loop;
  status:=case when unknowns>0 then 'unverified' when failed=0 then 'exact' when failed=1 then 'close' else 'not_met' end;
  select coalesce(jsonb_agg(value),'[]') into missing from jsonb_array_elements(checks) where value->>'status'='not_met';
  outcomes:=outcomes||jsonb_build_array(jsonb_build_object('programme',programme.document,'status',status,'learner_aps',score,'required_aps',required_score,'scoring_system',rule.scoring_system,'checks',checks,'missing',missing,'reason',case when status='exact' then 'Your current results meet the listed minimum requirements.' else 'One listed requirement needs attention.' end,'rule_source_url',rule.source_url));
 end loop;
 select count(*) into exact_count from jsonb_array_elements(outcomes) where value->>'status'='exact';
 foreach bucket in array array['exact','close'] loop
  select jsonb_build_object('total',(select count(*) from jsonb_array_elements(outcomes) where value->>'status'=bucket),'items',coalesce((select jsonb_agg(value order by (value->>'required_aps')::numeric desc nulls last,value->'programme'->>'title') from (
   select value from jsonb_array_elements(outcomes) where value->>'status'=bucket
   order by case when bucket='close' then (select sum(greatest(0,(c->>'minimum')::numeric-(c->>'actual')::numeric)) from jsonb_array_elements(value->'missing') c) else 0 end,
    (value->>'required_aps')::numeric desc nulls last,value->'programme'->>'title'
   limit case when bucket='exact' then p_limit else greatest(0,p_limit-least(p_limit,exact_count)) end
  ) ranked),'[]')) into row;
  grouped:=grouped||jsonb_build_object(bucket,row);
 end loop;
 return grouped||jsonb_build_object('grade',p_grade,'mode','eligibility','academic_year',p_year,'score',case when academic_count=6 then jsonb_build_object('value',points,'label','Six-subject APS','context','UJ / UNISA calculation; other institutions may calculate APS differently.') else null end,'insights',insights,'pathways','[]'::jsonb,'unverified_count',(select count(*) from public.via_programmes)-coalesce(jsonb_array_length(outcomes),0));
end $$;
revoke all on function public.check_connected_qualification(jsonb,integer,integer,integer) from public;
grant execute on function public.check_connected_qualification(jsonb,integer,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
