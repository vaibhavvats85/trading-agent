import { Pool, PoolClient } from "pg";
require("dotenv").config({ path: ".env.postgres.local" });
// PostgreSQL connection pool
let pool: Pool | null = null;

// Get database connection URL or create from individual parameters
function getConnectionString(): string {
  const postgresUrl = process.env.POSTGRES_URL;
  if (postgresUrl) {
    return postgresUrl;
  }

  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  const database = process.env.POSTGRES_DATABASE || "trading_agent";
  const user = process.env.POSTGRES_USER || "admin";
  const password = process.env.POSTGRES_PASSWORD || "admin";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// Initialize PostgreSQL connection pool
export function initializePool() {
  if (pool) return pool;

  const connectionString = getConnectionString();

  pool = new Pool({
    connectionString,
    max: 20,
    min: 2,
  });

  pool.on("error", (error) => {
    console.error("Unexpected error on idle client", error);
  });

  return pool;
}

// Get a client from the pool
export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    initializePool();
  }
  return pool!.connect();
}

// Initialize database schema
export async function initializeDatabase() {
  const client = await getClient();

  try {
    console.log("🔧 Initializing PostgreSQL database...");

    await client.query("BEGIN");

    // Create account table
    await client.query(`
      CREATE TABLE IF NOT EXISTS account (
        id SERIAL PRIMARY KEY CHECK (id = 1),
        total_capital NUMERIC(15, 2) NOT NULL DEFAULT 1000000,
        available_balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000,
        invested_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
        total_pnl NUMERIC(15, 2) NOT NULL DEFAULT 0,
        total_pnl_percent VARCHAR(10) NOT NULL DEFAULT '0.00',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create positions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        quantity INTEGER NOT NULL,
        entry_price NUMERIC(15, 4) NOT NULL,
        current_price NUMERIC(15, 4) NOT NULL,
        invested NUMERIC(15, 2) NOT NULL,
        current NUMERIC(15, 2) NOT NULL,
        pnl NUMERIC(15, 2) NOT NULL,
        pnl_percent VARCHAR(10) NOT NULL,
        signal_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('BUY', 'SELL')),
        quantity INTEGER NOT NULL,
        price_per_unit NUMERIC(15, 4) NOT NULL,
        total_amount NUMERIC(15, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED')),
        signal_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        filled_at TIMESTAMP
      );
    `);

    // Create position history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS position_history (
        id TEXT PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        quantity INTEGER NOT NULL,
        entry_price NUMERIC(15, 4) NOT NULL,
        exit_price NUMERIC(15, 4) NOT NULL,
        invested NUMERIC(15, 2) NOT NULL,
        current NUMERIC(15, 2) NOT NULL,
        pnl NUMERIC(15, 2) NOT NULL,
        pnl_percent VARCHAR(10) NOT NULL,
        signal_type VARCHAR(50),
        opened_at TIMESTAMP NOT NULL,
        closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create paper positions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS paper_positions (
        id TEXT PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        quantity INTEGER NOT NULL,
        entry_price NUMERIC(15, 4) NOT NULL,
        invested NUMERIC(15, 2) NOT NULL,
        instrument_token INTEGER NOT NULL,
        signal_type VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create instruments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS instruments (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(100),
        weight NUMERIC(10, 4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
      CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
      CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments(symbol);
      CREATE INDEX IF NOT EXISTS idx_history_closed_at ON position_history(closed_at);
      CREATE INDEX IF NOT EXISTS idx_paper_positions_symbol ON paper_positions(symbol);
      CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status);
    `);

    // Ensure account table has exactly one row
    await client.query(`
      INSERT INTO account (id, total_capital, available_balance)
      SELECT 1, 1000000, 1000000
      WHERE NOT EXISTS (SELECT 1 FROM account WHERE id = 1);
    `);

    await client.query("COMMIT");
    console.log("✅ PostgreSQL database initialized successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Close all connections
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("✅ PostgreSQL connection pool closed");
  }
}

export default {
  getClient,
  initializePool,
  initializeDatabase,
  closePool,
};
