import { Server as SocketIOServer } from "socket.io";
import { KiteTicker } from "kiteconnect";
import kite from "@/config/kite";
import type { Server } from "http";
import db from "@/lib/db/init";

// ============= STATE =============
let ticker: any = null;
const tickData: Record<number, any> = {};

let cachedHoldings: any[] = [];

const NIFTY50_TOKEN = 256265099;
let nifty50Data: any = null;

// ============= FUNCTIONS =============

/**
 * Fetch holdings from Kite API
 */
async function loadHoldings() {
  try {
    console.log("[DEBUG] Fetching holdings from Kite API...");
    const [holdings, positions] = await Promise.all([
      kite.getHoldings().catch((err) => {
        console.error("[DEBUG] getHoldings error:", err);
        return [];
      }),
      kite.getPositions().catch((err) => {
        console.error("[DEBUG] getPositions error:", err);
        return { net: [] } as any;
      }),
    ]);

    cachedHoldings = [...(holdings || []), ...(positions?.net || [])];
    
    // Use mock data if no real holdings
    if (cachedHoldings.length === 0) {
      console.log("[⚠️] No real holdings found, using mock data for testing...");
      cachedHoldings = [
        {
          symbol: "INFY",
          tradingsymbol: "NSE:INFY",
          instrument_token: 408065,
          quantity: 10,
          quantity_t1: 0,
          average_price: 1450.50,
          last_price: 1520.00,
          ohlc: { open: 1500, high: 1530, low: 1490, close: 1520 },
        },
        {
          symbol: "TCS",
          tradingsymbol: "NSE:TCS",
          instrument_token: 412033,
          quantity: 5,
          quantity_t1: 0,
          average_price: 3800.00,
          last_price: 3950.00,
          ohlc: { open: 3900, high: 3970, low: 3880, close: 3950 },
        },
        {
          symbol: "RELIANCE",
          tradingsymbol: "NSE:RELIANCE",
          instrument_token: 857857,
          quantity: 3,
          quantity_t1: 0,
          average_price: 2500.00,
          last_price: 2580.00,
          ohlc: { open: 2550, high: 2600, low: 2540, close: 2580 },
        },
      ];
    }
    
    console.log(`[✅] Loaded ${cachedHoldings.length} holdings:`, cachedHoldings.map(h => h.tradingsymbol || h.symbol));
    return cachedHoldings;
  } catch (err: any) {
    console.error("[❌] Holdings error:", err.message);
    return [];
  }
}

/**
 * Fetch scan results for price fallback
 */

/**
 * Build paper trading positions with real-time prices from KiteTicker
 */
