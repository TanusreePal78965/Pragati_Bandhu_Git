-- Add pack size & purchase UOM columns to products and bill_items to match SQLite schema
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_uom TEXT DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS units_per_pack INTEGER DEFAULT NULL;

ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS display_qty TEXT DEFAULT NULL;
