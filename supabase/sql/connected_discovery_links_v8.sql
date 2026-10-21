-- VIA CONNECTED DISCOVERY v8: apply after connected_discovery_setup_v7.sql.
-- Updates two moved TUT source destinations; no scoring or user-data changes.

-- SOURCE: supabase/migrations/20261018001400_tut_source_links.sql
-- v8: current destinations followed from TUT's official Study@TUT navigation.
-- v7 remains immutable. No requirements, marks, scoring or auth changes.
begin;
update public.via_opportunities set
 source_url='https://devwww.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf',
 website_url='https://devwww.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf',
 source_name='TUT 2027 course information (linked by official Study@TUT page)',last_verified_at='2026-10-18T00:00:00Z'
where id='20000000-0000-4000-8000-000000000019';
update public.via_admission_rules set
 source_url='https://devwww.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf',
 source_name='TUT 2027 course information',last_verified_at='2026-10-18T00:00:00Z'
where programme_id='20000000-0000-4000-8000-000000000019';
update public.via_programme_requirements set
 source_url='https://devwww.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf',
 source_name='TUT 2027 course information',last_verified_at='2026-10-18T00:00:00Z'
where programme_id='20000000-0000-4000-8000-000000000019';
update public.via_application_cycles set
 source_url='https://devwww.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf',
 source_name='TUT 2027 course information',last_verified_at='2026-10-18T00:00:00Z'
where opportunity_id='20000000-0000-4000-8000-000000000019';
update public.via_opportunities set source_url='https://www.tut.ac.za/accommodation/',website_url='https://www.tut.ac.za/accommodation/',source_name='TUT official accommodation guidance',last_verified_at='2026-10-18T00:00:00Z'
where id='40000000-0000-4000-8000-000000000016';
update public.via_accommodation_institutions set source_url='https://www.tut.ac.za/accommodation/',source_name='TUT official accommodation guidance',last_verified_at='2026-10-18T00:00:00Z'
where accommodation_id='40000000-0000-4000-8000-000000000016';
notify pgrst,'reload schema';
commit;
