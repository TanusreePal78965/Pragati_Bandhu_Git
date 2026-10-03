-- supabase/tests/database/chukta_phase2a.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'p2a-owner-a@test.internal'),
  ('e0000000-0000-0000-0000-00000000000b', 'p2a-owner-b@test.internal'),
  ('e0000000-0000-0000-0000-000000000051', 'p2a-staff@test.internal');
insert into public.shops (id, shop_name, owner_name, phone, auth_user_id) values
  ('e1000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000931', 'e0000000-0000-0000-0000-00000000000a'),
  ('e1000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000932', 'e0000000-0000-0000-0000-00000000000b');
insert into chukta.properties (id, shop_id, name) values
  ('e2000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000a', 'PA'),
  ('e2000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000b', 'PB');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role) values
  ('e4000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-00000000000a', 'WA', 'daily', 50000, '2026-09-01', 'e0000000-0000-0000-0000-00000000000a', 'owner');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role) values
  ('e4000000-0000-0000-0000-00000000000b', 'e2000000-0000-0000-0000-00000000000b', 'WB', 'daily', 50000, '2026-09-01', 'e0000000-0000-0000-0000-00000000000b', 'owner');
insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, note, created_by, created_by_role) values
  ('e5000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'bonus', 50000, '2026-09-05', null, 'e0000000-0000-0000-0000-00000000000a', 'owner');

-- constraints (as postgres)
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-09-10', 'X', 'party', 'full', 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'days_off kind is checked');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-10', 17, 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'overtime hours capped at 16');
select throws_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'deduction', 100, '2026-09-10', 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'deduction needs a reason');
select throws_ok($$ update chukta.properties set ot_mode = 'fixed', ot_rate_paise = null where id = 'e2000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'fixed overtime needs a rate');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000b', 'e4000000-0000-0000-0000-00000000000a', '2026-09-10', 2, 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'overtime worker must belong to the property');

-- owner A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'e1000000-0000-0000-0000-00000000000a')::text, true);
select lives_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, pay_rule, created_by_role)
  values ('e6000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-00000000000a', '2026-10-20', 'Durga Puja', 'holiday', 'full', 'by_basis', 'owner') $$,
  'owner adds a holiday');
select lives_ok($$ update chukta.days_off set is_active = false where id = 'e6000000-0000-0000-0000-00000000000a' $$, 'owner deactivates a day off');
select lives_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, custom_amount_paise, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-10', 2, 30000, 'owner') $$,
  'owner sets a custom overtime amount');
select lives_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'bonus', 50000, '2026-09-05', 'e5000000-0000-0000-0000-00000000000a', 'owner') $$,
  'owner voids a bonus');
select lives_ok($$ update chukta.properties set offday_multiplier = 1.5, ot_mode = 'fixed', ot_rate_paise = 6000 where id = 'e2000000-0000-0000-0000-00000000000a' $$,
  'owner updates extra-pay settings');
select throws_ok($$ delete from chukta.days_off $$, '42501', null, 'nobody deletes days off');
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-10-21', 'X', 'holiday', 'full', 'e0000000-0000-0000-0000-00000000000b', 'owner') $$,
  '42501', null, 'created_by cannot be spoofed on days_off');
select lives_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, custom_amount_paise, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-14', 'present', 100, 'owner') $$,
  'owner can set a custom day-off amount');

-- owner B (another shop) cannot write into property A
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-00000000000b', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'e1000000-0000-0000-0000-00000000000b')::text, true);
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-10-22', 'X', 'holiday', 'full', 'owner') $$,
  '42501', null, 'other-shop owner cannot add days off');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-15', 1, 'owner') $$,
  '23514', null, 'other-shop owner cannot add overtime'); -- consistency trigger rejects first: caller cannot see that worker
select throws_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'bonus', 100, '2026-09-15', 'owner') $$,
  '23514', null, 'other-shop owner cannot add adjustments'); -- consistency trigger rejects first: caller cannot see that worker

-- staff of property A
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000051', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'e1000000-0000-0000-0000-00000000000a', 'app_role', 'staff',
  'property_id', 'e2000000-0000-0000-0000-00000000000a')::text, true);
select lives_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-09-11', 'Bandh', 'closure', 'full', 'staff') $$, 'staff adds a closure');
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-09-12', 'Holi', 'holiday', 'full', 'staff') $$,
  '42501', null, 'staff cannot add a holiday');
select lives_ok($$ update chukta.days_off set name = 'x' $$, 'staff day-off update is a silent no-op');
select is((select name from chukta.days_off where id = 'e6000000-0000-0000-0000-00000000000a'), 'Durga Puja', 'staff cannot edit days off');
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, pay_rule, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-09-16', 'Bandh', 'closure', 'full', 'all_paid', 'staff') $$,
  '42501', null, 'staff closure must use by_basis pay rule');
select lives_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-16', 2, 'staff') $$,
  'staff can add overtime without a custom amount');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000b', 'e4000000-0000-0000-0000-00000000000b', '2026-09-16', 2, 'staff') $$,
  '23514', null, 'staff cannot add overtime to another property'); -- consistency trigger rejects first: caller cannot see that worker
select throws_ok($$ update chukta.workers set ot_mode = 'fixed', ot_rate_paise = 100 where id = 'e4000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'staff cannot change worker pay settings');
select throws_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, ot_mode, created_by_role)
  values ('e4000000-0000-0000-0000-0000000000c1', 'e2000000-0000-0000-0000-00000000000a', 'WS1', 'daily', 50000, '2026-09-01', 'fixed', 'staff') $$,
  '42501', null, 'staff cannot insert a worker with pay settings');
select lives_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by_role)
  values ('e4000000-0000-0000-0000-0000000000c2', 'e2000000-0000-0000-0000-00000000000a', 'WS2', 'daily', 50000, '2026-09-01', 'staff') $$,
  'staff can insert a worker without pay settings');
select lives_ok($$ update chukta.workers set name = 'WA2' where id = 'e4000000-0000-0000-0000-00000000000a' $$, 'staff can still edit Phase 1 worker columns');
select lives_ok($$ update chukta.properties set ot_mode = 'multiplier' $$, 'staff property pay-settings update is a silent no-op');
select is((select ot_mode from chukta.properties where id = 'e2000000-0000-0000-0000-00000000000a'), 'fixed', 'staff cannot change property pay settings');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, custom_amount_paise, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-12', 1, 100, 'staff') $$,
  '42501', null, 'staff cannot set a custom overtime amount');
select throws_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, custom_amount_paise, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-13', 'present', 100, 'staff') $$,
  '42501', null, 'staff cannot set a custom day-off amount');
select throws_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'bonus', 100, '2026-09-13', 'staff') $$,
  '42501', null, 'staff cannot add a bonus');

-- ShopAI token sees nothing
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'shopai', 'shop_id', 'e1000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.days_off), 0, 'shopai token sees no days off');

select * from finish();
rollback;
