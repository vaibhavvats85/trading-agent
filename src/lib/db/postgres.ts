import { Pool, PoolClient } from "pg";
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
let _dbInitialized = false;
export async function initializeDatabase() {
  if (_dbInitialized) return;
  _dbInitialized = true;

  const client = await getClient();

  try {
    console.log("🔧 Initializing PostgreSQL database...");

    await client.query("BEGIN");

    // Create account table — one row per user, keyed by user_id
    await client.query(`
      CREATE TABLE IF NOT EXISTS account (
        user_id TEXT PRIMARY KEY,
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
        user_id TEXT NOT NULL,
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
        user_id TEXT NOT NULL,
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
        user_id TEXT NOT NULL,
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

    // Create scan_results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scan_results (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        industry VARCHAR(100),
        ltp NUMERIC(15, 4) NOT NULL,
        change_amount NUMERIC(15, 4) NOT NULL,
        change_percent VARCHAR(20) NOT NULL,
        ema50 NUMERIC(15, 4) NOT NULL,
        rsi NUMERIC(10, 4) NOT NULL,
        dma10 NUMERIC(15, 4) NOT NULL,
        pullback BOOLEAN NOT NULL DEFAULT false,
        signal VARCHAR(20) NOT NULL,
        strategy_signals JSONB,
        indicators JSONB,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create sector_rankings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sector_rankings (
        id SERIAL PRIMARY KEY,
        rank INTEGER NOT NULL,
        sector_name VARCHAR(100) NOT NULL,
        index_symbol VARCHAR(50) NOT NULL,
        stock_count INTEGER NOT NULL DEFAULT 0,
        stocks_above_ema50 INTEGER NOT NULL DEFAULT 0,
        pct_above_ema50 NUMERIC(10, 4) NOT NULL DEFAULT 0,
        index_price NUMERIC(15, 4),
        index_ema20 NUMERIC(15, 4),
        index_ema50 NUMERIC(15, 4),
        distance_from_ema20_pct NUMERIC(10, 4),
        momentum VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Previous-day closing prices for portfolio holdings (global — same for all users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS holdings_prev_close (
        symbol    VARCHAR(30) NOT NULL,
        date      DATE        NOT NULL,
        prev_close NUMERIC(15, 4) NOT NULL,
        PRIMARY KEY (symbol, date)
      );
    `);

    // ── Idempotent migrations for existing databases ──────────────────────────
    // Add user_id to tables that existed before multi-user support.
    // ALTER TABLE ... ADD COLUMN IF NOT EXISTS is safe to run repeatedly.
    await client.query(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE position_history ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';`);

    // Migrate legacy single-user account table: if old table has an `id` column
    // (integer PK) but no user_id, we drop and recreate it. The account row is
    // auto-created per-user on first login so no data is permanently lost.
    const hasOldAccountSchema = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='account' AND column_name='id' AND data_type='integer'
      LIMIT 1;
    `);
    if (hasOldAccountSchema.rows.length > 0) {
      console.log("🔄 Migrating account table to multi-user schema...");
      await client.query("DROP TABLE IF EXISTS account CASCADE;");
      await client.query(`
        CREATE TABLE account (
          user_id TEXT PRIMARY KEY,
          total_capital NUMERIC(15, 2) NOT NULL DEFAULT 1000000,
          available_balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000,
          invested_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
          total_pnl NUMERIC(15, 2) NOT NULL DEFAULT 0,
          total_pnl_percent VARCHAR(10) NOT NULL DEFAULT '0.00',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
      CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
      CREATE INDEX IF NOT EXISTS idx_history_user ON position_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments(symbol);
      CREATE INDEX IF NOT EXISTS idx_history_closed_at ON position_history(closed_at);
      CREATE INDEX IF NOT EXISTS idx_paper_positions_symbol ON paper_positions(symbol);
      CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status);
      CREATE INDEX IF NOT EXISTS idx_scan_results_signal ON scan_results(signal);
      CREATE INDEX IF NOT EXISTS idx_scan_results_scanned_at ON scan_results(scanned_at);
      CREATE INDEX IF NOT EXISTS idx_sector_rankings_rank ON sector_rankings(rank);
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
