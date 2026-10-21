import fs from 'node:fs'
const records=JSON.parse(fs.readFileSync('supabase/catalogue/public_catalogue_v5.json','utf8'))
const sql=`-- Source-reviewed v5 catalogue. Updates preserve opportunity IDs and saved links.
begin;
do $seed$
declare d jsonb; r jsonb;
begin
 for d in select value from jsonb_array_elements($catalogue$${JSON.stringify(records)}$catalogue$::jsonb) loop
  insert into public.via_opportunities(id,kind,slug,title,overview,location,province,website_url,application_url,image_url,source_url,source_name,last_verified_at,academic_year,published)
  values((d->>'id')::uuid,d->>'kind',d->>'slug',d->>'title',d->>'overview',d->>'location',d->>'province',d->>'website_url',d->>'application_url',d->>'image_url',d->>'source_url',d->>'source_name',(d->>'last_verified_at')::timestamptz,(d->>'academic_year')::integer,true)
  on conflict(id) do update set title=excluded.title,overview=excluded.overview,location=excluded.location,province=excluded.province,website_url=excluded.website_url,application_url=excluded.application_url,image_url=excluded.image_url,source_url=excluded.source_url,source_name=excluded.source_name,last_verified_at=excluded.last_verified_at,academic_year=excluded.academic_year;
  if d->>'kind'='institutions' then
   insert into public.via_institutions(id,abbreviation,institution_type,logo_url) values((d->>'id')::uuid,d->>'abbreviation',d->>'institution_type',d->>'logo_url')
   on conflict(id) do update set abbreviation=excluded.abbreviation,institution_type=excluded.institution_type,logo_url=excluded.logo_url;
  elsif d->>'kind'='programmes' then
   insert into public.via_programmes(id,institution_id,faculty,field,qualification,duration,minimum_aps,mathematics_required,career_keywords)
   values((d->>'id')::uuid,(d->>'institution_id')::uuid,d->>'faculty',d->>'field',d->>'qualification',d->>'duration',(d->>'minimum_aps')::numeric,(d->>'mathematics_required')::boolean,array(select jsonb_array_elements_text(coalesce(nullif(d->'career_keywords','null'),'[]'))))
   on conflict(id) do update set faculty=excluded.faculty,field=excluded.field,qualification=excluded.qualification,duration=excluded.duration,minimum_aps=excluded.minimum_aps,mathematics_required=excluded.mathematics_required;
   delete from public.via_programme_requirements where via_programme_requirements.programme_id=(d->>'id')::uuid;
   for r in select value from jsonb_array_elements(d->'requirements') loop
    insert into public.via_programme_requirements(programme_id,subject,minimum_percentage,detail,recommended,source_url,source_name,last_verified_at,academic_year)
    values((d->>'id')::uuid,r->>'subject',(r->>'minimum_percentage')::numeric,r->>'detail',coalesce((r->>'recommended')::boolean,false),r->>'source_url',r->>'source_name',(r->>'last_verified_at')::timestamptz,(r->>'academic_year')::integer);
   end loop;
   if d ? 'admission_rule' then
    r:=d->'admission_rule';
    insert into public.via_admission_rules(programme_id,academic_year,scoring_system,minimum_aps,subject_rules,requirements_complete,requires_bachelor_pass,notes,source_url,source_name,last_verified_at)
    values((d->>'id')::uuid,(r->>'academic_year')::integer,r->>'scoring_system',(r->>'minimum_aps')::numeric,r->'subject_rules',(r->>'requirements_complete')::boolean,(r->>'requires_bachelor_pass')::boolean,r->>'notes',r->>'source_url',r->>'source_name',(r->>'last_verified_at')::timestamptz)
    on conflict(programme_id,academic_year) do update set scoring_system=excluded.scoring_system,minimum_aps=excluded.minimum_aps,subject_rules=excluded.subject_rules,requirements_complete=excluded.requirements_complete,requires_bachelor_pass=excluded.requires_bachelor_pass,notes=excluded.notes,source_url=excluded.source_url,source_name=excluded.source_name,last_verified_at=excluded.last_verified_at;
   end if;
  elsif d->>'kind'='bursaries' then
   insert into public.via_bursaries(id,provider,funding_type,fields,study_levels,coverage,required_documents)
   values((d->>'id')::uuid,d->>'provider',d->>'funding_type',array(select jsonb_array_elements_text(coalesce(nullif(d->'fields','null'),'[]'))),array(select jsonb_array_elements_text(coalesce(nullif(d->'study_levels','null'),'[]'))),array(select jsonb_array_elements_text(coalesce(nullif(d->'coverage','null'),'[]'))),array(select jsonb_array_elements_text(coalesce(nullif(d->'required_documents','null'),'[]'))))
   on conflict(id) do update set provider=excluded.provider,funding_type=excluded.funding_type,fields=excluded.fields,study_levels=excluded.study_levels,coverage=excluded.coverage,required_documents=excluded.required_documents;
   delete from public.via_bursary_eligibility where bursary_id=(d->>'id')::uuid;
   for r in select value from jsonb_array_elements(d->'eligibility') loop
    insert into public.via_bursary_eligibility(bursary_id,criterion,source_url,source_name,last_verified_at,academic_year)
    values((d->>'id')::uuid,r->>'criterion',r->>'source_url',r->>'source_name',(r->>'last_verified_at')::timestamptz,(r->>'academic_year')::integer);
   end loop;
  else
   insert into public.via_accommodations(id,accommodation_type,starting_price,price_period,room_types,amenities,nsfas_compatible,nsfas_source_url,nsfas_verified_at,contact)
   values((d->>'id')::uuid,d->>'accommodation_type',(d->>'starting_price')::numeric,d->>'price_period',array(select jsonb_array_elements_text(coalesce(nullif(d->'room_types','null'),'[]'))),array(select jsonb_array_elements_text(coalesce(nullif(d->'amenities','null'),'[]'))),(d->>'nsfas_compatible')::boolean,d->>'nsfas_source_url',(d->>'nsfas_verified_at')::timestamptz,d->>'contact')
   on conflict(id) do update set starting_price=excluded.starting_price,price_period=excluded.price_period,room_types=excluded.room_types,amenities=excluded.amenities,nsfas_compatible=excluded.nsfas_compatible,nsfas_source_url=excluded.nsfas_source_url,nsfas_verified_at=excluded.nsfas_verified_at,contact=excluded.contact;
   for r in select value from jsonb_array_elements(d->'institutions') loop
    insert into public.via_accommodation_institutions(accommodation_id,institution_id,source_url,source_name,last_verified_at)
    values((d->>'id')::uuid,(r->>'id')::uuid,d->>'source_url',d->>'source_name',(d->>'last_verified_at')::timestamptz)
    on conflict(accommodation_id,institution_id) do nothing;
   end loop;
  end if;
  delete from public.via_application_cycles where opportunity_id=(d->>'id')::uuid;
  for r in select value from jsonb_array_elements(d->'cycles') loop
   insert into public.via_application_cycles(opportunity_id,label,academic_year,opens_on,closes_on,fee,fee_note,source_url,source_name,last_verified_at)
   values((d->>'id')::uuid,r->>'label',(r->>'academic_year')::integer,(r->>'opens_on')::date,(r->>'closes_on')::date,(r->>'fee')::numeric,r->>'fee_note',r->>'source_url',r->>'source_name',(r->>'last_verified_at')::timestamptz);
  end loop;
 end loop;
end $seed$;
commit;
`
const output='supabase/migrations/20261017001100_verified_discovery_catalogue_fix.sql'
if(fs.existsSync(output)&&fs.readFileSync(output,'utf8')!==sql)throw new Error('Released migration is immutable. Create a new version.')
fs.writeFileSync(output,sql)
console.log('Built source-reviewed v5 catalogue migration; no database changed.')
