-- Read-only checks after v4. No private user data is returned.
select kind,count(*) as published_records from public.via_opportunities where published group by kind order by kind;
select tablename,rowsecurity from pg_tables where schemaname='public' and tablename in ('via_opportunities','via_institutions','via_programmes','via_programme_requirements','via_application_cycles','via_bursaries','via_bursary_eligibility','via_accommodations','via_accommodation_institutions','via_campuses','via_saved_opportunities') order by tablename;
select has_function_privilege('anon','public.search_public_opportunities(text,text,jsonb,integer,integer)','execute') as anonymous_browsing_should_be_true,
 has_table_privilege('anon','public.via_saved_opportunities','select') as anonymous_saved_read_should_be_false,
 has_table_privilege('anon','public.via_saved_opportunities','insert') as anonymous_save_should_be_false,
 has_table_privilege('authenticated','public.via_saved_opportunities','insert') as authenticated_save_should_be_true,
 has_table_privilege('authenticated','public.via_opportunities','update') as browser_catalogue_edit_should_be_false;
select (public.search_public_opportunities('programmes','computer','{}',1,2)->>'total')::integer as computer_programmes,
 jsonb_array_length(public.search_public_opportunities('programmes','','{}',1,2)->'items') as bounded_page_size_should_be_2;
