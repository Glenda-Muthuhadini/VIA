-- Run after connected_discovery_setup_v7.sql. All temporary changes roll back.
begin;
do $$ begin
 if (select count(*) from public.via_programmes)<>21 then raise exception 'FAIL: expected 21 curated programmes';end if;
 if exists(select 1 from public.via_institutions i where not exists(select 1 from public.via_programmes p where p.institution_id=i.id)) then raise exception 'FAIL: institution has no programmes';end if;
 if exists(select 1 from public.via_programmes p where not exists(select 1 from public.via_programme_requirements r where r.programme_id=p.id)) then raise exception 'FAIL: programme requirements missing';end if;
 if exists(select 1 from public.via_public_opportunities v where v.kind='programmes' and jsonb_array_length(v.document->'cycles')=0) then raise exception 'FAIL: application information not connected';end if;
 if exists(select 1 from public.via_programmes p where not exists(select 1 from public.via_bursary_programmes b where b.programme_id=p.id)) then raise exception 'FAIL: programme funding links missing';end if;
 if exists(select 1 from public.via_bursaries b where not exists(select 1 from public.via_bursary_programmes p where p.bursary_id=b.id)) then raise exception 'FAIL: isolated funding record';end if;
end $$;
set local role anon;
do $$
declare good jsonb:='[{"subject_id":"subject-1","mark":75},{"subject_id":"subject-3","mark":70},{"subject_id":"subject-6","mark":65},{"subject_id":"subject-17","mark":75},{"subject_id":"subject-18","mark":75},{"subject_id":"subject-22","mark":75},{"subject_id":"subject-16","mark":90}]';
 result jsonb; related jsonb; maths_lit jsonb; low jsonb; junior jsonb;
begin
 result:=public.check_connected_qualification(good,12);
 if (result->'score'->>'value')::integer<>35 or (result->'exact'->>'total')::integer<5 or jsonb_array_length(result->'exact'->'items')<>5 then raise exception 'FAIL: Grade 12 score/exact ranking';end if;
 if exists(select 1 from jsonb_array_elements(result->'exact'->'items') x where x->>'status'<>'exact' or exists(select 1 from jsonb_array_elements(x->'checks') c where c->>'status'<>'met')) then raise exception 'FAIL: incorrect exact match';end if;
 result:=public.check_connected_qualification(jsonb_set(good,'{0,mark}','66'),11);
 if exists(select 1 from jsonb_array_elements(result->'exact'->'items') x where x->'programme'->>'id' in ('20000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000010')) then raise exception 'FAIL: APS bypassed mandatory Mathematics';end if;
 maths_lit:='[{"subject_id":"subject-2","mark":60},{"subject_id":"subject-3","mark":45},{"subject_id":"subject-7","mark":55},{"subject_id":"subject-19","mark":55},{"subject_id":"subject-20","mark":50},{"subject_id":"subject-22","mark":50},{"subject_id":"subject-16","mark":70}]';
 result:=public.check_connected_qualification(maths_lit,12);
 if (result->'score'->>'value')::integer<>24 or (result->'exact'->>'total')::integer<>3 or jsonb_array_length(result->'close'->'items')<>2 then raise exception 'FAIL: Maths Literacy exact/close outcomes: %',result;end if;
 if not exists(select 1 from jsonb_array_elements(result->'close'->'items') x,jsonb_array_elements(x->'missing') c where c->>'label'='English' and (c->>'actual')::integer=45 and (c->>'minimum')::integer=50) then raise exception 'FAIL: close-match explanation';end if;
 low:='[{"subject_id":"subject-1","mark":45},{"subject_id":"subject-3","mark":45},{"subject_id":"subject-7","mark":50},{"subject_id":"subject-17","mark":40},{"subject_id":"subject-18","mark":45},{"subject_id":"subject-22","mark":40},{"subject_id":"subject-16","mark":55}]';
 result:=public.check_connected_qualification(low,11);
 if (result->'score'->>'value')::integer<>19 or (result->'exact'->>'total')::integer<>3 then raise exception 'FAIL: lower APS certificate pathways';end if;
 for i in 9..10 loop
  junior:=case when i=9 then '[{"subject_id":"subject-1","mark":72},{"subject_id":"subject-3","mark":65},{"subject_id":"subject-g9-natural-sciences","mark":75}]'::jsonb else good end;
  result:=public.check_connected_qualification(junior,i);
  if result->>'mode'<>'pathways' or result->'score'<>'null'::jsonb or jsonb_array_length(result->'pathways')<3 or (result->'exact'->>'total')::integer<>0 then raise exception 'FAIL: junior eligibility claim';end if;
 end loop;
 related:=public.related_public_opportunities('20000000-0000-4000-8000-000000000013');
 if jsonb_array_length(related->'institutions')<>1 or jsonb_array_length(related->'funding')<2 or jsonb_array_length(related->'accommodation')<1 then raise exception 'FAIL: programme chain not connected';end if;
 related:=public.related_public_opportunities('30000000-0000-4000-8000-000000000008');
 if not exists(select 1 from jsonb_array_elements(related->'programmes') p where p->>'id'='20000000-0000-4000-8000-000000000013') then raise exception 'FAIL: Thuthuka CA programme link';end if;
 begin perform public.check_connected_qualification(good,8);raise exception 'FAIL: invalid grade accepted';exception when invalid_parameter_value then null;end;
 begin perform public.check_connected_qualification(jsonb_set(good,'{0,mark}','101'),12);raise exception 'FAIL: invalid mark accepted';exception when invalid_parameter_value then null;end;
 begin update public.via_bursary_programmes set relationship_note='wrong';raise exception 'FAIL: anonymous write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: connected catalogue, Grades 9/10 pathways, Grades 11/12 APS/mandatory subjects, exact/close results, funding/housing navigation and public write denial' as result;
