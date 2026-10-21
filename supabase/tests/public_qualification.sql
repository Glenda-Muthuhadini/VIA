-- Run after corrected v6. Anonymous read-only test inputs; all temporary changes roll back.
begin;
set local role anon;
do $$
declare good jsonb:='[{"subject_id":"subject-1","mark":75},{"subject_id":"subject-3","mark":70},{"subject_id":"subject-7","mark":75},{"subject_id":"subject-17","mark":75},{"subject_id":"subject-18","mark":75},{"subject_id":"subject-22","mark":75},{"subject_id":"subject-16","mark":100}]'; r jsonb; item jsonb;
begin
 if (select count(*) from public.via_public_opportunities)<>40 then raise exception 'FAIL: expected 40 public catalogue records'; end if;
 if exists(select kind from public.via_public_opportunities group by kind having count(*)<>10) then raise exception 'FAIL: ten records per category'; end if;
 r:=public.check_public_qualification(good,true,true,2027);
 if (r#>>'{groups,meets,total}')::int<>4 then raise exception 'FAIL: supported positive match'; end if;
 for item in select value from jsonb_array_elements(r#>'{groups,meets,items}') loop
  if (item->>'learner_aps')::int<>36 then raise exception 'FAIL: APS or Life Orientation exclusion'; end if;
 end loop;
 r:=public.check_public_qualification(jsonb_set(good,'{0,mark}','66'),true,true,2027);
 if (r#>>'{groups,meets,total}')::int<>0 or (r#>>'{groups,close,total}')::int<>4 then raise exception 'FAIL: mandatory Mathematics ignored'; end if;
 r:=public.check_public_qualification(good,true,true,2026);
 if (r#>>'{groups,meets,total}')::int<>0 then raise exception 'FAIL: wrong intake accepted'; end if;
 r:=public.check_public_qualification(good,false,true,2027);
 if (r#>>'{groups,meets,total}')::int<>0 then raise exception 'FAIL: unsupported qualification accepted'; end if;
 r:=public.check_public_qualification(good,true,false,2027);
 if (r#>>'{groups,meets,total}')::int<>0 then raise exception 'FAIL: endorsement ignored'; end if;
 r:=public.check_public_qualification(good-0,true,true,2027);
 if (r#>>'{groups,meets,total}')::int<>0 then raise exception 'FAIL: missing Mathematics accepted'; end if;
 r:=public.check_public_qualification(good||'[{"subject_id":"subject-23","mark":100}]',true,true,2027);
 if (r#>>'{groups,meets,total}')::int<>0 then raise exception 'FAIL: invented extra-subject APS rule'; end if;
 begin
  perform public.check_public_qualification(jsonb_set(good,'{0,mark}','101'),true,true,2027);
  raise exception 'FAIL: mark over 100 accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.check_public_qualification(good||'[{"subject_id":"subject-4","mark":100}]',true,true,2027);
  raise exception 'FAIL: duplicate language variant double-counted';
 exception when invalid_parameter_value then null; end;
 begin
  insert into public.via_admission_rules(programme_id,academic_year,scoring_system,notes,source_url,source_name,last_verified_at)
  values('20000000-0000-4000-8000-000000000001',2027,'no_aps','test','https://example.invalid','test',now());
  raise exception 'FAIL: public catalogue write accepted';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.public_qualification_subjects())<6 then raise exception 'FAIL: public subjects unavailable'; end if;
end $$;
reset role;
rollback;
select 'PASS: 40 records, correct APS, mandatory subjects, missing/unsupported results, intake, endorsement, validation and read-only permissions' as result;
