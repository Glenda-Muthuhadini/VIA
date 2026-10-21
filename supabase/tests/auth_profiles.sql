-- Transactional integration test: all temporary users/profile changes roll back.
-- Run in a development Supabase project's SQL Editor as postgres, after setup.
-- No emails are sent and no real user's password is changed.
begin;
select set_config('via_test.user_a', gen_random_uuid()::text, true);
select set_config('via_test.user_b', gen_random_uuid()::text, true);

insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('via_test.user_a')::uuid, current_setting('via_test.user_a') || '@example.invalid', 'authenticated', 'authenticated', '{"first_name":"Test A","last_name":"VIA"}'::jsonb, now(), now()),
  (current_setting('via_test.user_b')::uuid, current_setting('via_test.user_b') || '@example.invalid', 'authenticated', 'authenticated', '{"first_name":"Test B","last_name":"VIA"}'::jsonb, now(), now());

do $$
begin
  if (select count(*) from public.via_profiles where id in (current_setting('via_test.user_a')::uuid, current_setting('via_test.user_b')::uuid)) <> 2 then
    raise exception 'FAIL: signup trigger did not create both profiles';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('via_test.user_a'), 'role', 'authenticated')::text, true);

do $$
declare changed_rows integer;
begin
  if (select count(*) from public.via_profiles where id = current_setting('via_test.user_a')::uuid) <> 1 then
    raise exception 'FAIL: owner cannot read profile';
  end if;
  if exists (select 1 from public.via_profiles where id = current_setting('via_test.user_b')::uuid) then
    raise exception 'FAIL: another user profile is visible';
  end if;
  update public.via_profiles set first_name = 'Updated test name' where id = current_setting('via_test.user_a')::uuid;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then raise exception 'FAIL: owner update was rejected'; end if;
  update public.via_profiles set first_name = 'Must not change' where id = current_setting('via_test.user_b')::uuid;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'FAIL: another user profile was updated'; end if;
  begin
    update public.via_profiles set created_at = now() where id = current_setting('via_test.user_a')::uuid;
    raise exception 'FAIL: protected columns can be updated';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.via_profiles (id) values (current_setting('via_test.user_a')::uuid);
    raise exception 'FAIL: direct profile insert is allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform id from public.via_profiles limit 1;
    raise exception 'FAIL: anonymous profile read is allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
select 'PASS: trigger, owner read/update, cross-user isolation, column permissions and anonymous denial' as result;
