-- VIA PUBLIC DISCOVERY v4. Apply ONCE after adaptive onboarding v3.
-- Public catalogue + owner-only saved opportunities; no auth/onboarding changes.
begin;
-- SOURCE: supabase/migrations/20261016000700_public_discovery.sql
-- Public catalogue shared by discovery and future personalised services.
create table public.via_opportunities (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('institutions','programmes','bursaries','accommodation')),
 slug text not null unique, title text not null, overview text not null,
 location text, province text, website_url text check(website_url ~ '^https://'),
 application_url text check(application_url ~ '^https://'), image_url text check(image_url ~ '^https://'),
 source_url text not null check(source_url ~ '^https://'), source_name text not null,
 last_verified_at timestamptz not null, academic_year integer check(academic_year between 2000 and 2200),
 published boolean not null default false, created_at timestamptz not null default now()
);
create index via_opportunities_kind_title on public.via_opportunities(kind,title) where published;
create index via_opportunities_search on public.via_opportunities using gin(to_tsvector('simple',title||' '||overview||' '||coalesce(location,'')));
create table public.via_institutions (
 id uuid primary key references public.via_opportunities(id) on delete cascade,
 abbreviation text, institution_type text not null, logo_url text check(logo_url ~ '^https://')
);
create table public.via_campuses (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.via_institutions(id),
 name text not null, location text, source_url text not null check(source_url ~ '^https://'),
 source_name text not null, last_verified_at timestamptz not null
);
create table public.via_programmes (
 id uuid primary key references public.via_opportunities(id) on delete cascade,
 institution_id uuid not null references public.via_institutions(id), campus_id uuid references public.via_campuses(id),
 faculty text, field text not null, qualification text not null, duration text,
 minimum_aps numeric check(minimum_aps>0), mathematics_required boolean, career_keywords text[] not null default '{}'
);
create index via_programmes_institution on public.via_programmes(institution_id);
create table public.via_programme_requirements (
 id uuid primary key default gen_random_uuid(), programme_id uuid not null references public.via_programmes(id) on delete cascade,
 subject text, minimum_percentage numeric check(minimum_percentage between 0 and 100),
 detail text not null, recommended boolean not null default false,
 source_url text not null check(source_url ~ '^https://'), source_name text not null,
 last_verified_at timestamptz not null, academic_year integer
);
create index via_requirements_programme on public.via_programme_requirements(programme_id);
create table public.via_application_cycles (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.via_opportunities(id) on delete cascade,
 label text not null, academic_year integer not null, opens_on date, closes_on date,
 fee numeric check(fee>=0), fee_note text,
 source_url text not null check(source_url ~ '^https://'), source_name text not null, last_verified_at timestamptz not null,
 check(opens_on is null or closes_on is null or opens_on<=closes_on)
);
create index via_cycles_opportunity on public.via_application_cycles(opportunity_id,academic_year desc);
create table public.via_bursaries (
 id uuid primary key references public.via_opportunities(id) on delete cascade,
 provider text not null, funding_type text not null, fields text[] not null default '{}',
 study_levels text[] not null default '{}', coverage text[] not null default '{}',
 required_documents text[] not null default '{}', institution_ids uuid[] not null default '{}'
);
create table public.via_bursary_eligibility (
 id uuid primary key default gen_random_uuid(), bursary_id uuid not null references public.via_bursaries(id) on delete cascade,
 criterion text not null, source_url text not null check(source_url ~ '^https://'),
 source_name text not null, last_verified_at timestamptz not null, academic_year integer
);
create table public.via_accommodations (
 id uuid primary key references public.via_opportunities(id) on delete cascade,
 accommodation_type text not null, starting_price numeric check(starting_price>=0), price_period text,
 room_types text[] not null default '{}', amenities text[] not null default '{}',
 nsfas_compatible boolean, nsfas_source_url text check(nsfas_source_url ~ '^https://'),
 nsfas_verified_at timestamptz, contact text,
 check(nsfas_compatible is null or (nsfas_source_url is not null and nsfas_verified_at is not null))
);
create table public.via_accommodation_institutions (
 accommodation_id uuid not null references public.via_accommodations(id) on delete cascade,
 institution_id uuid not null references public.via_institutions(id), campus_id uuid references public.via_campuses(id),
 distance_km numeric check(distance_km>=0), source_url text not null check(source_url ~ '^https://'),
 source_name text not null, last_verified_at timestamptz not null,
 primary key(accommodation_id,institution_id)
);
create table public.via_saved_opportunities (
 user_id uuid not null references auth.users(id) on delete cascade,
 opportunity_id uuid not null references public.via_opportunities(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,opportunity_id)
);

