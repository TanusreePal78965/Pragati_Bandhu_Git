import db from './sqlite';
import { addToSyncQueue } from './syncQueue';

// ─── ID generator ────────────────────────────────────────────────────────────
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ─── Shop ─────────────────────────────────────────────────────────────────────

export interface ShopInfo {
  id?: string;
  shopName: string;
  ownerName: string;
  category?: string;
  whatsappNumber?: string;
  phone?: string;
  aiConsent?: boolean;
  isActive?: boolean;
}

export const insertShop = (data: ShopInfo): void => {
  try {
    const id = genId();
    db.runSync(
      `INSERT OR REPLACE INTO shop
         (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.shopName,
        data.ownerName,
        data.phone ?? '',
        data.whatsappNumber ?? '',
        data.category ?? '',
        data.aiConsent ? 1 : 0,
      ]
    );
    addToSyncQueue('shop', 'INSERT', id, {
      shopName: data.shopName,
      ownerName: data.ownerName,
      category: data.category,
      whatsappNumber: data.whatsappNumber,
      aiConsent: data.aiConsent,
    });
  } catch (e) {
    console.error('insertShop error:', e);
  }
};

export const getShop = (): ShopInfo | null => {
  try {
    const row = db.getFirstSync('SELECT * FROM shop LIMIT 1') as any;
    if (!row) return null;
    return {
      id: row.id,
      shopName: row.shop_name,
      ownerName: row.owner_name,
      phone: row.phone,
      whatsappNumber: row.whatsapp_number,
      category: row.business_category,
      aiConsent: row.ai_consent === 1,
      isActive: row.is_active === 1,
    };
  } catch (e) {
    console.error('getShop error:', e);
    return null;
  }
};

export const updateShop = (data: Partial<Omit<ShopInfo, 'id' | 'isActive'>>): void => {
  try {
    const row = db.getFirstSync('SELECT id, phone FROM shop LIMIT 1') as any;
    if (!row) return;
    db.runSync(
      `UPDATE shop SET shop_name=?, owner_name=?, whatsapp_number=?, business_category=?, ai_consent=? WHERE id=?`,
      [
        data.shopName ?? '',
        data.ownerName ?? '',
        data.whatsappNumber ?? '',
        data.category ?? '',
        data.aiConsent ? 1 : 0,
        row.id,
      ]
    );
    addToSyncQueue('shop', 'UPDATE', row.id, { ...data, phone: row.phone });
  } catch (e) {
    console.error('updateShop error:', e);
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  icon_color: string;
}

export interface Brand {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_threshold: number;
  uom: string;
  updated_at: string;
  // joined fields (populated by getAllProducts)
  category_name?: string;
  brand_name?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  udhar_balance: number;
  created_at: string;
}

export interface BillItem {
  id?: string;
  bill_id?: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface Bill {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  payment_mode: 'cash' | 'udhar' | 'upi';
  total_amount: number;
  total_items: number;
  bill_date: string;
}

export interface ReportData {
  total_sales: number;
  net_profit: number;
  cash_sales: number;
  udhar_sales: number;
  upi_sales: number;
  bill_count: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  total_qty: number;
  total_amount: number;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const getAllCategories = (): Category[] => {
  try {
    return db.getAllSync('SELECT * FROM categories ORDER BY name ASC') as Category[];
  } catch (e) {
    console.error('getAllCategories error:', e);
    return [];
  }
};

export const insertCategory = (name: string, icon: string, icon_color: string): void => {
  const id = genId();
  try {
    db.runSync(
      'INSERT INTO categories (id, name, icon, icon_color) VALUES (?, ?, ?, ?)',
      [id, name, icon, icon_color]
    );
    addToSyncQueue('categories', 'INSERT', id, { id, name, icon, icon_color });
  } catch (e) {
    console.error('insertCategory error:', e);
    throw e;
  }
};

export const updateCategory = (id: string, name: string, icon: string, icon_color: string): void => {
  try {
    db.runSync(
      'UPDATE categories SET name = ?, icon = ?, icon_color = ? WHERE id = ?',
      [name, icon, icon_color, id]
    );
    addToSyncQueue('categories', 'UPDATE', id, { id, name, icon, icon_color });
  } catch (e) {
    console.error('updateCategory error:', e);
    throw e;
  }
};

export const deleteCategory = (id: string): void => {
  try {
    db.runSync('DELETE FROM categories WHERE id = ?', [id]);
    addToSyncQueue('categories', 'DELETE', id, { id });
  } catch (e) {
    console.error('deleteCategory error:', e);
    throw e;
  }
};

// ─── Brands ───────────────────────────────────────────────────────────────────

export const getAllBrands = (): Brand[] => {
  try {
    return db.getAllSync('SELECT * FROM brands ORDER BY name ASC') as Brand[];
  } catch (e) {
    console.error('getAllBrands error:', e);
    return [];
  }
};

export const insertBrand = (name: string, color: string): void => {
  const id = genId();
  try {
    db.runSync('INSERT INTO brands (id, name, color) VALUES (?, ?, ?)', [id, name, color]);
    addToSyncQueue('brands', 'INSERT', id, { id, name, color });
  } catch (e) {
    console.error('insertBrand error:', e);
    throw e;
  }
};

export const updateBrand = (id: string, name: string, color: string): void => {
  try {
    db.runSync('UPDATE brands SET name = ?, color = ? WHERE id = ?', [name, color, id]);
    addToSyncQueue('brands', 'UPDATE', id, { id, name, color });
  } catch (e) {
    console.error('updateBrand error:', e);
    throw e;
  }
};

export const deleteBrand = (id: string): void => {
  try {
    db.runSync('DELETE FROM brands WHERE id = ?', [id]);
    addToSyncQueue('brands', 'DELETE', id, { id });
  } catch (e) {
    console.error('deleteBrand error:', e);
    throw e;
  }
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const getAllProducts = (): Product[] => {
  try {
    return db.getAllSync(`
      SELECT p.*,
             c.name AS category_name,
             b.name AS brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ORDER BY p.name ASC
    `) as Product[];
  } catch (e) {
    console.error('getAllProducts error:', e);
    return [];
  }
};

export const getProductById = (id: string): Product | null => {
  try {
    return db.getFirstSync(
      `SELECT p.*, c.name AS category_name, b.name AS brand_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = ?`,
      [id]
    ) as Product | null;
  } catch (e) {
    console.error('getProductById error:', e);
    return null;
  }
};

export const getLowStockProducts = (): Product[] => {
  try {
    return db.getAllSync(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock_quantity <= p.min_stock_threshold
      ORDER BY p.stock_quantity ASC
    `) as Product[];
  } catch (e) {
    console.error('getLowStockProducts error:', e);
    return [];
  }
};

