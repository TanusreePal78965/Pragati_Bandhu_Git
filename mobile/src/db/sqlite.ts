import * as SQLite from 'expo-sqlite';

// ─── Per-user database isolation ─────────────────────────────────────────────
//
// Each user gets their own SQLite file: shopai_<phone>.db
// This prevents data bleed between accounts on the same device without
// ever needing to wipe data on logout — isolation is structural.
//
// All callers keep `import db from './sqlite'` unchanged.
// The Proxy below forwards every property access to the current _db instance
// at call time, so switching users just means swapping _db.

let _db: SQLite.SQLiteDatabase | null = null;
let _currentDbKey: string | null = null;

const db = new Proxy({} as SQLite.SQLiteDatabase, {
  get(_, prop: string | symbol) {
    if (!_db) throw new Error(`[SQLite] No database open — openUserDatabase(dbKey) must be called first`);
    const val = (_db as any)[prop];
    return typeof val === 'function' ? val.bind(_db) : val;
  },
});

// ─── Schema ───────────────────────────────────────────────────────────────────

function initTables(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'grid-outline',
      icon_color TEXT DEFAULT '#1a57db'
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#1a57db'
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT,
      brand_id TEXT,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      min_stock_threshold INTEGER DEFAULT 5,
      uom TEXT DEFAULT 'Pcs',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      udhar_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      payment_mode TEXT DEFAULT 'cash',
      total_amount REAL NOT NULL,
      total_items INTEGER NOT NULL,
      bill_date TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY NOT NULL,
      bill_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_log (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty_sold INTEGER NOT NULL,
      sale_amount REAL NOT NULL,
      sold_date TEXT DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_log (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suggestions_cache (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      urgency TEXT,
      days_left INTEGER,
      suggested_qty INTEGER,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS draft_bills (
      id TEXT PRIMARY KEY NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      payment_mode TEXT DEFAULT 'cash',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS draft_bill_items (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      display_qty TEXT,
      uom TEXT DEFAULT 'Pcs',
      units_per_pack INTEGER,
      purchase_uom TEXT,
      is_pack_mode INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      data_id TEXT NOT NULL,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      attempts INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shop (
      id TEXT PRIMARY KEY NOT NULL,
      shop_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT,
      whatsapp_number TEXT,
      business_category TEXT,
      ai_consent INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Additive migrations — safe to run on every open (ALTER TABLE fails silently if column exists)
  try { database.runSync('ALTER TABLE shop ADD COLUMN is_active INTEGER DEFAULT 1'); } catch (_) {}
  try { database.runSync('ALTER TABLE products ADD COLUMN purchase_uom TEXT DEFAULT NULL'); } catch (_) {}
  try { database.runSync('ALTER TABLE products ADD COLUMN units_per_pack INTEGER DEFAULT NULL'); } catch (_) {}
  try { database.runSync('ALTER TABLE bill_items ADD COLUMN display_qty TEXT DEFAULT NULL'); } catch (_) {}
  try { database.runSync('ALTER TABLE bill_items ADD COLUMN purchase_price REAL DEFAULT 0'); } catch (_) {}
  try { database.runSync('ALTER TABLE draft_bill_items ADD COLUMN purchase_price REAL DEFAULT 0'); } catch (_) {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Open the database file for the given unique key (user UUID or phone number).
 * Must be called once after authentication before any SQLite access.
 * Safe to call multiple times with the same key — no-ops on repeated calls.
 */
export const openUserDatabase = (dbKey: string): void => {
  if (_currentDbKey === dbKey && _db) return;
  if (_db) {
    try { _db.closeSync(); } catch (_) {}
  }
  _db = SQLite.openDatabaseSync(`shopai_${dbKey}.db`);
  _currentDbKey = dbKey;
  initTables(_db);
};

/**
 * Close the current database. Called on logout so file handles are released.
 */
export const closeUserDatabase = (): void => {
  if (_db) {
    try { _db.closeSync(); } catch (_) {}
    _db = null;
    _currentDbKey = null;
  }
};

/**
 * Wipe all rows from the current user's database (schema preserved).
 * Used by the "Delete All Data" flow — NOT called on logout.
 */
export const clearDatabase = (): void => {
  if (!_db) return;
  _db.execSync(`
    DELETE FROM sync_queue;
    DELETE FROM suggestions_cache;
    DELETE FROM sales_log;
    DELETE FROM bill_items;
    DELETE FROM bills;
    DELETE FROM draft_bill_items;
    DELETE FROM draft_bills;
    DELETE FROM customers;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM brands;
    DELETE FROM shop;
  `);
};

export default db;
