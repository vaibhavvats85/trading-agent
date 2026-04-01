import kite from "@/config/kite";
import fetchHistorical from "@/lib/data/historical";
import { computeIndicators } from "@/lib/indicators/indicators";
import { swingStrategy } from "@/lib/strategies/swing";
import { pullbackStrategy } from "@/lib/strategies/pullbackStrategy";
import { breakoutMomentumStrategy } from "@/lib/strategies/breakoutMomentum";
import { Instrument, StrategyConfig } from "@/lib/types";
import * as dbIndex from "@/lib/db/index";
import { STRATEGIES } from "@/lib/strategies/registry";

// Map strategy id -> evaluator function (add new strategies here)
const strategyEvaluators: Record<string, (ind: any, state: null, config: StrategyConfig) => string> = {
  swing: swingStrategy,
  pullback: pullbackStrategy,
  breakoutMomentum: breakoutMomentumStrategy,
};

// NIFTY 100 symbols will be loaded from database
let SYMBOLS: string[] = [];

// Default strategy configuration
const strategyConfig: StrategyConfig = {
  riskPercentage: 0.01,
  capitalPerTrade: 100000,
  targetMultiplier: 2,
  trendFilterPeriod: 50,
  momentumThreshold: 55,
  trailingStopPeriod: 10,
  lookbackCandles: 5,
};

// Rate limiting helper: Process promises with concurrency limit
async function processConcurrent<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number = 5,
  delayMs: number = 100,
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const promise = Promise.resolve()
      .then(() => processor(item))
      .then((result) => {
        results.push(result);
        return result;
      });

    executing.push(promise);

    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  await Promise.all(executing);
  return results;
}

// Cache instruments to avoid repeated API calls
let cachedInstruments: Instrument[] | null = null;
let instrumentsCacheTime = 0;
const INSTRUMENTS_CACHE_DURATION = 3600000; // Cache instruments for 1 hour