-- Catalogue publishing is administrative. Browsers cannot change catalogue facts.
do $$ declare t text; begin
 foreach t in array array['via_opportunities','via_institutions','via_campuses','via_programmes','via_programme_requirements','via_application_cycles','via_bursaries','via_bursary_eligibility','via_accommodations','via_accommodation_institutions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end; $$;
create policy catalogue_published on public.via_opportunities for select to anon,authenticated using(published);
create policy institution_published on public.via_institutions for select to anon,authenticated using(exists(select 1 from public.via_opportunities o where o.id=via_institutions.id and o.kind='institutions'));
create policy campus_published on public.via_campuses for select to anon,authenticated using(exists(select 1 from public.via_institutions i where i.id=institution_id));
create policy programme_published on public.via_programmes for select to anon,authenticated using(exists(select 1 from public.via_opportunities o where o.id=via_programmes.id and o.kind='programmes') and exists(select 1 from public.via_institutions i where i.id=institution_id));
create policy requirement_published on public.via_programme_requirements for select to anon,authenticated using(exists(select 1 from public.via_programmes p where p.id=programme_id));
create policy cycle_published on public.via_application_cycles for select to anon,authenticated using(exists(select 1 from public.via_opportunities o where o.id=opportunity_id));
create policy bursary_published on public.via_bursaries for select to anon,authenticated using(exists(select 1 from public.via_opportunities o where o.id=via_bursaries.id and o.kind='bursaries'));
create policy eligibility_published on public.via_bursary_eligibility for select to anon,authenticated using(exists(select 1 from public.via_bursaries b where b.id=bursary_id));
create policy accommodation_published on public.via_accommodations for select to anon,authenticated using(exists(select 1 from public.via_opportunities o where o.id=via_accommodations.id and o.kind='accommodation'));
create policy accommodation_institution_published on public.via_accommodation_institutions for select to anon,authenticated using(exists(select 1 from public.via_accommodations a where a.id=accommodation_id) and exists(select 1 from public.via_institutions i where i.id=institution_id));
alter table public.via_saved_opportunities enable row level security;
revoke all on public.via_saved_opportunities from public,anon,authenticated;
grant select,insert,delete on public.via_saved_opportunities to authenticated;
grant all on public.via_saved_opportunities to service_role;
create policy saved_read on public.via_saved_opportunities for select to authenticated using(user_id=(select auth.uid()));
create policy saved_add on public.via_saved_opportunities for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.via_opportunities o where o.id=opportunity_id));
create policy saved_remove on public.via_saved_opportunities for delete to authenticated using(user_id=(select auth.uid()));

