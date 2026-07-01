-- Migration: Add purchase_price column to bill_items to record historical cost at time of sale
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS purchase_price NUMERIC DEFAULT 0;
