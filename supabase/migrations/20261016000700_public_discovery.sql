-- Public catalogue shared by discovery and future personalised services.
begin;
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
commit;
