import { NextResponse } from "next/server";
import { closePaperPosition, getPaperTradingAccount } from "@/lib/trading/paperTrading";
import type { ClosePaperPositionRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClosePaperPositionRequest;

    const account = await getPaperTradingAccount();
    const result = await closePaperPosition(account, body.positionId, body.currentPrice);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.account,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Close paper position error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to close paper position",
      },
      { status: 500 }
    );
  }
}
