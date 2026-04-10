import { NextResponse } from "next/server";
import { getKite } from "@/config/kite";
import { isMarketOpen } from "@/lib/utils/marketHours";

export async function GET() {
  try {
    const kite = getKite();
    const marketOpen = isMarketOpen();

    let holdings, positions;

    if (marketOpen) {
      // Market is open: fetch both holdings and T1 positions for live data
      [holdings, positions] = await Promise.all([
        kite.getHoldings(),
        kite.getPositions().catch(() => ({ net: [] } as any)),
      ]);
    } else {
      // Market is closed: fetch only holdings from Kite API
      console.log("[API] Market closed - fetching holdings only");
      holdings = await kite.getHoldings();
      positions = { net: [] }; // No T1 positions when market is closed
    }

    // Merge holdings with T1 positions (only if market is open)
    let allPositions = [...holdings];

    if (positions && positions.net && marketOpen) {
      positions.net.forEach((pos: any) => {
        const existingIndex = allPositions.findIndex(
          (h) =>
            h.tradingsymbol === pos.tradingsymbol ||
            h.symbol === pos.tradingsymbol
        );

        if (existingIndex === -1) {
          allPositions.push({
            tradingsymbol: pos.tradingsymbol,
            symbol: pos.symbol,
            quantity: pos.quantity,
            average_price: pos.average_price,
            last_price: pos.last_price,
            instrument_token: pos.instrument_token,
            t1_quantity: pos.quantity,
          });
        }
      });
    }

    // Transform holdings data
    const portfolioData = allPositions.map((holding: any) => {
      const symbol = holding.tradingsymbol
        ? holding.tradingsymbol.split(":").pop()
        : holding.symbol;

      const regularQty = holding.quantity || 0;
      const t1Qty = holding.quantity_t1 || 0;
      const quantity = regularQty + t1Qty;

      const avgPrice = parseFloat(holding.average_price) || 0;
      const currentPrice = parseFloat(holding.last_price) || avgPrice;

      const invested = quantity * avgPrice;
      const current = quantity * currentPrice;
      const pnl = current - invested;
      const pnlPercent = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : "0.00";

      return {
        symbol,
        quantity,
        avgPrice,
        currentPrice,
        invested,
        current,
        pnl,
        pnlPercent,
        instrumentToken: holding.instrument_token,
      };
    });

    return NextResponse.json({
      success: true,
      data: portfolioData,
      marketStatus: marketOpen ? "open" : "closed",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API] Holdings endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch holdings",
      },
      { status: 500 }
    );
  }
}
