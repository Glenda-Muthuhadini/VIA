-- VIA ONBOARDING SETUP v2: paste this entire file into Supabase SQL Editor.
-- Upgrade: requires auth_setup_v1.sql to have been applied already.
-- Apply this version ONCE. Keep the existing auth v1 release unchanged.

begin;
-- SOURCE: supabase/migrations/20261016000300_via_onboarding.sql
-- VIA onboarding v2. Apply after the auth v1 migrations. No credentials required.

create table public.via_onboarding_options (
  id text primary key,
  category text not null check (category in ('current','interest','personality','preference','institution_type','province','study_goal','subject','journey')),
  label text not null check (char_length(label) between 1 and 150),
  description text not null default '',
  icon text not null default 'Compass',
  tone text not null default 'emerald' check (tone in ('emerald','mint','blue','gold','rose','violet')),
  sort_order integer not null default 0,
  active boolean not null default true
);
create index via_onboarding_options_category on public.via_onboarding_options(category, sort_order) where active;
alter table public.via_onboarding_options enable row level security;
revoke all on public.via_onboarding_options from public, anon, authenticated;
grant select on public.via_onboarding_options to authenticated;
grant all on public.via_onboarding_options to service_role;
create policy via_onboarding_options_read on public.via_onboarding_options for select to authenticated using (active);

create table public.via_onboarding_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  file_size integer not null check (file_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = user_id::text)
);
create index via_onboarding_reports_user on public.via_onboarding_reports(user_id);
alter table public.via_onboarding_reports enable row level security;
revoke all on public.via_onboarding_reports from public, anon, authenticated;
grant select on public.via_onboarding_reports to authenticated;
grant insert (id, user_id, storage_path, file_name, mime_type, file_size) on public.via_onboarding_reports to authenticated;
grant all on public.via_onboarding_reports to service_role;
create policy via_onboarding_reports_read on public.via_onboarding_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy via_onboarding_reports_insert on public.via_onboarding_reports for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from storage.objects where bucket_id = 'via-school-reports' and name = storage_path
  )
);

create table public.via_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  current_step text not null default 'welcome' check (current_step in ('welcome','current','interests','results','personality','study-plan','preferences','building','ready')),
  revision bigint not null default 1,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.via_onboarding enable row level security;
revoke all on public.via_onboarding from public, anon, authenticated;
grant select on public.via_onboarding to authenticated;
grant all on public.via_onboarding to service_role;
create policy via_onboarding_read on public.via_onboarding for select to authenticated using ((select auth.uid()) = user_id);

