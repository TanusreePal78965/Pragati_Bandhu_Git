-- supabase/tests/database/chukta_schema.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_schema('chukta', 'chukta schema exists');
select has_table('chukta', 'properties', 'properties');
select has_table('chukta', 'staff_users', 'staff_users');
select has_table('chukta', 'workers', 'workers');
select has_table('chukta', 'attendance_entries', 'attendance_entries');
select has_table('chukta', 'advance_entries', 'advance_entries');
select has_table('chukta', 'wage_payments', 'wage_payments');

insert into public.shops (id, shop_name, owner_name, phone)
values ('c1000000-0000-0000-0000-000000000001', 'S', 'O', '+919800000901');
insert into chukta.properties (id, shop_id, name)
values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'P1'),
       ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'P2');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role)
values ('c3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Ram', 'daily', 50000, '2026-09-01', 'c9000000-0000-0000-0000-000000000009', 'owner'),
       ('c3000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Sita', 'daily', 50000, '2026-09-01', 'c9000000-0000-0000-0000-000000000009', 'owner');
insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role)
values ('c4000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'advance', 100000, '2026-09-02', 'c9000000-0000-0000-0000-000000000009', 'owner');

select throws_ok(
  $$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', '2026-09-03', 'hours', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'status hours requires hours');

select throws_ok(
  $$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'writeoff', 500, '2026-09-03', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'writeoff requires a note');

select throws_ok(
  $$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', '2026-09-03', 'absent', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'entry property must match the worker property');

select throws_ok(
  $$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000002', 'advance', 100000, '2026-09-03', 'c4000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'void must target the same worker');

update chukta.workers set server_updated_at = '2000-01-01', name = 'Ram K' where id = 'c3000000-0000-0000-0000-000000000001';
select ok((select server_updated_at > '2001-01-01' from chukta.workers where id = 'c3000000-0000-0000-0000-000000000001'),
  'trigger stamps server_updated_at on update');

select * from finish();
rollback;
