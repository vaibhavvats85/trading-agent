import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { placePaperOrder, getPaperTradingAccount } from "@/lib/trading/paperTrading";
import type { PlacePaperOrderRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlacePaperOrderRequest;
    const userId = headers().get("x-kite-user-id") ?? "";

    const account = await getPaperTradingAccount(userId);
    const result = await placePaperOrder(userId, account, body);

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
