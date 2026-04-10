import { NextResponse } from "next/server";
import { getKite } from "@/config/kite";

export async function GET() {
  try {
    const positions = await getKite().getPositions();

    return NextResponse.json({
      success: true,
      data: positions,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Positions endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch positions",
      },
      { status: 500 }
    );
  }
}
