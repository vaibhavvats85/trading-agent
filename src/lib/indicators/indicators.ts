import { RSI, EMA, SMA } from "technicalindicators";
import { Candle, Indicators } from "@/lib/types";

export function computeIndicators(candles: Candle[]): Indicators {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  const rsi = RSI.calculate({ values: closes, period: 14 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });
  const dma10 = SMA.calculate({ values: closes, period: 10 });
  const dma50 = SMA.calculate({ values: closes, period: 50 });
  const dma200Period = Math.min(closes.length, 200);
  const dma200 = SMA.calculate({ values: closes, period: dma200Period });
  const ema20 = EMA.calculate({ values: closes, period: 20 });

  // 20-day average volume
  const avgVolume20Arr = SMA.calculate({ values: volumes, period: 20 });

  // 20-day highest close (consolidation ceiling for breakout)
  const recentCloses = closes.slice(-21, -1); // previous 20 closes (excluding today)
  const high20 = recentCloses.length > 0 ? Math.max(...recentCloses) : 0;

  // Detect pullback: price pulls back from recent high, then potentially breaks above it
  const { isPullback, pullbackHigh, pullbackLow } = detectPullback(candles, 5);

  // Find recent swing low (low point in last 10 candles)
  const recentSwingLow = Math.min(...lows.slice(-10));

  return {
    price: closes[closes.length - 1],
    rsi: rsi[rsi.length - 1] ?? 0,
    ema50: ema50[ema50.length - 1] ?? 0,
    dma10: dma10[dma10.length - 1] ?? 0,
    dma50: dma50[dma50.length - 1] ?? 0,
    dma200: dma200[dma200.length - 1] ?? 0,
    ema20: ema20[ema20.length - 1] ?? 0,
    volume: volumes[volumes.length - 1] ?? 0,
    avgVolume20: avgVolume20Arr[avgVolume20Arr.length - 1] ?? 0,
    high20,
    recentSwingLow,
    isPullback,
    pullbackHigh,
    pullbackLow,
  };
}

/**
 * Detect pullback: price recently made a high, pulled back, and is now rising again
 * This indicates a potential entry point on breakout of the pullback high
 */
function detectPullback(
  candles: Candle[],
  lookbackCandles: number
): { isPullback: boolean; pullbackHigh: number; pullbackLow: number } {
  if (candles.length < lookbackCandles + 2) {
    return {
      isPullback: false,
      pullbackHigh: 0,
      pullbackLow: 0,
    };
  }

  const recentCandles = candles.slice(-lookbackCandles);
  const closes = recentCandles.map((c) => c.close);
  const highs = recentCandles.map((c) => c.high);
  const lows = recentCandles.map((c) => c.low);

  const maxHigh = Math.max(...highs);
  const maxHighIndex = highs.indexOf(maxHigh);

  // Check if we have a pullback: high made, then lower close, then rising again
  if (maxHighIndex >= 2 && maxHighIndex < lookbackCandles - 1) {
    const pullbackClose = closes[maxHighIndex + 1];
    const currentClose = closes[closes.length - 1];

    // Pullback detected if price made a high, pulled back below it, and is rising again
    if (pullbackClose < maxHigh && currentClose > pullbackClose) {
      const pullbackLow = Math.min(...lows.slice(maxHighIndex + 1));

      return {
        isPullback: true,
        pullbackHigh: maxHigh,
        pullbackLow,
      };
    }
  }

  return {
    isPullback: false,
    pullbackHigh: 0,
    pullbackLow: 0,
  };
}
