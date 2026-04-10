import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { initializePool, initializeDatabase as initPostgresDatabase } from "./postgres";

// Use a data directory in the project root
const dbDir = path.join(process.cwd(), ".data");
const dbPath = path.join(dbDir, "paper-trading.db");

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database based on DATABASE_TYPE environment variable
let db: Database.Database | null = null;

// Only initialize SQLite if using SQLite database
if (process.env.DATABASE_TYPE !== "postgres") {
  db = new Database(dbPath);
  // Enable foreign keys
  db.pragma("foreign_keys = ON");
}

export function initializeDatabase() {
  // If using PostgreSQL, initialize pool AND create all tables
  if (process.env.DATABASE_TYPE === "postgres") {
    console.log("📊 Using PostgreSQL database");
    initializePool();
    return initPostgresDatabase();
  }

  // Otherwise, use SQLite
  if (!db) {
    throw new Error("Database not initialized");
  }

  // Create tables if they don't exist (multi-user schema with user_id)
  db.exec(`
    -- Account table: one row per user
    CREATE TABLE IF NOT EXISTS account (
      user_id TEXT PRIMARY KEY,
      total_capital REAL NOT NULL DEFAULT 1000000,
      available_balance REAL NOT NULL DEFAULT 1000000,
      invested_amount REAL NOT NULL DEFAULT 0,
      total_pnl REAL NOT NULL DEFAULT 0,
      total_pnl_percent TEXT NOT NULL DEFAULT '0.00',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Active positions table
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      entry_price REAL NOT NULL,
      current_price REAL NOT NULL,
      invested REAL NOT NULL,
      current REAL NOT NULL,
      pnl REAL NOT NULL,
      pnl_percent TEXT NOT NULL,
      signal_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Open orders table
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      order_type TEXT NOT NULL CHECK (order_type IN ('BUY', 'SELL')),
      quantity INTEGER NOT NULL,
      price_per_unit REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED')),
      signal_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      filled_at DATETIME
    );

    -- Closed positions history table
    CREATE TABLE IF NOT EXISTS position_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      entry_price REAL NOT NULL,
      exit_price REAL NOT NULL,
      invested REAL NOT NULL,
      current REAL NOT NULL,
      pnl REAL NOT NULL,
      pnl_percent TEXT NOT NULL,
      signal_type TEXT,
      opened_at DATETIME NOT NULL,
      closed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Paper trading positions table for mock trading
    CREATE TABLE IF NOT EXISTS paper_positions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      entry_price REAL NOT NULL,
      invested REAL NOT NULL,
      instrument_token INTEGER NOT NULL,
      signal_type TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Instruments/Stocks table for storing index constituents
    CREATE TABLE IF NOT EXISTS instruments (
      id INTEGER PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      industry TEXT,
      weight REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
    CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments(symbol);
    CREATE INDEX IF NOT EXISTS idx_history_closed_at ON position_history(closed_at);
    CREATE INDEX IF NOT EXISTS idx_history_user ON position_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_paper_positions_symbol ON paper_positions(symbol);
    CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status);

    -- Scan results table
    CREATE TABLE IF NOT EXISTS scan_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      industry TEXT,
      ltp REAL NOT NULL,
      change_amount REAL NOT NULL,
      change_percent TEXT NOT NULL,
      ema50 REAL NOT NULL,
      rsi REAL NOT NULL,
      dma10 REAL NOT NULL,
      pullback INTEGER NOT NULL DEFAULT 0,
      signal TEXT NOT NULL,
      strategy_signals TEXT,
      indicators TEXT,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sector rankings table
    CREATE TABLE IF NOT EXISTS sector_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank INTEGER NOT NULL,
      sector_name TEXT NOT NULL,
      index_symbol TEXT NOT NULL,
      stock_count INTEGER NOT NULL DEFAULT 0,
      stocks_above_ema50 INTEGER NOT NULL DEFAULT 0,
      pct_above_ema50 REAL NOT NULL DEFAULT 0,
      index_price REAL,
      index_ema20 REAL,
      index_ema50 REAL,
      distance_from_ema20_pct REAL,
      momentum TEXT NOT NULL DEFAULT 'UNKNOWN',
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_scan_results_signal ON scan_results(signal);
    CREATE INDEX IF NOT EXISTS idx_scan_results_scanned_at ON scan_results(scanned_at);
    CREATE INDEX IF NOT EXISTS idx_sector_rankings_rank ON sector_rankings(rank);

    -- Previous-day closing prices for portfolio holdings (keyed by symbol + date)
    CREATE TABLE IF NOT EXISTS holdings_prev_close (
      symbol TEXT NOT NULL,
      date  TEXT NOT NULL,
      prev_close REAL NOT NULL,
      PRIMARY KEY (symbol, date)
    );
  `);

  console.log("✅ SQLite database initialized at:", dbPath);

  // ── Migration: add user_id to tables that still use the old single-user schema ──
  // SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS,
  // so we catch the "duplicate column" error and ignore it.
  const migrations = [
    "ALTER TABLE positions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE position_history ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  // Migrate old single-row account table (id INTEGER PK) → new user_id TEXT PK schema.
  // Only triggers if the old `id` column still exists and `user_id` column is missing.
  const accountCols = (db.pragma("table_info(account)") as any[]).map((c) => c.name);
  if (accountCols.includes("id") && !accountCols.includes("user_id")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_new (
        user_id TEXT PRIMARY KEY,
        total_capital REAL NOT NULL DEFAULT 1000000,
        available_balance REAL NOT NULL DEFAULT 1000000,
        invested_amount REAL NOT NULL DEFAULT 0,
        total_pnl REAL NOT NULL DEFAULT 0,
        total_pnl_percent TEXT NOT NULL DEFAULT '0.00',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      DROP TABLE account;
      ALTER TABLE account_new RENAME TO account;
    `);
    console.log("✅ SQLite account table migrated to multi-user schema");
  }

  return db;
}

// Initialize database on module load
initializeDatabase();

export default db as Database.Database;