export const insertProduct = (product: {
  name: string;
  category_id: string | null;
  brand_id: string | null;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_threshold: number;
  uom: string;
}): void => {
  const id = genId();
  try {
    db.runSync(
      `INSERT INTO products (id, name, category_id, brand_id, purchase_price, selling_price, stock_quantity, min_stock_threshold, uom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        product.name,
        product.category_id,
        product.brand_id,
        product.purchase_price,
        product.selling_price,
        product.stock_quantity,
        product.min_stock_threshold,
        product.uom,
      ]
    );
    addToSyncQueue('products', 'INSERT', id, { id, ...product });
  } catch (e) {
    console.error('insertProduct error:', e);
    throw e;
  }
};

export const updateProduct = (
  id: string,
  fields: Partial<Omit<Product, 'id' | 'updated_at' | 'category_name' | 'brand_name'>>
): void => {
  try {
    const sets = Object.keys(fields)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(fields), id];
    db.runSync(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = ?`, values);
    // Re-read the full row — partial payloads would corrupt Supabase if the INSERT
    // hasn't synced yet (deduplication deletes the INSERT queue entry on every UPDATE).
    const full = db.getFirstSync('SELECT * FROM products WHERE id = ?', [id]) as Product | null;
    if (full) {
      const { category_name: _c, brand_name: _b, ...syncPayload } = full;
      addToSyncQueue('products', 'UPDATE', id, syncPayload);
    }
  } catch (e) {
    console.error('updateProduct error:', e);
    throw e;
  }
};

