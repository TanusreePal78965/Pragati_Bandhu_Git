begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function('public', 'admin_chukta_counts', 'admin_chukta_counts exists');
select ok(not has_function_privilege('anon', 'public.admin_chukta_counts()', 'execute'), 'anon cannot execute');
select ok(not has_function_privilege('authenticated', 'public.admin_chukta_counts()', 'execute'), 'authenticated cannot execute');

insert into public.shops (id, shop_name, owner_name, phone) values
  ('ca000000-0000-0000-0000-000000000001', 'S1', 'O', '+919800000951'),
  ('ca000000-0000-0000-0000-000000000002', 'S2', 'O', '+919800000952');
insert into chukta.properties (id, shop_id, name, is_active) values
  ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'A', true),
  ('cb000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000001', 'B', true),
  ('cb000000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-000000000001', 'Archived', false);
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, status, left_date, created_by, created_by_role) values
  ('cc000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'W1', 'daily', 50000, '2026-09-01', 'active', null, 'c9000000-0000-0000-0000-000000000009', 'owner'),
  ('cc000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000001', 'W2', 'daily', 50000, '2026-09-01', 'left', '2026-09-10', 'c9000000-0000-0000-0000-000000000009', 'owner'),
  ('cc000000-0000-0000-0000-000000000003', 'cb000000-0000-0000-0000-000000000003', 'W3', 'daily', 50000, '2026-09-01', 'active', null, 'c9000000-0000-0000-0000-000000000009', 'owner');

select results_eq(
  $$ select property_count, worker_count from public.admin_chukta_counts() where shop_id = 'ca000000-0000-0000-0000-000000000001' $$,
  $$ values (2::bigint, 1::bigint) $$,
  'counts active properties and active workers of active properties');
select is((select count(*) from public.admin_chukta_counts() where shop_id = 'ca000000-0000-0000-0000-000000000002'), 0::bigint,
  'shops without properties are absent');

select * from finish();
rollback;
