-- Migration: Create purchase_log table for tracking restocking history
-- Note: product_id is stored as plain TEXT to prevent sync deadlocks (out-of-order syncing in offline-first apps)
CREATE TABLE IF NOT EXISTS public.purchase_log (
  id TEXT PRIMARY KEY NOT NULL,
  shop_id TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty REAL NOT NULL,
  purchase_price REAL NOT NULL,
  selling_price REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.purchase_log ENABLE ROW LEVEL SECURITY;

-- Owner Access Policy matching other log tables
CREATE POLICY "owner_access" ON public.purchase_log
  FOR ALL
  USING (shop_id = right(auth.jwt() ->> 'phone', 10));
