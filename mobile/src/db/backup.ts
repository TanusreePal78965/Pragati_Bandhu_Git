import db from './sqlite';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupData {
  /** Bump when the schema changes so importFromJson can handle migrations */
  version: number;
  exportedAt: string;
  shop: any | null;
  categories: any[];
  brands: any[];
  products: any[];
  customers: any[];
  bills: any[];
  billItems: any[];
  salesLog: any[];
}

export interface ImportSummary {
  categories: number;
  brands: number;
  products: number;
  customers: number;
  bills: number;
  billItems: number;
  salesLog: number;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Reads every local SQLite table and returns a portable BackupData object.
 * Does NOT include sync_queue or suggestions_cache (internal/cache only).
 */
export const exportAsJson = (): BackupData => {
  const shop = db.getFirstSync('SELECT * FROM shop') as any | null;
  const categories = db.getAllSync('SELECT * FROM categories') as any[];
  const brands = db.getAllSync('SELECT * FROM brands') as any[];
  const products = db.getAllSync('SELECT * FROM products') as any[];
  const customers = db.getAllSync('SELECT * FROM customers') as any[];
  const bills = db.getAllSync('SELECT * FROM bills ORDER BY bill_date ASC') as any[];
  const billItems = db.getAllSync('SELECT * FROM bill_items') as any[];
  const salesLog = db.getAllSync('SELECT * FROM sales_log') as any[];

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    shop,
    categories,
    brands,
    products,
    customers,
    bills,
    billItems,
    salesLog,
  };
};

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * INSERT OR REPLACE all rows from a BackupData object into the local SQLite DB.
 * Idempotent — safe to run on a non-empty database (merges, not overwrites).
 * Returns a count of rows inserted per table.
 */
export const importFromJson = (data: BackupData): ImportSummary => {
  const summary: ImportSummary = {
    categories: 0,
    brands: 0,
    products: 0,
    customers: 0,
    bills: 0,
    billItems: 0,
    salesLog: 0,
  };

  db.withTransactionSync(() => {
    // Shop
    if (data.shop) {
      db.runSync(
        `INSERT OR REPLACE INTO shop
           (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.shop.id,
          data.shop.shop_name,
          data.shop.owner_name,
          data.shop.phone ?? null,
          data.shop.whatsapp_number ?? null,
          data.shop.business_category ?? null,
          data.shop.ai_consent ?? 0,
          data.shop.is_active ?? 1,
          data.shop.created_at ?? new Date().toISOString(),
        ]
      );
    }

    // Categories
    for (const row of data.categories ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO categories (id, name, icon, icon_color) VALUES (?, ?, ?, ?)`,
        [row.id, row.name, row.icon ?? 'grid-outline', row.icon_color ?? '#1a57db']
      );
      summary.categories++;
    }

    // Brands
    for (const row of data.brands ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO brands (id, name, color) VALUES (?, ?, ?)`,
        [row.id, row.name, row.color ?? '#1a57db']
      );
      summary.brands++;
    }

    // Products
    for (const row of data.products ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO products
           (id, name, category_id, brand_id, purchase_price, selling_price, stock_quantity, min_stock_threshold, uom, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id, row.name,
          row.category_id ?? null,
          row.brand_id ?? null,
          row.purchase_price ?? 0,
          row.selling_price ?? 0,
          row.stock_quantity ?? 0,
          row.min_stock_threshold ?? 5,
          row.uom ?? 'Pcs',
          row.updated_at ?? new Date().toISOString(),
        ]
      );
      summary.products++;
    }

    // Customers
    for (const row of data.customers ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO customers (id, name, phone, address, udhar_balance, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.name, row.phone ?? null, row.address ?? null, row.udhar_balance ?? 0, row.created_at ?? new Date().toISOString()]
      );
      summary.customers++;
    }

    // Bills
    for (const row of data.bills ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO bills
           (id, customer_id, customer_name, payment_mode, total_amount, total_items, bill_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.customer_id ?? null,
          row.customer_name ?? null,
          row.payment_mode ?? 'cash',
          row.total_amount,
          row.total_items,
          row.bill_date ?? new Date().toISOString(),
        ]
      );
      summary.bills++;
    }

    // Bill Items
    for (const row of data.billItems ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO bill_items
           (id, bill_id, product_id, product_name, qty, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.bill_id, row.product_id, row.product_name, row.qty, row.unit_price, row.line_total]
      );
      summary.billItems++;
    }

    // Sales Log
    for (const row of data.salesLog ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO sales_log
           (id, product_id, product_name, qty_sold, sale_amount, sold_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.product_id, row.product_name, row.qty_sold, row.sale_amount, row.sold_date ?? new Date().toISOString()]
      );
      summary.salesLog++;
    }
  });

  return summary;
};

// ─── Clear ────────────────────────────────────────────────────────────────────

/**
 * Deletes ALL rows from every table but preserves the schema.
 * Used for "Delete All Data / Fresh Start".
 */
export const clearAllLocalData = (): void => {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM bill_items');
    db.runSync('DELETE FROM sales_log');
    db.runSync('DELETE FROM bills');
    db.runSync('DELETE FROM customers');
    db.runSync('DELETE FROM products');
    db.runSync('DELETE FROM brands');
    db.runSync('DELETE FROM categories');
    db.runSync('DELETE FROM suggestions_cache');
    db.runSync('DELETE FROM sync_queue');
    db.runSync('DELETE FROM shop');
  });
};
