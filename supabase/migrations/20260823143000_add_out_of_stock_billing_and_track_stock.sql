-- Migration: Add allow_out_of_stock_billing to shops and track_stock to products
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS allow_out_of_stock_billing BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_stock INTEGER DEFAULT 1;

-- Grant column privileges for allow_out_of_stock_billing on public.shops
GRANT SELECT (allow_out_of_stock_billing), UPDATE (allow_out_of_stock_billing) ON public.shops TO anon, authenticated;

-- Grant permissions for track_stock on public.products
GRANT SELECT (track_stock), INSERT (track_stock), UPDATE (track_stock) ON public.products TO anon, authenticated;
