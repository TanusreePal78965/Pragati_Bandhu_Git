-- supabase/tests/database/shopai_deltas.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into public.shops (id, shop_name, owner_name, phone) values
  ('a0000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000201'),
  ('b0000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000202');
insert into public.products (id, shop_id, name, stock_quantity, updated_at) values
  ('prod-a', 'a0000000-0000-0000-0000-00000000000a', 'item A', 10, '2000-01-01T00:00:00Z'),
  ('prod-b', 'b0000000-0000-0000-0000-00000000000b', 'item B', 10, '2000-01-01T00:00:00Z');
insert into public.customers (id, shop_id, name, udhar_balance) values
  ('cust-a', 'a0000000-0000-0000-0000-00000000000a', 'cust A', 100),
  ('cust-b', 'b0000000-0000-0000-0000-00000000000b', 'cust B', 100);

-- Static checks (as the migration owner).
select is((select bool_or(prosecdef) from pg_proc
            where proname in ('shopai_adjust_stock', 'shopai_adjust_udhar') and pronamespace = 'public'::regnamespace),
  false, 'both delta functions are SECURITY INVOKER');
select is(has_function_privilege('anon', 'public.shopai_adjust_stock(text, numeric, text)', 'execute'), false,
  'anon cannot execute shopai_adjust_stock');
select is(has_function_privilege('anon', 'public.shopai_adjust_udhar(text, numeric, text)', 'execute'), false,
  'anon cannot execute shopai_adjust_udhar');
select is(has_function_privilege('authenticated', 'public.shopai_adjust_stock(text, numeric, text)', 'execute'), true,
  'authenticated can execute shopai_adjust_stock');
select is(has_table_privilege('anon', 'public.shopai_applied_deltas', 'SELECT,INSERT,UPDATE,DELETE'), false,
  'anon has no access to shopai_applied_deltas');
select is((select relrowsecurity from pg_class where oid = 'public.shopai_applied_deltas'::regclass), true,
  'shopai_applied_deltas has RLS enabled');

-- ShopAI token for shop A.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'shopai',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);

select lives_ok($$ select public.shopai_adjust_stock('prod-a', -3, 'op-1') $$, 'owner adjusts own stock');
select is((select stock_quantity from public.products where id = 'prod-a'), 7::numeric, 'stock changed by the delta');
select is((select updated_at > '2000-01-01T00:00:00Z'::timestamptz from public.products where id = 'prod-a'), true,
  'stock delta bumps updated_at');
select lives_ok($$ select public.shopai_adjust_stock('prod-a', -3, 'op-1') $$, 'replaying the same op_id does not fail');
select is((select stock_quantity from public.products where id = 'prod-a'), 7::numeric, 'same op_id is applied only once');
select lives_ok($$ select public.shopai_adjust_stock('prod-a', -2, 'op-2') $$, 'a different op_id applies');
select is((select stock_quantity from public.products where id = 'prod-a'), 5::numeric, 'different op_id changed stock');
select is((select shop_id from public.shopai_applied_deltas where op_id = 'op-1'),
  'a0000000-0000-0000-0000-00000000000a'::uuid, 'applied op is recorded for the caller''s shop');
select lives_ok($$ select public.shopai_adjust_stock('prod-a', -100, 'op-3') $$, 'oversized negative delta does not fail');
select is((select stock_quantity from public.products where id = 'prod-a'), 0::numeric, 'stock clamps at 0');
select lives_ok($$ select public.shopai_adjust_stock('prod-b', -3, 'op-4') $$, 'delta on another shop product is a silent no-op');

select lives_ok($$ select public.shopai_adjust_udhar('cust-a', 50.25, 'op-5') $$, 'owner adjusts own udhar');
select is((select udhar_balance from public.customers where id = 'cust-a'), 150.25::numeric, 'udhar changed by the delta');
select lives_ok($$ select public.shopai_adjust_udhar('cust-a', 50.25, 'op-5') $$, 'replaying the same udhar op_id does not fail');
select is((select udhar_balance from public.customers where id = 'cust-a'), 150.25::numeric, 'same udhar op_id is applied only once');
select lives_ok($$ select public.shopai_adjust_udhar('cust-a', -1000, 'op-6') $$, 'oversized udhar payment does not fail');
select is((select udhar_balance from public.customers where id = 'cust-a'), 0::numeric, 'udhar clamps at 0');
select lives_ok($$ select public.shopai_adjust_udhar('cust-b', 50, 'op-7') $$, 'delta on another shop customer is a silent no-op');

-- Chukta token for the same shop: the applied_deltas policy (jwt_app() = 'shopai') rejects
-- the op record, so the call fails and nothing changes.
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'chukta',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);
select throws_ok($$ select public.shopai_adjust_stock('prod-a', 5, 'op-8') $$, '42501', null,
  'chukta token cannot apply a shopai delta');

reset role;
select is(
  (select array[pa.stock_quantity, pb.stock_quantity, cb.udhar_balance]
     from public.products pa, public.products pb, public.customers cb
    where pa.id = 'prod-a' and pb.id = 'prod-b' and cb.id = 'cust-b'),
  array[0, 10, 100]::numeric[], 'chukta call left shopai stock at 0; other shop rows unchanged (RLS)');

set local role anon;
select throws_ok($$ select public.shopai_adjust_stock('prod-a', 1, 'op-9') $$, '42501', null, 'anon call is rejected');

select * from finish();
rollback;
