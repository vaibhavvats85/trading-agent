import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scanner/scan";
import { DEFAULT_STRATEGY } from "@/lib/strategies/registry";

// Per-strategy cache
const scanCache: Record<string, { results: any[]; time: number }> = {};
const SCAN_CACHE_DURATION = 30000; // Cache for 30 seconds

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fresh = searchParams.get("fresh") === "true";
    const strategy = searchParams.get("strategy") || DEFAULT_STRATEGY;
    const now = Date.now();

    const cache = scanCache[strategy];
    let results = cache?.results ?? [];

    // Force fresh scan if requested or cache expired
    if (fresh || !cache || now - cache.time > SCAN_CACHE_DURATION) {
      try {
        results = await runScan();
        scanCache[strategy] = { results, time: now };
        console.log(`[API] Fresh scan [${strategy}]: ${results.length} stocks`);
      } catch (scanError: any) {
        console.error(`[API] Scan error [${strategy}]: ${scanError.message}`);
        if (!results.length) {
          // Return error if no cache available
          return NextResponse.json(
            {
              success: false,
              error: `Scan temporarily unavailable: ${scanError.message}`,
              cached: false,
            },
            { status: 503 }
          );
        }
        // Use cached results as fallback
        console.log(`[API] Returning cached results as fallback`);
      }
    } else {
      const remainingSeconds = Math.round(
        (SCAN_CACHE_DURATION - (now - cache.time)) / 1000
      );
      console.log(`[API] Returning cached scan [${strategy}] (${remainingSeconds}s remaining)`);
    }

    return NextResponse.json({
      strategy,
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
      cached: !!(cache && now - cache.time <= SCAN_CACHE_DURATION),
    });
  } catch (error: any) {
    console.error("[API] Scan endpoint error:", error);
    const errorMessage = error?.message || "Internal server error";
    
    // Return proper JSON error response
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
