import { KiteTicker } from "kiteconnect";
import { Tick } from "@/lib/types";

type TickCallback = (tick: Tick) => void;

let ticker: any = null;
const subscribers: Record<number, TickCallback> = {};
let pendingTokens: number[] = [];

function initWebSocket(): any {
  if (ticker) return ticker;

  ticker = new KiteTicker({
    access_token: process.env.KITE_ACCESS_TOKEN!,
    api_key: process.env.KITE_API_KEY!,
  });

  ticker.autoReconnect(true, 50, 5);

  ticker.on("connect", () => {
    console.log("✅ WebSocket connected");

    if (pendingTokens.length > 0) {
      console.log("📡 Subscribing to tokens:", pendingTokens);
      ticker.subscribe(pendingTokens);
      ticker.setMode(ticker.modeFull, pendingTokens);
    }
  });

  ticker.on("disconnect", () => {
    console.log("⚠️  WebSocket disconnected");
  });

  ticker.on("error", (error: any) => {
    console.error("❌ WebSocket error:", error);
  });

  ticker.on("reconnect", (retries: number, interval: number) => {
    console.log(`🔄 Reconnecting... attempt ${retries} in ${interval}ms`);
  });

  ticker.on("noreconnect", () => {
    console.log("❌ Max reconnection attempts reached");
  });

  ticker.on("message", (data: ArrayBuffer) => {
    console.log("📨 Raw message received, bytes:", data.byteLength);
  });

  ticker.on("ticks", (ticks: Tick[]) => {
    ticks.forEach((tick) => {
      if (subscribers[tick.instrument_token]) {
        subscribers[tick.instrument_token](tick);
      }
    });
  });

  ticker.on("order_update", (order: any) => {
    console.log("Order update:", order);
  });

  return ticker;
}

export function subscribeToTicker(
  tokens: number | number[],
  callback: TickCallback
): void {
  if (!ticker) {
    initWebSocket();
  }

  pendingTokens = Array.isArray(tokens) ? tokens : [tokens];

  pendingTokens.forEach((token) => {
    subscribers[token] = callback;
  });
}

export function connectWebSocket(): void {
  if (!ticker) {
    initWebSocket();
  }
  ticker.connect();
}

export function disconnectWebSocket(): void {
  if (ticker) {
    ticker.disconnect();
  }
}
