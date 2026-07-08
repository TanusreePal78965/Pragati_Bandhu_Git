-- Migration: Migrate shop_id from phone number (TEXT) to User UUID (UUID)
-- Support Google login and phone number changes.

SET session_replication_role = 'replica';

-- 1. Ensure all shops have a user in auth.users
-- If a shop phone has no corresponding auth user in dev, we insert a dummy user to prevent FK failure.
INSERT INTO auth.users (id, phone, email, raw_user_meta_data, created_at, updated_at, role, aud, instance_id)
SELECT 
  gen_random_uuid(), 
  CASE WHEN s.phone LIKE '+%' THEN s.phone ELSE '+91' || s.phone END, 
  s.phone || '@example.com', 
  jsonb_build_object('phone_number', s.phone),
  now(), 
  now(), 
  'authenticated', 
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
FROM public.shops s
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u 
  WHERE right(u.phone, 10) = right(s.phone, 10)
);

-- 1b. Drop existing RLS policies that reference the phone-keyed columns —
-- otherwise the DROP COLUMN statements below fail with "other objects depend
-- on it" (policies are recreated on the new UUID columns in section 6).
DROP POLICY IF EXISTS "owner_access" ON public.shops;
DROP POLICY IF EXISTS "owner_access" ON public.categories;
DROP POLICY IF EXISTS "owner_access" ON public.brands;
DROP POLICY IF EXISTS "owner_access" ON public.products;
DROP POLICY IF EXISTS "owner_access" ON public.customers;
DROP POLICY IF EXISTS "owner_access" ON public.bills;
DROP POLICY IF EXISTS "owner_access" ON public.sales_log;
DROP POLICY IF EXISTS "owner_access" ON public.purchase_log;
DROP POLICY IF EXISTS "owner_access" ON public.bill_items;
DROP POLICY IF EXISTS "owner_insert" ON public.login_events;
DROP POLICY IF EXISTS "owner_read" ON public.login_events;

-- 2. Add temporary new_id column to shops referencing auth.users(id)
ALTER TABLE public.shops ADD COLUMN new_id UUID REFERENCES auth.users(id);

-- Update new_id matching by phone number
UPDATE public.shops s
SET new_id = u.id
FROM auth.users u
WHERE right(u.phone, 10) = right(s.phone, 10);

-- 3. Migrate referencing tables
-- We will do this for categories, brands, products, customers, bills, sales_log, purchase_log

-- Categories
ALTER TABLE public.categories ADD COLUMN shop_uuid UUID;
UPDATE public.categories c SET shop_uuid = s.new_id FROM public.shops s WHERE c.shop_id = s.id;
ALTER TABLE public.categories DROP COLUMN shop_id;
ALTER TABLE public.categories RENAME COLUMN shop_uuid TO shop_id;
ALTER TABLE public.categories ALTER COLUMN shop_id SET NOT NULL;

-- Brands
ALTER TABLE public.brands ADD COLUMN shop_uuid UUID;
UPDATE public.brands b SET shop_uuid = s.new_id FROM public.shops s WHERE b.shop_id = s.id;
ALTER TABLE public.brands DROP COLUMN shop_id;
ALTER TABLE public.brands RENAME COLUMN shop_uuid TO shop_id;
ALTER TABLE public.brands ALTER COLUMN shop_id SET NOT NULL;

-- Products
ALTER TABLE public.products ADD COLUMN shop_uuid UUID;
UPDATE public.products p SET shop_uuid = s.new_id FROM public.shops s WHERE p.shop_id = s.id;
ALTER TABLE public.products DROP COLUMN shop_id;
ALTER TABLE public.products RENAME COLUMN shop_uuid TO shop_id;
ALTER TABLE public.products ALTER COLUMN shop_id SET NOT NULL;

-- Customers
ALTER TABLE public.customers ADD COLUMN shop_uuid UUID;
UPDATE public.customers c SET shop_uuid = s.new_id FROM public.shops s WHERE c.shop_id = s.id;
ALTER TABLE public.customers DROP COLUMN shop_id;
ALTER TABLE public.customers RENAME COLUMN shop_uuid TO shop_id;
ALTER TABLE public.customers ALTER COLUMN shop_id SET NOT NULL;

