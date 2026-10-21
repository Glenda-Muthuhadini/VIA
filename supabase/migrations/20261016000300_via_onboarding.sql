-- VIA onboarding v2. Apply after the auth v1 migrations. No credentials required.
begin;

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
commit;
