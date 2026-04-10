import { Candle, Indicators } from "@/lib/types";

const TEN_CRORE = 10_00_00_000; // ₹10,00,00,000

/**
 * Quote-level filter — runs BEFORE fetching historical data.
 * Only uses data available from the live quote (ltp, volume).
 * Eliminates clearly ineligible stocks early to save API calls.
 */
export interface QuoteFilterResult {
  passed: boolean;
  reason?: string;
}

export function filterByQuote(ltp: number): QuoteFilterResult {
  if (ltp < 100) {
    return { passed: false, reason: `Price ₹${ltp} < ₹100 (penny stock)` };
  }
  if (ltp > 5000) {
    return { passed: false, reason: `Price ₹${ltp} > ₹5,000 (capital heavy)` };
  }
  return { passed: true };
}

/**
 * Candle-level filter — runs AFTER fetching historical data, BEFORE computing indicators.
 *
 * Conditions:
 *   1. No gap > 5% in the last 5 candles (open vs prev close)
 *      — avoids post-earnings/news volatile stocks
 *   2. Symbol not in the upcomingEarnings set
 *      — avoids holding through result announcements
 *
 * NOTE: Kite Connect does not provide an earnings calendar API.
 * Populate upcomingEarnings from NSE corporate calendar or a third-party source.
 * Pass an empty Set (default) to disable the earnings check.
 */
export interface CandleFilterResult {
  passed: boolean;
  reason?: string;
}

export function filterByCandles(
  symbol: string,
  candles: Candle[],
  upcomingEarnings: Set<string> = new Set()
): CandleFilterResult {
  // --- Earnings check ---
  if (upcomingEarnings.has(symbol.toUpperCase())) {
    return { passed: false, reason: `${symbol} has upcoming earnings within 5 days` };
  }

  // --- Gap check: last 5 candles ---
  // Need at least 6 candles to check 5 gaps (each gap = open vs prev close)
  const lookback = candles.slice(-6);
  if (lookback.length >= 2) {
    for (let i = 1; i < lookback.length; i++) {
      const prevClose = lookback[i - 1].close;
      const currOpen = lookback[i].open;
      if (prevClose === 0) continue;
      const gapPct = Math.abs((currOpen - prevClose) / prevClose) * 100;
      if (gapPct > 5) {
        return {
          passed: false,
          reason: `Gap of ${gapPct.toFixed(1)}% on ${lookback[i].date} (prev close ₹${prevClose.toFixed(2)} → open ₹${currOpen.toFixed(2)})`,
        };
      }
    }
  }

  return { passed: true };
}

/**
 * Indicator-level filter — runs AFTER computing indicators from historical data.
 * Uses 20-day avg volume and 20-day avg turnover for the volume OR condition.
 *
 * Conditions:
 *   avgVolume20  > 5,00,000 shares
 *   OR
 *   avgTurnover20 > ₹10 crore (avg daily traded value)
 */
export interface IndicatorFilterResult {
  passed: boolean;
  reason?: string;
}

export function filterByIndicators(ind: Indicators): IndicatorFilterResult {
  const volumeOk = ind.avgVolume20 > 500_000;
  const turnoverOk = ind.avgTurnover20 > TEN_CRORE;

  if (!volumeOk && !turnoverOk) {
    return {
      passed: false,
      reason: `Low liquidity — avg vol ${Math.round(ind.avgVolume20).toLocaleString()} shares, avg turnover ₹${(ind.avgTurnover20 / 1_00_00_000).toFixed(2)} cr`,
    };
  }

  return { passed: true };
}
