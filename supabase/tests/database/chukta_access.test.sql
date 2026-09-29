-- supabase/tests/database/chukta_access.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- fixtures (as postgres)
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'owner-a@test.internal'),
  ('d0000000-0000-0000-0000-00000000000b', 'owner-b@test.internal'),
  ('d0000000-0000-0000-0000-000000000051', 'staff-1@test.internal');
insert into public.shops (id, shop_name, owner_name, phone, auth_user_id) values
  ('d1000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000911', 'd0000000-0000-0000-0000-00000000000a'),
  ('d1000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000912', 'd0000000-0000-0000-0000-00000000000b');
insert into chukta.properties (id, shop_id, name) values
  ('d2000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', 'PA'),
  ('d2000000-0000-0000-0000-00000000000b', 'd1000000-0000-0000-0000-00000000000b', 'PB');
insert into chukta.staff_users (id, property_id, name, auth_user_id, pin_hash, pin_salt) values
  ('d3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-00000000000a', 'Mgr', 'd0000000-0000-0000-0000-000000000051', 'h', 's');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role) values
  ('d4000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000a', 'WA', 'daily', 50000, '2026-09-01', 'd0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d4000000-0000-0000-0000-00000000000b', 'd2000000-0000-0000-0000-00000000000b', 'WB', 'daily', 50000, '2026-09-01', 'd0000000-0000-0000-0000-00000000000b', 'owner');
insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role) values
  ('d5000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', 'advance', 100000, '2026-09-02', 'd0000000-0000-0000-0000-00000000000a', 'owner');
insert into public.app_sessions (session_id, user_id, app) values
  ('d6000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000051', 'chukta');
insert into auth.users (id, email) values ('d0000000-0000-0000-0000-000000000052', 'staff-2@test.internal');
insert into chukta.staff_users (id, property_id, name, auth_user_id, pin_hash, pin_salt, is_active) values
  ('d3000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-00000000000a', 'Old', 'd0000000-0000-0000-0000-000000000052', 'h', 's', false);

-- hook: staff claims
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', 'd0000000-0000-0000-0000-000000000051',
    'claims', jsonb_build_object('session_id', 'd6000000-0000-0000-0000-000000000001', 'role', 'authenticated'))) -> 'claims' ->> 'app_role',
  'staff', 'hook adds app_role=staff for active staff');
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', 'd0000000-0000-0000-0000-000000000051',
    'claims', jsonb_build_object('session_id', 'd6000000-0000-0000-0000-000000000001', 'role', 'authenticated'))) -> 'claims' ->> 'property_id',
  'd2000000-0000-0000-0000-00000000000a', 'hook adds property_id for staff');
select ok(
  (public.custom_access_token_hook(jsonb_build_object('user_id', 'd0000000-0000-0000-0000-000000000052',
    'claims', jsonb_build_object('role', 'authenticated'))) -> 'claims' ->> 'app_role') is null,
  'inactive staff gets no staff claims');

-- owner A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'd1000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.properties), 1, 'owner sees only own shop properties');
select lives_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'New', 'daily', 40000, '2026-09-05', 'owner') $$, 'owner inserts worker in own property');
select throws_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000b', 'X', 'daily', 40000, '2026-09-05', 'owner') $$, '42501', null, 'owner cannot insert into another shop property');
select throws_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'X', 'daily', 40000, '2026-09-05', 'd0000000-0000-0000-0000-00000000000b', 'owner') $$, '42501', null, 'created_by cannot be spoofed');
select throws_ok($$ delete from chukta.workers where id = 'd4000000-0000-0000-0000-00000000000a' $$, '42501', null, 'owner cannot delete');
select lives_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', 'advance', 100000, '2026-09-03', 'd5000000-0000-0000-0000-00000000000a', 'owner') $$, 'owner can void');
select throws_ok($$ update chukta.workers set property_id = 'd2000000-0000-0000-0000-00000000000b' where id = 'd4000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'owner cannot move a worker to another property');
select throws_ok($$ update chukta.workers set created_by = 'd0000000-0000-0000-0000-00000000000b' where id = 'd4000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'audit columns are not updatable');

-- staff of PA
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-000000000051', 'role', 'authenticated',
  'app', 'chukta', 'app_role', 'staff', 'property_id', 'd2000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.properties), 1, 'staff sees only own property');
select is((select count(*)::int from chukta.workers where property_id = 'd2000000-0000-0000-0000-00000000000b'), 0, 'staff sees no other property workers');
select ok((select count(*) from chukta.workers where property_id = 'd2000000-0000-0000-0000-00000000000a') >= 1,
  'staff sees own property workers');
select lives_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', '2026-09-04', 'absent', 'staff') $$, 'staff marks attendance');
select throws_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', 'advance', 100000, '2026-09-03', 'd5000000-0000-0000-0000-00000000000a', 'staff') $$, '42501', null, 'staff cannot void');
select throws_ok($$ update chukta.advance_entries set amount_paise = 1 $$, '42501', null, 'money rows are not updatable');
select throws_ok($$ select pin_hash from chukta.staff_users $$, '42501', null, 'pin_hash is never readable');
select throws_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'X', 'daily', 40000, '2026-09-05', 'owner') $$, '42501', null, 'staff cannot claim owner role');

-- ShopAI token and anon
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'shopai', 'shop_id', 'd1000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.workers), 0, 'shopai token sees no chukta data');
reset role;
set local role anon;
select throws_ok($$ select 1 from chukta.workers $$, '42501', null, 'anon has no access');
reset role;
set local role authenticated;
select throws_ok($$ select chukta.reserve_pin_attempt('d1000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'clients cannot call reserve_pin_attempt');
reset role;
select is(
  (select array_agg(chukta.reserve_pin_attempt('d1000000-0000-0000-0000-00000000000b')) from generate_series(1, 11)),
  array['ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','locked'],
  '10 attempts per window, the 11th locks');
select chukta.clear_pin_attempts('d1000000-0000-0000-0000-00000000000b');
select is(chukta.reserve_pin_attempt('d1000000-0000-0000-0000-00000000000b'), 'ok', 'clear_pin_attempts unlocks');

reset role;
update chukta.properties set is_active = false where id = 'd2000000-0000-0000-0000-00000000000a';
select is((select is_active from chukta.staff_users where id = 'd3000000-0000-0000-0000-000000000001'), false,
  'archiving a property deactivates its staff');
select is((select count(*)::int from public.app_sessions where user_id = 'd0000000-0000-0000-0000-000000000051'), 0,
  'archiving a property revokes staff sessions');

select * from finish();
rollback;