-- Only this authenticated RPC can write progress. The caller supplies no user ID.
-- Definer is necessary for atomic validation/revision checks without granting
-- clients the ability to forge completion or overwrite another user's row.
create function public.save_my_onboarding(
  p_answers jsonb,
  p_current_step text,
  p_expected_revision bigint,
  p_complete boolean default false
) returns public.via_onboarding
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  existing public.via_onboarding;
  saved public.via_onboarding;
  field_name text;
  category_name text;
  selected jsonb;
  item jsonb;
  step_number integer;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 32768 then
    raise exception 'Invalid onboarding answers' using errcode = '22023';
  end if;
  if p_complete is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid save request' using errcode = '22023';
  end if;
  step_number := array_position(array['welcome','current','interests','results','personality','study-plan','preferences','building','ready'], p_current_step);
  if step_number is null then raise exception 'Invalid onboarding step' using errcode = '22023'; end if;
  if p_current_step in ('building','ready') and not p_complete then
    raise exception 'Complete onboarding before viewing this step' using errcode = '22023';
  end if;
  -- Do not accept arbitrary unvalidated keys, including removed certainty options.
  if exists (select 1 from jsonb_object_keys(p_answers) k where k not in (
    'current_id','interest_ids','personality_ids','goal_ids','preference_ids',
    'institution_type_ids','location_mode','province_ids','school_name',
    'academic_year','results','report_id'
  )) then raise exception 'Unknown onboarding field' using errcode = '22023'; end if;
  if jsonb_typeof(p_answers->'current_id') is distinct from 'string' then
    raise exception 'Invalid study stage' using errcode = '22023';
  end if;
  if coalesce(p_answers->>'current_id','') <> '' and not exists (
    select 1 from public.via_onboarding_options where id = p_answers->>'current_id' and category = 'current' and active
  ) then raise exception 'Invalid study stage' using errcode = '22023'; end if;
  for field_name, category_name in select * from (values
    ('interest_ids','interest'),('personality_ids','personality'),('goal_ids','study_goal'),
    ('preference_ids','preference'),('institution_type_ids','institution_type'),('province_ids','province')
  ) fields(field_name, category_name) loop
    selected := p_answers->field_name;
    if jsonb_typeof(selected) is distinct from 'array' then raise exception 'Invalid selection list' using errcode = '22023'; end if;
    if jsonb_array_length(selected) > 100 then raise exception 'Too many selections' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_array_elements(selected) v where jsonb_typeof(v) <> 'string') or
      exists (select 1 from jsonb_array_elements_text(selected) v where not exists (
        select 1 from public.via_onboarding_options o where o.id = v and o.category = category_name and o.active
      )) or jsonb_array_length(selected) <> (select count(distinct v) from jsonb_array_elements_text(selected) v) then
      raise exception 'Invalid or obsolete onboarding selection' using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(p_answers->'location_mode') is distinct from 'string' or p_answers->>'location_mode' not in ('anywhere','provinces') then
    raise exception 'Invalid location preference' using errcode = '22023';
  end if;
  if jsonb_typeof(p_answers->'school_name') is distinct from 'string' or char_length(p_answers->>'school_name') > 200 then
    raise exception 'Invalid school name' using errcode = '22023';
  end if;
  if p_answers->'academic_year' is distinct from 'null'::jsonb and (
    jsonb_typeof(p_answers->'academic_year') is distinct from 'number' or
    (p_answers->>'academic_year')::numeric not between 2000 and 2100 or
    (p_answers->>'academic_year')::numeric <> trunc((p_answers->>'academic_year')::numeric)
  ) then raise exception 'Invalid academic year' using errcode = '22023'; end if;
  if jsonb_typeof(p_answers->'results') is distinct from 'array' then raise exception 'Invalid results' using errcode = '22023'; end if;
  if jsonb_array_length(p_answers->'results') > 20 then raise exception 'Too many subjects' using errcode = '22023'; end if;
  for item in select * from jsonb_array_elements(p_answers->'results') loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'subject_id') is distinct from 'string' or
      not exists (select 1 from public.via_onboarding_options where id = item->>'subject_id' and category = 'subject' and active) or
      jsonb_typeof(item->'mark') is distinct from 'number' then
      raise exception 'Invalid subject or mark' using errcode = '22023';
    end if;
    if (item->>'mark')::numeric not between 0 and 100 then raise exception 'Marks must be between 0 and 100' using errcode = '22023'; end if;
  end loop;
  if jsonb_array_length(p_answers->'results') <> (select count(distinct v->>'subject_id') from jsonb_array_elements(p_answers->'results') v) then
    raise exception 'Duplicate subjects' using errcode = '22023';
  end if;
  if p_answers->'report_id' is distinct from 'null'::jsonb then
    if jsonb_typeof(p_answers->'report_id') is distinct from 'string' or not exists (
      select 1 from public.via_onboarding_reports where id::text = p_answers->>'report_id' and user_id = owner_id
    ) then raise exception 'Invalid report' using errcode = '22023'; end if;
  end if;
  if step_number >= 3 and p_answers->>'current_id' = '' then raise exception 'Choose your study stage' using errcode = '22023'; end if;
  if step_number >= 4 and jsonb_array_length(p_answers->'interest_ids') = 0 then raise exception 'Choose at least one interest' using errcode = '22023'; end if;
  if step_number >= 6 and jsonb_array_length(p_answers->'personality_ids') = 0 then raise exception 'Choose at least one strength' using errcode = '22023'; end if;
  if step_number >= 7 and jsonb_array_length(p_answers->'goal_ids') = 0 then raise exception 'Choose at least one study interest' using errcode = '22023'; end if;
  if p_complete then
    if step_number < 8 or jsonb_array_length(p_answers->'institution_type_ids') = 0 then
      raise exception 'Choose your institution preferences' using errcode = '22023';
    end if;
    if p_answers->>'location_mode' = 'provinces' and jsonb_array_length(p_answers->'province_ids') = 0 then
      raise exception 'Choose at least one province' using errcode = '22023';
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  select * into existing from public.via_onboarding where user_id = owner_id for update;
  if coalesce(existing.revision, 0) <> p_expected_revision then
    raise exception 'Your VIA changed in another tab. Reload before saving.' using errcode = '40001';
  end if;
  insert into public.via_onboarding(user_id, answers, current_step, completed_at)
  values (owner_id, p_answers, p_current_step, case when p_complete then now() end)
  on conflict (user_id) do update set answers = excluded.answers, current_step = excluded.current_step,
    completed_at = excluded.completed_at, revision = public.via_onboarding.revision + 1, updated_at = now()
  returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_my_onboarding(jsonb,text,bigint,boolean) from public, anon, authenticated;
