-- Run after v9. Administrative mutation checks are temporary and rolled back.
begin;
do $$ declare r jsonb;begin
 if exists(select 1 from public.via_programmes where faculty_id is null) then raise exception 'FAIL: missing faculty';end if;
 if exists(select 1 from public.via_opportunities where kind='institutions' and application_url is null) then raise exception 'FAIL: missing application destination';end if;
 r:=public.public_institution_summaries(array['10000000-0000-4000-8000-000000000005'::uuid,'10000000-0000-4000-8000-000000000008'::uuid,'10000000-0000-4000-8000-000000000009'::uuid]);
 if (r->'10000000-0000-4000-8000-000000000005'->>'aps_min')::numeric<>22 or (r->'10000000-0000-4000-8000-000000000005'->>'aps_max')::numeric<>33 then raise exception 'FAIL: UJ range';end if;
 if r->'10000000-0000-4000-8000-000000000009'->'aps_min'<>'null'::jsonb then raise exception 'FAIL: unsupported score aggregated';end if;
 update public.via_admission_rules set minimum_aps=35 where programme_id='20000000-0000-4000-8000-000000000013' and academic_year=2027;
 if (select minimum_aps from public.via_programmes where id='20000000-0000-4000-8000-000000000013')<>35 then raise exception 'FAIL: rule sync';end if;
 r:=public.public_institution_faculties('10000000-0000-4000-8000-000000000005','Accounting');
 if jsonb_array_length(r)<>1 or (r->0->>'aps_max')::numeric<>35 then raise exception 'FAIL: cross-faculty search or live range';end if;
 update public.via_programmes set minimum_aps=34 where id='20000000-0000-4000-8000-000000000013';
 if (select minimum_aps from public.via_admission_rules where programme_id='20000000-0000-4000-8000-000000000013' and academic_year=2027)<>34 then raise exception 'FAIL: programme score sync';end if;
 begin
 update public.via_programmes set faculty_id=(select id from public.via_faculties where institution_id='10000000-0000-4000-8000-000000000001' limit 1) where id='20000000-0000-4000-8000-000000000013';
 raise exception 'FAIL: cross-institution faculty accepted';exception when foreign_key_violation then null;end;
end $$;
set local role anon;
do $$ declare i record; f jsonb;begin
 for i in select id from public.via_institutions loop
  f:=public.public_institution_faculties(i.id);
  if jsonb_array_length(f)=0 then raise exception 'FAIL: empty institution';end if;
 end loop;
 if public.public_institution_faculties('10000000-0000-4000-8000-000000000005','no-such-programme')<>'[]'::jsonb then raise exception 'FAIL: empty search';end if;
 begin update public.via_faculties set name='wrong';raise exception 'FAIL: anonymous write';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- A new linked programme appears automatically; removal disappears automatically.
insert into public.via_opportunities(id,kind,slug,title,overview,source_url,source_name,last_verified_at,published) values('90000000-0000-4000-8000-000000000009','programmes','test-v9-rollback','Test programme rollback','Test only','https://example.invalid/','Test',now(),true);
insert into public.via_programmes(id,institution_id,faculty_id,field,qualification) select '90000000-0000-4000-8000-000000000009',institution_id,id,'Test','Test' from public.via_faculties where institution_id='10000000-0000-4000-8000-000000000001' limit 1;
do $$ begin if jsonb_array_length(public.public_institution_faculties('10000000-0000-4000-8000-000000000001','Test programme'))<>1 then raise exception 'FAIL: new programme missing';end if;end $$;
delete from public.via_opportunities where id='90000000-0000-4000-8000-000000000009';
do $$ begin if public.public_institution_faculties('10000000-0000-4000-8000-000000000001','Test programme')<>'[]'::jsonb then raise exception 'FAIL: deleted programme visible';end if;end $$;
rollback;
select 'PASS: faculty relationships, automatic programme updates, server search, comparable APS ranges, score synchronization, official application URLs and public read-only access' as result;
