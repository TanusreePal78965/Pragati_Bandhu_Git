-- Migration: Add discount_percent, discount_amount, and discount_type to public.bills table
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'none';