-- Bills
ALTER TABLE public.bills ADD COLUMN shop_uuid UUID;
UPDATE public.bills b SET shop_uuid = s.new_id FROM public.shops s WHERE b.shop_id = s.id;
ALTER TABLE public.bills DROP COLUMN shop_id;
ALTER TABLE public.bills RENAME COLUMN shop_uuid TO shop_id;
ALTER TABLE public.bills ALTER COLUMN shop_id SET NOT NULL;

-- Sales Log
ALTER TABLE public.sales_log ADD COLUMN shop_uuid UUID;
UPDATE public.sales_log sl SET shop_uuid = s.new_id FROM public.shops s WHERE sl.shop_id = s.id;
ALTER TABLE public.sales_log DROP COLUMN shop_id;
ALTER TABLE public.sales_log RENAME COLUMN shop_uuid TO shop_id;
ALTER TABLE public.sales_log ALTER COLUMN shop_id SET NOT NULL;

-- Purchase Log
ALTER TABLE public.purchase_log ADD COLUMN shop_uuid UUID;
UPDATE public.purchase_log pl SET shop_uuid = s.new_id FROM public.shops s WHERE pl.shop_id = s.id;
ALTER TABLE public.purchase_log DROP COLUMN shop_id;
ALTER TABLE public.purchase_log RENAME COLUMN shop_uuid TO shop_id;
ALTER TABLE public.purchase_log ALTER COLUMN shop_id SET NOT NULL;

-- Login Events (conditional, if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'login_events') THEN
    ALTER TABLE public.login_events ADD COLUMN shop_uuid UUID;
    UPDATE public.login_events le SET shop_uuid = s.new_id FROM public.shops s WHERE le.shop_id = s.id;
    -- Drop rows that don't match any current shop (stale/legacy log entries) —
    -- this is an activity-log table, not core business data, and shop_id is
    -- about to become NOT NULL.
    DELETE FROM public.login_events WHERE shop_uuid IS NULL;
    ALTER TABLE public.login_events DROP COLUMN shop_id;
    ALTER TABLE public.login_events RENAME COLUMN shop_uuid TO shop_id;
    ALTER TABLE public.login_events ALTER COLUMN shop_id SET NOT NULL;
  END IF;
END $$;

-- 4. Update shops table primary key
ALTER TABLE public.shops DROP CONSTRAINT shops_pkey CASCADE;
ALTER TABLE public.shops DROP COLUMN id;
ALTER TABLE public.shops RENAME COLUMN new_id TO id;
ALTER TABLE public.shops ADD CONSTRAINT shops_pkey PRIMARY KEY (id);

-- 5. Restore Foreign Key constraints referencing new shops(id)
ALTER TABLE public.categories ADD CONSTRAINT categories_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.brands ADD CONSTRAINT brands_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD CONSTRAINT products_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD CONSTRAINT customers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD CONSTRAINT bills_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.sales_log ADD CONSTRAINT sales_log_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_log ADD CONSTRAINT purchase_log_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'login_events') THEN
    ALTER TABLE public.login_events ADD CONSTRAINT login_events_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Recreate RLS Policies to use auth.uid()
DROP POLICY IF EXISTS "owner_access" ON public.shops;
CREATE POLICY "owner_access" ON public.shops FOR ALL USING (id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.products;
CREATE POLICY "owner_access" ON public.products FOR ALL USING (shop_id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.categories;
CREATE POLICY "owner_access" ON public.categories FOR ALL USING (shop_id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.brands;
CREATE POLICY "owner_access" ON public.brands FOR ALL USING (shop_id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.customers;
CREATE POLICY "owner_access" ON public.customers FOR ALL USING (shop_id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.bills;
CREATE POLICY "owner_access" ON public.bills FOR ALL USING (shop_id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.sales_log;
CREATE POLICY "owner_access" ON public.sales_log FOR ALL USING (shop_id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.purchase_log;
CREATE POLICY "owner_access" ON public.purchase_log FOR ALL USING (shop_id = auth.uid());

DROP POLICY IF EXISTS "owner_access" ON public.bill_items;
CREATE POLICY "owner_access" ON public.bill_items FOR ALL USING (
  bill_id IN (
    SELECT id FROM public.bills WHERE shop_id = auth.uid()
  )
);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'login_events') THEN
    CREATE POLICY "owner_insert" ON public.login_events FOR INSERT WITH CHECK (shop_id = auth.uid());
    CREATE POLICY "owner_read" ON public.login_events FOR SELECT USING (shop_id = auth.uid());
  END IF;
END $$;

SET session_replication_role = 'origin';
