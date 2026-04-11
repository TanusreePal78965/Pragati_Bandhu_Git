import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('shopai.db');

export const initDatabase = () => {
  db.execSync(`
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
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
};

export default db;
