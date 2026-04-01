import db from "./init";
import type {
  PaperOrder,
  PaperPosition,
  PaperTradingAccount,
} from "@/lib/types";

/**
 * Get current account state from database
 */
export async function getAccount(): Promise<PaperTradingAccount> {
  const stmt = db.prepare("SELECT * FROM account WHERE id = 1");
  const row = stmt.get() as any;

  if (!row) {
    throw new Error("Account not found");
  }

  // Get positions
  const positionsStmt = db.prepare("SELECT * FROM positions");
  const positions = positionsStmt.all() as any[];

  // Get open orders
  const ordersStmt = db.prepare("SELECT * FROM orders WHERE status != 'CANCELLED'");
  const orders = ordersStmt.all() as any[];

  // Convert database rows to TypeScript types
  const mappedPositions: PaperPosition[] = positions.map((p) => ({
    id: p.id,
    symbol: p.symbol,
    quantity: p.quantity,
    entryPrice: p.entry_price,
    currentPrice: p.current_price,
    invested: p.invested,
    current: p.current,
    pnl: p.pnl,
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
    pricePerUnit: o.price_per_unit,
    totalAmount: o.total_amount,
    status: o.status,
    createdAt: o.created_at,
    filledAt: o.filled_at || undefined,
  }));

  return {
    totalCapital: row.total_capital,
    availableBalance: row.available_balance,
    investedAmount: row.invested_amount,
    totalPnl: row.total_pnl,
    totalPnlPercent: row.total_pnl_percent,
    positions: mappedPositions,
    openOrders: mappedOrders,
  };
}

/**
 * Update account balances after order
 */
