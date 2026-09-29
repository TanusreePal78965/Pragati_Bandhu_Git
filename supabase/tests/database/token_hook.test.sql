-- supabase/tests/database/token_hook.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'hook-test@accounts.pragatibandhu.internal');
insert into public.shops (id, shop_name, owner_name, phone, auth_user_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Hook Shop', 'Owner', '+919800000002', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.app_sessions (session_id, user_id, app)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'chukta');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'cccccccc-0000-0000-0000-000000000001', 'role', 'authenticated')
  )) -> 'claims' ->> 'app',
  'chukta', 'hook adds app claim from app_sessions');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'cccccccc-0000-0000-0000-000000000001', 'role', 'authenticated')
  )) -> 'claims' ->> 'shop_id',
  'bbbbbbbb-0000-0000-0000-000000000001', 'hook adds shop_id claim');

select ok(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'dddddddd-0000-0000-0000-000000000009', 'role', 'authenticated')
  )) -> 'claims' ->> 'app') is null,
  'unknown session gets no app claim');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'cccccccc-0000-0000-0000-000000000001', 'role', 'authenticated')
  )) -> 'claims' ->> 'role',
  'authenticated', 'existing claims preserved');

insert into auth.sessions (id, user_id) values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
select public.revoke_user_sessions('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.app_sessions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          0, 'revoke_user_sessions clears app_sessions');
select is((select count(*)::int from auth.sessions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'revoke_user_sessions deletes auth.sessions');

select table_privs_are('public', 'app_sessions', 'supabase_auth_admin', array['SELECT'], 'auth admin can only SELECT app_sessions');
select column_privs_are('public', 'shops', 'auth_user_id', 'supabase_auth_admin', array['SELECT'], 'auth admin can read shops.auth_user_id');
select column_privs_are('public', 'shops', 'id', 'supabase_auth_admin', array['SELECT'], 'auth admin can read shops.id');
select function_privs_are('public', 'custom_access_token_hook', array['jsonb'], 'supabase_auth_admin', array['EXECUTE'], 'auth admin can execute hook');
select function_privs_are('public', 'custom_access_token_hook', array['jsonb'], 'anon', array[]::text[], 'anon cannot execute hook');
select function_privs_are('public', 'custom_access_token_hook', array['jsonb'], 'authenticated', array[]::text[], 'authenticated cannot execute hook');
select function_privs_are('public', 'revoke_user_sessions', array['uuid'], 'anon', array[]::text[], 'anon cannot revoke sessions');
select function_privs_are('public', 'revoke_user_sessions', array['uuid'], 'authenticated', array[]::text[], 'authenticated cannot revoke sessions');
select function_privs_are('public', 'revoke_user_sessions', array['uuid'], 'service_role', array['EXECUTE'], 'service_role can revoke sessions');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_sessions' and policyname = 'auth admin reads app_sessions' and 'supabase_auth_admin'::name = any(roles)), 'hook policy on app_sessions exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shops' and policyname = 'auth admin reads shops' and 'supabase_auth_admin'::name = any(roles)), 'hook policy on shops exists');

select * from finish();
rollback;
