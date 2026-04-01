import { getClient } from "./postgres";
import type {
  PaperOrder,
  PaperPosition,
  PaperTradingAccount,
} from "@/lib/types";

/**
 * Get current account state from database
 */
export async function getAccount(): Promise<PaperTradingAccount> {
  const client = await getClient();

  try {
    const accountRes = await client.query("SELECT * FROM account WHERE id = 1");
    const row = accountRes.rows[0];

    if (!row) {
      throw new Error("Account not found");
    }

    // Get positions
    const positionsRes = await client.query("SELECT * FROM positions");
    const positions = positionsRes.rows;

    // Get open orders
    const ordersRes = await client.query(
      "SELECT * FROM orders WHERE status != $1",
      ["CANCELLED"]
    );
    const orders = ordersRes.rows;

    // Convert database rows to TypeScript types
    const mappedPositions: PaperPosition[] = positions.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      quantity: p.quantity,
      entryPrice: parseFloat(p.entry_price),
      currentPrice: parseFloat(p.current_price),
      invested: parseFloat(p.invested),
      current: parseFloat(p.current),
      pnl: parseFloat(p.pnl),
      pnlPercent: p.pnl_percent,
      signalType: p.signal_type,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const mappedOrders: PaperOrder[] = orders.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      orderType: o.order_type,
      quantity: o.quantity,
      pricePerUnit: parseFloat(o.price_per_unit),
      totalAmount: parseFloat(o.total_amount),
      status: o.status,
      createdAt: o.created_at,
      filledAt: o.filled_at || undefined,
    }));

    return {
      totalCapital: parseFloat(row.total_capital),
      availableBalance: parseFloat(row.available_balance),
      investedAmount: parseFloat(row.invested_amount),
      totalPnl: parseFloat(row.total_pnl),
      totalPnlPercent: row.total_pnl_percent,
      positions: mappedPositions,
      openOrders: mappedOrders,
    };
  } finally {
    client.release();
  }
}

/**
 * Update account balances after order
 */
export async function updateAccountBalances(
  investedAmt: number,
  totalPnl: number
): Promise<void> {
  const client = await getClient();

  try {
    const pnlPercent =
      investedAmt > 0 ? ((totalPnl / investedAmt) * 100).toFixed(2) : "0.00";

    await client.query(
      `
      UPDATE account SET 
        invested_amount = $1,
        total_pnl = $2,
        total_pnl_percent = $3,
        available_balance = total_capital - $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `,
      [investedAmt, totalPnl, pnlPercent, investedAmt]
    );
  } finally {
    client.release();
  }
}

/**
 * Add a new position to the database
 */
export async function addPosition(position: PaperPosition): Promise<void> {
  const client = await getClient();

  try {
    await client.query(
      `
      INSERT INTO positions (
        id, symbol, quantity, entry_price, current_price,
        invested, current, pnl, pnl_percent, signal_type,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        position.id,
        position.symbol,
        position.quantity,
        position.entryPrice,
        position.currentPrice,
        position.invested,
        position.current,
        position.pnl,
        position.pnlPercent,
        position.signalType,
        position.createdAt,
        position.updatedAt,
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Update an existing position's price and P&L
 */
export async function updatePositionPrice(
  positionId: string,
  currentPrice: number
): Promise<void> {
  const client = await getClient();

  try {
    // Get current position
    const getRes = await client.query("SELECT * FROM positions WHERE id = $1", [
      positionId,
    ]);
    const position = getRes.rows[0];

    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    // Recalculate P&L
    const current = position.quantity * currentPrice;
    const pnl = current - position.invested;
    const pnlPercent = ((pnl / position.invested) * 100).toFixed(2);

    // Update position
    await client.query(
      `
      UPDATE positions SET
        current_price = $1,
        current = $2,
        pnl = $3,
        pnl_percent = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [currentPrice, current, pnl, pnlPercent, positionId]
    );
  } finally {
    client.release();
  }
}

/**
 * Close a position and move it to history
 */
