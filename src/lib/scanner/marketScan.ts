import kite from "@/config/kite";

// Nifty 50 index instrument token on NSE
// NSE:NIFTY 50 token is 256265
const NIFTY50_TOKEN = 256265;

export type MarketSignal = "GREEN" | "RED";

export interface MarketScanResult {
  signal: MarketSignal;
  close: number;
  dma200: number;
  distancePercent: string; // how far close is from 200 DMA (+ or -)
}

export async function runMarketScan(): Promise<MarketScanResult> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 290); // fetch extra days to ensure 200 trading days

  const candles = await kite.getHistoricalData(NIFTY50_TOKEN, "day", from, to);

  if (!candles || candles.length < 150) {
    throw new Error(
      `Not enough Nifty 50 historical data. Got ${candles?.length ?? 0} candles, need at least 150.`
    );
  }

  const closes = candles.map((c: any) => c.close);
  const dmaWindow = Math.min(closes.length, 200);
  const last200Closes = closes.slice(-dmaWindow);
  const dma200 = last200Closes.reduce((sum: number, v: number) => sum + v, 0) / dmaWindow;
  const close = closes[closes.length - 1];

  const signal: MarketSignal = close > dma200 ? "GREEN" : "RED";
  const distancePercent = (((close - dma200) / dma200) * 100).toFixed(2);

  return { signal, close, dma200, distancePercent };
}