grant execute on function public.save_my_onboarding(jsonb,text,bigint,boolean) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('via-school-reports', 'via-school-reports', false, 10485760, array['application/pdf','image/jpeg','image/png']);
create policy via_school_reports_insert on storage.objects for insert to authenticated
with check (bucket_id = 'via-school-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy via_school_reports_read on storage.objects for select to authenticated
using (bucket_id = 'via-school-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy via_school_reports_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'via-school-reports' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.via_onboarding_reports r where r.storage_path = name));

notify pgrst, 'reload schema';



-- SOURCE: supabase/migrations/20261016000400_via_onboarding_catalog.sql
-- Existing VIA choices moved into a database-owned catalog. No preselected answers.
insert into public.via_onboarding_options(id, category, label, description, icon, tone, sort_order) values
('current-1','current','Grade 9 - 10','Explore subjects, careers and possibilities.','BookOpen','emerald',0),
('current-2','current','Grade 11','Discover your options and prepare for what''s next.','BarChart3','blue',1),
('current-3','current','Grade 12','Find opportunities and start applying.','GraduationCap','gold',2),
('current-4','current','Matriculated / Gap Year','Find your next study opportunity.','BriefcaseBusiness','rose',3),
('current-5','current','Currently Studying','Continue and manage your academic journey.','Landmark','violet',4),
('interest-1','interest','Health Sciences','e.g. Medicine, Nursing, Pharmacy, Biomedical Sciences','HeartPulse','emerald',0),
('interest-2','interest','Technology','e.g. IT, Computer Science, Data Science, Artificial Intelligence','Laptop','blue',1),
('interest-3','interest','Business','e.g. Accounting, Finance, Marketing, Management','BriefcaseBusiness','gold',2),
('interest-4','interest','Creative Arts','e.g. Design, Media, Film, Music, Performing Arts','Palette','violet',3),
('interest-5','interest','Engineering','e.g. Civil, Mechanical, Electrical, Chemical','Cog','rose',4),
('interest-6','interest','Education','e.g. Teaching, Early Childhood Development','Users','blue',5),
('interest-7','interest','Environmental Sciences','e.g. Agriculture, Conservation, Sustainability','Sprout','emerald',6),
('personality-1','personality','Solving problems','I enjoy figuring things out.','Brain','emerald',0),
('personality-2','personality','Working with technology','Computers, apps and digital tools.','Laptop','blue',1),
('personality-3','personality','Helping people','Supporting and caring for others.','Heart','rose',2),
('personality-4','personality','Working with numbers','Maths, data and patterns.','BarChart3','gold',3),
('personality-5','personality','Creating things','Designing, writing or making.','Palette','violet',4),
('personality-6','personality','Building & fixing','Understanding how things work.','Cog','rose',5),
('personality-7','personality','Leading & organising','Planning and bringing people together.','Users','emerald',6),
('personality-8','personality','Exploring & discovering','Learning, researching and asking questions.','Search','blue',7),
('preference-1','preference','Affordability','Cost is important when choosing where I study.','WalletCards','emerald',0),
('preference-2','preference','Funding','I''ll need NSFAS, a bursary or other financial support.','GraduationCap','blue',1),
('preference-3','preference','Accommodation','I may need student accommodation.','Home','gold',2),
('preference-4','preference','Close to home','I''d prefer options closer to where I live.','MapPin','rose',3),
('preference-5','preference','Institution type','I''m open to different types of institutions.','Landmark','violet',4),
('preference-6','preference','Location','I''m willing to study in another province.','Globe2','emerald',5),
('journey-1','journey','Discover','Explore careers and possibilities.','Compass','emerald',0),
('journey-2','journey','Choose','Find what fits you.','GraduationCap','mint',1),
('journey-3','journey','Plan','Set your goals and prepare.','BarChart3','blue',2),
('journey-4','journey','Apply','Take the next step.','FileText','gold',3),
('journey-5','journey','Graduate','Reach your goals.','Map','rose',4),
('institution_type-1','institution_type','University','','Compass','emerald',0),
('institution_type-2','institution_type','University of Technology','','Compass','emerald',1),
('institution_type-3','institution_type','TVET College','','Compass','emerald',2),
('institution_type-4','institution_type','Private Institution','','Compass','emerald',3),
('institution_type-5','institution_type','I''m open to anything','','Compass','emerald',4),
('province-1','province','Eastern Cape','','Compass','emerald',0),
('province-2','province','Free State','','Compass','emerald',1),
('province-3','province','Gauteng','','Compass','emerald',2),
('province-4','province','KwaZulu-Natal','','Compass','emerald',3),
('province-5','province','Limpopo','','Compass','emerald',4),
('province-6','province','Mpumalanga','','Compass','emerald',5),
('province-7','province','North West','','Compass','emerald',6),
('province-8','province','Northern Cape','','Compass','emerald',7),
('province-9','province','Western Cape','','Compass','emerald',8),
('study_goal-1','study_goal','Computer Science','','Compass','emerald',0),
('study_goal-2','study_goal','Software Engineering','','Compass','emerald',1),
('study_goal-3','study_goal','Data Science','','Compass','emerald',2),
('study_goal-4','study_goal','Health Sciences','','Compass','emerald',3),
('study_goal-5','study_goal','Business','','Compass','emerald',4),
('study_goal-6','study_goal','Creative Arts','','Compass','emerald',5),
('study_goal-7','study_goal','Engineering','','Compass','emerald',6),
('study_goal-8','study_goal','Education','','Compass','emerald',7),
('study_goal-9','study_goal','Environmental Sciences','','Compass','emerald',8),
('subject-1','subject','Mathematics','','Compass','emerald',0),
('subject-2','subject','Mathematical Literacy','','Compass','emerald',1),
('subject-3','subject','English Home Language','','Compass','emerald',2),
('subject-4','subject','English First Additional Language','','Compass','emerald',3),
('subject-5','subject','Afrikaans Home Language','','Compass','emerald',4),
('subject-6','subject','Afrikaans First Additional Language','','Compass','emerald',5),
('subject-7','subject','isiZulu Home Language','','Compass','emerald',6),
('subject-8','subject','isiXhosa Home Language','','Compass','emerald',7),
('subject-9','subject','Sepedi Home Language','','Compass','emerald',8),
('subject-10','subject','Sesotho Home Language','','Compass','emerald',9),
('subject-11','subject','Setswana Home Language','','Compass','emerald',10),
('subject-12','subject','siSwati Home Language','','Compass','emerald',11),
('subject-13','subject','Tshivenda Home Language','','Compass','emerald',12),
('subject-14','subject','Xitsonga Home Language','','Compass','emerald',13),
('subject-15','subject','isiNdebele Home Language','','Compass','emerald',14),
('subject-16','subject','Life Orientation','','Compass','emerald',15),
('subject-17','subject','Physical Sciences','','Compass','emerald',16),
('subject-18','subject','Life Sciences','','Compass','emerald',17),
('subject-19','subject','Accounting','','Compass','emerald',18),
('subject-20','subject','Business Studies','','Compass','emerald',19),
('subject-21','subject','Economics','','Compass','emerald',20),
('subject-22','subject','Geography','','Compass','emerald',21),
('subject-23','subject','History','','Compass','emerald',22),
('subject-24','subject','Computer Applications Technology','','Compass','emerald',23),
('subject-25','subject','Information Technology','','Compass','emerald',24),
('subject-26','subject','Agricultural Sciences','','Compass','emerald',25),
('subject-27','subject','Engineering Graphics and Design','','Compass','emerald',26),
('subject-28','subject','Tourism','','Compass','emerald',27),
('subject-29','subject','Consumer Studies','','Compass','emerald',28),
('subject-30','subject','Visual Arts','','Compass','emerald',29),
('subject-31','subject','Dramatic Arts','','Compass','emerald',30),
('subject-32','subject','Music','','Compass','emerald',31),
('subject-33','subject','Design','','Compass','emerald',32);


commit;
