/**
 * Database abstraction layer
 * Dynamically exports the appropriate database service based on DATABASE_TYPE environment variable
 * 
 * Usage:
 *   - For SQLite (default): No action needed, uses service.ts
 *   - For PostgreSQL: Set DATABASE_TYPE=postgres in environment, uses service-postgres.ts
 * 
 * Both services have the same interface, so no code changes are needed when switching databases
 */

type DatabaseService = typeof import("./service");

// Lazy load the database service based on environment
let dbService: DatabaseService | null = null;

async function loadDatabaseService(): Promise<DatabaseService> {
  if (dbService) {
    return dbService;
  }

  const databaseType = process.env.DATABASE_TYPE || "sqlite";

  if (databaseType === "postgres") {
    console.log("🐘 Loading PostgreSQL service...");
    dbService = await import("./service-postgres");
  } else {
    console.log("📊 Loading SQLite service...");
    dbService = await import("./service");
  }

  return dbService;
}

// Export functions that delegate to the appropriate service
export async function getAccount() {
  const service = await loadDatabaseService();
  return service.getAccount();
}

export async function updateAccountBalances(investedAmt: number, totalPnl: number) {
  const service = await loadDatabaseService();
  return service.updateAccountBalances(investedAmt, totalPnl);
}

export async function addPosition(position: any) {
  const service = await loadDatabaseService();
  return service.addPosition(position);
}

export async function updatePositionPrice(positionId: string, currentPrice: number) {
  const service = await loadDatabaseService();
  return service.updatePositionPrice(positionId, currentPrice);
}

export async function closePosition(positionId: string, exitPrice: number) {
  const service = await loadDatabaseService();
  return service.closePosition(positionId, exitPrice);
}

export async function createOrder(order: any) {
  const service = await loadDatabaseService();
  return service.createOrder(order);
}

export async function getPositionHistory(limit?: number) {
  const service = await loadDatabaseService();
  return service.getPositionHistory(limit);
}

export async function getAccountStats() {
  const service = await loadDatabaseService();
  return service.getAccountStats();
}

export async function resetAccount() {
  const service = await loadDatabaseService();
  return service.resetAccount();
}

export async function getOpenOrders() {
  const service = await loadDatabaseService();
  return service.getOpenOrders();
}

export async function insertInstruments(instruments: any[]) {
  const service = await loadDatabaseService();
  return service.insertInstruments(instruments);
}

export async function getInstruments() {
  const service = await loadDatabaseService();
  return service.getInstruments();
}

export async function getInstrumentsBySymbols(symbols: string[]) {
  const service = await loadDatabaseService();
  return service.getInstrumentsBySymbols(symbols);
}

export async function getInstrumentCount() {
  const service = await loadDatabaseService();
  return service.getInstrumentCount();
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
