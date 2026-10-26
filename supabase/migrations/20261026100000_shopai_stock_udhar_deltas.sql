-- supabase/migrations/20261026100000_shopai_stock_udhar_deltas.sql
-- Stock and udhar sync as server-applied deltas instead of absolute last-write-wins upserts.
--
-- Column types (000_base_schema.sql, unchanged by later migrations):
--   products.id text, products.stock_quantity numeric
--   customers.id text, customers.udhar_balance numeric
--
-- SECURITY INVOKER: the caller's RLS (policy shopai_owner_access, 20260928100200) scopes the
-- UPDATE to its own app + shop, so a delta on another shop's row silently changes nothing.
-- Deploy order: apply this migration to the live project BEFORE shipping the app build that
-- queues 'DELTA' operations.

create or replace function public.shopai_adjust_stock(p_product_id text, p_delta numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.products
     set stock_quantity = greatest(0, coalesce(stock_quantity, 0) + p_delta),
         updated_at = now()
   where id = p_product_id;
end;
$$;

-- customers has no updated_at column in the cloud schema, so only the balance changes.
create or replace function public.shopai_adjust_udhar(p_customer_id text, p_delta numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.customers
     set udhar_balance = greatest(0, coalesce(udhar_balance, 0) + p_delta)
   where id = p_customer_id;
end;
$$;

revoke execute on function public.shopai_adjust_stock(text, numeric) from public, anon;
revoke execute on function public.shopai_adjust_udhar(text, numeric) from public, anon;
grant execute on function public.shopai_adjust_stock(text, numeric) to authenticated;
grant execute on function public.shopai_adjust_udhar(text, numeric) to authenticated;
