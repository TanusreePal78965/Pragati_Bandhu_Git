-- Base Schema for Pragati Bandhu
-- Creates initial base tables before RLS policies (001) are applied.

CREATE TABLE IF NOT EXISTS public.shops (
  id TEXT PRIMARY KEY,
  shop_name TEXT,
  owner_name TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  business_category TEXT,
  ai_consent BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  active_device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'grid-outline',
  icon_color TEXT DEFAULT '#1a57db'
);

CREATE TABLE IF NOT EXISTS public.brands (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#1a57db'
);

CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  name TEXT NOT NULL,
  category_id TEXT,
  brand_id TEXT,
  purchase_price NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  stock_quantity NUMERIC DEFAULT 0,
  min_stock_threshold NUMERIC DEFAULT 5,
  uom TEXT DEFAULT 'Pcs',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  udhar_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bills (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  customer_id TEXT,
  customer_name TEXT,
  payment_mode TEXT DEFAULT 'cash',
  total_amount NUMERIC DEFAULT 0,
  total_items NUMERIC DEFAULT 0,
  bill_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bill_items (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  line_total NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.sales_log (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty_sold NUMERIC DEFAULT 0,
  sale_amount NUMERIC DEFAULT 0,
  sold_date DATE DEFAULT CURRENT_DATE
);
