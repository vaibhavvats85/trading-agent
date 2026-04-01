import { NextResponse } from "next/server";
import { placePaperOrder, getPaperTradingAccount } from "@/lib/trading/paperTrading";
import type { PlacePaperOrderRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlacePaperOrderRequest;

    const account = await getPaperTradingAccount();
    const result = await placePaperOrder(account, body);

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
      data: {
        order: result.order,
        account: result.account,
      },
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Place paper order error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to place paper order",
      },
      { status: 500 }
    );
  }
}
