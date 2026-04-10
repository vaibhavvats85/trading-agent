import { NextRequest, NextResponse } from "next/server";
import { getScanResults } from "@/lib/db/service-postgres";
import { filterToTopSectors } from "@/lib/scanner/sectorRank";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filterSectors = searchParams.get("filterSectors") === "true";

    let results = await getScanResults();

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No scan data available. Please trigger a manual scan first.",
        data: [],
      }, { status: 404 });
    }

    if (filterSectors) {
      const topSymbols = await filterToTopSectors(
        results.map((r: any) => ({ symbol: r.symbol, ltp: r.ltp, ema50: r.ema50 }))
      );
      if (topSymbols.size > 0) {
        results = results.filter((r: any) => topSymbols.has(r.symbol));
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
      cached: false,
      filtered: filterSectors,
    });
  } catch (error: any) {
    console.error("[API] Scan GET error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

