import { NextRequest, NextResponse } from "next/server";
import { getSectorRankings } from "@/lib/db/service-postgres";

export async function GET(_request: NextRequest) {
  try {
    const rankings = await getSectorRankings();

    if (rankings.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No sector ranking data available. Please trigger a manual scan first.",
        data: [],
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rankings, cached: false });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Sector rank failed" },
      { status: 500 }
    );
  }
}

