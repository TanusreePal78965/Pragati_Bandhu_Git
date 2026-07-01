-- Migration: Convert quantity columns from INTEGER to NUMERIC to support decimal sales quantities (like 1.4 kg)
ALTER TABLE public.bill_items ALTER COLUMN qty TYPE NUMERIC;
ALTER TABLE public.sales_log ALTER COLUMN qty_sold TYPE NUMERIC;
ALTER TABLE public.bills ALTER COLUMN total_items TYPE NUMERIC;
