-- supabase/migrations/20260928100200_shopai_rls_lockdown.sql
-- Replace the permissive policies from 20260708090742 with app + shop scoped policies (spec §4.8).

-- 1. Every public table carrying shop_id (includes tables created outside migrations).
do $$
declare
  r record;
  p record;
  shop_expr text;
begin
  for r in
    select c.table_name, c.data_type
      from information_schema.columns c
      join information_schema.tables t using (table_schema, table_name)
     where c.table_schema = 'public' and c.column_name = 'shop_id' and t.table_type = 'BASE TABLE'
       and c.table_name not in ('app_subscriptions', 'payments')
  loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = r.table_name loop
      execute format('drop policy %I on public.%I', p.policyname, r.table_name);
    end loop;

    shop_expr := case when r.data_type = 'uuid' then 'public.jwt_shop_id()' else 'public.jwt_shop_id()::text' end;

    execute format('alter table public.%I enable row level security', r.table_name);
    execute format(
      'create policy shopai_owner_access on public.%I for all to authenticated
         using (public.jwt_app() = %L and shop_id = %s)
         with check (public.jwt_app() = %L and shop_id = %s)',
      r.table_name, 'shopai', shop_expr, 'shopai', shop_expr);
    execute format('revoke all on public.%I from anon', r.table_name);
  end loop;
end $$;

-- 2. bill_items has no shop_id — scope through its bill.
drop policy if exists "owner_access" on public.bill_items;
create policy shopai_owner_access on public.bill_items for all to authenticated
  using (public.jwt_app() = 'shopai' and exists (
    select 1 from public.bills b where b.id = bill_items.bill_id and b.shop_id = public.jwt_shop_id()))
  with check (public.jwt_app() = 'shopai' and exists (
    select 1 from public.bills b where b.id = bill_items.bill_id and b.shop_id = public.jwt_shop_id()));
revoke all on public.bill_items from anon;

-- 3. shops: owner sees own row (either app); narrow column grants.
drop policy if exists "owner_access" on public.shops;
create policy owner_reads_own_shop on public.shops for select to authenticated
  using (id = public.jwt_shop_id());
create policy owner_updates_own_shop on public.shops for update to authenticated
  using (id = public.jwt_shop_id()) with check (id = public.jwt_shop_id());

revoke all on public.shops from anon, authenticated;
grant select (
  id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent,
  is_active, active_device_id, created_at, last_synced_at, allow_out_of_stock_billing
) on public.shops to authenticated;
grant update (
  shop_name, owner_name, whatsapp_number, business_category, ai_consent,
  active_device_id, last_synced_at, allow_out_of_stock_billing
) on public.shops to authenticated;

-- 4. payments: owners read their own; writes only via the payments function (service role).
drop policy if exists "owner_insert_payment" on public.payments;
drop policy if exists "owner_read_payment" on public.payments;
drop policy if exists "admin_read_all" on public.payments;
drop policy if exists "admin_update_all" on public.payments;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy owner_reads_own_payments on public.payments for select to authenticated
  using (shop_id = public.jwt_shop_id());

-- 5. app_settings: public read (version check runs before login); writes via admin function only.
drop policy if exists "Admin write app_settings" on public.app_settings;
revoke insert, update, delete, truncate on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;
