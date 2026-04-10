import { NextResponse } from "next/server";
import { getKite } from "@/config/kite";
import { runMarketScan } from "@/lib/scanner/marketScan";

// Cache market scan - only needs to update once per day
let cache: { result: any; time: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    getKite(); // sync token from request header → process.env → kite singleton
    const now = Date.now();

    if (cache && now - cache.time < CACHE_DURATION) {
      return NextResponse.json({ success: true, data: cache.result, cached: true });
    }

    const result = await runMarketScan();
    cache = { result, time: now };

    return NextResponse.json({ success: true, data: result, cached: false });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Market scan failed" },
      { status: 500 }
    );
  }
}
