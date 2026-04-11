import db from './sqlite';
import { addToSyncQueue } from './syncQueue';

// ─── ID generator ────────────────────────────────────────────────────────────
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ─── Shop ─────────────────────────────────────────────────────────────────────

export interface ShopInfo {
  shopName: string;
  ownerName: string;
  category?: string;
  whatsappNumber?: string;
  phone?: string;
  aiConsent?: boolean;
}

export const insertShop = (data: ShopInfo): void => {
  try {
    db.runSync(
      `INSERT OR REPLACE INTO shop
         (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        genId(),
        data.shopName,
        data.ownerName,
        data.phone ?? '',
        data.whatsappNumber ?? '',
        data.category ?? '',
        data.aiConsent ? 1 : 0,
      ]
    );
  } catch (e) {
    console.error('insertShop error:', e);
  }
};

export const getShop = (): ShopInfo | null => {
  try {
    const row = db.getFirstSync('SELECT * FROM shop LIMIT 1') as any;
    if (!row) return null;
    return {
      shopName: row.shop_name,
      ownerName: row.owner_name,
      phone: row.phone,
      whatsappNumber: row.whatsapp_number,
      category: row.business_category,
      aiConsent: row.ai_consent === 1,
    };
  } catch (e) {
    console.error('getShop error:', e);
    return null;
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
  payment_mode: 'cash' | 'udhar';
  total_amount: number;
  total_items: number;
  bill_date: string;
}

export interface ReportData {
  total_sales: number;
  net_profit: number;
  cash_sales: number;
  udhar_sales: number;
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
    addToSyncQueue('products', 'UPDATE', id, { id, ...fields });
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
    addToSyncQueue('products', 'UPDATE', id, { id, stock_quantity: newQty });
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

export const updateCustomerUdhar = (id: string, deltaAmount: number): void => {
  try {
    db.runSync('UPDATE customers SET udhar_balance = udhar_balance + ? WHERE id = ?', [deltaAmount, id]);
    addToSyncQueue('customers', 'UPDATE', id, { id, udhar_delta: deltaAmount });
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
          [genId(), item.product_id, item.product_name, item.qty, item.line_total]
        );
      }

      // 5. If udhar → increment customer balance
      if (bill.payment_mode === 'udhar' && bill.customer_id) {
        db.runSync(
          'UPDATE customers SET udhar_balance = udhar_balance + ? WHERE id = ?',
          [bill.total_amount, bill.customer_id]
        );
      }
    });

    addToSyncQueue('bills', 'INSERT', billId, { id: billId, ...bill, items });
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
         COUNT(*) AS bill_count
       FROM bills
       WHERE date(bill_date) BETWEEN date(?) AND date(?)`,
      [from, to]
    ) as any;

    const totalSales = row?.total_sales ?? 0;
    // Rough net profit: assume ~20% margin over selling price
    const net_profit = Math.round(totalSales * 0.2);

    return {
      total_sales: totalSales,
      net_profit,
      cash_sales: row?.cash_sales ?? 0,
      udhar_sales: row?.udhar_sales ?? 0,
      bill_count: row?.bill_count ?? 0,
    };
  } catch (e) {
    console.error('getSalesByRange error:', e);
    return { total_sales: 0, net_profit: 0, cash_sales: 0, udhar_sales: 0, bill_count: 0 };
  }
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
