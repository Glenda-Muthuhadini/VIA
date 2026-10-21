-- v9: institution → academic unit → programme. No learner/auth changes.
begin;
create table public.via_faculties (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.via_institutions(id),
 name text not null check(length(trim(name)) between 1 and 180),
 unit_kind text not null default 'faculty' check(unit_kind in ('faculty','college','study_area')),
 source_url text not null check(source_url ~ '^https://'), source_name text not null,
 last_verified_at timestamptz not null,
 unique(institution_id,name), unique(id,institution_id)
);
alter table public.via_faculties enable row level security;
revoke all on public.via_faculties from public,anon,authenticated;
grant select on public.via_faculties to anon,authenticated;
grant all on public.via_faculties to service_role;
create policy faculty_published on public.via_faculties for select to anon,authenticated
 using(exists(select 1 from public.via_institutions i where i.id=institution_id));

-- Fill previously absent academic units from the official sources below.
-- TVET study areas and UNISA's college retain their real names, not invented faculties.
update public.via_programmes set faculty=case
 when id='20000000-0000-4000-8000-000000000004' then 'Faculty of Engineering, Built Environment and Information Technology'
 when id='20000000-0000-4000-8000-000000000006' then 'Information and Communication Technology'
 when id='20000000-0000-4000-8000-000000000011' then 'Faculty of Humanities'
 when id in ('20000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000013') then 'College of Business and Economics'
 when id='20000000-0000-4000-8000-000000000014' then 'Faculty of Education'
 when id in ('20000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000021') then 'College of Economic and Management Sciences'
 when id='20000000-0000-4000-8000-000000000016' then 'Faculty of Informatics and Design'
 when id='20000000-0000-4000-8000-000000000017' then 'Faculty of Accounting and Informatics'
 when id='20000000-0000-4000-8000-000000000018' then 'Faculty of Engineering, the Built Environment and Technology'
 when id='20000000-0000-4000-8000-000000000019' then 'Faculty of Information and Communication Technology'
 when faculty in ('Science','Humanities','Commerce') then 'Faculty of '||faculty
 else faculty end;

insert into public.via_faculties(institution_id,name,unit_kind,source_url,source_name,last_verified_at)
select p.institution_id,p.faculty,
 case when p.faculty like 'College of %' then 'college' when p.institution_id='10000000-0000-4000-8000-000000000004' then 'study_area' else 'faculty' end,
 case p.institution_id
 when '10000000-0000-4000-8000-000000000003' then 'https://www.up.ac.za/faculty-of-engineering-built-environment-it/undergraduate-programmes'
 when '10000000-0000-4000-8000-000000000004' then 'https://falsebaycollege.co.za/campuses/fish-hoek-campus/'
 when '10000000-0000-4000-8000-000000000006' then 'https://www.cput.ac.za/faculties/fid'
 when '10000000-0000-4000-8000-000000000007' then 'https://www.dut.ac.za/academic/'
 when '10000000-0000-4000-8000-000000000010' then 'https://www.tut.ac.za/ict/'
 else min(o.source_url) end,
 'Official institution academic-unit information','2026-10-18T00:00:00Z'
from public.via_programmes p join public.via_opportunities o on o.id=p.id
group by p.institution_id,p.faculty;
alter table public.via_programmes add column faculty_id uuid;
update public.via_programmes p set faculty_id=f.id from public.via_faculties f where f.institution_id=p.institution_id and f.name=p.faculty;
alter table public.via_programmes alter column faculty_id set not null;
alter table public.via_programmes add constraint programme_faculty_institution_fk foreign key(faculty_id,institution_id) references public.via_faculties(id,institution_id);
create index via_programmes_faculty on public.via_programmes(faculty_id);
-- Keep the existing text projection compatible; faculty_id is authoritative.
create function public.sync_programme_faculty() returns trigger language plpgsql set search_path='' as $$
begin
 select f.name into new.faculty from public.via_faculties f where f.id=new.faculty_id and f.institution_id=new.institution_id;
 if new.faculty is null then raise exception 'Programme must belong to a faculty at its institution' using errcode='23503';end if;
 return new;
end $$;
create trigger programme_faculty_name before insert or update on public.via_programmes for each row execute function public.sync_programme_faculty();
create function public.sync_faculty_name() returns trigger language plpgsql set search_path='' as $$
begin update public.via_programmes set faculty=new.name where faculty_id=new.id;return new;end $$;
create trigger faculty_name_changed after update of name on public.via_faculties for each row execute function public.sync_faculty_name();
-- Existing programme projections already expose minimum_aps. Keep them in sync
-- when administrators update a latest-intake rule instead of the programme row.
create function public.sync_latest_programme_aps() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.via_admission_rules r where r.programme_id=new.programme_id and r.academic_year>new.academic_year) then
  update public.via_programmes set minimum_aps=new.minimum_aps where id=new.programme_id and minimum_aps is distinct from new.minimum_aps;
 end if;return new;
