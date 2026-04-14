-- RLS Policies for Pragati Bandhu
--
-- Supabase Phone Auth stores the user's phone in E.164 format (+919876543210).
-- Our schema uses 10-digit numbers as shop_id (e.g. 9876543210).
-- We strip +91 using right(auth.jwt() ->> 'phone', 10) in every policy.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- Or: supabase db push

-- ── shops ─────────────────────────────────────────────────────────────────────
-- id = 10-digit phone (primary key)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON shops
  FOR ALL
  USING (id = right(auth.jwt() ->> 'phone', 10));

-- ── products ──────────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON products
  FOR ALL
  USING (shop_id = right(auth.jwt() ->> 'phone', 10));

-- ── categories ────────────────────────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON categories
  FOR ALL
  USING (shop_id = right(auth.jwt() ->> 'phone', 10));

-- ── brands ────────────────────────────────────────────────────────────────────
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON brands
  FOR ALL
  USING (shop_id = right(auth.jwt() ->> 'phone', 10));

-- ── customers ─────────────────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON customers
  FOR ALL
  USING (shop_id = right(auth.jwt() ->> 'phone', 10));

-- ── bills ─────────────────────────────────────────────────────────────────────
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON bills
  FOR ALL
  USING (shop_id = right(auth.jwt() ->> 'phone', 10));

-- ── sales_log ─────────────────────────────────────────────────────────────────
ALTER TABLE sales_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON sales_log
  FOR ALL
  USING (shop_id = right(auth.jwt() ->> 'phone', 10));

-- ── bill_items ────────────────────────────────────────────────────────────────
-- No shop_id column — access is derived through the parent bills row.
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON bill_items
  FOR ALL
  USING (
    bill_id IN (
      SELECT id FROM bills
      WHERE shop_id = right(auth.jwt() ->> 'phone', 10)
    )
  );
