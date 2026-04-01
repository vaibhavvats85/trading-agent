import { NextResponse } from "next/server";
import { getPaperTradingAccount } from "@/lib/trading/paperTrading";

export async function GET() {
  try {
    const account = await getPaperTradingAccount();
    return NextResponse.json({
      success: true,
      data: account,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Paper trading account error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch paper trading account",
      },
      { status: 500 }
    );
  }
}
