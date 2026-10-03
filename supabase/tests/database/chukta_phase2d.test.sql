-- supabase/tests/database/chukta_phase2d.test.sql
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-00000000000a', 'p2d-owner-a@test.internal'),
  ('f0000000-0000-0000-0000-00000000000b', 'p2d-owner-b@test.internal'),
  ('f0000000-0000-0000-0000-000000000051', 'p2d-staff@test.internal');
insert into public.shops (id, shop_name, owner_name, phone, auth_user_id) values
  ('f1000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000941', 'f0000000-0000-0000-0000-00000000000a'),
  ('f1000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000942', 'f0000000-0000-0000-0000-00000000000b');
insert into chukta.properties (id, shop_id, name) values
  ('f2000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-00000000000a', 'PA'),
  ('f2000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-00000000000b', 'PB');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role) values
  ('f4000000-0000-0000-0000-00000000000a', 'f2000000-0000-0000-0000-00000000000a', 'WA', 'daily', 50000, '2026-09-01', 'f0000000-0000-0000-0000-00000000000a', 'owner');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role) values
  ('f4000000-0000-0000-0000-00000000000b', 'f2000000-0000-0000-0000-00000000000b', 'WB', 'daily', 50000, '2026-09-01', 'f0000000-0000-0000-0000-00000000000b', 'owner');
select plan(24);


-- as postgres: order + overlap
select lives_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by, created_by_role)
  values ('f7000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-01', '2026-09-05', '2026-09-06', 'daily', 50000, 0, 250000, 0, 0, 0, 0, 250000, 0, 250000, 0, 0, 0,
    'f0000000-0000-0000-0000-00000000000a', 'owner') $$, 'first settlement starts on the joining date');
select throws_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-03', '2026-09-12', '2026-09-13', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    'f0000000-0000-0000-0000-00000000000a', 'owner') $$, '23514', null, 'overlapping settlement rejected');
select throws_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-08', '2026-09-12', '2026-09-13', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    'f0000000-0000-0000-0000-00000000000a', 'owner') $$, '23514', null, 'gap after the last settlement rejected');
select is(chukta.settled_period_id('f4000000-0000-0000-0000-00000000000a', '2026-09-03'),
  'f7000000-0000-0000-0000-000000000001'::uuid, 'settled_period_id finds the covering settlement');
select is(chukta.settled_period_id('f4000000-0000-0000-0000-00000000000a', '2026-09-06'), null::uuid, 'no settlement after the period');

-- owner A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'f1000000-0000-0000-0000-00000000000a')::text, true);
select throws_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-03', 'absent', 'owner') $$,
  '23514', null, 'attendance in a settled period is locked');
select lives_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-07', 'absent', 'owner') $$,
  'attendance after the period is allowed');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-03', 1, 'owner') $$,
  '23514', null, 'overtime in a settled period is locked');
select throws_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', 'bonus', 100, '2026-09-03', 'owner') $$,
  '23514', null, 'bonus in a settled period is locked');
select throws_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', 'advance', 100, '2026-09-03', 'owner') $$,
  '23514', null, 'advance in a settled period is locked');
select throws_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', 100, '2026-09-03', 'owner') $$,
  '23514', null, 'unlinked payment in a settled period is locked');
select lives_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, mode, settlement_id, created_by_role)
  values ('f8000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    250000, '2026-09-05', 'cash', 'f7000000-0000-0000-0000-000000000001', 'owner') $$, 'payment linked to its settlement is allowed');
select throws_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, settlement_id, voids_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    250000, '2026-09-05', 'f7000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-000000000001', 'owner') $$,
  '23514', null, 'a void inside a settled period is locked even when linked');
select throws_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, settlement_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    'advance', 100, '2026-09-05', 'f7000000-0000-0000-0000-000000000001', 'owner') $$,
  '23514', null, 'only repayments may link to a settlement');
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, pay_rule, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', '2026-09-04', 'H', 'holiday', 'full', 'by_basis', 'owner') $$,
  '23514', null, 'holiday on a settled date is locked');
select lives_ok($$ update chukta.properties set pay_cycle = 'monthly', cycle_end_weekday = 3 where id = 'f2000000-0000-0000-0000-00000000000a' $$,
  'owner sets the pay cycle');

-- staff of property A
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000051', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'f1000000-0000-0000-0000-00000000000a', 'app_role', 'staff',
  'property_id', 'f2000000-0000-0000-0000-00000000000a')::text, true);
select throws_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-06', '2026-09-12', '2026-09-13', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'staff') $$,
  '42501', null, 'staff cannot settle');
select throws_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, settlement_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    100, '2026-09-08', 'f7000000-0000-0000-0000-000000000001', 'staff') $$, '42501', null, 'staff cannot link a payment to a settlement');
select throws_ok($$ update chukta.workers set pay_cycle = 'monthly' where id = 'f4000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'staff cannot change the pay cycle');
select is((select count(*)::int from chukta.settlements where worker_id = 'f4000000-0000-0000-0000-00000000000a'), 1, 'staff can read settlements');

-- owner A again: unlock
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'f1000000-0000-0000-0000-00000000000a')::text, true);
select lives_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, voids_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-01', '2026-09-05', '2026-09-08', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    'f7000000-0000-0000-0000-000000000001', 'owner') $$, 'owner unlocks by voiding');
select lives_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-03', 'absent', 'owner') $$,
  'unlocked period accepts entries again');
select throws_ok($$ update chukta.settlements set note = 'x' $$, '42501', null, 'nobody updates settlements');
select throws_ok($$ delete from chukta.settlements $$, '42501', null, 'nobody deletes settlements');

select * from finish();
rollback;