export async function updateAccountBalances(
  investedAmt: number,
  totalPnl: number
): Promise<void> {
  const stmt = db.prepare(`
    UPDATE account SET 
      invested_amount = ?,
      total_pnl = ?,
      total_pnl_percent = ?,
      available_balance = total_capital - ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);

  const pnlPercent = investedAmt > 0 ? ((totalPnl / investedAmt) * 100).toFixed(2) : "0.00";
  stmt.run(investedAmt, totalPnl, pnlPercent, investedAmt);
}

/**
 * Add a new position to the database
 */
export async function addPosition(position: PaperPosition): Promise<void> {
  const stmt = db.prepare(`
    INSERT INTO positions (
      id, symbol, quantity, entry_price, current_price,
      invested, current, pnl, pnl_percent, signal_type,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
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
    position.updatedAt
  );
}

/**
 * Update an existing position's price and P&L
 */
export async function updatePositionPrice(positionId: string, currentPrice: number): Promise<void> {
  // Get current position
  const getStmt = db.prepare("SELECT * FROM positions WHERE id = ?");
  const position = getStmt.get(positionId) as any;

  if (!position) {
    throw new Error(`Position ${positionId} not found`);
  }

  // Recalculate P&L
  const current = position.quantity * currentPrice;
  const pnl = current - position.invested;
  const pnlPercent = ((pnl / position.invested) * 100).toFixed(2);

  // Update position
  const updateStmt = db.prepare(`
    UPDATE positions SET
      current_price = ?,
      current = ?,
      pnl = ?,
      pnl_percent = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  updateStmt.run(currentPrice, current, pnl, pnlPercent, positionId);
}

/**
 * Close a position and move it to history
 */
export async function closePosition(positionId: string, exitPrice: number): Promise<PaperPosition> {
  const getStmt = db.prepare("SELECT * FROM positions WHERE id = ?");
  const position = getStmt.get(positionId) as any;

  if (!position) {
    throw new Error(`Position ${positionId} not found`);
  }

  const current = position.quantity * exitPrice;
  const pnl = current - position.invested;
  const pnlPercent = ((pnl / position.invested) * 100).toFixed(2);

  // Start transaction
  const transaction = db.transaction(() => {
    // Move to history
    const insertHistoryStmt = db.prepare(`
      INSERT INTO position_history (
        id, symbol, quantity, entry_price, exit_price,
        invested, current, pnl, pnl_percent, signal_type,
        opened_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertHistoryStmt.run(
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
      new Date().toISOString()
    );

    // Delete from active positions
    const deleteStmt = db.prepare("DELETE FROM positions WHERE id = ?");
    deleteStmt.run(positionId);
  });

  transaction();

  return {
    id: positionId,
    symbol: position.symbol,
    quantity: position.quantity,
    entryPrice: position.entry_price,
    currentPrice: exitPrice,
    invested: position.invested,
    current,
    pnl,
    pnlPercent,
    signalType: position.signal_type,
    createdAt: position.created_at,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add an order to the database
 */
export async function createOrder(order: PaperOrder): Promise<void> {
  const stmt = db.prepare(`
    INSERT INTO orders (
      id, symbol, order_type, quantity, price_per_unit,
      total_amount, status, created_at, filled_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    order.id,
    order.symbol,
    order.orderType,
    order.quantity,
    order.pricePerUnit,
    order.totalAmount,
    order.status,
    order.createdAt,
    order.filledAt || null
  );
}

/**
 * Get position history (closed positions)
 */
export async function getPositionHistory(limit: number = 50): Promise<any[]> {
  const stmt = db.prepare(`
    SELECT * FROM position_history
    ORDER BY closed_at DESC
    LIMIT ?
  `);

  return stmt.all(limit) as any[];
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
  const historyStmt = db.prepare(
    "SELECT COUNT(*) as total, SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins FROM position_history"
  );
  const stats = historyStmt.get() as any;

  const total = stats?.total || 0;
  const wins = stats?.wins || 0;
  const losses = total - wins;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : "0.00";

  const profitStmt = db.prepare(
    "SELECT AVG(pnl) as avg_profit FROM position_history WHERE pnl > 0"
  );
  const lossStmt = db.prepare(
    "SELECT AVG(pnl) as avg_loss FROM position_history WHERE pnl <= 0"
  );

  const profitData = profitStmt.get() as any;
  const lossData = lossStmt.get() as any;

  return {
    totalTrades: total,
    winningTrades: wins,
    losingTrades: losses,
    winRate,
    avgProfit: profitData?.avg_profit?.toFixed(2) || "0.00",
    avgLoss: lossData?.avg_loss?.toFixed(2) || "0.00",
  };
}

/**
 * Reset account to initial state
 */
export async function resetAccount(): Promise<void> {
  const transaction = db.transaction(() => {
    // Reset account
    db.prepare(`
      UPDATE account SET
        available_balance = total_capital,
        invested_amount = 0,
        total_pnl = 0,
        total_pnl_percent = '0.00',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();

    // Clear active positions
    db.prepare("DELETE FROM positions").run();

    // Clear open orders
    db.prepare("DELETE FROM orders WHERE status != 'CANCELLED'").run();
  });

  transaction();
}

/**
 * Get open orders for a position
 */
export async function getOpenOrders(): Promise<PaperOrder[]> {
  const stmt = db.prepare("SELECT * FROM orders WHERE status = 'PENDING'");
  const orders = stmt.all() as any[];

  return orders.map((o) => ({
    id: o.id,
    symbol: o.symbol,
    orderType: o.order_type,
    quantity: o.quantity,
    pricePerUnit: o.price_per_unit,
    totalAmount: o.total_amount,
    status: o.status,
    createdAt: o.created_at,
    filledAt: o.filled_at || undefined,
  }));
}

/**
 * Insert or update instruments (stocks) in the database
 */
export async function insertInstruments(
  instruments: Array<{ symbol: string; name: string; industry?: string; weight?: number }>
): Promise<void> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO instruments (symbol, name, industry, weight, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const transaction = db.transaction(() => {
    // Clear existing instruments
    db.prepare("DELETE FROM instruments").run();

    // Insert new instruments
    for (const instrument of instruments) {
      stmt.run(
        instrument.symbol,
        instrument.name,
        instrument.industry || null,
        instrument.weight || null
      );
    }
  });

  transaction();
}

/**
 * Get all instruments from the database
 */
export async function getInstruments(): Promise<Array<{
  id: number;
  symbol: string;
  name: string;
  industry: string | null;
  weight: number | null;
}>> {
  const stmt = db.prepare("SELECT id, symbol, name, industry, weight FROM instruments ORDER BY symbol");
  return stmt.all() as Array<{
    id: number;
    symbol: string;
    name: string;
    industry: string | null;
    weight: number | null;
  }>;
}

/**
 * Get instruments by symbols
 */
export async function getInstrumentsBySymbols(symbols: string[]): Promise<Array<{
  id: number;
  symbol: string;
  name: string;
  industry: string | null;
  weight: number | null;
}>> {
  const placeholders = symbols.map(() => "?").join(",");
  const stmt = db.prepare(
    `SELECT id, symbol, name, industry, weight FROM instruments WHERE symbol IN (${placeholders}) ORDER BY symbol`
  );
  return stmt.all(...symbols) as Array<{
    id: number;
    symbol: string;
    name: string;
    industry: string | null;
    weight: number | null;
  }>;
}

/**
 * Get count of instruments in the database
 */
export async function getInstrumentCount(): Promise<number> {
  const stmt = db.prepare("SELECT COUNT(*) as count FROM instruments");
  const result = stmt.get() as any;
  return result?.count || 0;
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
