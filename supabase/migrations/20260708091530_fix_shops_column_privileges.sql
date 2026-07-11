-- Fix: the previous migration's `REVOKE SELECT (password_hash) ... FROM anon,
-- authenticated` was a no-op. anon/authenticated hold table-level SELECT/UPDATE
-- grants on shops (Supabase's default schema exposure) and a column-level
-- REVOKE cannot narrow a broader table-level GRANT — pg_attribute.attacl was
-- NULL, confirming there was never a column-level grant to revoke in the
-- first place. Fix by replacing the table-level SELECT/UPDATE grants with
-- explicit column allowlists that omit password_hash.
REVOKE SELECT, UPDATE ON public.shops FROM anon, authenticated;

GRANT SELECT (
  id, shop_name, owner_name, phone, whatsapp_number, business_category,
  ai_consent, is_active, active_device_id, created_at, last_synced_at
) ON public.shops TO anon, authenticated;

GRANT UPDATE (
  id, shop_name, owner_name, phone, whatsapp_number, business_category,
  ai_consent, is_active, active_device_id, created_at, last_synced_at
) ON public.shops TO anon, authenticated;

-- Registration now goes exclusively through the register-shop Edge Function
-- (service-role, verifies the phone via Firebase first). Permissive RLS
-- (`WITH CHECK (true)`) plus a client-facing INSERT grant would otherwise let
-- anyone with the (public, bundled-in-app) anon key fabricate a shop row for
-- a phone number they don't control, bypassing verification entirely.
REVOKE INSERT ON public.shops FROM anon, authenticated;