export async function runScan(): Promise<any[]> {
  // Step 1: Load NIFTY100 symbols from database
  if (SYMBOLS.length === 0) {
    try {
      const dbInstruments = await dbIndex.getInstruments();
      if (dbInstruments && dbInstruments.length > 0) {
        SYMBOLS = dbInstruments.map((inst) => inst.symbol);
        console.log(`[Instruments] Loaded ${SYMBOLS.length} NIFTY100 symbols from database`);
      } else {
        console.error("❌ [Instruments] Database is empty - NIFTY100 list not available");
        console.log("📝 Please run: npm run populate-nifty100");
        throw new Error("NIFTY100 database is empty. Run 'npm run populate-nifty100' to populate it.");
      }
    } catch (error: any) {
      console.error("❌ [Instruments] Failed to load NIFTY100 from database");
      console.log("📝 Please ensure:");
      console.log("   1. PostgreSQL is running: brew services start postgresql");
      console.log("   2. Database is populated: npm run populate-nifty100");
      throw new Error(`Cannot load NIFTY100 symbols: ${error.message}`);
    }
  }

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║        🔍 NIFTY 100 Swing Trading Scanner                ║");
  console.log("║              (Signal Generation)                          ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  console.log(`📋 Scanning ${SYMBOLS.length} NIFTY100 stocks...\n`);

  // Store results for summary
  const results: Array<{
    symbol: string;
    ltp: number;
    change: number;
    changePercent: string;
    ema50: number;
    rsi: number;
    dma10: number;
    pullback: boolean;
    signal: string;
  }> = [];

  try {
    // Step 2: Get cached NSE instruments (fetched only once per hour)
    const now = Date.now();
    if (
      !cachedInstruments ||
      now - instrumentsCacheTime >= INSTRUMENTS_CACHE_DURATION
    ) {
      cachedInstruments = await kite.getInstruments("NSE");
      instrumentsCacheTime = now;
      console.log(`[Instruments] Fetched NSE instruments (${cachedInstruments?.length || 0} total)`);
    } else {
      console.log("[Instruments] Using cached NSE instruments");
    }

    // Step 3: Build token map for ONLY NIFTY100 stocks
    const nifty100TokenMap: Record<string, number> = {};
    if (cachedInstruments) {
      cachedInstruments.forEach((inst) => {
        if (SYMBOLS.includes(inst.tradingsymbol)) {
          nifty100TokenMap[inst.tradingsymbol] = inst.instrument_token;
        }
      });
    }

    if (Object.keys(nifty100TokenMap).length === 0) {
      throw new Error("No NIFTY100 instruments found in NSE list");
    }

    console.log(`📡 Fetching quotes for ${SYMBOLS.length} NIFTY100 stocks only...\n`);

    // Step 4: Fetch quotes for ONLY NIFTY100 tokens with rate limiting
    const nifty100Tokens = Object.values(nifty100TokenMap);
    const batchSize = 25; // Smaller batches to avoid rate limiting
    const quotesMap: Record<number, any> = {};

    for (let i = 0; i < nifty100Tokens.length; i += batchSize) {
      const batch = nifty100Tokens.slice(i, i + batchSize);
      const quotesResponse: any = await kite.getQuote(batch);

      // Parse quotes response
      let quotesArray: any[] = [];

      if (Array.isArray(quotesResponse)) {
        quotesArray = quotesResponse;
      } else if (quotesResponse?.data) {
        quotesArray = Object.values(quotesResponse.data);
      } else {
        quotesArray = Object.values(quotesResponse || {});
      }

      // Map quotes by token
      quotesArray.forEach((quote: any) => {
        quotesMap[quote.instrument_token] = quote;
      });

      // Add delay between batches to respect rate limits
      if (i + batchSize < nifty100Tokens.length) {
        console.log(`  ├─ Fetched quotes for ${Math.min(i + batchSize, nifty100Tokens.length)}/${nifty100Tokens.length}`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay between batches
      }
    }

    console.log(`✅ Retrieved quotes for ${Object.keys(quotesMap).length} NIFTY100 stocks\n`);

    // Step 5: Fetch historical data with concurrency limit
    const historicalDataResults = await processConcurrent(
      Object.entries(nifty100TokenMap),
      async ([sym, token]) => ({
        symbol: sym,
        token,
        data: await fetchHistorical(token),
      }),
      3, // Max 3 concurrent historical data requests
      200, // 200ms delay between batches
    );

    // Step 6: Process results
    for (const {
      symbol,
      token,
      data: historicalData,
    } of historicalDataResults) {
      try {
        // Get quote from NIFTY100 quotes
        const quote = quotesMap[token];
        if (!quote) {
          console.error(`⚠️  No quote data for ${symbol}`);
          continue;
        }

        const ltp = quote.last_price || 0;
        const ohlc = quote.ohlc || { open: 0, high: 0, low: 0, close: 0 };

        // Compute indicators
        const ind = computeIndicators(historicalData);

        // Generate signal using all registered strategies
        const strategySignals = STRATEGIES.map((s) => {
          const evaluator = strategyEvaluators[s.id];
          const sig = evaluator ? evaluator(ind, null, strategyConfig) : "NO TRADE";
          return { strategyId: s.id, strategyName: s.name, signal: sig as any };
        });

        // Overall signal: BUY if any strategy says BUY, otherwise NO TRADE
        const signal = strategySignals.some((s) => s.signal === "BUY") ? "BUY" : "NO TRADE";

        // Calculate change
        const open = ohlc.open || 0;
        const change = ltp - open;
        const changePercent =
          open > 0 ? ((change / open) * 100).toFixed(2) : "0.00";

        const result = {
          symbol,
          ltp,
          change,
          changePercent,
          ema50: ind.ema50,
          rsi: ind.rsi,
          dma10: ind.dma10,
          pullback: ind.isPullback,
          signal,
          strategySignals,
          indicators: ind,
        };

        console.log(
          `✓ ${symbol.padEnd(12)} - LTP: ₹${String(ltp).padEnd(8)} | Signal: ${signal === "BUY" ? "🟢 BUY" : "⭐ " + signal}`,
        );
        results.push(result);
      } catch (error) {
        console.error(`❌ Error processing ${symbol}:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Error fetching quotes:`, error);
    throw error;
  }

  // Sort results by Signal (BUY first, then NO TRADE)
  results.sort((a, b) => {
    if (a.signal === "BUY" && b.signal !== "BUY") return -1;
    if (a.signal !== "BUY" && b.signal === "BUY") return 1;
    return 0;
  });

  console.log(
    "\n╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║ SCAN SUMMARY                                                                                         ║",
  );
  console.log(
    "╠════════════╦═══════════╦═════════╦═════════╦═══════╦═════╦═══════╦═══════════╦════════════════════════╣",
  );
  console.log(
    "║ Symbol     ║ LTP       ║ Change  ║ Change% ║ EMA50 ║ RSI ║ DMA10 ║ Pullback  ║ Signal               ║",
  );
  console.log(
    "╠════════════╬═══════════╬═════════╬═════════╬═══════╬═════╬═══════╬═══════════╬════════════════════════╣",
  );

  for (const result of results) {
    const signalDisplay = result.signal === "BUY" ? "🟢 BUY  " : "⭐ NO TRADE";
    const pullbackDisplay = result.pullback ? "YES" : "NO ";
    console.log(
      `║ ${result.symbol.padEnd(10)} ║ ${String(result.ltp).padEnd(9)} ║ ${String(result.change.toFixed(2)).padEnd(7)} ║ ${String(result.changePercent).padEnd(7)} ║ ${String(result.ema50.toFixed(0)).padEnd(5)} ║ ${String(result.rsi.toFixed(0)).padEnd(3)} ║ ${String(result.dma10.toFixed(0)).padEnd(5)} ║ ${pullbackDisplay.padEnd(9)} ║ ${signalDisplay.padEnd(20)} ║`,
    );
  }

  console.log(
    "╚════════════╩═══════════╩═════════╩═════════╩═══════╩═════╩═══════╩═══════════╩════════════════════════╝",
  );

  // Count signals
  const buySignals = results.filter((r) => r.signal === "BUY").length;
  console.log(`\n📊 Scan Results:`);
  console.log(`   • Total Stocks Scanned: ${results.length}`);
  console.log(`   • 🟢 BUY Signals: ${buySignals}`);
  console.log(`   • ⭐ NO TRADE: ${results.length - buySignals}`);

  if (buySignals > 0) {
    console.log(`\n🎯 Stocks with BUY signals:`);
    results
      .filter((r) => r.signal === "BUY")
      .forEach((r) => {
        console.log(
          `   • ${r.symbol.padEnd(12)} - LTP: ₹${r.ltp.toFixed(2)}, RSI: ${r.rsi.toFixed(1)}, EMA50: ₹${r.ema50.toFixed(2)}`,
        );
      });
  }

  console.log("✅ Scan complete!");
  return results;
}
