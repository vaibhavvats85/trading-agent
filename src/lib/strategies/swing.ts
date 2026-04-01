import { Indicators, Signal, TradeState, StrategyConfig } from "@/lib/types";

/**
 * Final Swing Trading Strategy (Long-Only)
 * 
 * Entry Rules:
 * 1. Price > 50 EMA (uptrend confirmation)
 * 2. RSI > 55 (momentum confirmation)
 * 3. Stock has formed a pullback
 * 4. Enter on breakout above pullback high
 * 
 * Risk Management:
 * - Risk 1% of capital per trade
 * - Stop-loss below recent swing low (1R)
 * 
 * Exit Rules:
 * - At 2R target: Switch to trailing stop below 10 DMA (don't book profit)
 * - Exit when price closes below 10 DMA
 */

export function swingStrategy(
  ind: Indicators,
  tradeState: TradeState | null,
  config: StrategyConfig
): Signal {
  // Check for active trade exit conditions
  if (tradeState && tradeState.isActive) {
    return evaluateActiveTradeExit(ind, tradeState, config);
  }

  // Evaluate entry conditions
  return evaluateEntry(ind, config);
}

/**
 * Evaluate entry conditions for swing trading
 */
function evaluateEntry(
  ind: Indicators,
  config: StrategyConfig
): Signal {
  // 1. Trend filter: Price > 50 EMA
  if (ind.price <= ind.ema50) {
    return "NO TRADE"; // Not in uptrend
  }

  // 2. Momentum filter: RSI > 55
  if (ind.rsi <= config.momentumThreshold) {
    return "NO TRADE"; // Insufficient momentum
  }

  // 3. Pullback confirmation: Stock must have formed a pullback
  if (!ind.isPullback) {
    return "NO TRADE"; // No pullback detected
  }

  // 4. Entry trigger: Breakout of pullback high
  if (ind.price > ind.pullbackHigh) {
    return "BUY"; // Enter on breakout of pullback high
  }

  return "NO TRADE";
}

/**
 * Evaluate exit conditions for active trades
 */
function evaluateActiveTradeExit(
  ind: Indicators,
  tradeState: TradeState,
  config: StrategyConfig
): Signal {
  const currentProfit = ind.price - tradeState.entryPrice;
  const riskReward = currentProfit / tradeState.riskAmount;

  // Check if we've hit 2R profit target
  if (riskReward >= config.targetMultiplier) {
    // Switch to trailing stop - don't book profit yet
    if (!tradeState.trailingStop) {
      // Enable trailing stop at 10 DMA level
      tradeState.trailingStop = true;
      tradeState.trailingStopLevel = ind.dma10;
      return "NO TRADE"; // Continue holding, just switch to trailing stop
    }
  }

  // If trailing stop is active, update the trailing stop level
  if (tradeState.trailingStop && ind.dma10 > tradeState.trailingStopLevel) {
    tradeState.trailingStopLevel = ind.dma10; // Move trailing stop up with 10 DMA
  }

  // Exit rules:
  // 1. Stop-loss hit: Price closes below stop-loss
  if (ind.price < tradeState.stopLoss) {
    return "SELL"; // Exit at 1R loss
  }

  // 2. Trailing stop exit: Price closes below 10 DMA (only after 2R achieved)
  if (tradeState.trailingStop && ind.price < ind.dma10) {
    return "EXIT"; // Exit at trailing stop level (2R or higher profit)
  }

  return "NO TRADE"; // Hold position
}

/**
 * Calculate position size and stop-loss based on risk management rules
 * Risk 1% of capital per trade, with stop-loss below recent swing low (1R)
 */
export function calculatePositionSize(
  entryPrice: number,
  stopLoss: number,
  capital: number,
  riskPercentage: number = 0.01
): { shares: number; riskAmount: number } {
  const riskAmount = capital * riskPercentage; // 1% of capital
  const riskPerShare = entryPrice - stopLoss; // Distance to stop-loss = 1R

  if (riskPerShare <= 0) {
    return { shares: 0, riskAmount: 0 };
  }

  const shares = Math.floor(riskAmount / riskPerShare);

  return {
    shares,
    riskAmount,
  };
}

/**
 * Initialize a new trade position with calculated risk parameters
 */
export function initiateTrade(
  entryPrice: number,
  recentSwingLow: number,
  capital: number,
  config: StrategyConfig
): TradeState {
  const stopLoss = recentSwingLow; // Stop below recent swing low = 1R
  const riskAmount = capital * config.riskPercentage;
  const target2R = entryPrice + riskAmount * config.targetMultiplier;

  return {
    isActive: true,
    entryPrice,
    stopLoss,
    riskAmount,
    target2R,
    trailingStop: false,
    trailingStopLevel: 0,
  };
}
