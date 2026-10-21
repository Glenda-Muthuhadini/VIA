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