-- A read projection, not a duplicate catalogue. RLS always runs as the caller.
create view public.via_public_opportunities with(security_invoker=true) as
select o.id,o.kind,o.title,
 to_jsonb(o)-'published' || jsonb_build_object(
 'institution_type',i.institution_type,'abbreviation',i.abbreviation,'logo_url',i.logo_url,
 'institution_id',p.institution_id,'institution_name',inst.title,'faculty',p.faculty,
 'field',p.field,'qualification',p.qualification,'duration',p.duration,'minimum_aps',p.minimum_aps,'mathematics_required',p.mathematics_required,
 'campus',camp.name,'career_keywords',p.career_keywords,
 'programme_count',case when i.id is not null then (select count(*) from public.via_programmes q where q.institution_id=i.id) end,
 'requirements',coalesce((select jsonb_agg(to_jsonb(r)-'programme_id' order by r.recommended,r.subject,r.id) from public.via_programme_requirements r where r.programme_id=p.id),'[]'::jsonb),
 'provider',b.provider,'funding_type',b.funding_type,'fields',b.fields,'study_levels',b.study_levels,'coverage',b.coverage,'required_documents',b.required_documents,
 'eligibility',coalesce((select jsonb_agg(to_jsonb(e)-'bursary_id' order by e.id) from public.via_bursary_eligibility e where e.bursary_id=b.id),'[]'::jsonb),
 'accommodation_type',a.accommodation_type,'starting_price',a.starting_price,'price_period',a.price_period,'room_types',a.room_types,'amenities',a.amenities,
 'nsfas_compatible',a.nsfas_compatible,'nsfas_source_url',a.nsfas_source_url,'nsfas_verified_at',a.nsfas_verified_at,'contact',a.contact,
 'institutions',case when p.id is not null then jsonb_build_array(jsonb_build_object('id',inst.id,'name',inst.title)) when b.id is not null then coalesce((select jsonb_agg(jsonb_build_object('id',bo.id,'name',bo.title)) from public.via_opportunities bo where bo.id=any(b.institution_ids) and bo.kind='institutions'),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('id',ao.id,'name',ao.title,'campus',ac.name,'distance_km',ai.distance_km)) from public.via_accommodation_institutions ai join public.via_opportunities ao on ao.id=ai.institution_id left join public.via_campuses ac on ac.id=ai.campus_id where ai.accommodation_id=a.id),'[]'::jsonb) end,
 'cycles',coalesce((select jsonb_agg(to_jsonb(c)-'opportunity_id' order by c.academic_year desc,c.label) from public.via_application_cycles c where c.opportunity_id=o.id or (p.id is not null and c.opportunity_id=p.institution_id)),'[]'::jsonb)
 ) as document
from public.via_opportunities o
left join public.via_institutions i on i.id=o.id
left join public.via_programmes p on p.id=o.id
left join public.via_opportunities inst on inst.id=p.institution_id
left join public.via_campuses camp on camp.id=p.campus_id
left join public.via_bursaries b on b.id=o.id
left join public.via_accommodations a on a.id=o.id
where (o.kind='institutions' and i.id is not null) or (o.kind='programmes' and p.id is not null and inst.id is not null) or (o.kind='bursaries' and b.id is not null) or (o.kind='accommodation' and a.id is not null);
grant select on public.via_public_opportunities to anon,authenticated;

