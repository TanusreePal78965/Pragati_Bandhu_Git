-- supabase/tests/database/shopai_rls_lockdown.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.shops (id, shop_name, owner_name, phone) values
  ('a0000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000101'),
  ('b0000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000102');
insert into public.categories (id, shop_id, name) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'cat A'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'cat B');
insert into public.bills (id, shop_id) values
  ('bill-a', 'a0000000-0000-0000-0000-00000000000a'),
  ('bill-b', 'b0000000-0000-0000-0000-00000000000b');
insert into public.bill_items (id, bill_id, product_id, product_name) values
  ('bi-a', 'bill-a', 'p1', 'item A'),
  ('bi-b', 'bill-b', 'p1', 'item B');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'shopai',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);

select is((select count(*)::int from public.categories where name like 'cat %'), 1, 'shopai token sees only its own shop rows');
select is((select name from public.categories where name like 'cat %'), 'cat A', 'and it is the right row');
select throws_ok(
  $$ insert into public.categories (id, shop_id, name) values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'x') $$,
  '42501', null, 'cannot write rows for another shop');
select lives_ok(
  $$ insert into public.categories (id, shop_id, name) values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'own new') $$,
  'owner can insert rows for own shop');
select is((select count(*)::int from public.bill_items where id in ('bi-a', 'bi-b')), 1, 'bill_items scoped through own bills');
select lives_ok($$ update public.shops set shop_name = 'A renamed' where id = 'a0000000-0000-0000-0000-00000000000a' $$, 'owner can update allowed shops column');
select is((select shop_name from public.shops), 'A renamed', 'own shop_name updated');
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
select is(
  (select count(*)::int from pg_tables t
    where t.schemaname = 'public' and t.tablename <> 'app_settings'
      and (has_table_privilege('anon', format('public.%I', t.tablename), 'SELECT,INSERT,UPDATE,DELETE')
        or has_any_column_privilege('anon', format('public.%I', t.tablename), 'SELECT,INSERT,UPDATE'))),
  0, 'anon has no privileges on any public table except app_settings');
select is(
  (select count(*)::int from pg_policies p
    where p.schemaname = 'public'
      and (p.qual = 'true' or p.with_check = 'true')
      and not (p.tablename = 'app_settings' and p.cmd = 'SELECT')
      and not ('supabase_auth_admin'::name = any(p.roles))),
  0, 'no permissive (true) policies left outside app_settings read and auth-admin hook policies');
set local role anon;
select throws_ok($$ select 1 from public.categories $$, '42501', null, 'anon has no table access');
select lives_ok($$ select key from public.app_settings limit 1 $$, 'anon can still read app_settings (version check)');

select * from finish();
rollback;
