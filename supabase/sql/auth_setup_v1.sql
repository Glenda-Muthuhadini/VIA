-- VIA AUTH SETUP v1: paste this entire file into Supabase SQL Editor.
-- Contains migrations 20261016000100 and 20261016000200, in order.
-- Run as the project SQL Editor postgres role. No credentials belong in SQL.

-- SOURCE: supabase/migrations/20261016000100_via_auth_profiles.sql
-- VIA authentication schema, version 1. Immutable: add a new migration for changes.
-- Supabase already owns auth.users and passwords. Never create a password table.
begin;

create schema if not exists via_private;
revoke all on schema via_private from public, anon, authenticated;

create table if not exists public.via_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 100),
  last_name text not null default '' check (char_length(last_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.via_profiles is
  'Private VIA profile data. Authentication, email and passwords belong to Supabase Auth.';

alter table public.via_profiles enable row level security;

-- Auth users can read their own profile and update only their names.
-- Creation is owned by the signup trigger, not by browser clients.
revoke all on public.via_profiles from public, anon, authenticated;
grant select on public.via_profiles to authenticated;
grant update (first_name, last_name) on public.via_profiles to authenticated;
grant all on public.via_profiles to service_role;

drop policy if exists via_profiles_select_own on public.via_profiles;
create policy via_profiles_select_own on public.via_profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists via_profiles_update_own on public.via_profiles;
create policy via_profiles_update_own on public.via_profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function via_private.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function via_private.set_profile_updated_at() from public, anon, authenticated;
drop trigger if exists via_profiles_set_updated_at on public.via_profiles;
create trigger via_profiles_set_updated_at
  before update on public.via_profiles
  for each row execute function via_private.set_profile_updated_at();

commit;


-- SOURCE: supabase/migrations/20261016000200_via_auth_profile_bootstrap.sql
-- VIA authentication schema, version 2. Run after version 1.
-- Creates a profile for new accounts and fills missing profiles for existing users.
begin;

create or replace function via_private.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.via_profiles (id, first_name, last_name)
  values (
    new.id,
    pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 100),
    pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 100)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function via_private.create_user_profile() from public, anon, authenticated;

-- Do not replace triggers belonging to other applications in the project.
drop trigger if exists via_auth_user_created on auth.users;
create trigger via_auth_user_created
  after insert on auth.users
  for each row execute function via_private.create_user_profile();

insert into public.via_profiles (id, first_name, last_name)
select
  users.id,
  pg_catalog.left(coalesce(users.raw_user_meta_data ->> 'first_name', ''), 100),
  pg_catalog.left(coalesce(users.raw_user_meta_data ->> 'last_name', ''), 100)
from auth.users as users
on conflict (id) do nothing;

notify pgrst, 'reload schema';
commit;
