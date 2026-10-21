-- Read-only verification. Run in Supabase SQL Editor after auth_setup_v1.sql.
select to_regclass('public.via_profiles') is not null as profile_table_exists;

select relrowsecurity as row_level_security_enabled
from pg_class where oid = to_regclass('public.via_profiles');

select policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'via_profiles';

select
  has_table_privilege('anon', 'public.via_profiles', 'SELECT') as anonymous_can_read_should_be_false,
  has_table_privilege('authenticated', 'public.via_profiles', 'SELECT') as authenticated_can_read_should_be_true,
  has_column_privilege('authenticated', 'public.via_profiles', 'first_name', 'UPDATE') as can_update_name_should_be_true,
  has_column_privilege('authenticated', 'public.via_profiles', 'id', 'UPDATE') as can_update_id_should_be_false,
  has_table_privilege('authenticated', 'public.via_profiles', 'INSERT') as can_insert_should_be_false;

select tgname, tgenabled
from pg_trigger
where tgname in ('via_auth_user_created', 'via_profiles_set_updated_at') and not tgisinternal;

select count(*) as users_missing_profiles_should_be_zero
from auth.users as users left join public.via_profiles as profiles on profiles.id = users.id
where profiles.id is null;
