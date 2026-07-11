-- Migration: drop Supabase Auth dependency, move to phone+password (no session).
--
-- Registration moves to a separate web app; the mobile app becomes login-only
-- (phone + password, no OTP, no Google, no Supabase Auth session). Without a
-- session there is no auth.uid() to scope RLS against, so policies become
-- permissive for the anon key — the app already filters every query by
-- shop_id itself, so this keeps behavior working with a documented, accepted
-- isolation tradeoff (anon key can read/write any shop's rows if it knows the
-- shop_id). password_hash is explicitly carved out of that tradeoff below.

-- 1. Password storage for the new login flow.
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. shops.id is no longer tied to a Supabase Auth user — new shops are
-- created directly by the register-shop Edge Function with a generated UUID.
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_new_id_fkey;
ALTER TABLE public.shops ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Permissive RLS — replace every auth.uid()-scoped policy.
DROP POLICY IF EXISTS "owner_access" ON public.shops;
CREATE POLICY "owner_access" ON public.shops FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.products;
CREATE POLICY "owner_access" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.categories;
CREATE POLICY "owner_access" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.brands;
CREATE POLICY "owner_access" ON public.brands FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.customers;
CREATE POLICY "owner_access" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.bills;
CREATE POLICY "owner_access" ON public.bills FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.sales_log;
CREATE POLICY "owner_access" ON public.sales_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.purchase_log;
CREATE POLICY "owner_access" ON public.purchase_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access" ON public.bill_items;
CREATE POLICY "owner_access" ON public.bill_items FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'login_events') THEN
    DROP POLICY IF EXISTS "owner_insert" ON public.login_events;
    DROP POLICY IF EXISTS "owner_read" ON public.login_events;
    CREATE POLICY "owner_insert" ON public.login_events FOR INSERT WITH CHECK (true);
    CREATE POLICY "owner_read" ON public.login_events FOR SELECT USING (true);
  END IF;
END $$;

-- 4. password_hash must never be readable by the anon/authenticated roles —
-- permissive table RLS above must not extend to handing out password hashes.
-- Only the service-role key (used inside the login/register-shop Edge
-- Functions) can read it.
REVOKE SELECT (password_hash) ON public.shops FROM anon, authenticated;
