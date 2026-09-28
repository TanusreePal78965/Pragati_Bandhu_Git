-- supabase/tests/database/shopai_rls_lockdown.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.shops (id, shop_name, owner_name, phone) values
  ('a0000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000101'),
  ('b0000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000102');
insert into public.categories (id, shop_id, name) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'cat A'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'cat B');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'shopai',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);

select is((select count(*)::int from public.categories where name like 'cat %'), 1, 'shopai token sees only its own shop rows');
select is((select name from public.categories where name like 'cat %'), 'cat A', 'and it is the right row');
select throws_ok(
  $$ insert into public.categories (id, shop_id, name) values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'x') $$,
  '42501', null, 'cannot write rows for another shop');
select is((select count(*)::int from public.shops), 1, 'sees only own shops row');
select throws_ok($$ update public.shops set is_active = true $$, '42501', null, 'cannot update is_active');
select throws_ok($$ update public.shops set phone = '+910000000000' $$, '42501', null, 'cannot update phone');
select throws_ok($$ update public.app_settings set value = '1' where key = 'app_maintenance_mode' $$,
  '42501', null, 'cannot write app_settings');

select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'chukta',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from public.categories), 0, 'chukta token cannot read ShopAI tables');

reset role;
set local role anon;
select throws_ok($$ select 1 from public.categories $$, '42501', null, 'anon has no table access');
select lives_ok($$ select key from public.app_settings limit 1 $$, 'anon can still read app_settings (version check)');

select * from finish();
rollback;
