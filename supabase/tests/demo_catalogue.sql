-- Focused v10 tests. Temporary changes roll back; no accounts or marks written.
begin;
do $$ begin
 if (select count(*) from public.via_opportunities where kind='institutions' and published)<>10 then raise exception 'FAIL: institution count';end if;
 if (select count(*) from public.via_faculties)<>50 then raise exception 'FAIL: faculty count';end if;
 if (select count(*) from public.via_opportunities where kind='programmes' and is_demo and published)<>150 then raise exception 'FAIL: demo programme count';end if;
 if exists(select 1 from public.via_institutions i where (select count(*) from public.via_faculties f where f.institution_id=i.id)<>5) then raise exception 'FAIL: five faculties each';end if;
 if exists(select 1 from public.via_faculties f where (select count(*) from public.via_programmes p join public.via_opportunities o on o.id=p.id where p.faculty_id=f.id and o.is_demo)<3) then raise exception 'FAIL: three programmes per faculty';end if;
 if exists(select 1 from public.via_programmes p join public.via_opportunities o on o.id=p.id where o.is_demo and (p.study_mode is null or p.duration is null or p.minimum_aps is null or not exists(select 1 from public.via_programme_requirements r where r.programme_id=p.id and r.is_demo))) then raise exception 'FAIL: incomplete programme';end if;
 if exists(select 1 from public.via_opportunities where is_demo and kind<>'institutions' and application_url is not null) then raise exception 'FAIL: invented application URL';end if;
end $$;
set local role anon;
do $$
declare i record; f jsonb; r jsonb; other jsonb; linked jsonb;
 good jsonb:='[{"subject_id":"subject-1","mark":80},{"subject_id":"subject-3","mark":80},{"subject_id":"subject-6","mark":80},{"subject_id":"subject-17","mark":80},{"subject_id":"subject-18","mark":80},{"subject_id":"subject-22","mark":80},{"subject_id":"subject-16","mark":80}]';
begin
 for i in select id from public.via_institutions loop
  f:=public.public_institution_faculties(i.id);
  if jsonb_array_length(f)<>5 or exists(select 1 from jsonb_array_elements(f) x where jsonb_array_length(x->'programmes')<>3 or x->'aps_min'='null'::jsonb) then raise exception 'FAIL: faculty public projection';end if;
 end loop;
 r:=public.check_connected_qualification(good,12);
 if (r->'score'->>'value')::integer<>42 or jsonb_array_length(r->'exact'->'items')<>5 or (r->'exact'->>'total')::integer<150 then raise exception 'FAIL: all demo programmes compared';end if;
 if exists(select 1 from jsonb_array_elements(r->'exact'->'items') x where (x->'programme'->>'is_demo')::boolean is not true or exists(select 1 from jsonb_array_elements(x->'checks') c where c->>'status'<>'met')) then raise exception 'FAIL: incorrect demo result';end if;
 linked:=public.related_public_opportunities((r->'exact'->'items'->0->'programme'->>'id')::uuid);
 if jsonb_array_length(linked->'institutions')<>1 or jsonb_array_length(linked->'funding')=0 or jsonb_array_length(linked->'accommodation')=0 then raise exception 'FAIL: disconnected demo result';end if;
 other:=public.check_connected_qualification(jsonb_set(good,'{0,mark}','39'),11);
 if jsonb_array_length(other->'exact'->'items')<>5 or other->'exact'->'items'=r->'exact'->'items' then raise exception 'FAIL: fixed Top 5';end if;
 if exists(select 1 from jsonb_array_elements(other->'exact'->'items') x,jsonb_array_elements(x->'checks') c where c->>'label'='Mathematics' and (c->>'minimum')::numeric>39) then raise exception 'FAIL: APS bypassed subject mark';end if;
 other:=public.check_connected_qualification(good,9);
 if other->>'mode'<>'pathways' or other->'score'<>'null'::jsonb then raise exception 'FAIL: junior eligibility';end if;
 begin update public.via_opportunities set is_demo=false;raise exception 'FAIL: anonymous write';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: 10 institutions, 50 faculties, 150 connected demo programmes, dynamic Top 5, APS/subject checks, funding/accommodation links and public read-only access' as result;
