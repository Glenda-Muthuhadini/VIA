-- Read-only verification after adaptive onboarding v3.
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='via_profiles' and column_name like 'education_stage%';
select tablename,rowsecurity from pg_tables where schemaname='public' and tablename in ('via_onboarding_history','via_learner_selections','via_academic_records','via_academic_results');
select category,count(*) from public.via_onboarding_options where education_stages=array['grade_9'] group by category;
select has_function_privilege('authenticated','public.set_my_education_stage(text,bigint)','EXECUTE') as authenticated_stage_save_should_be_true,
 has_function_privilege('anon','public.set_my_education_stage(text,bigint)','EXECUTE') as anonymous_stage_save_should_be_false,
 has_table_privilege('authenticated','public.via_learner_selections','INSERT') as direct_selection_write_should_be_false;
