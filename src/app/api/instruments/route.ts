import { NextResponse } from "next/server";
import * as dbIndex from "@/lib/db/index";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get("symbols");

    let instruments;

    if (symbols) {
      // Fetch specific instruments by symbols
      const symbolList = symbols.split(",").map((s) => s.trim().toUpperCase());
      instruments = await dbIndex.getInstrumentsBySymbols(symbolList);
    } else {
      // Fetch all instruments
      instruments = await dbIndex.getInstruments();
    }

    return NextResponse.json({
      success: true,
      count: instruments.length,
      data: instruments,
    });
  } catch (error) {
    console.error("Error fetching instruments:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch instruments",
      },
      { status: 500 }
    );
  }
}
