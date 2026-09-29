-- supabase/tests/database/account_tables.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_column('public', 'shops', 'auth_user_id', 'shops.auth_user_id exists');
select hasnt_column('public', 'shops', 'plan_expires_at', 'legacy plan_expires_at dropped');
select hasnt_column('public', 'shops', 'password_hash', 'legacy password_hash dropped');
select hasnt_column('public', 'shops', 'plan_type', 'legacy plan_type dropped');
select has_table('public', 'app_subscriptions', 'app_subscriptions exists');
select has_table('public', 'app_sessions', 'app_sessions exists');
select has_column('public', 'payments', 'app', 'payments.app exists');

insert into public.shops (id, shop_name, owner_name, phone)
values ('11111111-1111-1111-1111-111111111111', 'Test Shop', 'Owner', '+919800000001');

select throws_ok(
  $$ insert into public.app_subscriptions (shop_id, app, plan_type) values ('11111111-1111-1111-1111-111111111111', 'other', 'x') $$,
  '23514', null, 'unknown app rejected');

select lives_ok(
  $$ insert into public.app_subscriptions (shop_id, app, plan_type) values ('11111111-1111-1111-1111-111111111111', 'chukta', 'monthly') $$,
  'chukta subscription accepted');

select set_config('request.jwt.claims', '{"app":"chukta","shop_id":"11111111-1111-1111-1111-111111111111"}', true);
select is(public.jwt_app() || ':' || public.jwt_shop_id()::text,
          'chukta:11111111-1111-1111-1111-111111111111', 'jwt helpers read claims');

select * from finish();
rollback;
