import { NextResponse } from "next/server";
import { getKite } from "@/config/kite";
import { runScan } from "@/lib/scanner/scan";
import { runSectorRank } from "@/lib/scanner/sectorRank";
import { updateScanResultsCache } from "@/lib/scanner/scanResultsCache";
import {
  saveScanResults,
  saveSectorRankings,
} from "@/lib/db/service-postgres";

/**
 * POST /api/scan/trigger
 * Runs a fresh scan + sector rank and persists both to the database.
 * Returns the combined results.
 */
export async function POST() {
  try {
    getKite(); // sync token from request header → process.env → kite singleton
    console.log("[TriggerScan] Starting fresh scan...");

    // Step 1: Run full scan
    const scanResults = await runScan();
    updateScanResultsCache(
      scanResults.map((r: any) => ({ symbol: r.symbol, ltp: r.ltp, ema50: r.ema50 }))
    );
    console.log(`[TriggerScan] Scan complete: ${scanResults.length} stocks`);

    // Step 2: Run sector rank using freshly scanned data
    const sectorRankInput = scanResults.map((r: any) => ({
      symbol: r.symbol,
      ltp: r.ltp,
      ema50: r.ema50,
    }));
    const sectorRankings = await runSectorRank(sectorRankInput);
    console.log(`[TriggerScan] Sector rank complete: ${sectorRankings.length} sectors`);

    // Step 3: Persist both to DB
    await saveScanResults(scanResults);
    await saveSectorRankings(sectorRankings);
    console.log("[TriggerScan] Saved scan results and sector rankings to DB");

    return NextResponse.json({
      success: true,
      scanCount: scanResults.length,
      sectorCount: sectorRankings.length,
      scanResults,
      sectorRankings,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[TriggerScan] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Trigger scan failed" },
      { status: 500 }
    );
  }
}