export const updateProductStock = (id: string, newQty: number): void => {
  try {
    db.runSync(
      `UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?`,
      [newQty, id]
    );
    const full = db.getFirstSync('SELECT * FROM products WHERE id = ?', [id]) as Product | null;
    if (full) {
      const { category_name: _c, brand_name: _b, ...syncPayload } = full;
      addToSyncQueue('products', 'UPDATE', id, syncPayload);
    }
  } catch (e) {
    console.error('updateProductStock error:', e);
    throw e;
  }
};

export const deleteProduct = (id: string): void => {
  try {
    db.runSync('DELETE FROM products WHERE id = ?', [id]);
    addToSyncQueue('products', 'DELETE', id, { id });
  } catch (e) {
    console.error('deleteProduct error:', e);
    throw e;
  }
};

// ─── Customers ────────────────────────────────────────────────────────────────

export const getAllCustomers = (): Customer[] => {
  try {
    return db.getAllSync('SELECT * FROM customers ORDER BY name ASC') as Customer[];
  } catch (e) {
    console.error('getAllCustomers error:', e);
    return [];
  }
};

export const getCustomerById = (id: string): Customer | null => {
  try {
    return db.getFirstSync('SELECT * FROM customers WHERE id = ?', [id]) as Customer | null;
  } catch (e) {
    console.error('getCustomerById error:', e);
    return null;
  }
};

export const insertCustomer = (customer: {
  name: string;
  phone?: string;
  address?: string;
  udhar_balance?: number;
}): void => {
  const id = genId();
  try {
    db.runSync(
      'INSERT INTO customers (id, name, phone, address, udhar_balance) VALUES (?, ?, ?, ?, ?)',
      [id, customer.name, customer.phone ?? null, customer.address ?? null, customer.udhar_balance ?? 0]
    );
    addToSyncQueue('customers', 'INSERT', id, { id, ...customer });
  } catch (e) {
    console.error('insertCustomer error:', e);
    throw e;
  }
};

export const updateCustomer = (
  id: string,
  fields: { name: string; phone?: string; address?: string }
): void => {
  try {
    db.runSync(
      `UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?`,
      [fields.name, fields.phone ?? null, fields.address ?? null, id]
    );
    const updated = db.getFirstSync('SELECT * FROM customers WHERE id = ?', [id]) as Customer | null;
    if (updated) addToSyncQueue('customers', 'UPDATE', id, updated);
  } catch (e) {
    console.error('updateCustomer error:', e);
    throw e;
  }
};

/**
 * Records a cash payment against a customer's udhar balance.
 * Balance is clamped to 0 — it can never go negative.
 */
export const recordUdharPayment = (id: string, paymentAmount: number): void => {
  try {
    db.runSync(
      `UPDATE customers SET udhar_balance = MAX(0, udhar_balance - ?) WHERE id = ?`,
      [paymentAmount, id]
    );
    const updated = db.getFirstSync('SELECT * FROM customers WHERE id = ?', [id]) as Customer | null;
    if (updated) addToSyncQueue('customers', 'UPDATE', id, updated);
  } catch (e) {
    console.error('recordUdharPayment error:', e);
    throw e;
  }
};

export const updateCustomerUdhar = (id: string, deltaAmount: number): void => {
  try {
    db.runSync('UPDATE customers SET udhar_balance = udhar_balance + ? WHERE id = ?', [deltaAmount, id]);
    // Re-read the full row so the upsert payload is safe and complete (no non-existent delta column)
    const updated = db.getFirstSync('SELECT * FROM customers WHERE id = ?', [id]) as Customer | null;
    if (updated) addToSyncQueue('customers', 'UPDATE', id, updated);
  } catch (e) {
    console.error('updateCustomerUdhar error:', e);
    throw e;
  }
};

// ─── Bills ────────────────────────────────────────────────────────────────────

/**
 * Atomically inserts a bill + its items, deducts stock, logs sales,
 * and updates customer udhar if payment_mode = 'udhar'.
 * Returns the new bill id.
 */