end $$;
create trigger admission_aps_changed after insert or update of minimum_aps,academic_year on public.via_admission_rules for each row execute function public.sync_latest_programme_aps();
create function public.sync_programme_aps_rule() returns trigger language plpgsql set search_path='' as $$
begin
 if old.minimum_aps is distinct from new.minimum_aps then
  update public.via_admission_rules r set minimum_aps=new.minimum_aps where r.programme_id=new.id and r.academic_year=(select max(a.academic_year) from public.via_admission_rules a where a.programme_id=new.id) and r.minimum_aps is distinct from new.minimum_aps;
 end if;return new;
end $$;
create trigger programme_aps_changed after update of minimum_aps on public.via_programmes for each row execute function public.sync_programme_aps_rule();
revoke all on function public.sync_programme_faculty(),public.sync_faculty_name(),public.sync_latest_programme_aps(),public.sync_programme_aps_rule() from public,anon,authenticated;

-- Official application guidance destinations, verified by institution navigation.
-- Guidance is intentional where applicant categories use different portals.
update public.via_opportunities set application_url=case id
 when '10000000-0000-4000-8000-000000000003' then 'https://www.up.ac.za/online-application/apply-online'
 when '10000000-0000-4000-8000-000000000004' then 'https://falsebaycollege.co.za/study-here/apply-now/'
 when '10000000-0000-4000-8000-000000000007' then 'https://www.dut.ac.za/admissions/'
 else application_url end where kind='institutions' and application_url is null;
update public.via_opportunities o set application_url=i.application_url from public.via_programmes p join public.via_opportunities i on i.id=p.institution_id where o.id=p.id and o.application_url is null;

create view public.via_institution_programme_scores with(security_invoker=true) as
select p.id,p.institution_id,p.faculty_id,p.faculty,o.title,
 coalesce(r.minimum_aps,p.minimum_aps) as aps_min,
 greatest(coalesce(r.minimum_aps,p.minimum_aps),(select max((a->>'minimum_aps')::numeric) from jsonb_array_elements(coalesce(r.aps_alternatives,'[]')) a)) as aps_max,
 r.scoring_system,r.academic_year,
 (r.requirements_complete and r.scoring_system in ('uj_nsc_six_v1','nsc_six_v1') and r.minimum_aps is not null and (o.academic_year is null or o.academic_year=r.academic_year)) is true as comparable
from public.via_programmes p join public.via_opportunities o on o.id=p.id
left join lateral(select * from public.via_admission_rules a where a.programme_id=p.id order by a.academic_year desc limit 1) r on true;
grant select on public.via_institution_programme_scores to anon,authenticated;

-- Small batched summaries for institution cards, independent of result pagination.
create function public.public_institution_summaries(p_ids uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_ids is null or cardinality(p_ids)>24 then raise exception 'Invalid institution request' using errcode='22023';end if;
 select coalesce(jsonb_object_agg(id,summary),'{}') into result from (
 select i.id,jsonb_build_object('aps_min',case when bool_and(s.comparable) and count(distinct s.scoring_system)=1 and count(distinct s.academic_year)=1 then min(s.aps_min) end,
 'aps_max',case when bool_and(s.comparable) and count(distinct s.scoring_system)=1 and count(distinct s.academic_year)=1 then max(s.aps_max) end) summary
 from public.via_institutions i left join public.via_institution_programme_scores s on s.institution_id=i.id where i.id=any(p_ids) group by i.id) q;
 return result;
end $$;
-- Only names/scores/IDs reach faculty rows. Full programme details stay in the
-- existing programme endpoint/dialog. Search spans all faculties server-side.
create function public.public_institution_faculties(p_institution uuid,p_query text default '') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; pattern text;
begin
 if p_query is null or length(p_query)>160 then raise exception 'Invalid programme search' using errcode='22023';end if;
 pattern:='%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%';
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'aps_min',a.aps_min,'aps_max',a.aps_max,'programme_count',a.total,'programmes',m.items) order by f.name),'[]') into result
 from public.via_faculties f
 cross join lateral(select count(*) total,
 case when bool_and(s.comparable) and count(distinct s.scoring_system)=1 and count(distinct s.academic_year)=1 then min(s.aps_min) end aps_min,
 case when bool_and(s.comparable) and count(distinct s.scoring_system)=1 and count(distinct s.academic_year)=1 then max(s.aps_max) end aps_max
 from public.via_institution_programme_scores s where s.faculty_id=f.id) a
 cross join lateral(select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'aps_min',s.aps_min,'aps_max',s.aps_max) order by s.title,s.id) items from public.via_institution_programme_scores s where s.faculty_id=f.id and s.title ilike pattern) m
 where f.institution_id=p_institution and m.items is not null;
 return result;
end $$;
revoke all on function public.public_institution_summaries(uuid[]),public.public_institution_faculties(uuid,text) from public;
grant execute on function public.public_institution_summaries(uuid[]),public.public_institution_faculties(uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
