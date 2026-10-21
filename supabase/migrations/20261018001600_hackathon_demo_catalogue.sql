-- v10. Synthetic hackathon fixtures. Existing official records and IDs remain.
begin;
-- Provenance remains mandatory for non-demo data. Synthetic data has no source URL.
do $$ declare t text;begin
 foreach t in array array['via_opportunities','via_faculties','via_programme_requirements','via_application_cycles','via_admission_rules','via_bursary_programmes','via_bursary_institutions','via_accommodation_institutions'] loop
  execute format('alter table public.%I add column is_demo boolean not null default false',t);
  execute format('alter table public.%I alter column source_url drop not null',t);
  execute format('alter table public.%I alter column last_verified_at drop not null',t);
  execute format('alter table public.%I add constraint real_provenance_required check(is_demo or (source_url is not null and last_verified_at is not null))',t);
 end loop;
end $$;
alter table public.via_programmes add column study_mode text;
alter table public.via_admission_rules drop constraint via_admission_rules_scoring_system_check;
alter table public.via_admission_rules add constraint via_admission_rules_scoring_system_check check(scoring_system in ('uj_nsc_six_v1','nsc_six_v1','demo_nsc_six_v1','unsupported','no_aps'));

do $$
declare inst record; fac record; unit text; theme text; titles text[]; title text;
 i integer:=0; j integer; k integer; sequence integer:=0; aps integer; english integer; maths integer;
 programme uuid; funding uuid; accommodation uuid; qualification text; duration text; gate text;
 subjects jsonb; subject_rule jsonb; unit_names text[]:=array['Faculty of Engineering','Faculty of Science','Faculty of Business','Faculty of Humanities','Faculty of Education'];
