-- 1. Add subscription fields and superadmin flag to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- 2. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    merchant_transaction_id VARCHAR(12) NOT NULL UNIQUE,
    amount NUMERIC NOT NULL,
    plan_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, success, failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for payments
-- Note: auth.uid() returns uuid in Supabase normally, but some older policies in this project used phone numbers.
-- We use auth.uid() for UUID since shops(id) is UUID based on migration 20260701115044_migrate_to_uuid.sql.
CREATE POLICY "owner_insert_payment" ON public.payments
  FOR INSERT WITH CHECK (shop_id = auth.uid());

CREATE POLICY "owner_read_payment" ON public.payments
  FOR SELECT USING (shop_id = auth.uid());

-- Admins can read all payments
CREATE POLICY "admin_read_all" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shops s 
      WHERE s.id = auth.uid() AND s.is_superadmin = true
    )
  );

-- Admins can update all payments
CREATE POLICY "admin_update_all" ON public.payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shops s 
      WHERE s.id = auth.uid() AND s.is_superadmin = true
    )
  );
