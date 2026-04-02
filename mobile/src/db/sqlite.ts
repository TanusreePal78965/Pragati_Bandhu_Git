import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('shopai.db');

export const initDatabase = () => {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT,
      brand_id TEXT,
      stock_quantity REAL DEFAULT 0,
      min_stock_threshold REAL DEFAULT 0,
      price REAL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      total_price REAL NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
      data_id TEXT NOT NULL,
      payload TEXT, -- JSON string of the object
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      attempts INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    );
  `);
};

export default db;
