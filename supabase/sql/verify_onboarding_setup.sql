-- Read-only setup checks. Run after onboarding_setup_v2.sql.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('via_onboarding','via_onboarding_options','via_onboarding_reports');
select category, count(*) as active_options from public.via_onboarding_options where active group by category order by category;
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'via-school-reports';
select schemaname, tablename, policyname, cmd from pg_policies where
  tablename like 'via_onboarding%' or policyname like 'via_school_reports_%' order by tablename, policyname;
select has_table_privilege('anon','public.via_onboarding','SELECT') as anonymous_answers_read_should_be_false,
  has_table_privilege('authenticated','public.via_onboarding','UPDATE') as direct_answers_write_should_be_false,
  has_function_privilege('authenticated','public.save_my_onboarding(jsonb,text,bigint,boolean)','EXECUTE') as authenticated_save_should_be_true,
  has_function_privilege('anon','public.save_my_onboarding(jsonb,text,bigint,boolean)','EXECUTE') as anonymous_save_should_be_false;
