#!/usr/bin/env ts-node
/**
 * Script to migrate data from SQLite to PostgreSQL
 * Run with: npm run migrate-to-postgres
 *
 * Make sure PostgreSQL is running and .env.postgres is configured
 */

import Database from "better-sqlite3";
import path from "path";
import { getClient, initializeDatabase } from "./src/lib/db/postgres";

const dbPath = path.join(process.cwd(), ".data", "paper-trading.db");

async function migrateData() {
  try {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║        SQLite to PostgreSQL Migration                     ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    // Initialize PostgreSQL
    console.log("🔧 Initializing PostgreSQL database...");
    await initializeDatabase();
    console.log("✓ PostgreSQL database initialized\n");

    // Open SQLite database
    console.log("📂 Opening SQLite database...");
    const sqlite = new Database(dbPath);
    console.log("✓ Connected to SQLite\n");

    // Migrate account data
    console.log("📊 Migrating account data...");
    const accounts = sqlite
      .prepare("SELECT * FROM account WHERE id = 1")
      .all() as any[];

    if (accounts.length > 0) {
      const client = await getClient();
      try {
        const account = accounts[0];
        await client.query(
          `
          INSERT INTO account (id, total_capital, available_balance, invested_amount, total_pnl, total_pnl_percent, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            total_capital = $2,
            available_balance = $3,
            invested_amount = $4,
            total_pnl = $5,
            total_pnl_percent = $6,
            updated_at = CURRENT_TIMESTAMP
          `,
          [
            account.id,
            account.total_capital,
            account.available_balance,
            account.invested_amount,
            account.total_pnl,
            account.total_pnl_percent,
            account.updated_at,
          ]
        );
        console.log("✓ Account data migrated\n");
      } finally {
        client.release();
      }
    }

    // Migrate positions
    console.log("📈 Migrating positions...");
    const positions = sqlite.prepare("SELECT * FROM positions").all() as any[];

    if (positions.length > 0) {
      const client = await getClient();
      try {
        for (const position of positions) {
          await client.query(
            `
            INSERT INTO positions (id, symbol, quantity, entry_price, current_price, invested, current, pnl, pnl_percent, signal_type, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `,
            [
              position.id,
              position.symbol,
              position.quantity,
              position.entry_price,
              position.current_price,
              position.invested,
              position.current,
              position.pnl,
              position.pnl_percent,
              position.signal_type,
              position.created_at,
              position.updated_at,
            ]
          );
        }
        console.log(`✓ ${positions.length} positions migrated\n`);
      } finally {
        client.release();
      }
    }

    // Migrate orders
    console.log("📝 Migrating orders...");
    const orders = sqlite.prepare("SELECT * FROM orders").all() as any[];

    if (orders.length > 0) {
      const client = await getClient();
      try {
        for (const order of orders) {
          await client.query(
            `
            INSERT INTO orders (id, symbol, order_type, quantity, price_per_unit, total_amount, status, signal_type, created_at, filled_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [
              order.id,
              order.symbol,
              order.order_type,
              order.quantity,
              order.price_per_unit,
              order.total_amount,
              order.status,
              order.signal_type,
              order.created_at,
              order.filled_at,
            ]
          );
        }
        console.log(`✓ ${orders.length} orders migrated\n`);
      } finally {
        client.release();
      }
    }

    // Migrate position history
    console.log("📜 Migrating position history...");
    const history = sqlite
      .prepare("SELECT * FROM position_history")
      .all() as any[];

    if (history.length > 0) {
      const client = await getClient();
      try {
        for (const record of history) {
          await client.query(
            `
            INSERT INTO position_history (id, symbol, quantity, entry_price, exit_price, invested, current, pnl, pnl_percent, signal_type, opened_at, closed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `,
            [
              record.id,
              record.symbol,
              record.quantity,
              record.entry_price,
              record.exit_price,
              record.invested,
              record.current,
              record.pnl,
              record.pnl_percent,
              record.signal_type,
              record.opened_at,
              record.closed_at,
            ]
          );
        }
        console.log(`✓ ${history.length} history records migrated\n`);
      } finally {
        client.release();
      }
    }

    // Migrate paper positions
    console.log("🏦 Migrating paper positions...");
    const paperPositions = sqlite
      .prepare("SELECT * FROM paper_positions")
      .all() as any[];

    if (paperPositions.length > 0) {
      const client = await getClient();
      try {
        for (const position of paperPositions) {
          await client.query(
            `
            INSERT INTO paper_positions (id, symbol, quantity, entry_price, invested, instrument_token, signal_type, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [
              position.id,
              position.symbol,
              position.quantity,
              position.entry_price,
              position.invested,
              position.instrument_token,
              position.signal_type,
              position.status,
              position.created_at,
              position.updated_at,
            ]
          );
        }
        console.log(`✓ ${paperPositions.length} paper positions migrated\n`);
      } finally {
        client.release();
      }
    }

    // Migrate instruments
    console.log("🔧 Migrating instruments...");
    const instruments = sqlite
      .prepare("SELECT id, symbol, name, industry, weight FROM instruments")
      .all() as any[];

    if (instruments.length > 0) {
      const client = await getClient();
      try {
        for (const instrument of instruments) {
          await client.query(
            `
            INSERT INTO instruments (id, symbol, name, industry, weight, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (symbol) DO UPDATE SET
              name = $3,
              industry = $4,
              weight = $5,
              updated_at = CURRENT_TIMESTAMP
            `,
            [
              instrument.id,
              instrument.symbol,
              instrument.name,
              instrument.industry,
              instrument.weight,
            ]
          );
        }
        console.log(`✓ ${instruments.length} instruments migrated\n`);
      } finally {
        client.release();
      }
    }

    // Close connections
    sqlite.close();

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║              Migration Summary                             ║");
    console.log("╠════════════════════════════════════════════════════════════╣");
    console.log(`║ ✓ Account data       : ${accounts.length > 0 ? "Migrated" : "Skipped"}`);
    console.log(
      `║ ✓ Positions          : ${positions.length} records migrated`
    );
    console.log(`║ ✓ Orders             : ${orders.length} records migrated`);
    console.log(
      `║ ✓ Position History   : ${history.length} records migrated`
    );
    console.log(
      `║ ✓ Paper Positions    : ${paperPositions.length} records migrated`
    );
    console.log(
      `║ ✓ Instruments        : ${instruments.length} records migrated`
    );
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log("║                                                            ║");
    console.log("║  ✅ Migration completed successfully!                     ║");
    console.log("║                                                            ║");
    console.log("║  Next steps:                                             ║");
    console.log("║  1. Update import statements to use service-postgres ║");
    console.log("║  2. Set DATABASE_TYPE=postgres in .env                 ║");
    console.log("║  3. Test your application with PostgreSQL             ║");
    console.log("║  4. Backup SQLite database: .data/paper-trading.db   ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateData();