create function public.search_public_opportunities(p_kind text,p_query text default '',p_filters jsonb default '{}',p_page integer default 1,p_page_size integer default 12)
returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare result jsonb; query_text text; today date:=(now() at time zone 'Africa/Johannesburg')::date;
begin
 if p_kind is null or p_kind not in ('institutions','programmes','bursaries','accommodation') or p_page is null or p_page not between 1 and 10000 or p_page_size is null or p_page_size not between 1 and 24 or p_query is null or char_length(p_query)>160 or jsonb_typeof(p_filters) is distinct from 'object' or octet_length(p_filters::text)>4096 then raise exception 'Invalid discovery query' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each_text(p_filters) f where f.key not in ('province','institution_type','applications','fee','field','institution','qualification','aps_min','aps_max','mathematics','funding_type','study_level','closing_before','coverage','location','accommodation_type','price_min','price_max','nsfas','amenity') or char_length(f.value)>200) then raise exception 'Unsupported filter' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each_text(p_filters) f where f.key in ('aps_min','aps_max','price_min','price_max') and f.value !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$') then raise exception 'Invalid numeric range' using errcode='22023'; end if;
 if p_filters ? 'closing_before' and (p_filters->>'closing_before') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid closing date' using errcode='22023'; end if;
 query_text:='%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%';
 with catalog as materialized(select v.*,v.document as d from public.via_public_opportunities v where v.kind=p_kind),
 filtered as (select * from catalog where
  (trim(p_query)='' or concat_ws(' ',title,d->>'abbreviation',d->>'location',d->>'institution_name',d->>'field',d->>'qualification',d->>'provider',d->>'fields',d->>'institutions',d->>'campus',d->>'career_keywords') ilike query_text)
  and not exists(select 1 from jsonb_each_text(p_filters) f where case f.key
   when 'institution' then not exists(select 1 from jsonb_array_elements(d->'institutions') r where r->>'id'=f.value)
   when 'field' then coalesce(d->>'field','')<>f.value and not coalesce((d->'fields') ? f.value,false)
   when 'study_level' then not coalesce((d->'study_levels') ? f.value,false)
   when 'coverage' then not coalesce((d->'coverage') ? f.value,false)
   when 'amenity' then not coalesce((d->'amenities') ? f.value,false)
   when 'aps_min' then d->>'minimum_aps' is null or (d->>'minimum_aps')::numeric<f.value::numeric
   when 'aps_max' then d->>'minimum_aps' is null or (d->>'minimum_aps')::numeric>f.value::numeric
   when 'price_min' then d->>'starting_price' is null or (d->>'starting_price')::numeric<f.value::numeric
   when 'price_max' then d->>'starting_price' is null or (d->>'starting_price')::numeric>f.value::numeric
   when 'mathematics' then coalesce(d->>'mathematics_required','unknown')<>f.value
   when 'nsfas' then coalesce(d->>'nsfas_compatible','unknown')<>f.value
   when 'applications' then not exists(select 1 from jsonb_array_elements(d->'cycles') c where c->>'opens_on' is not null and c->>'closes_on' is not null and (c->>'opens_on')::date<=today and (c->>'closes_on')::date>=today)
   when 'fee' then not exists(select 1 from jsonb_array_elements(d->'cycles') c where c->>'fee' is not null and case when f.value='free' then (c->>'fee')::numeric=0 else (c->>'fee')::numeric>0 end)
   when 'closing_before' then not exists(select 1 from jsonb_array_elements(d->'cycles') c where c->>'closes_on' is not null and (c->>'closes_on')::date<=f.value::date and (c->>'closes_on')::date>=today)
   else coalesce(d->>f.key,'')<>f.value end)
 ), facets as (
  select key,jsonb_agg(distinct value order by value) as choices from (
   select e.key,e.value from catalog cross join lateral jsonb_each_text(d) e where e.key in ('province','institution_type','field','qualification','funding_type','location','accommodation_type') and e.value is not null
   union all select 'field',v from catalog cross join lateral jsonb_array_elements_text(coalesce(nullif(d->'fields','null'),'[]')) v
   union all select 'study_level',v from catalog cross join lateral jsonb_array_elements_text(coalesce(nullif(d->'study_levels','null'),'[]')) v
   union all select 'coverage',v from catalog cross join lateral jsonb_array_elements_text(coalesce(nullif(d->'coverage','null'),'[]')) v
   union all select 'amenity',v from catalog cross join lateral jsonb_array_elements_text(coalesce(nullif(d->'amenities','null'),'[]')) v
  ) f group by key
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(document order by title,id) from (select * from filtered order by title,id offset (p_page-1)*p_page_size limit p_page_size) page),'[]'),
 'total',(select count(*) from filtered),'facets',coalesce((select jsonb_object_agg(key,choices) from facets),'{}'),
 'institutions',coalesce((select jsonb_agg(jsonb_build_object('value',o.id,'label',o.title) order by o.title) from public.via_institutions i join public.via_opportunities o on o.id=i.id),'[]')) into result;
 return result;