export async function closePosition(
  positionId: string,
  exitPrice: number
): Promise<PaperPosition> {
  const client = await getClient();

  try {
    const getRes = await client.query("SELECT * FROM positions WHERE id = $1", [
      positionId,
    ]);
    const position = getRes.rows[0];

    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const current = position.quantity * exitPrice;
    const pnl = current - position.invested;
    const pnlPercent = ((pnl / position.invested) * 100).toFixed(2);

    // Start transaction
    await client.query("BEGIN");

    try {
      // Move to history
      await client.query(
        `
        INSERT INTO position_history (
          id, symbol, quantity, entry_price, exit_price,
          invested, current, pnl, pnl_percent, signal_type,
          opened_at, closed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          `${position.id}-history`,
          position.symbol,
          position.quantity,
          position.entry_price,
          exitPrice,
          position.invested,
          current,
          pnl,
          pnlPercent,
          position.signal_type,
          position.created_at,
          new Date().toISOString(),
        ]
      );

      // Delete from active positions
      await client.query("DELETE FROM positions WHERE id = $1", [positionId]);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    return {
      id: positionId,
      symbol: position.symbol,
      quantity: position.quantity,
      entryPrice: parseFloat(position.entry_price),
      currentPrice: exitPrice,
      invested: parseFloat(position.invested),
      current,
      pnl,
      pnlPercent,
      signalType: position.signal_type,
      createdAt: position.created_at,
      updatedAt: new Date().toISOString(),
    };
  } finally {
    client.release();
  }
}

/**
 * Add an order to the database
 */
export async function createOrder(order: PaperOrder): Promise<void> {
  const client = await getClient();

  try {
    await client.query(
      `
      INSERT INTO orders (
        id, symbol, order_type, quantity, price_per_unit,
        total_amount, status, created_at, filled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        order.id,
        order.symbol,
        order.orderType,
        order.quantity,
        order.pricePerUnit,
        order.totalAmount,
        order.status,
        order.createdAt,
        order.filledAt || null,
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Get position history (closed positions)
 */
export async function getPositionHistory(limit: number = 50): Promise<any[]> {
  const client = await getClient();

  try {
    const res = await client.query(
      `
      SELECT * FROM position_history
      ORDER BY closed_at DESC
      LIMIT $1
      `,
      [limit]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Get account statistics
 */
export async function getAccountStats(): Promise<{
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: string;
  avgProfit: string;
  avgLoss: string;
}> {
  const client = await getClient();

  try {
    const statsRes = await client.query(
      `
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins 
      FROM position_history
      `
    );
    const stats = statsRes.rows[0];

    const total = parseInt(stats.total) || 0;
    const wins = parseInt(stats.wins) || 0;
    const losses = total - wins;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : "0.00";

    const profitRes = await client.query(
      `SELECT AVG(pnl) as avg_profit FROM position_history WHERE pnl > 0`
    );
    const lossRes = await client.query(
      `SELECT AVG(pnl) as avg_loss FROM position_history WHERE pnl <= 0`
    );

    const profitData = profitRes.rows[0];
    const lossData = lossRes.rows[0];

    return {
      totalTrades: total,
      winningTrades: wins,
      losingTrades: losses,
      winRate,
      avgProfit: profitData?.avg_profit?.toFixed(2) || "0.00",
      avgLoss: lossData?.avg_loss?.toFixed(2) || "0.00",
    };
  } finally {
    client.release();
  }
}

/**
 * Reset account to initial state
 */
export async function resetAccount(): Promise<void> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    try {
      // Reset account
      await client.query(
        `
        UPDATE account SET
          available_balance = total_capital,
          invested_amount = 0,
          total_pnl = 0,
          total_pnl_percent = '0.00',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `
      );

      // Clear active positions
      await client.query("DELETE FROM positions");

      // Clear open orders
      await client.query(
        "DELETE FROM orders WHERE status != $1",
        ["CANCELLED"]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

/**
 * Get open orders for a position
 */
export async function getOpenOrders(): Promise<PaperOrder[]> {
  const client = await getClient();

  try {
    const res = await client.query(
      "SELECT * FROM orders WHERE status = $1",
      ["PENDING"]
    );
    const orders = res.rows;

    return orders.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      orderType: o.order_type,
      quantity: o.quantity,
      pricePerUnit: parseFloat(o.price_per_unit),
      totalAmount: parseFloat(o.total_amount),
      status: o.status,
      createdAt: o.created_at,
      filledAt: o.filled_at || undefined,
    }));
  } finally {
    client.release();
  }
}

/**
 * Insert or update instruments (stocks) in the database
 */
export async function insertInstruments(
  instruments: Array<{ symbol: string; name: string; industry?: string; weight?: number }>
): Promise<void> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    try {
      // Clear existing instruments
      await client.query("DELETE FROM instruments");

      // Insert new instruments
      for (const instrument of instruments) {
        await client.query(
          `
          INSERT INTO instruments (symbol, name, industry, weight, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `,
          [
            instrument.symbol,
            instrument.name,
            instrument.industry || null,
            instrument.weight || null,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

/**
 * Get all instruments from the database
 */
export async function getInstruments(): Promise<
  Array<{
    id: number;
    symbol: string;
    name: string;
    industry: string | null;
    weight: number | null;
  }>
> {
  const client = await getClient();

  try {
    const res = await client.query(
      "SELECT id, symbol, name, industry, weight FROM instruments ORDER BY symbol"
    );
    return res.rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      industry: row.industry,
      weight: row.weight ? parseFloat(row.weight) : null,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get instruments by symbols
 */
export async function getInstrumentsBySymbols(
  symbols: string[]
): Promise<
  Array<{
    id: number;
    symbol: string;
    name: string;
    industry: string | null;
    weight: number | null;
  }>
> {
  const client = await getClient();

  try {
    const placeholders = symbols.map((_, i) => `$${i + 1}`).join(",");
    const res = await client.query(
      `SELECT id, symbol, name, industry, weight FROM instruments 
       WHERE symbol IN (${placeholders}) 
       ORDER BY symbol`,
      symbols
    );
    return res.rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      industry: row.industry,
      weight: row.weight ? parseFloat(row.weight) : null,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get count of instruments in the database
 */
export async function getInstrumentCount(): Promise<number> {
  const client = await getClient();

  try {
    const res = await client.query(
      "SELECT COUNT(*) as count FROM instruments"
    );
    return parseInt(res.rows[0].count) || 0;
  } finally {
    client.release();
  }
}

export default {
  getAccount,
  updateAccountBalances,
  addPosition,
  updatePositionPrice,
  closePosition,
  createOrder,
  getPositionHistory,
  getAccountStats,
  resetAccount,
  getOpenOrders,
  insertInstruments,
  getInstruments,
  getInstrumentsBySymbols,
  getInstrumentCount,
};
