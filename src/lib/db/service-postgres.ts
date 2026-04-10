import { getClient } from "./postgres";
import type {
  PaperOrder,
  PaperPosition,
  PaperTradingAccount,
  ScanResult,
} from "@/lib/types";
import type { SectorRankResult } from "@/lib/scanner/sectorRank";

/**
 * Get current account state for a specific user.
 * Auto-creates a default ₹10L account on first login.
 */
export async function getAccount(userId: string): Promise<PaperTradingAccount> {
  const client = await getClient();

  try {
    // Upsert: create default account row on first login
    await client.query(
      `INSERT INTO account (user_id, total_capital, available_balance)
       VALUES ($1, 1000000, 1000000)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const accountRes = await client.query(
      "SELECT * FROM account WHERE user_id = $1",
      [userId]
    );
    const row = accountRes.rows[0];

    // Get positions
    const positionsRes = await client.query(
      "SELECT * FROM positions WHERE user_id = $1",
      [userId]
    );
    const positions = positionsRes.rows;

    // Get open orders
    const ordersRes = await client.query(
      "SELECT * FROM orders WHERE user_id = $1 AND status != $2",
      [userId, "CANCELLED"]
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
  userId: string,
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
      WHERE user_id = $5
      `,
      [investedAmt, totalPnl, pnlPercent, investedAmt, userId]
    );
  } finally {
    client.release();
  }
}

/**
 * Add a new position to the database
 */
export async function addPosition(userId: string, position: PaperPosition): Promise<void> {
  const client = await getClient();

  try {
    await client.query(
      `
      INSERT INTO positions (
        id, user_id, symbol, quantity, entry_price, current_price,
        invested, current, pnl, pnl_percent, signal_type,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        position.id,
        userId,
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
  userId: string,
  positionId: string,
  currentPrice: number
): Promise<void> {
  const client = await getClient();

  try {
    // Get current position
    const getRes = await client.query(
      "SELECT * FROM positions WHERE id = $1 AND user_id = $2",
      [positionId, userId]
    );
    const position = getRes.rows[0];

    if (!position) {
      throw new Error(`Position ${positionId} not found for user ${userId}`);
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
      WHERE id = $5 AND user_id = $6
      `,
      [currentPrice, current, pnl, pnlPercent, positionId, userId]
    );
  } finally {
    client.release();
  }
}

/**
 * Close a position and move it to history
 */
