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
export async function getAccount(userId: string) {
  const service = await loadDatabaseService();
  return service.getAccount(userId);
}

export async function updateAccountBalances(userId: string, investedAmt: number, totalPnl: number) {
  const service = await loadDatabaseService();
  return service.updateAccountBalances(userId, investedAmt, totalPnl);
}

export async function addPosition(userId: string, position: any) {
  const service = await loadDatabaseService();
  return service.addPosition(userId, position);
}

export async function updatePositionPrice(userId: string, positionId: string, currentPrice: number) {
  const service = await loadDatabaseService();
  return service.updatePositionPrice(userId, positionId, currentPrice);
}

export async function closePosition(userId: string, positionId: string, exitPrice: number) {
  const service = await loadDatabaseService();
  return service.closePosition(userId, positionId, exitPrice);
}

export async function createOrder(userId: string, order: any) {
  const service = await loadDatabaseService();
  return service.createOrder(userId, order);
}

export async function getPositionHistory(userId: string, limit?: number) {
  const service = await loadDatabaseService();
  return service.getPositionHistory(userId, limit);
}

export async function getAccountStats(userId: string) {
  const service = await loadDatabaseService();
  return service.getAccountStats(userId);
}

export async function resetAccount(userId: string) {
  const service = await loadDatabaseService();
  return service.resetAccount(userId);
}

export async function getOpenOrders(userId: string) {
  const service = await loadDatabaseService();
  return service.getOpenOrders(userId);
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

export async function upsertPrevCloseMap(map: Record<string, number>, date: string) {
  const service = await loadDatabaseService();
  return service.upsertPrevCloseMap(map, date);
}

export async function getPrevCloseMap(date: string): Promise<Record<string, number>> {
  const service = await loadDatabaseService();
  return service.getPrevCloseMap(date);
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
  upsertPrevCloseMap,
  getPrevCloseMap,
};
