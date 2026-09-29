-- supabase/migrations/20260930100100_chukta_access.sql
-- Chukta Phase 1 access control (spec §5).

-- 1. Claim helpers.
create or replace function chukta.jwt_role() returns text
language sql stable set search_path = '' as $$ select coalesce(auth.jwt() ->> 'app_role', 'owner') $$;

create or replace function chukta.is_owner_of(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner'
     and exists (select 1 from chukta.properties p where p.id = pid and p.shop_id = public.jwt_shop_id())
$$;

create or replace function chukta.is_staff_of(pid uuid) returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_app() = 'chukta' and chukta.jwt_role() = 'staff'
     and (auth.jwt() ->> 'property_id') = pid::text
$$;

create or replace function chukta.is_member_of(pid uuid) returns boolean
language sql stable set search_path = '' as $$ select chukta.is_owner_of(pid) or chukta.is_staff_of(pid) $$;

create or replace function chukta.is_own_write(p_created_by uuid, p_role text) returns boolean
language sql stable set search_path = '' as $$ select p_created_by = auth.uid() and p_role = chukta.jwt_role() $$;

-- 2. Grants.
revoke all on schema chukta from anon;
revoke all on all tables in schema chukta from anon, authenticated;
grant usage on schema chukta to authenticated, service_role, supabase_auth_admin;
grant select, insert, update on chukta.properties, chukta.workers to authenticated;
grant select, insert on chukta.attendance_entries, chukta.advance_entries, chukta.wage_payments to authenticated;
grant select (id, property_id, name, auth_user_id, is_active, created_at, server_updated_at) on chukta.staff_users to authenticated;
grant all on all tables in schema chukta to service_role;
grant execute on function chukta.jwt_role(), chukta.is_owner_of(uuid), chukta.is_staff_of(uuid),
  chukta.is_member_of(uuid), chukta.is_own_write(uuid, text) to authenticated;
alter default privileges for role postgres in schema chukta revoke all on tables from anon;

-- 3. RLS.
alter table chukta.properties enable row level security;
alter table chukta.staff_users enable row level security;
alter table chukta.workers enable row level security;
alter table chukta.attendance_entries enable row level security;
alter table chukta.advance_entries enable row level security;
alter table chukta.wage_payments enable row level security;

create policy owner_select on chukta.properties for select to authenticated
  using (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id());
create policy owner_insert on chukta.properties for insert to authenticated
  with check (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id());
create policy owner_update on chukta.properties for update to authenticated
  using (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id())
  with check (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id());
create policy staff_select on chukta.properties for select to authenticated using (chukta.is_staff_of(id));

create policy owner_select on chukta.staff_users for select to authenticated using (chukta.is_owner_of(property_id));
create policy staff_select_self on chukta.staff_users for select to authenticated
  using (public.jwt_app() = 'chukta' and auth_user_id = auth.uid());

create policy member_select on chukta.workers for select to authenticated using (chukta.is_member_of(property_id));
create policy member_insert on chukta.workers for insert to authenticated
  with check (chukta.is_member_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy member_update on chukta.workers for update to authenticated
  using (chukta.is_member_of(property_id)) with check (chukta.is_member_of(property_id));

create policy member_select on chukta.attendance_entries for select to authenticated using (chukta.is_member_of(property_id));
create policy member_insert on chukta.attendance_entries for insert to authenticated
  with check (chukta.is_member_of(property_id) and chukta.is_own_write(created_by, created_by_role));

create policy member_select on chukta.advance_entries for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.advance_entries for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy staff_insert on chukta.advance_entries for insert to authenticated
  with check (chukta.is_staff_of(property_id) and voids_id is null and chukta.is_own_write(created_by, created_by_role));

create policy member_select on chukta.wage_payments for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.wage_payments for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy staff_insert on chukta.wage_payments for insert to authenticated
  with check (chukta.is_staff_of(property_id) and voids_id is null and chukta.is_own_write(created_by, created_by_role));

-- 4. Hook: add staff claims (keeps Phase 0 behaviour for app + shop_id).
grant select (auth_user_id, property_id, is_active) on chukta.staff_users to supabase_auth_admin;
create policy auth_admin_reads_staff on chukta.staff_users for select to supabase_auth_admin using (true);

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := event -> 'claims';
  v_app  text;
  v_shop uuid;
  v_staff_property uuid;
begin
  select s.app into v_app
    from public.app_sessions s
   where s.session_id = nullif(claims ->> 'session_id', '')::uuid;

  select sh.id into v_shop
    from public.shops sh
   where sh.auth_user_id = (event ->> 'user_id')::uuid;

  select su.property_id into v_staff_property
    from chukta.staff_users su
   where su.auth_user_id = (event ->> 'user_id')::uuid and su.is_active;

  if v_app is not null then
    claims := jsonb_set(claims, '{app}', to_jsonb(v_app));
  end if;
  if v_shop is not null then
    claims := jsonb_set(claims, '{shop_id}', to_jsonb(v_shop::text));
  end if;
  if v_staff_property is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb('staff'::text));
    claims := jsonb_set(claims, '{property_id}', to_jsonb(v_staff_property::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

-- 5. Atomic PIN failure counter (service role only).
create or replace function chukta.record_pin_failure(p_staff_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update chukta.staff_users
     set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
         locked_until    = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
   where id = any(p_staff_ids);
$$;
revoke execute on function chukta.record_pin_failure(uuid[]) from public, anon, authenticated;
grant execute on function chukta.record_pin_failure(uuid[]) to service_role;
