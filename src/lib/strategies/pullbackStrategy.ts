import { Indicators, Signal } from "@/lib/types";

/**
 * Pullback Strategy
 *
 * Entry Rules (all must be true):
 * 1. Close > 200 DMA  → uptrend confirmed
 * 2. Close > 50 DMA   → medium-term trend intact
 * 3. Close within 2% of 20 EMA → pullback is happening
 * 4. Volume < 20-day avg → quiet pullback (healthy, not panic)
 */
export function pullbackStrategy(
  ind: Indicators,
  _state: null,
  _config: any
): Signal {
  // Guard: require indicators to be computed (need at least 200 candles)
  if (!ind.dma200 || !ind.dma50 || !ind.ema20 || !ind.avgVolume20) {
    return "NO TRADE";
  }

  // 1. Uptrend: price above 200 DMA
  if (ind.price <= ind.dma200) return "NO TRADE";

  // 2. Medium trend: price above 50 DMA
  if (ind.price <= ind.dma50) return "NO TRADE";

  // 3. Pullback: close within 2% of 20 EMA (above or below)
  const distanceFromEma20 = Math.abs(ind.price - ind.ema20) / ind.ema20;
  if (distanceFromEma20 > 0.02) return "NO TRADE";

  // 4. Quiet pullback: volume below 20-day average
  if (ind.volume >= ind.avgVolume20) return "NO TRADE";

  return "BUY";
}
