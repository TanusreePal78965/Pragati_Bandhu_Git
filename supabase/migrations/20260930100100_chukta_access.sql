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
grant select, insert on chukta.properties, chukta.workers to authenticated;
grant update (name, address, is_active, default_pay_basis, default_attendance_mode, shift_hours, weekly_off, monthly_divisor)
  on chukta.properties to authenticated;
grant update (name, phone, pay_basis, rate_paise, joining_date, status, left_date, attendance_mode, shift_hours,
  weekly_off_override, weekly_off, monthly_divisor) on chukta.workers to authenticated;
grant select, insert on chukta.attendance_entries, chukta.advance_entries, chukta.wage_payments to authenticated;
grant select (id, property_id, name, auth_user_id, is_active, created_at, server_updated_at) on chukta.staff_users to authenticated;
grant all on all tables in schema chukta to service_role;
grant execute on function chukta.jwt_role(), chukta.is_owner_of(uuid), chukta.is_staff_of(uuid),
  chukta.is_member_of(uuid), chukta.is_own_write(uuid, text) to authenticated;
alter default privileges for role postgres in schema chukta revoke all on tables from anon;
alter default privileges for role postgres in schema chukta revoke execute on functions from public;

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

-- 5. Per-shop staff PIN throttle (atomic reservation BEFORE PIN verification).
create table chukta.shop_pin_throttle (
  shop_id      uuid primary key references public.shops(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts     int not null default 0,
  lockouts     int not null default 0,
  locked_until timestamptz
);
alter table chukta.shop_pin_throttle enable row level security;
revoke all on chukta.shop_pin_throttle from anon, authenticated;
grant all on chukta.shop_pin_throttle to service_role;

-- Returns 'ok' (attempt reserved) or 'locked'. 10 attempts per 15-minute window per shop;
-- the 11th locks the shop's staff login for 15 min × 2^(lockouts−1), capped at 2^6 (16 h).
create or replace function chukta.reserve_pin_attempt(p_shop_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r chukta.shop_pin_throttle;
begin
  insert into chukta.shop_pin_throttle (shop_id) values (p_shop_id) on conflict (shop_id) do nothing;
  select * into r from chukta.shop_pin_throttle where shop_id = p_shop_id for update;
  if r.locked_until is not null and r.locked_until > now() then
    return 'locked';
  end if;
  if r.window_start < now() - interval '15 minutes' then
    r.window_start := now();
    r.attempts := 0;
  end if;
  r.attempts := r.attempts + 1;
  if r.attempts > 10 then
    r.lockouts := r.lockouts + 1;
    r.locked_until := now() + interval '15 minutes' * power(2, least(r.lockouts - 1, 6));
    r.attempts := 0;
    r.window_start := now();
  end if;
  update chukta.shop_pin_throttle
     set window_start = r.window_start, attempts = r.attempts, lockouts = r.lockouts, locked_until = r.locked_until
   where shop_id = p_shop_id;
  return case when r.locked_until is not null and r.locked_until > now() then 'locked' else 'ok' end;
end $$;

create or replace function chukta.clear_pin_attempts(p_shop_id uuid) returns void
language sql security definer set search_path = '' as $$
  update chukta.shop_pin_throttle
     set attempts = 0, lockouts = 0, locked_until = null, window_start = now()
   where shop_id = p_shop_id;
$$;

revoke execute on function chukta.reserve_pin_attempt(uuid), chukta.clear_pin_attempts(uuid) from public, anon, authenticated;
grant execute on function chukta.reserve_pin_attempt(uuid), chukta.clear_pin_attempts(uuid) to service_role;

-- 6. Pull-sync cursor indexes.
create index if not exists idx_chukta_properties_sync on chukta.properties(server_updated_at, id);
create index if not exists idx_chukta_staff_sync on chukta.staff_users(server_updated_at, id);
create index if not exists idx_chukta_workers_sync on chukta.workers(server_updated_at, id);
create index if not exists idx_chukta_attendance_sync on chukta.attendance_entries(server_updated_at, id);
create index if not exists idx_chukta_advance_sync on chukta.advance_entries(server_updated_at, id);
create index if not exists idx_chukta_payments_sync on chukta.wage_payments(server_updated_at, id);