end; $$;
revoke all on function public.search_public_opportunities(text,text,jsonb,integer,integer) from public;
grant execute on function public.search_public_opportunities(text,text,jsonb,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';



-- SOURCE: supabase/migrations/20261016000800_public_discovery_seed.sql
-- Curated official-source snapshot verified 2026-10-16. Not a comprehensive directory.
-- Unknown values are deliberately NULL. No availability or match scores are seeded.
insert into public.via_opportunities(id,kind,slug,title,overview,location,province,website_url,application_url,source_url,source_name,last_verified_at,academic_year,published) values
('10000000-0000-4000-8000-000000000001','institutions','wits','University of the Witwatersrand','Explore the programmes listed in VIA and check current application guidance with Wits.','Johannesburg','Gauteng','https://www.wits.ac.za/','https://www.wits.ac.za/undergraduate/apply-to-wits/','https://www.wits.ac.za/undergraduate/apply-to-wits/','Wits University','2026-10-16T00:00:00Z',2027,true),
('10000000-0000-4000-8000-000000000002','institutions','uct','University of Cape Town','Explore listed study options and official undergraduate information from UCT.','Cape Town','Western Cape','https://uct.ac.za/','https://sit.uct.ac.za/how-apply','https://uct.ac.za/applicants-and-students','University of Cape Town','2026-10-16T00:00:00Z',2027,true),
('10000000-0000-4000-8000-000000000003','institutions','up','University of Pretoria','Explore the listed programme and confirm the current intake requirements directly with UP.','Pretoria','Gauteng','https://www.up.ac.za/',null,'https://www.up.ac.za/science-mathematics-technology-education/pdf/generator/study_programmes/67441','University of Pretoria: Study@UP 2026','2026-10-16T00:00:00Z',2026,true),
('10000000-0000-4000-8000-000000000004','institutions','false-bay','False Bay TVET College','Explore college study areas and follow the official college guidance for applications.','Cape Town','Western Cape','https://falsebaycollege.co.za/',null,'https://falsebaycollege.co.za/','False Bay TVET College','2026-10-16T00:00:00Z',null,true),
('20000000-0000-4000-8000-000000000001','programmes','wits-computer-science','BSc Computer Science','Study computational problem solving, programming and the mathematical foundations of computing. Minimum requirements do not guarantee selection.','Johannesburg','Gauteng','https://www.wits.ac.za/course-finder/undergraduate/science/computer-science/','https://www.wits.ac.za/undergraduate/apply-to-wits/','https://www.wits.ac.za/course-finder/undergraduate/science/computer-science/','Wits official programme page','2026-10-16T00:00:00Z',2027,true),
('20000000-0000-4000-8000-000000000002','programmes','uct-ba-informatics-computer-science','BA Informatics — Computer Science','Combine computing with a humanities subject. This listing refers to the Computer Science route; the Information Systems route has different entry conditions.','Cape Town','Western Cape','https://sit.uct.ac.za/ba-informatics','https://sit.uct.ac.za/how-apply','https://sit.uct.ac.za/ba-informatics','UCT School of Information Technology','2026-10-16T00:00:00Z',null,true),
('20000000-0000-4000-8000-000000000003','programmes','uct-business-science-computer-science','BBusSc specialising in Computer Science','Study computing alongside business science. Consult the current faculty handbook for the complete admission and progression rules.','Cape Town','Western Cape','https://sit.uct.ac.za/bachelor-business-science-specialising-computer-science','https://sit.uct.ac.za/how-apply','https://sit.uct.ac.za/bachelor-business-science-specialising-computer-science','UCT School of Information Technology','2026-10-16T00:00:00Z',null,true),
('20000000-0000-4000-8000-000000000004','programmes','up-computer-science','BSc Computer Science','Computing study option from the 2026 Study@UP programme information. This is a historical intake snapshot; confirm requirements for the year you intend to apply.','Pretoria','Gauteng','https://www.up.ac.za/',null,'https://www.up.ac.za/science-mathematics-technology-education/pdf/generator/study_programmes/67441','University of Pretoria: Study@UP 2026','2026-10-16T00:00:00Z',2026,true),
('20000000-0000-4000-8000-000000000005','programmes','uct-bsc-computer-science-major','BSc — Computer Science major','The Department of Computer Science offers a Computer Science major within the Bachelor of Science. Check the current Science faculty requirements and available major combinations.','Cape Town','Western Cape','https://sit.uct.ac.za/department-computer-science','https://sit.uct.ac.za/how-apply','https://sit.uct.ac.za/department-computer-science','UCT Department of Computer Science','2026-10-16T00:00:00Z',null,true),
('30000000-0000-4000-8000-000000000001','bursaries','nsfas-bursary','NSFAS Bursary','Government student funding for approved undergraduate study at public universities and TVET colleges, subject to the applicable financial and academic rules.',null,null,'https://www.nsfas.org.za/content/','https://www.nsfas.org.za/content/how-to-apply.html','https://www.nsfas.org.za/content/how-to-apply.html','NSFAS: 2027 applications','2026-10-16T00:00:00Z',2027,true),
('30000000-0000-4000-8000-000000000002','bursaries','funza-lushaka','Funza Lushaka Bursary','Initial teacher-education funding. Consult the current bursary rules, priority teaching areas and service obligations before applying.',null,null,'https://www.funzalushaka.doe.gov.za/Home/','https://www.funzalushaka.doe.gov.za/Home/','https://www.funzalushaka.doe.gov.za/Home/','Department of Basic Education: Funza Lushaka','2026-10-16T00:00:00Z',2027,true),
('40000000-0000-4000-8000-000000000001','accommodation','south-point-ksi','KSI — South Point','Student residence in Braamfontein. Rates are a published 2026 snapshot; confirm the room, contract, current price and funding approval directly with the provider.','Braamfontein, Johannesburg','Gauteng','https://www.staysouthpoint.co.za/joburg/ksi','https://my.staysouthpoint.co.za/','https://www.staysouthpoint.co.za/joburg/ksi','South Point: KSI property page','2026-10-16T00:00:00Z',2026,true),
('40000000-0000-4000-8000-000000000002','accommodation','south-point-melridge','Melridge House — South Point','Student residence with shared-room options in Braamfontein. Published rates do not confirm current room availability; enquire with the provider.','Braamfontein, Johannesburg','Gauteng','https://www.staysouthpoint.co.za/joburg/melridge-house','https://my.staysouthpoint.co.za/','https://www.staysouthpoint.co.za/joburg/melridge-house','South Point: Melridge House property page','2026-10-16T00:00:00Z',2026,true);
insert into public.via_institutions(id,abbreviation,institution_type) values
('10000000-0000-4000-8000-000000000001','Wits','University'),
('10000000-0000-4000-8000-000000000002','UCT','University'),
('10000000-0000-4000-8000-000000000003','UP','University'),
('10000000-0000-4000-8000-000000000004','False Bay','TVET College');
insert into public.via_campuses(id,institution_id,name,location,source_url,source_name,last_verified_at) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Wits Main Campus','Braamfontein, Johannesburg','https://www.staysouthpoint.co.za/joburg/ksi','South Point: nearby campuses','2026-10-16T00:00:00Z');
insert into public.via_programmes(id,institution_id,faculty,field,qualification,duration,minimum_aps,mathematics_required,career_keywords) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Science','Technology','Bachelor','3 years',44,true,array['software development','data science','computing']),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Humanities','Technology','Bachelor','3 years',null,true,array['software development','business analysis','informatics']),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Commerce','Business','Bachelor','4 years',null,null,array['computing','business science']),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003',null,'Technology','Bachelor',null,30,true,array['computing','computer science']),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','Science','Technology','Bachelor',null,null,null,array['computer science','computing']);
insert into public.via_programme_requirements(programme_id,subject,minimum_percentage,detail,source_url,source_name,last_verified_at,academic_year) values
('20000000-0000-4000-8000-000000000001','Mathematics',null,'NSC Level 6. Wits uses its own APS calculation; minimum entry requirements do not guarantee a place.','https://www.wits.ac.za/course-finder/undergraduate/science/computer-science/','Wits official programme page','2026-10-16T00:00:00Z',2027),
('20000000-0000-4000-8000-000000000001','English',null,'Home Language or First Additional Language at NSC Level 5. Check the official page for NBT and selection conditions.','https://www.wits.ac.za/course-finder/undergraduate/science/computer-science/','Wits official programme page','2026-10-16T00:00:00Z',2027),
('20000000-0000-4000-8000-000000000002','Mathematics',70,'The Computer Science route requires at least 70% NSC Mathematics. Consult the Humanities handbook for the full BA admission criteria.','https://sit.uct.ac.za/ba-informatics','UCT School of IT','2026-10-16T00:00:00Z',null),
('20000000-0000-4000-8000-000000000004','Mathematics',null,'2026 programme information: Mathematics NSC/IEB Level 6. Confirm your intended intake year with UP.','https://www.up.ac.za/science-mathematics-technology-education/pdf/generator/study_programmes/67441','Study@UP 2026','2026-10-16T00:00:00Z',2026),
('20000000-0000-4000-8000-000000000004','English',null,'2026 programme information: English Home Language or First Additional Language Level 5.','https://www.up.ac.za/science-mathematics-technology-education/pdf/generator/study_programmes/67441','Study@UP 2026','2026-10-16T00:00:00Z',2026);
insert into public.via_application_cycles(opportunity_id,label,academic_year,opens_on,closes_on,fee,fee_note,source_url,source_name,last_verified_at) values
('10000000-0000-4000-8000-000000000001','General undergraduate programmes; some programmes close earlier',2027,null,'2026-09-30',100,'Consult the official application guide for your applicant category and programme.','https://www.wits.ac.za/undergraduate/apply-to-wits/','Wits undergraduate applications','2026-10-16T00:00:00Z'),
('10000000-0000-4000-8000-000000000002','Undergraduate applications',2027,'2026-04-01','2026-07-31',null,null,'https://uct.ac.za/applicants-and-students','UCT applicants and students','2026-10-16T00:00:00Z'),
('30000000-0000-4000-8000-000000000001','2027 student funding applications',2027,'2026-09-18','2026-10-31',0,'NSFAS states that applying is free.','https://www.nsfas.org.za/content/how-to-apply.html','NSFAS application guidance','2026-10-16T00:00:00Z'),
('30000000-0000-4000-8000-000000000002','New applicants; returning bursars have a different deadline',2027,'2026-10-01','2027-01-31',null,null,'https://www.funzalushaka.doe.gov.za/Home/','Funza Lushaka 2027 applications','2026-10-16T00:00:00Z');
insert into public.via_bursaries(id,provider,funding_type,fields,study_levels,coverage,required_documents) values
('30000000-0000-4000-8000-000000000001','National Student Financial Aid Scheme','Government bursary','{}',array['Undergraduate','TVET'],array['Tuition','Learning materials','Living allowance','Accommodation where applicable'],array['NSFAS consent form','Identity document','Additional documents requested by myNSFAS for your household']),
('30000000-0000-4000-8000-000000000002','Department of Basic Education','Teaching bursary',array['Education'],array['Initial teacher education'],'{}','{}');
insert into public.via_bursary_eligibility(bursary_id,criterion,source_url,source_name,last_verified_at,academic_year) values
('30000000-0000-4000-8000-000000000001','Funding is for approved undergraduate qualifications at public universities or TVET colleges, subject to the applicable financial and academic rules. An application is not a funding award.','https://www.nsfas.org.za/content/faqs.html','NSFAS FAQs','2026-10-16T00:00:00Z',2027),
('30000000-0000-4000-8000-000000000002','First-time applicants must be 30 years or younger. Check the current priority teaching areas, admission and service requirements. Returning bursars have a separate deadline of 30 November 2026.','https://www.funzalushaka.doe.gov.za/Home/','Funza Lushaka application guidance','2026-10-16T00:00:00Z',2027);
insert into public.via_accommodations(id,accommodation_type,starting_price,price_period,room_types,amenities,contact) values
('40000000-0000-4000-8000-000000000001','Student residence',5530,'month',array['Single room','Double sharing'],array['Wi-Fi','Study rooms','Laundry','24-hour security'],'info@staysouthpoint.co.za'),
('40000000-0000-4000-8000-000000000002','Student residence',5130,'month',array['Single room','Double sharing','Triple sharing'],array['Wi-Fi','Study rooms','Laundry','24-hour security'],'info@staysouthpoint.co.za');
-- Provider accreditation claims are NOT treated as independent NSFAS verification.
-- Distance and current availability also remain unknown instead of being guessed.
insert into public.via_accommodation_institutions(accommodation_id,institution_id,campus_id,source_url,source_name,last_verified_at) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','https://www.staysouthpoint.co.za/joburg/ksi','South Point property page','2026-10-16T00:00:00Z'),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','https://www.staysouthpoint.co.za/joburg/melridge-house','South Point property page','2026-10-16T00:00:00Z');
insert into public.via_opportunities(id,kind,slug,title,overview,location,province,website_url,source_url,source_name,last_verified_at,published) values
('20000000-0000-4000-8000-000000000006','programmes','false-bay-ncv-it','NC(V) Information Technology and Computer Science','A vocational computing qualification listed by the college at NQF Levels 2–4. Confirm campus, entry requirements and the next intake with False Bay.','Cape Town','Western Cape','https://falsebaycollege.co.za/ict/','https://falsebaycollege.co.za/ict/','False Bay TVET College: ICT programmes','2026-10-16T00:00:00Z',true);
insert into public.via_programmes(id,institution_id,field,qualification) values
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000004','Technology','National Certificate (Vocational)');


commit;