export async function closePosition(
  userId: string,
  positionId: string,
  exitPrice: number
): Promise<PaperPosition> {
  const client = await getClient();

  try {
    const getRes = await client.query(
      "SELECT * FROM positions WHERE id = $1 AND user_id = $2",
      [positionId, userId]
    );
    const position = getRes.rows[0];

    if (!position) {
      throw new Error(`Position ${positionId} not found for user ${userId}`);
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
          id, user_id, symbol, quantity, entry_price, exit_price,
          invested, current, pnl, pnl_percent, signal_type,
          opened_at, closed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          `${position.id}-history`,
          userId,
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
      await client.query("DELETE FROM positions WHERE id = $1 AND user_id = $2", [positionId, userId]);

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
export async function createOrder(userId: string, order: PaperOrder): Promise<void> {
  const client = await getClient();

  try {
    await client.query(
      `
      INSERT INTO orders (
        id, user_id, symbol, order_type, quantity, price_per_unit,
        total_amount, status, created_at, filled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        order.id,
        userId,
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
export async function getPositionHistory(userId: string, limit: number = 50): Promise<any[]> {
  const client = await getClient();

  try {
    const res = await client.query(
      `
      SELECT * FROM position_history
      WHERE user_id = $1
      ORDER BY closed_at DESC
      LIMIT $2
      `,
      [userId, limit]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Get account statistics
 */
export async function getAccountStats(userId: string): Promise<{
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
      WHERE user_id = $1
      `,
      [userId]
    );
    const stats = statsRes.rows[0];

    const total = parseInt(stats.total) || 0;
    const wins = parseInt(stats.wins) || 0;
    const losses = total - wins;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : "0.00";

    const profitRes = await client.query(
      `SELECT AVG(pnl) as avg_profit FROM position_history WHERE user_id = $1 AND pnl > 0`,
      [userId]
    );
    const lossRes = await client.query(
      `SELECT AVG(pnl) as avg_loss FROM position_history WHERE user_id = $1 AND pnl <= 0`,
      [userId]
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
export async function resetAccount(userId: string): Promise<void> {
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
        WHERE user_id = $1
        `,
        [userId]
      );

      // Clear active positions
      await client.query("DELETE FROM positions WHERE user_id = $1", [userId]);

      // Clear open orders
      await client.query(
        "DELETE FROM orders WHERE user_id = $1 AND status != $2",
        [userId, "CANCELLED"]
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
export async function getOpenOrders(userId: string): Promise<PaperOrder[]> {
  const client = await getClient();

  try {
    const res = await client.query(
      "SELECT * FROM orders WHERE user_id = $1 AND status = $2",
      [userId, "PENDING"]
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

/**
 * Save scan results to DB (replaces all existing rows)
 */
export async function saveScanResults(results: ScanResult[]): Promise<void> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM scan_results");
    for (const r of results) {
      await client.query(
        `INSERT INTO scan_results
          (symbol, industry, ltp, change_amount, change_percent, ema50, rsi, dma10, pullback, signal, strategy_signals, indicators, scanned_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
        [
          r.symbol,
          r.industry ?? null,
          r.ltp,
          r.change,
          r.changePercent,
          r.ema50,
          r.rsi,
          r.dma10,
          r.pullback,
          r.signal,
          JSON.stringify(r.strategySignals ?? []),
          JSON.stringify(r.indicators ?? {}),
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch latest scan results from DB
 */
export async function getScanResults(): Promise<ScanResult[]> {
  const client = await getClient();
  try {
    const res = await client.query(
      "SELECT * FROM scan_results ORDER BY signal DESC, symbol ASC"
    );
    return res.rows.map((r) => ({
      symbol: r.symbol,
      industry: r.industry ?? undefined,
      ltp: parseFloat(r.ltp),
      change: parseFloat(r.change_amount),
      changePercent: r.change_percent,
      ema50: parseFloat(r.ema50),
      rsi: parseFloat(r.rsi),
      dma10: parseFloat(r.dma10),
      pullback: r.pullback,
      signal: r.signal,
      strategySignals: r.strategy_signals ?? [],
      indicators: r.indicators ?? {},
    })) as ScanResult[];
  } finally {
    client.release();
  }
}

/**
 * Save sector rankings to DB (replaces all existing rows)
 */
export async function saveSectorRankings(rankings: SectorRankResult[]): Promise<void> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM sector_rankings");
    for (const s of rankings) {
      await client.query(
        `INSERT INTO sector_rankings
          (rank, sector_name, index_symbol, stock_count, stocks_above_ema50, pct_above_ema50,
           index_price, index_ema20, index_ema50, distance_from_ema20_pct, momentum, scanned_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
        [
          s.rank,
          s.sectorName,
          s.indexSymbol,
          s.stockCount,
          s.stocksAboveEma50,
          s.pctAboveEma50,
          s.indexPrice,
          s.indexEma20,
          s.indexEma50,
          s.distanceFromEma20Pct,
          s.momentum,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch latest sector rankings from DB
 */
export async function getSectorRankings(): Promise<SectorRankResult[]> {
  const client = await getClient();
  try {
    const res = await client.query("SELECT * FROM sector_rankings ORDER BY rank ASC");
    return res.rows.map((r) => ({
      rank: r.rank,
      sectorName: r.sector_name,
      indexSymbol: r.index_symbol,
      stockCount: r.stock_count,
      stocksAboveEma50: r.stocks_above_ema50,
      pctAboveEma50: parseFloat(r.pct_above_ema50),
      indexPrice: r.index_price !== null ? parseFloat(r.index_price) : null,
      indexEma20: r.index_ema20 !== null ? parseFloat(r.index_ema20) : null,
      indexEma50: r.index_ema50 !== null ? parseFloat(r.index_ema50) : null,
      distanceFromEma20Pct:
        r.distance_from_ema20_pct !== null ? parseFloat(r.distance_from_ema20_pct) : null,
      momentum: r.momentum,
    })) as SectorRankResult[];
  } finally {
    client.release();
  }
}

/**
 * Get the timestamp of the most recent scan
 */
export async function getLastScanTimestamp(): Promise<Date | null> {
  const client = await getClient();
  try {
    const res = await client.query(
      "SELECT MAX(scanned_at) AS last_scanned FROM scan_results"
    );
    const ts = res.rows[0]?.last_scanned;
    return ts ? new Date(ts) : null;
  } finally {
    client.release();
  }
}

/**
 * Upsert previous-day closing prices for a set of symbols.
 * @param map  symbol → prevClose
 * @param date ISO date string, e.g. "2026-04-10"
 */
export async function upsertPrevCloseMap(
  map: Record<string, number>,
  date: string
): Promise<void> {
  if (Object.keys(map).length === 0) return;
  const client = await getClient();
  try {
    for (const [symbol, prevClose] of Object.entries(map)) {
      await client.query(
        `INSERT INTO holdings_prev_close (symbol, date, prev_close)
         VALUES ($1, $2, $3)
         ON CONFLICT (symbol, date) DO UPDATE SET prev_close = EXCLUDED.prev_close`,
        [symbol, date, prevClose]
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Return { symbol → prevClose } for the given date.
 * Returns an empty object if no data exists for that date.
 */
export async function getPrevCloseMap(date: string): Promise<Record<string, number>> {
  const client = await getClient();
  try {
    const res = await client.query(
      "SELECT symbol, prev_close FROM holdings_prev_close WHERE date = $1",
      [date]
    );
    return Object.fromEntries(
      res.rows.map((r: any) => [r.symbol, parseFloat(r.prev_close)])
    );
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
  saveScanResults,
  getScanResults,
  saveSectorRankings,
  getSectorRankings,
  getLastScanTimestamp,
  upsertPrevCloseMap,
  getPrevCloseMap,
};
