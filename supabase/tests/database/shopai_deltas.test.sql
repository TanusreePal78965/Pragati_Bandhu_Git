-- supabase/tests/database/shopai_deltas.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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
select is(has_function_privilege('anon', 'public.shopai_adjust_stock(text, numeric)', 'execute'), false,
  'anon cannot execute shopai_adjust_stock');
select is(has_function_privilege('anon', 'public.shopai_adjust_udhar(text, numeric)', 'execute'), false,
  'anon cannot execute shopai_adjust_udhar');
select is(has_function_privilege('authenticated', 'public.shopai_adjust_stock(text, numeric)', 'execute'), true,
  'authenticated can execute shopai_adjust_stock');

-- ShopAI token for shop A.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'shopai',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);

select lives_ok($$ select public.shopai_adjust_stock('prod-a', -3) $$, 'owner adjusts own stock');
select is((select stock_quantity from public.products where id = 'prod-a'), 7::numeric, 'stock changed by the delta');
select is((select updated_at > '2000-01-01T00:00:00Z'::timestamptz from public.products where id = 'prod-a'), true,
  'stock delta bumps updated_at');
select lives_ok($$ select public.shopai_adjust_stock('prod-a', -100) $$, 'oversized negative delta does not fail');
select is((select stock_quantity from public.products where id = 'prod-a'), 0::numeric, 'stock clamps at 0');
select lives_ok($$ select public.shopai_adjust_stock('prod-b', -3) $$, 'delta on another shop product is a silent no-op');

select lives_ok($$ select public.shopai_adjust_udhar('cust-a', 50.25) $$, 'owner adjusts own udhar');
select is((select udhar_balance from public.customers where id = 'cust-a'), 150.25::numeric, 'udhar changed by the delta');
select lives_ok($$ select public.shopai_adjust_udhar('cust-a', -1000) $$, 'oversized udhar payment does not fail');
select is((select udhar_balance from public.customers where id = 'cust-a'), 0::numeric, 'udhar clamps at 0');
select lives_ok($$ select public.shopai_adjust_udhar('cust-b', 50) $$, 'delta on another shop customer is a silent no-op');

-- Chukta token for the same shop: RLS (jwt_app() = 'shopai') hides ShopAI rows.
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'chukta',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);
select lives_ok($$ select public.shopai_adjust_stock('prod-a', 5) $$, 'chukta token call is a silent no-op');

reset role;
select is((select stock_quantity from public.products where id = 'prod-a'), 0::numeric,
  'chukta token did not change shopai product stock');
select is(
  (select array[p.stock_quantity, c.udhar_balance] from public.products p, public.customers c
    where p.id = 'prod-b' and c.id = 'cust-b'),
  array[10, 100]::numeric[], 'other shop rows unchanged (RLS)');

set local role anon;
select throws_ok($$ select public.shopai_adjust_stock('prod-a', 1) $$, '42501', null, 'anon call is rejected');

select * from finish();
rollback;