begin
 for inst in select o.*,n.abbreviation from public.via_opportunities o join public.via_institutions n on n.id=o.id where o.kind='institutions' and o.published order by o.id loop
  i:=i+1;
  update public.via_opportunities set is_demo=true where id=inst.id;
  if (select count(*) from public.via_faculties where institution_id=inst.id)>5 then raise exception 'Expected at most five existing faculties per demo institution';end if;
  foreach unit in array unit_names loop
   exit when (select count(*) from public.via_faculties where institution_id=inst.id)=5;
   if exists(select 1 from public.via_faculties f where f.institution_id=inst.id and case
    when unit='Faculty of Engineering' then f.name ~* 'engineering'
    when unit='Faculty of Business' then f.name ~* 'account|business|economic|commerce'
    when unit='Faculty of Science' then f.name in ('Faculty of Science','Science')
    when unit='Faculty of Humanities' then f.name ~* 'humanities'
    else f.name ~* 'education' end) then continue;end if;
   insert into public.via_faculties(institution_id,name,source_url,source_name,last_verified_at,is_demo)
   values(inst.id,unit,null,'VIA synthetic demo',null,true) on conflict(institution_id,name) do nothing;
  end loop;
  update public.via_faculties set is_demo=true where institution_id=inst.id;
  insert into public.via_application_cycles(id,opportunity_id,label,academic_year,opens_on,closes_on,fee,fee_note,source_url,source_name,last_verified_at,is_demo)
  values(('d5000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,inst.id,'Demo application cycle',2027,'2026-04-01',('2026-11-'||lpad((10+i)::text,2,'0'))::date,case when i%3=0 then 0 else 50+i*25 end,'Synthetic demo fee and dates; not official admissions information.',null,'VIA synthetic demo',null,true);

  funding:=('d3000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  accommodation:=('d4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into public.via_opportunities(id,kind,slug,title,overview,location,province,source_url,source_name,last_verified_at,academic_year,published,is_demo) values
  (funding,'bursaries','demo-study-fund-'||i,'VIA Demo Study Fund — '||coalesce(inst.abbreviation,inst.title),'Synthetic funding opportunity for the hackathon. No real award, eligibility or application is implied.',inst.location,inst.province,null,'VIA synthetic demo',null,2027,true,true),
  (accommodation,'accommodation','demo-residence-'||i,'VIA Demo Residence — '||coalesce(inst.abbreviation,inst.title),'Synthetic student accommodation for exploring the connected demo. Not an actual residence or booking offer.',inst.location,inst.province,null,'VIA synthetic demo',null,2027,true,true);
  insert into public.via_bursaries(id,provider,funding_type,fields,study_levels,coverage,institution_ids)
  values(funding,'VIA Demo Foundation','Demo bursary',array['Engineering','Science','Technology','Business','Humanities','Education'],array['Undergraduate','Diploma','Higher Certificate'],array['Tuition','Books','Accommodation'],array[inst.id]);
  insert into public.via_bursary_institutions(bursary_id,institution_id,relationship_note,source_url,source_name,last_verified_at,is_demo)
  values(funding,inst.id,'Synthetic demo association; not a real funding offer.',null,'VIA synthetic demo',null,true);
  insert into public.via_accommodations(id,accommodation_type,starting_price,price_period,room_types,amenities)
  values(accommodation,'Demo student residence',3200+i*175,'month',array['Single','Shared'],array['Wi-Fi','Study area','Laundry']);
  insert into public.via_accommodation_institutions(accommodation_id,institution_id,source_url,source_name,last_verified_at,is_demo)
  values(accommodation,inst.id,null,'VIA synthetic demo',null,true);

  j:=0;
  for fac in select * from public.via_faculties where institution_id=inst.id order by name loop
   j:=j+1;
   theme:=case when fac.name ~* 'account|business|economic|commerce' then 'Business' when fac.name ~* 'engineering' then 'Engineering' when fac.name ~* 'informat|technology' then 'Technology' when fac.name ~* 'education' then 'Education' when fac.name ~* 'humanities' then 'Humanities' else 'Science' end;
   titles:=case theme
    when 'Engineering' then array['BEng Civil Engineering','BEng Chemical Engineering','Diploma in Construction Engineering']
    when 'Technology' then array['Bachelor of Information Technology','Bachelor of Software Engineering','Diploma in Application Development']
    when 'Business' then array['BCom Accounting','BCom Financial Management','Higher Certificate in Business Administration']
    when 'Humanities' then array['BA Psychology','BA Social Studies','Higher Certificate in Community Development']
    when 'Education' then array['BEd Foundation Phase Teaching','BEd Senior Phase Teaching','Higher Certificate in Education Support']
    else array['BSc Life Sciences','BSc Applied Mathematics','Higher Certificate in Applied Science'] end;
   for k in 1..3 loop
    sequence:=sequence+1;programme:=('d1000000-0000-4000-8000-'||lpad(sequence::text,12,'0'))::uuid;
    title:=titles[k];qualification:=case when title like 'Higher Certificate%' then 'Higher Certificate' when title like 'Diploma%' then 'Diploma' else 'Bachelor' end;
    gate:=case qualification when 'Higher Certificate' then 'certificate' when 'Diploma' then 'diploma' else 'bachelor' end;
    duration:=case qualification when 'Higher Certificate' then '1 year' when 'Diploma' then '3 years' else case when theme in ('Engineering','Education') then '4 years' else '3 years' end end;
    aps:=case qualification when 'Higher Certificate' then 16+(i+j)%7 when 'Diploma' then 22+(i+j)%7 else case when theme in ('Engineering','Science','Technology') then 28+(i+j+k)%13 else 22+(i+j+k)%12 end end;
    english:=case when qualification='Higher Certificate' then 40 else 40+5*((i+k)%5) end;
    maths:=case when qualification='Higher Certificate' then 40 when qualification='Diploma' then 40+5*(i%3) else 50+5*((i+j)%5) end;
    subjects:=jsonb_build_array(jsonb_build_object('label','English','subject_ids',array['subject-3','subject-4'],'minimum_percentage',english));
    if theme in ('Engineering','Science','Technology') then
     subjects:=subjects||jsonb_build_array(jsonb_build_object('label','Mathematics','subject_ids',array['subject-1'],'minimum_percentage',maths));
     if theme='Engineering' and qualification='Bachelor' then subjects:=subjects||jsonb_build_array(jsonb_build_object('label','Physical Sciences','subject_ids',array['subject-17'],'minimum_percentage',50+5*(i%4)));end if;
    end if;
    insert into public.via_opportunities(id,kind,slug,title,overview,location,province,source_url,source_name,last_verified_at,academic_year,published,is_demo)
    values(programme,'programmes','demo-programme-'||sequence,title,'Explore '||lower(title)||' through practical projects, subject knowledge and career preparation. Synthetic VIA hackathon programme; not an official institutional offering.',inst.location,inst.province,null,'VIA synthetic demo',null,2027,true,true);
    insert into public.via_programmes(id,institution_id,faculty_id,field,qualification,duration,minimum_aps,mathematics_required,study_mode)
    values(programme,inst.id,fac.id,theme,qualification,duration,aps,theme in ('Engineering','Science','Technology'),case when (i+j+k)%4=0 then 'Blended' when (i+j+k)%5=0 then 'Part-time' else 'Full-time' end);
    insert into public.via_admission_rules(programme_id,academic_year,scoring_system,minimum_aps,subject_rules,requirements_complete,requires_bachelor_pass,qualification_gate,notes,source_url,source_name,last_verified_at,is_demo)
    values(programme,2027,'demo_nsc_six_v1',aps,subjects,true,gate='bachelor',gate,'Synthetic demo thresholds. Six academic subjects, excluding Life Orientation; not official admissions requirements.',null,'VIA synthetic demo',null,true);
    for subject_rule in select value from jsonb_array_elements(subjects) loop
     insert into public.via_programme_requirements(programme_id,subject,minimum_percentage,detail,source_url,source_name,last_verified_at,academic_year,is_demo)
     values(programme,subject_rule->>'label',(subject_rule->>'minimum_percentage')::numeric,'Synthetic demo minimum mark; not an official requirement.',null,'VIA synthetic demo',null,2027,true);
    end loop;
    insert into public.via_bursary_programmes(bursary_id,programme_id,relationship_note,source_url,source_name,last_verified_at,is_demo)
    values(funding,programme,'Synthetic demo funding association; not a real award or eligibility decision.',null,'VIA synthetic demo',null,true);
   end loop;
  end loop;
 end loop;
 if i<>10 or sequence<>150 then raise exception 'Expected 10 institutions, 50 faculties and 150 new demo programmes';end if;
end $$;

-- Same public projection, now exposing study mode and explicit demo cycles first.
create or replace view public.via_public_opportunities with(security_invoker=true) as
select o.id,o.kind,o.title,
 to_jsonb(o)-'published' || jsonb_build_object(
 'institution_type',i.institution_type,'abbreviation',i.abbreviation,'logo_url',i.logo_url,
 'institution_id',p.institution_id,'institution_name',inst.title,'faculty',p.faculty,
 'field',p.field,'qualification',p.qualification,'duration',p.duration,'study_mode',p.study_mode,'minimum_aps',p.minimum_aps,'mathematics_required',p.mathematics_required,
 'campus',camp.name,'career_keywords',p.career_keywords,
 'programme_count',case when i.id is not null then (select count(*) from public.via_programmes q where q.institution_id=i.id) end,
 'requirements',coalesce((select jsonb_agg(to_jsonb(r)-'programme_id' order by r.recommended,r.subject,r.id) from public.via_programme_requirements r where r.programme_id=p.id),'[]'::jsonb),
 'provider',b.provider,'funding_type',b.funding_type,'fields',b.fields,'study_levels',b.study_levels,'coverage',b.coverage,'required_documents',b.required_documents,
 'eligibility',coalesce((select jsonb_agg(to_jsonb(e)-'bursary_id' order by e.id) from public.via_bursary_eligibility e where e.bursary_id=b.id),'[]'::jsonb),
 'accommodation_type',a.accommodation_type,'starting_price',a.starting_price,'price_period',a.price_period,'room_types',a.room_types,'amenities',a.amenities,
 'nsfas_compatible',a.nsfas_compatible,'nsfas_source_url',a.nsfas_source_url,'nsfas_verified_at',a.nsfas_verified_at,'contact',a.contact,
 'institutions',case when p.id is not null then jsonb_build_array(jsonb_build_object('id',inst.id,'name',inst.title)) when b.id is not null then coalesce((select jsonb_agg(jsonb_build_object('id',bo.id,'name',bo.title)) from public.via_opportunities bo where bo.id=any(b.institution_ids) and bo.kind='institutions'),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('id',ao.id,'name',ao.title,'campus',ac.name,'distance_km',ai.distance_km)) from public.via_accommodation_institutions ai join public.via_opportunities ao on ao.id=ai.institution_id left join public.via_campuses ac on ac.id=ai.campus_id where ai.accommodation_id=a.id),'[]'::jsonb) end,
 'cycles',coalesce((select jsonb_agg(to_jsonb(c)-'opportunity_id' order by c.is_demo desc,c.academic_year desc,c.label) from public.via_application_cycles c where c.opportunity_id=o.id or (p.id is not null and c.opportunity_id=p.institution_id)),'[]'::jsonb)
 ) as document
from public.via_opportunities o
left join public.via_institutions i on i.id=o.id
left join public.via_programmes p on p.id=o.id
left join public.via_opportunities inst on inst.id=p.institution_id
left join public.via_campuses camp on camp.id=p.campus_id
left join public.via_bursaries b on b.id=o.id
left join public.via_accommodations a on a.id=o.id
where (o.kind='institutions' and i.id is not null) or (o.kind='programmes' and p.id is not null and inst.id is not null) or (o.kind='bursaries' and b.id is not null) or (o.kind='accommodation' and a.id is not null);

-- In a demo institution browser, ranges/rows describe its synthetic catalogue.
create or replace view public.via_institution_programme_scores with(security_invoker=true) as
select p.id,p.institution_id,p.faculty_id,p.faculty,o.title,
 coalesce(r.minimum_aps,p.minimum_aps) as aps_min,
 greatest(coalesce(r.minimum_aps,p.minimum_aps),(select max((a->>'minimum_aps')::numeric) from jsonb_array_elements(coalesce(r.aps_alternatives,'[]')) a)) as aps_max,
 r.scoring_system,r.academic_year,
 (r.requirements_complete and r.scoring_system in ('uj_nsc_six_v1','nsc_six_v1','demo_nsc_six_v1') and r.minimum_aps is not null and (o.academic_year is null or o.academic_year=r.academic_year)) is true as comparable
from public.via_programmes p join public.via_opportunities o on o.id=p.id
left join lateral(select * from public.via_admission_rules a where a.programme_id=p.id order by a.academic_year desc limit 1) r on true
where o.is_demo or not exists(select 1 from public.via_programmes dp join public.via_opportunities d on d.id=dp.id where dp.institution_id=p.institution_id and d.is_demo and d.published);

-- Existing checker still ranks every candidate by real input checks; no fixed Top 5.
create or replace function public.check_connected_qualification(p_results jsonb,p_grade integer,p_year integer default 2027,p_limit integer default 5)
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
  if not found or not rule.requirements_complete or rule.scoring_system not in ('uj_nsc_six_v1','nsc_six_v1','demo_nsc_six_v1','no_aps') then continue; end if;
  checks:='[]';failed:=0;unknowns:=0;score:=null;required_score:=rule.minimum_aps;
  for alternative in select value from jsonb_array_elements(rule.aps_alternatives) loop
   if alternative->>'subject_id'=any(subject_ids) then required_score:=(alternative->>'minimum_aps')::numeric; end if;
  end loop;
  gate_ok:=case rule.qualification_gate when 'bachelor' then bachelor_pass when 'diploma' then diploma_pass when 'certificate' then nsc_pass else false end;
  if cardinality(subject_ids)<>7 or academic_count<>6 then unknowns:=unknowns+1;
  elsif not gate_ok then failed:=failed+1; end if;
  checks:=checks||jsonb_build_array(jsonb_build_object('label',case rule.qualification_gate when 'bachelor' then 'Bachelor academic minimum' when 'diploma' then 'Diploma academic minimum' else 'NSC academic minimum' end,'status',case when cardinality(subject_ids)<>7 or academic_count<>6 then 'unknown' when gate_ok then 'met' else 'not_met' end,'actual',null,'minimum',null));
  if rule.scoring_system in ('uj_nsc_six_v1','nsc_six_v1','demo_nsc_six_v1') then
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
  outcomes:=outcomes||jsonb_build_array(jsonb_build_object('programme',programme.document,'status',status,'learner_aps',score,'required_aps',required_score,'scoring_system',rule.scoring_system,'checks',checks,'missing',missing,'reason',case when status='exact' and rule.is_demo then 'Your current results meet these synthetic demo requirements.' when status='exact' then 'Your current results meet the listed minimum requirements.' else 'One listed requirement needs attention.' end,'rule_source_url',rule.source_url));
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
 return grouped||jsonb_build_object('grade',p_grade,'mode','eligibility','academic_year',p_year,'score',case when academic_count=6 then jsonb_build_object('value',points,'label','Six-subject APS','context','Six academic subjects, excluding Life Orientation. Demo programme requirements are synthetic.') else null end,'insights',insights,'pathways','[]'::jsonb,'unverified_count',(select count(*) from public.via_programmes)-coalesce(jsonb_array_length(outcomes),0));
end $$;

notify pgrst,'reload schema';
commit;