export const insertBill = (
  bill: Omit<Bill, 'id' | 'bill_date'>,
  items: Omit<BillItem, 'id' | 'bill_id'>[]
): string => {
  const billId = genId();
  const billItemsForSync: any[] = [];
  const salesLogForSync: any[] = [];

  try {
    db.withTransactionSync(() => {
      // 1. Insert bill
      db.runSync(
        `INSERT INTO bills (id, customer_id, customer_name, payment_mode, total_amount, total_items)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          billId,
          bill.customer_id,
          bill.customer_name,
          bill.payment_mode,
          bill.total_amount,
          bill.total_items,
        ]
      );

      for (const item of items) {
        const itemId = genId();
        const logId = genId();

        // 2. Insert bill item
        db.runSync(
          `INSERT INTO bill_items (id, bill_id, product_id, product_name, qty, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [itemId, billId, item.product_id, item.product_name, item.qty, item.unit_price, item.line_total]
        );

        // 3. Deduct stock
        db.runSync(
          `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime('now') WHERE id = ?`,
          [item.qty, item.product_id]
        );

        // 4. Append sales log
        db.runSync(
          `INSERT INTO sales_log (id, product_id, product_name, qty_sold, sale_amount)
           VALUES (?, ?, ?, ?, ?)`,
          [logId, item.product_id, item.product_name, item.qty, item.line_total]
        );

        billItemsForSync.push({
          id: itemId,
          bill_id: billId,
          product_id: item.product_id,
          product_name: item.product_name,
          qty: item.qty,
          unit_price: item.unit_price,
          line_total: item.line_total,
        });
        salesLogForSync.push({
          id: logId,
          product_id: item.product_id,
          product_name: item.product_name,
          qty_sold: item.qty,
          sale_amount: item.line_total,
        });
      }

      // 5. If udhar → increment customer balance
      if (bill.payment_mode === 'udhar' && bill.customer_id) {
        db.runSync(
          'UPDATE customers SET udhar_balance = udhar_balance + ? WHERE id = ?',
          [bill.total_amount, bill.customer_id]
        );
      }

      // 6. Queue sync — inside the transaction so a queue-write failure rolls back
      //    the bill insert too, keeping SQLite and sync_queue consistent.
      addToSyncQueue('bills', 'INSERT', billId, {
        bill: { id: billId, ...bill },
        items: billItemsForSync,
        salesLog: salesLogForSync,
      });

      if (bill.payment_mode === 'udhar' && bill.customer_id) {
        const updatedCustomer = db.getFirstSync(
          'SELECT * FROM customers WHERE id = ?',
          [bill.customer_id]
        ) as Customer | null;
        if (updatedCustomer) {
          addToSyncQueue('customers', 'UPDATE', bill.customer_id, updatedCustomer);
        }
      }
    });

    return billId;
  } catch (e) {
    console.error('insertBill error:', e);
    throw e;
  }
};

export const getRecentBills = (limit = 5): Bill[] => {
  try {
    return db.getAllSync(
      'SELECT * FROM bills ORDER BY bill_date DESC LIMIT ?',
      [limit]
    ) as Bill[];
  } catch (e) {
    console.error('getRecentBills error:', e);
    return [];
  }
};

export const getAllBills = (): Bill[] => {
  try {
    return db.getAllSync(
      'SELECT * FROM bills ORDER BY bill_date DESC'
    ) as Bill[];
  } catch (e) {
    console.error('getAllBills error:', e);
    return [];
  }
};

export const getBillItems = (billId: string): BillItem[] => {
  try {
    return db.getAllSync(
      'SELECT * FROM bill_items WHERE bill_id = ?',
      [billId]
    ) as BillItem[];
  } catch (e) {
    console.error('getBillItems error:', e);
    return [];
  }
};

