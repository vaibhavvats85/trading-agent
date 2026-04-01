import { Indicators, Signal } from "@/lib/types";

/**
 * Breakout Momentum Strategy
 *
 * Entry Rules (all must be true):
 * 1. Today's close > 20-day high → breakout confirmed above consolidation ceiling
 * 2. Volume > 1.5x 20-day avg   → breakout confirmed by volume surge
 */
export function breakoutMomentumStrategy(
  ind: Indicators,
  _state: null,
  _config: any
): Signal {
  // Guard: require indicators to be computed
  if (!ind.high20 || !ind.avgVolume20) {
    return "NO TRADE";
  }

  // 1. Breakout: today's close above the 20-day high (previous 20 days, not today)
  if (ind.price <= ind.high20) return "NO TRADE";

  // 2. Volume confirmation: volume > 1.5x the 20-day average
  if (ind.volume < ind.avgVolume20 * 1.5) return "NO TRADE";

  return "BUY";
}
