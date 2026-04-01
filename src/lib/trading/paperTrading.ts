import type {
  PaperPosition,
  PaperOrder,
  PaperTradingAccount,
  PlacePaperOrderRequest,
} from "@/lib/types";
import * as dbIndex from "@/lib/db/index";

const INITIAL_CAPITAL = 1000000; // 10 lakhs for paper trading

/**
 * Initialize or get the paper trading account from database
 * Server-side only
 */
export async function initializePaperTradingAccount(): Promise<PaperTradingAccount> {
  try {
    return await dbIndex.getAccount();
  } catch (error) {
    console.error("Error initializing paper trading account:", error);
    // Fallback account structure
    return {
      totalCapital: INITIAL_CAPITAL,
      availableBalance: INITIAL_CAPITAL,
      investedAmount: 0,
      totalPnl: 0,
      totalPnlPercent: "0.00",
      positions: [],
      openOrders: [],
    };
  }
}

/**
 * Get the current paper trading account
 */
export async function getPaperTradingAccount(): Promise<PaperTradingAccount> {
  return initializePaperTradingAccount();
}

/**
 * Place a paper trading order
 */
export async function placePaperOrder(
  account: PaperTradingAccount,
  request: PlacePaperOrderRequest
): Promise<{ success: boolean; message?: string; order?: PaperOrder; account?: PaperTradingAccount }> {
  const { symbol, orderType, quantity, pricePerUnit, signalType } = request;

  const totalAmount = quantity * pricePerUnit;

  // Check if user has sufficient balance for BUY orders
  if (orderType === "BUY") {
    if (account.availableBalance < totalAmount) {
      return {
        success: false,
        message: `Insufficient balance. Required: ₹${totalAmount.toLocaleString("en-IN")}, Available: ₹${account.availableBalance.toLocaleString("en-IN")}`,
      };
    }
  }

  try {
    // Create order
    const order: PaperOrder = {
      id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      orderType,
      quantity,
      pricePerUnit,
      totalAmount,
      status: "FILLED", // Paper trading orders are instantly filled
      createdAt: new Date().toISOString(),
      filledAt: new Date().toISOString(),
    };

    // Create order in database
    await dbIndex.createOrder(order);

    // Update positions based on order type
    let updatedAccount = { ...account };
    let totalPnl = updatedAccount.totalPnl;
    let totalInvested = updatedAccount.investedAmount;

    if (orderType === "BUY") {
      // Check if position already exists
      const existingPosition = updatedAccount.positions.find((p) => p.symbol === symbol);

      if (existingPosition) {
        // Add to existing position (average down/up)
        const newInvested = existingPosition.invested + totalAmount;
        const newQuantity = existingPosition.quantity + quantity;
        const newAvgPrice = newInvested / newQuantity;

        updatedAccount.positions = updatedAccount.positions.map((p) =>
          p.id === existingPosition.id
            ? {
                ...p,
                quantity: newQuantity,
                entryPrice: newAvgPrice,
                invested: newInvested,
                updatedAt: new Date().toISOString(),
              }
            : p
        );
      } else {
        // Create new position
        const position: PaperPosition = {
          id: `PP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          symbol,
          quantity,
          entryPrice: pricePerUnit,
          currentPrice: pricePerUnit,
          invested: totalAmount,
          current: totalAmount,
          pnl: 0,
          pnlPercent: "0.00",
          signalType: signalType || "BUY",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updatedAccount.positions.push(position);
        await dbIndex.addPosition(position);
      }

      // Deduct from available balance
      updatedAccount.availableBalance -= totalAmount;
      totalInvested += totalAmount;
    } else {
      // SELL order
      const positionIndex = updatedAccount.positions.findIndex((p) => p.symbol === symbol);

      if (positionIndex === -1) {
        return {
          success: false,
          message: `No open position for ${symbol}`,
        };
      }

      const position = updatedAccount.positions[positionIndex];

      if (position.quantity < quantity) {
        return {
          success: false,
          message: `Insufficient quantity. Have: ${position.quantity}, Trying to sell: ${quantity}`,
        };
      }

      const sellProceeds = quantity * pricePerUnit;
      const proportionalInvested = (position.invested / position.quantity) * quantity;
      const pnl = sellProceeds - proportionalInvested;

      if (position.quantity === quantity) {
        // Close entire position
        updatedAccount.positions.splice(positionIndex, 1);
        await dbIndex.closePosition(position.id, pricePerUnit);
      } else {
        // Partial sell
        const newPosition = {
          ...position,
          quantity: position.quantity - quantity,
          invested: position.invested - proportionalInvested,
          current: (position.quantity - quantity) * position.currentPrice,
          pnl: position.pnl - pnl,
          updatedAt: new Date().toISOString(),
        };
        updatedAccount.positions[positionIndex] = newPosition as PaperPosition;
        await dbIndex.updatePositionPrice(position.id, position.currentPrice);
      }

      updatedAccount.availableBalance += sellProceeds;
      totalInvested -= proportionalInvested;
      totalPnl += pnl;
    }

    // Calculate and update total P&L percent
    const totalPnlPercent = totalInvested > 0 ? ((totalPnl / totalInvested) * 100).toFixed(2) : "0.00";

    updatedAccount.investedAmount = totalInvested;
    updatedAccount.totalPnl = totalPnl;
    updatedAccount.totalPnlPercent = totalPnlPercent;

    // Update database
    await dbIndex.updateAccountBalances(totalInvested, totalPnl);

    return {
      success: true,
      message: `${orderType} order placed for ${symbol}`,
      order,
      account: updatedAccount,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error placing order",
    };
  }
}

/**
 * Update position prices (called when real-time prices update)
 */
export async function updatePaperPositionPrices(
  account: PaperTradingAccount,
  priceUpdates: Record<string, number>
): Promise<PaperTradingAccount> {
  let totalPnl = 0;
  const updatedAccount = { ...account };

  updatedAccount.positions = updatedAccount.positions.map((position) => {
    const newPrice = priceUpdates[position.symbol] || position.currentPrice;
    const newCurrent = position.quantity * newPrice;
    const newPnl = newCurrent - position.invested;

    totalPnl += newPnl;

    // Update in database (fire and forget)
    dbIndex.updatePositionPrice(position.id, newPrice).catch((error) => {
      console.error("Error updating position price:", error);
    });

    return {
      ...position,
      currentPrice: newPrice,
      current: newCurrent,
      pnl: newPnl,
      pnlPercent: position.invested > 0 ? ((newPnl / position.invested) * 100).toFixed(2) : "0.00",
    };
  });

  updatedAccount.totalPnl = totalPnl;
  updatedAccount.totalPnlPercent = updatedAccount.investedAmount > 0 
    ? ((totalPnl / updatedAccount.investedAmount) * 100).toFixed(2)
    : "0.00";

  // Update database
  try {
    await dbIndex.updateAccountBalances(updatedAccount.investedAmount, totalPnl);
  } catch (error) {
    console.error("Error updating account balances:", error);
  }

  return updatedAccount;
}

/**
 * Close a specific position
 */
export async function closePaperPosition(
  account: PaperTradingAccount,
  positionId: string,
  closePrice: number
): Promise<{
  success: boolean;
  message?: string;
  account?: PaperTradingAccount;
}> {
  const positionIndex = account.positions.findIndex((p) => p.id === positionId);

  if (positionIndex === -1) {
    return { success: false, message: "Position not found" };
  }

  try {
    const position = account.positions[positionIndex];
    const closeProceeds = position.quantity * closePrice;
    const pnl = closeProceeds - position.invested;

    const updatedAccount = { ...account };
    updatedAccount.availableBalance += closeProceeds;
    updatedAccount.investedAmount -= position.invested;
    updatedAccount.totalPnl += pnl;

    updatedAccount.totalPnlPercent = updatedAccount.investedAmount > 0
      ? ((updatedAccount.totalPnl / updatedAccount.investedAmount) * 100).toFixed(2)
      : "0.00";

    updatedAccount.positions.splice(positionIndex, 1);

    // Close position in database
    await dbIndex.closePosition(positionId, closePrice);

    // Update account balances
    await dbIndex.updateAccountBalances(updatedAccount.investedAmount, updatedAccount.totalPnl);

    return {
      success: true,
      message: `Position closed with PnL: ₹${pnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      account: updatedAccount,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error closing position",
    };
  }
}

/**
 * Reset paper trading account to initial state
 */
export async function resetPaperTradingAccount(): Promise<PaperTradingAccount> {
  try {
    await dbIndex.resetAccount();
    return {
      totalCapital: INITIAL_CAPITAL,
      availableBalance: INITIAL_CAPITAL,
      investedAmount: 0,
      totalPnl: 0,
      totalPnlPercent: "0.00",
      positions: [],
      openOrders: [],
    };
  } catch (error) {
    console.error("Error resetting account:", error);
    return {
      totalCapital: INITIAL_CAPITAL,
      availableBalance: INITIAL_CAPITAL,
      investedAmount: 0,
      totalPnl: 0,
      totalPnlPercent: "0.00",
      positions: [],
      openOrders: [],
    };
  }
}