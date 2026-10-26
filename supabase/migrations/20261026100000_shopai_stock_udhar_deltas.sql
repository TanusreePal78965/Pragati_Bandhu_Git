-- supabase/migrations/20261026100000_shopai_stock_udhar_deltas.sql
-- Stock and udhar sync as server-applied deltas instead of absolute last-write-wins upserts.
--
-- Column types (000_base_schema.sql, unchanged by later migrations):
--   products.id text, products.stock_quantity numeric
--   customers.id text, customers.udhar_balance numeric
--
-- SECURITY INVOKER: the caller's RLS (policy shopai_owner_access, 20260928100200) scopes the
-- UPDATE to its own app + shop, so a delta on another shop's row silently changes nothing.
--
-- Idempotency: every queued client delta carries a unique op_id. The RPC records it in
-- shopai_applied_deltas first and adjusts only when that insert actually added a row, so a
-- retry after a lost response (commit succeeded, client saw a network error) is a no-op.
-- Retention: applied_deltas rows are never cleaned up here (tiny rows; prune later if needed).
--
-- Deploy order: apply this migration to the live project BEFORE shipping the app build that
-- queues 'DELTA' operations.

create table if not exists public.shopai_applied_deltas (
  op_id text primary key,
  shop_id uuid not null default public.jwt_shop_id(),
  applied_at timestamptz not null default now()
);

alter table public.shopai_applied_deltas enable row level security;
drop policy if exists shopai_owner_access on public.shopai_applied_deltas;
create policy shopai_owner_access on public.shopai_applied_deltas for all to authenticated
  using (public.jwt_app() = 'shopai' and shop_id = public.jwt_shop_id())
  with check (public.jwt_app() = 'shopai' and shop_id = public.jwt_shop_id());
revoke all on public.shopai_applied_deltas from public, anon, authenticated;
grant select, insert on public.shopai_applied_deltas to authenticated;

create or replace function public.shopai_adjust_stock(p_product_id text, p_delta numeric, p_op_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.shopai_applied_deltas (op_id, shop_id)
  values (p_op_id, public.jwt_shop_id())
  on conflict do nothing;
  -- FOUND is true only when the insert added a row, i.e. this op_id is new.
  if found then
    update public.products
       set stock_quantity = greatest(0, coalesce(stock_quantity, 0) + p_delta),
           updated_at = now()
     where id = p_product_id;
  end if;
end;
$$;

-- customers has no updated_at column in the cloud schema, so only the balance changes.
create or replace function public.shopai_adjust_udhar(p_customer_id text, p_delta numeric, p_op_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.shopai_applied_deltas (op_id, shop_id)
  values (p_op_id, public.jwt_shop_id())
  on conflict do nothing;
  if found then
    update public.customers
       set udhar_balance = greatest(0, coalesce(udhar_balance, 0) + p_delta)
     where id = p_customer_id;
  end if;
end;
$$;

revoke execute on function public.shopai_adjust_stock(text, numeric, text) from public, anon;
revoke execute on function public.shopai_adjust_udhar(text, numeric, text) from public, anon;
grant execute on function public.shopai_adjust_stock(text, numeric, text) to authenticated;
grant execute on function public.shopai_adjust_udhar(text, numeric, text) to authenticated;