export const getBillsByCustomer = (customerId: string, limit = 10): Bill[] => {
  try {
    return db.getAllSync(
      'SELECT * FROM bills WHERE customer_id = ? ORDER BY bill_date DESC LIMIT ?',
      [customerId, limit]
    ) as Bill[];
  } catch (e) {
    console.error('getBillsByCustomer error:', e);
    return [];
  }
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const getTodaySales = (): { total: number; count: number } => {
  try {
    const row = db.getFirstSync(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
       FROM bills WHERE date(bill_date) = date('now')`
    ) as { total: number; count: number };
    return row ?? { total: 0, count: 0 };
  } catch (e) {
    console.error('getTodaySales error:', e);
    return { total: 0, count: 0 };
  }
};

export const getSalesByRange = (from: string, to: string): ReportData => {
  try {
    const row = db.getFirstSync(
      `SELECT
         COALESCE(SUM(total_amount), 0) AS total_sales,
         COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN total_amount ELSE 0 END), 0) AS cash_sales,
         COALESCE(SUM(CASE WHEN payment_mode = 'udhar' THEN total_amount ELSE 0 END), 0) AS udhar_sales,
         COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN total_amount ELSE 0 END), 0) AS upi_sales,
         COUNT(*) AS bill_count
       FROM bills
       WHERE date(bill_date) BETWEEN date(?) AND date(?)`,
      [from, to]
    ) as any;

    const totalSales = row?.total_sales ?? 0;

    // Real net profit: (unit_price - purchase_price) × qty for every bill item in range.
    // Falls back to 0 for products with no purchase price set (rather than inflating profit).
    const profitRow = db.getFirstSync(
      `SELECT COALESCE(SUM(bi.qty * (bi.unit_price - COALESCE(p.purchase_price, 0))), 0) AS net_profit
       FROM bills b
       JOIN bill_items bi ON bi.bill_id = b.id
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE date(b.bill_date) BETWEEN date(?) AND date(?)`,
      [from, to]
    ) as { net_profit: number } | null;
    const net_profit = Math.round(profitRow?.net_profit ?? 0);

    return {
      total_sales: totalSales,
      net_profit,
      cash_sales: row?.cash_sales ?? 0,
      udhar_sales: row?.udhar_sales ?? 0,
      upi_sales: row?.upi_sales ?? 0,
      bill_count: row?.bill_count ?? 0,
    };
  } catch (e) {
    console.error('getSalesByRange error:', e);
    return { total_sales: 0, net_profit: 0, cash_sales: 0, udhar_sales: 0, upi_sales: 0, bill_count: 0 };
  }
};

// ─── Full Re-queue ────────────────────────────────────────────────────────────

/**
 * Reads every row from SQLite and adds it to the sync queue as an upsert.
 *
 * Use cases:
 * 1. Offline → cloud switch: pushes all historical local data up to Supabase.
 * 2. JSON import for cloud users: re-syncs restored rows and cancels any stale
 *    DELETE queue entries for the same IDs (addToSyncQueue deduplication removes
 *    them before inserting the new upsert entries).
 */
export const queueAllLocalData = (): void => {
  // Shop — payload must match the camelCase shape syncUpsert expects
  const shop = db.getFirstSync('SELECT * FROM shop') as any | null;
  if (shop) {
    addToSyncQueue('shop', 'INSERT', shop.id, {
      shopName: shop.shop_name,
      ownerName: shop.owner_name,
      category: shop.business_category,
      whatsappNumber: shop.whatsapp_number,
      aiConsent: shop.ai_consent === 1,
    });
  }

  // Simple tables — payload columns map 1-to-1 with Supabase columns
  const categories = db.getAllSync('SELECT * FROM categories') as any[];
  for (const row of categories) addToSyncQueue('categories', 'INSERT', row.id, row);

  const brands = db.getAllSync('SELECT * FROM brands') as any[];
  for (const row of brands) addToSyncQueue('brands', 'INSERT', row.id, row);

  const products = db.getAllSync(
    'SELECT id, name, category_id, brand_id, purchase_price, selling_price, stock_quantity, min_stock_threshold, uom, updated_at FROM products'
  ) as any[];
  for (const row of products) addToSyncQueue('products', 'INSERT', row.id, row);

  const customers = db.getAllSync(
    'SELECT id, name, phone, address, udhar_balance, created_at FROM customers'
  ) as any[];
  for (const row of customers) addToSyncQueue('customers', 'INSERT', row.id, row);

  // Bills — compound payload: { bill, items, salesLog }
  // salesLog is queued separately below so it isn't double-upserted here.
  const bills = db.getAllSync('SELECT * FROM bills') as any[];
  for (const bill of bills) {
    const items = db.getAllSync(
      'SELECT * FROM bill_items WHERE bill_id = ?',
      [bill.id]
    ) as any[];
    addToSyncQueue('bills', 'INSERT', bill.id, { bill, items, salesLog: [] });
  }

  // Sales log — queued individually via the standalone 'sales_log' syncUpsert case
  const salesLog = db.getAllSync('SELECT * FROM sales_log') as any[];
  for (const row of salesLog) addToSyncQueue('sales_log', 'INSERT', row.id, row);
};

// ─── SQLite Export ────────────────────────────────────────────────────────────

/**
 * Dumps all local SQLite tables as SQL INSERT statements ready to paste
 * into the Supabase SQL editor. Requires shopId (10-digit phone) to fill
 * the shop_id column that Supabase RLS enforces.
 */
export const exportAsSql = (shopId: string): string => {
  const escape = (v: any): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  };

  const lines: string[] = [
    `-- Pragati Bandhu export — shop ${shopId} — ${new Date().toISOString()}`,
    `-- Paste into Supabase SQL Editor and run.`,
    '',
  ];

  const dump = (_table: string, supaTable: string, rows: any[], cols: string[], extraCols?: Record<string, string>) => {
    if (!rows.length) return;
    const allCols = extraCols ? [...cols, ...Object.keys(extraCols)] : cols;
    lines.push(`-- ${supaTable} (${rows.length} rows)`);
    for (const row of rows) {
      const vals = cols.map((c) => escape(row[c]));
      if (extraCols) Object.values(extraCols).forEach((v) => vals.push(`'${v}'`));
      lines.push(`INSERT INTO ${supaTable} (${allCols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;`);
    }
    lines.push('');
  };

  const sid = shopId;

  const categories = db.getAllSync('SELECT * FROM categories') as any[];
  dump('categories', 'categories', categories, ['id', 'name', 'icon', 'icon_color'], { shop_id: sid });

  const brands = db.getAllSync('SELECT * FROM brands') as any[];
  dump('brands', 'brands', brands, ['id', 'name', 'color'], { shop_id: sid });

  const products = db.getAllSync('SELECT * FROM products') as any[];
  dump('products', 'products', products,
    ['id', 'name', 'category_id', 'brand_id', 'purchase_price', 'selling_price', 'stock_quantity', 'min_stock_threshold', 'uom'],
    { shop_id: sid });

  const customers = db.getAllSync('SELECT * FROM customers') as any[];
  dump('customers', 'customers', customers, ['id', 'name', 'phone', 'address', 'udhar_balance'], { shop_id: sid });

  const bills = db.getAllSync('SELECT * FROM bills') as any[];
  dump('bills', 'bills', bills,
    ['id', 'customer_id', 'customer_name', 'payment_mode', 'total_amount', 'total_items', 'bill_date'],
    { shop_id: sid });

  const billItems = db.getAllSync('SELECT * FROM bill_items') as any[];
  dump('bill_items', 'bill_items', billItems,
    ['id', 'bill_id', 'product_id', 'product_name', 'qty', 'unit_price', 'line_total']);

  const salesLog = db.getAllSync('SELECT * FROM sales_log') as any[];
  dump('sales_log', 'sales_log', salesLog,
    ['id', 'product_id', 'product_name', 'qty_sold', 'sale_amount', 'sold_date'],
    { shop_id: sid });

  lines.push('-- End of export');
  return lines.join('\n');
};

export const getTopProducts = (from: string, to: string, limit = 5): TopProduct[] => {
  try {
    return db.getAllSync(
      `SELECT product_id, product_name,
              SUM(qty_sold) AS total_qty,
              SUM(sale_amount) AS total_amount
       FROM sales_log
       WHERE date(sold_date) BETWEEN date(?) AND date(?)
       GROUP BY product_id, product_name
       ORDER BY total_qty DESC
       LIMIT ?`,
      [from, to, limit]
    ) as TopProduct[];
  } catch (e) {
    console.error('getTopProducts error:', e);
    return [];
  }
};
