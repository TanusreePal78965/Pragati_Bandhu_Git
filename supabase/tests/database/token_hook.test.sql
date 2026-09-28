-- supabase/tests/database/token_hook.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

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

select public.revoke_user_sessions('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.app_sessions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          0, 'revoke_user_sessions clears app_sessions');

select * from finish();
rollback;
