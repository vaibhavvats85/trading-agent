import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { initializePool } from "./postgres";

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
  // If using PostgreSQL, use the pool initialization
  if (process.env.DATABASE_TYPE === "postgres") {
    console.log("📊 Using PostgreSQL database");
    initializePool();
    return;
  }

  // Otherwise, use SQLite
  if (!db) {
    throw new Error("Database not initialized");
  }

  // Create tables if they don't exist
  db.exec(`
    -- Account table for tracking trading account state
    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
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

    -- Ensure account table has exactly one row
    INSERT OR IGNORE INTO account (id, total_capital, available_balance) 
    VALUES (1, 1000000, 1000000);

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
    CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
    CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments(symbol);
    CREATE INDEX IF NOT EXISTS idx_history_closed_at ON position_history(closed_at);
    CREATE INDEX IF NOT EXISTS idx_paper_positions_symbol ON paper_positions(symbol);
    CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status);
  `);

  console.log("✅ SQLite database initialized at:", dbPath);
  return db;
}

// Initialize database on module load
initializeDatabase();

export default db as Database.Database;
