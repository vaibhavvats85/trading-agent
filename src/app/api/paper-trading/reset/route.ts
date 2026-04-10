import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { resetPaperTradingAccount } from "@/lib/trading/paperTrading";

export async function POST() {
  try {
    const userId = headers().get("x-kite-user-id") ?? "";
    const account = await resetPaperTradingAccount(userId);

    return NextResponse.json({
      success: true,
      data: account,
      message: "Paper trading account reset successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Reset paper trading account error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reset paper trading account",
      },
      { status: 500 }
    );
  }
}