async function buildPaperPositions() {
  try {
    // Get all paper trading positions from database
    const positions = db
      .prepare("SELECT * FROM paper_positions WHERE status != ?")
      .all("CLOSED") as any[];

    if (positions.length === 0) {
      return {
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Calculate P&L for each position with live prices
    const updatedPositions = positions.map((position: any) => {
      // Get live price from ticker or fallback to scan results
      let currentPrice = position.entryPrice; // Fallback to entry price

      if (position.instrumentToken && tickData[position.instrumentToken]) {
        currentPrice = tickData[position.instrumentToken].last_price || position.entryPrice;
      } else {
        // Fallback: find price from scan results
        const scanResult = cachedScanResults.find(
          (s: any) => s.symbol === position.symbol
        );
        if (scanResult) {
          currentPrice = scanResult.ltp || scanResult.price || position.entryPrice;
        }
      }

      const current = currentPrice * position.quantity;
      const pnl = current - position.invested;
      const pnlPercent =
        position.invested > 0
          ? ((pnl / position.invested) * 100).toFixed(2)
          : "0.00";

      return {
        id: position.id,
        symbol: position.symbol,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice,
        invested: position.invested,
        current,
        pnl,
        pnlPercent,
        signalType: position.signalType,
        createdAt: position.createdAt,
        updatedAt: position.updatedAt,
      };
    });

    console.log(
      `[📊] Built ${updatedPositions.length} paper positions with live prices`
    );

    return {
      success: true,
      data: updatedPositions,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[❌] Paper positions error:", err.message);
    return {
      success: false,
      data: [],
      error: err.message,
    };
  }
}

/**
 * Build portfolio data from holdings + live tick prices only (scan is manual)
 */
async function buildPortfolio() {
  // Ensure holdings are loaded
  if (!cachedHoldings.length) {
    await loadHoldings();
  }

  // Calculate portfolio using only live tick prices (no auto scan)
  const portfolio = cachedHoldings.map((h: any, idx: number) => {
    const symbol = h.tradingsymbol?.split(":").pop() || h.symbol || "UNKNOWN";
    const tick = tickData[h.instrument_token];

    // Price from live tick only
    const price = tick?.last_price || 0;
    
    // Get today's open price - check multiple fields where Kite might send it
    let open = 0;
    
    // Try tick fields first
    if (tick?.ohlc?.open) {
      open = tick.ohlc.open;
    } else if (tick?.open) {
      open = tick.open;
    } else if (tick?.open_price) {
      open = tick.open_price;
    }
    
    // If still no open, try OHLC from holdings
    if (!open && h.ohlc?.open) {
      open = h.ohlc.open;
    }
    
    // Fallback to price if no open available
    if (!open) {
      open = price;
    }

    const qty = (h.quantity || 0) + (h.quantity_t1 || 0);
    const avgPrice = parseFloat(h.average_price) || 0;

    const invested = qty * avgPrice;
    const current = qty * price;
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : "0.00";

    // Today's P&L = (current price - today's open) * quantity
    const dayPnl = qty * (price - open);
    const dayPnlPct = (open * qty) > 0 ? ((dayPnl / (open * qty)) * 100).toFixed(2) : "0.00";

    // Debug first holding
    if (idx === 0) {
      console.log(`[DEBUG] ${symbol}: price=${price}, open=${open}, dayPnl=${dayPnl}, qty=${qty}`);
      if (tick) {
        console.log(`[DEBUG] Tick data:`, JSON.stringify({ ohlc: tick.ohlc, open: tick.open, last_price: tick.last_price }));
      }
    }

    return {
      symbol,
      quantity: qty,
      avgPrice,
      currentPrice: price,
      invested,
      current,
      pnl,
      pnlPercent,
      openPrice: open,
      todayPnl: dayPnl,
      todayPnlPercent: dayPnlPct,
      instrumentToken: h.instrument_token,
    };
  });

  // Calculate summary
  const totalInvested = portfolio.reduce((s, p) => s + p.invested, 0);
  const totalCurrent = portfolio.reduce((s, p) => s + p.current, 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? ((totalPnl / totalInvested) * 100).toFixed(2) : "0.00";

  const totalDayPnl = portfolio.reduce((s, p) => s + p.todayPnl, 0);
  const totalDayOpen = portfolio.reduce((s, p) => s + p.openPrice * p.quantity, 0);
  const totalDayPnlPct = totalDayOpen > 0 ? ((totalDayPnl / totalDayOpen) * 100).toFixed(2) : "0.00";

  return {
    success: true,
    data: portfolio,
    summary: {
      totalInvested,
      totalCurrent,
      totalPnl,
      totalPnlPercent,
      totalTodayPnl: totalDayPnl,
      totalTodayPnlPercent: totalDayPnlPct,
      nifty50: nifty50Data
        ? {
            ltp: nifty50Data.last_price || 0,
            open: nifty50Data.open_price || 0,
            high: nifty50Data.high || 0,
            low: nifty50Data.low || 0,
            change: nifty50Data.change || 0,
            changePercent: nifty50Data.change_percent || 0,
          }
        : null,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Start KiteTicker websocket
 */
function startTicker(io: any) {
  if (ticker) {
    console.log("[DEBUG] Ticker already started, skipping");
    return;
  }

  console.log("[DEBUG] Creating KiteTicker instance...");
  try {
    ticker = new KiteTicker({
      api_key: process.env.KITE_API_KEY!,
      access_token: process.env.KITE_ACCESS_TOKEN!,
      userid: process.env.KITE_USER_ID,
    });
  } catch {
    console.log("[DEBUG] Creating KiteTicker without userid...");
    ticker = new KiteTicker({
      api_key: process.env.KITE_API_KEY!,
      access_token: process.env.KITE_ACCESS_TOKEN!,
    } as any);
  }

  ticker.autoReconnect(true, 10);

  ticker.on("connect", async () => {
    console.log("[✅] KiteTicker CONNECTED");

    // Load holdings on connect
    if (!cachedHoldings.length) {
      console.log("[DEBUG] No cached holdings, loading...");
      await loadHoldings();
    } else {
      console.log("[DEBUG] Holdings already cached, skipping load");
    }

    // Subscribe to all tokens
    const tokens = [
      NIFTY50_TOKEN,
      ...cachedHoldings.map((h: any) => h.instrument_token).filter(Boolean),
    ];

    if (tokens.length === 0) {
      console.log("[⚠️] No tokens to subscribe to!");
      return;
    }

    // Subscribe in batches
    console.log(`[DEBUG] Subscribing to ${tokens.length} tokens...`);
    for (let i = 0; i < tokens.length; i += 50) {
      ticker.subscribe(tokens.slice(i, i + 50));
    }

    console.log(`[✅] Subscribed to ${tokens.length} tokens`);
  });

  ticker.on("ticks", async (ticks: any[]) => {
    console.log(`[DEBUG] Received ${ticks.length} ticks`);
    
    // Update prices
    ticks.forEach((tick) => {
      tickData[tick.instrument_token] = tick;
      if (tick.instrument_token === NIFTY50_TOKEN) {
        nifty50Data = tick;
      }
    });

    // Send portfolio update
    try {
      const data = await buildPortfolio();
      console.log(`[✅] Broadcasting portfolio with ${data.data.length} holdings`);
      io.emit("portfolio-update", data);
    } catch (err: any) {
      console.error("[❌] Broadcast error:", err.message);
    }

    // Send paper trading positions update
    try {
      const paperData = await buildPaperPositions();
      if (paperData.data.length > 0) {
        console.log(`[✅] Broadcasting ${paperData.data.length} paper positions`);
        io.emit("paper-positions-update", paperData);
      }
    } catch (err: any) {
      console.error("[❌] Paper positions broadcast error:", err.message);
    }
  });

  ticker.on("disconnect", () => console.log("[⚠️] KiteTicker disconnected"));
  ticker.on("error", (err: any) => console.error("[🔴] KiteTicker error:", err));

  console.log("[DEBUG] Calling ticker.connect()...");
  ticker.connect();
}

// ============= SOCKET.IO =============

export function initializeSocket(httpServer: Server) {
  console.log("[DEBUG] Initializing Socket.IO...");
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", async (socket) => {
    console.log(`[✅] Client connected: ${socket.id}`);

    // Start ticker once
    if (!ticker) {
      console.log("[DEBUG] First client, starting ticker...");
      startTicker(io);
    } else {
      console.log("[DEBUG] Ticker already running");
    }

  // Send initial portfolio
    try {
      console.log("[DEBUG] Building initial portfolio...");
      const data = await buildPortfolio();
      console.log(`[✅] Built portfolio: ${data.data?.length || 0} holdings`);
      console.log("[DEBUG] Emitting to new client...");
      socket.emit("portfolio-update", data);
      console.log(`[✅] Emitted initial portfolio to ${socket.id}`);
    } catch (err: any) {
      console.error(`[❌] Initial portfolio error:`, err.message);
      console.error("[DEBUG] Stack:", err.stack);
      socket.emit("error", {
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    socket.on("disconnect", () => {
      console.log(`[⚠️] Client ${socket.id} disconnected`);
    });
  });

  console.log("[DEBUG] Socket.IO initialization complete");
  return io;
}

export { buildPortfolio as getPortfolioData };
