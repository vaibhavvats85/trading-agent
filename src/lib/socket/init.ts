import { Server as SocketIOServer } from "socket.io";
import { KiteTicker } from "kiteconnect";
import kite from "@/config/kite";
import type { Server } from "http";
import * as dbIndex from "@/lib/db/index";
import { getLastScanResults } from "@/lib/scanner/scanResultsCache";
import { clearTokens } from "@/lib/auth/tokenStore";

// ============= STATE =============
let ticker: any = null;
/** Prevents handleTokenExpiry firing multiple times from stale ticker listeners */
let authExpiredHandled = false;
const tickData: Record<number, any> = {};

let cachedHoldings: any[] = [];

/** symbol → instrument_token, built from holdings + resolved for paper positions */
const paperSymbolTokenMap: Record<string, number> = {};

/** Maps socketId → kite_user_id so ticks can emit per-user paper positions */
const socketUserMap = new Map<string, string>();

const NIFTY50_TOKEN = 256265099;
let nifty50Data: any = null;

/**
 * symbol → previous day's closing price.
 * Populated once per calendar day from the DB or Kite OHLC API.
 */
const prevCloseMap: Record<string, number> = {};

// ============= FUNCTIONS =============

/**
 * Load or fetch previous-day closing prices for all current holdings.
 *
 * Strategy:
 *  1. If DB already has records for today → use them (fast path).
 *  2. Otherwise call Kite OHLC for all holding tokens, extract ohlc.close
 *     (Kite always returns yesterday’s close in this field), persist, and cache.
 */
async function loadPrevClose(): Promise<void> {
  if (cachedHoldings.length === 0) return;

  // Use IST date (UTC+5:30) so the cache key matches the Indian market day,
  // not UTC which can be a different calendar date before 05:30 IST.
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const today = istNow.toISOString().split("T")[0]; // "YYYY-MM-DD" in IST

  // Try DB first
  const stored = await dbIndex.getPrevCloseMap(today).catch(() => ({}));
  if (Object.keys(stored).length > 0) {
    Object.assign(prevCloseMap, stored);
    console.log(`[✅] Loaded ${Object.keys(stored).length} prevClose values from DB for ${today}`);
    return;
  }

  // Extract close_price directly from holdings — official NSE previous-day close.
  // Kite's getHoldings() returns `close_price` which is the VWAP-based official
  // NSE closing price, exactly what Kite's own app uses. No extra API call needed.
  const freshMap: Record<string, number> = {};
  cachedHoldings.forEach((h: any) => {
    const symbol = h.tradingsymbol?.split(":").pop() || h.symbol;
    const closePrice = parseFloat(h.close_price ?? h.last_price ?? 0);
    if (symbol && closePrice > 0) {
      freshMap[symbol] = closePrice;
      prevCloseMap[symbol] = closePrice;
    }
  });

  if (Object.keys(freshMap).length > 0) {
    await dbIndex.upsertPrevCloseMap(freshMap, today).catch(console.error);
    console.log(`[OK] Stored ${Object.keys(freshMap).length} prevClose values from holdings for ${today}`);
  }
}

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
async function buildPaperPositions(userId: string) {
  try {
    // Use the DB abstraction layer — works for both SQLite and PostgreSQL
    const account = await dbIndex.getAccount(userId);
    const positions = account.positions;

    if (positions.length === 0) {
      return {
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      };
    }

    const { results: scanResults } = getLastScanResults();

    // Calculate P&L for each position with live prices
    const updatedPositions = positions.map((position: any) => {
      let currentPrice = position.entryPrice; // Fallback to entry price

      // 1. Try live tick via symbol→token map
      const token = paperSymbolTokenMap[position.symbol];
      if (token && tickData[token]) {
        currentPrice = tickData[token].last_price || position.entryPrice;
      } else {
        // 2. Fallback: scan results cache
        const scanResult = scanResults.find(
          (s: any) => s.symbol === position.symbol
        );
        if (scanResult) {
          currentPrice = scanResult.ltp || position.entryPrice;
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

    // Detect stocks bought today using Kite's position fields.
    // - Items from getHoldings() have `close_price` but no `overnight_quantity`.
    // - Items from getPositions() have `overnight_quantity`:
    //     0  → position opened today (no overnight carry) → today's P&L = total P&L
    //    >0  → carried from a previous session        → use close_price as baseline
    const boughtToday =
      typeof h.overnight_quantity !== "undefined" && h.overnight_quantity === 0;

    let dayPnl: number;
    let dayPnlPct: string;
    let prevClose: number;

    if (boughtToday) {
      dayPnl = Math.round(pnl * 100) / 100;
      dayPnlPct = pnlPercent;
      prevClose = avgPrice; // logical baseline for a same-day purchase
    } else {
      // Today's P&L = (currentPrice − prevClose) × quantity
      prevClose = prevCloseMap[symbol] ?? open; // fall back to open if prevClose not yet loaded
      dayPnl = Math.round((price - prevClose) * qty * 100) / 100;
      dayPnlPct = prevClose > 0 ? (((price - prevClose) / prevClose) * 100).toFixed(2) : "0.00";
    }

    // Debug first holding
    if (idx === 0) {
      console.log(`[DEBUG] ${symbol}: price=${price}, open=${open}, dayPnl=${dayPnl}, qty=${qty}`);
      if (tick) {
        console.log(`[DEBUG] Tick data:`, JSON.stringify({ ohlc: tick.ohlc, open: tick.open, last_price: tick.last_price }));
      }
    }

    // Debug ALL holdings — helps diagnose today's P&L discrepancy
    console.log(
      `[PNL] ${symbol.padEnd(16)} qty=${String(qty).padStart(4)}  avgPrice=${String(avgPrice).padStart(8)}  price=${String(price).padStart(8)}  prevClose=${String(prevClose).padStart(8)}  boughtToday=${boughtToday}  dayPnl=${dayPnl}`
    );

    return {
      symbol,
      quantity: qty,
      avgPrice,
      currentPrice: price,
      invested,
      current,
      pnl,
      pnlPercent,
      prevClose,
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

  const totalDayPnl = Math.round(portfolio.reduce((s, p) => s + p.todayPnl, 0) * 100) / 100;
  const totalDayOpen = portfolio.reduce((s, p) => s + p.openPrice * p.quantity, 0);
  const totalDayPnlPct = totalDayOpen > 0 ? ((totalDayPnl / totalDayOpen) * 100).toFixed(2) : "0.00";

  console.log(`[PNL] ─── TOTAL todayPnl=${totalDayPnl}  totalPnl=${Math.round(totalPnl*100)/100} ───`);

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
 * Parse a single cookie value by name from a raw Cookie header string.
 */
function parseCookie(cookieHeader: string, name: string): string {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Start KiteTicker websocket using the access token from the browser cookie.
 * @param accessToken — the kite_access_token value from the handshake cookie
 */
function startTicker(io: any, accessToken: string) {
  if (ticker) {
    console.log("[DEBUG] Ticker already started, skipping");
    return;
  }

  if (!accessToken) {
    console.warn("[⚠️] Cannot start ticker: no access token available");
    return;
  }

  // Sync to kite singleton so API routes that run in the same process benefit too
  kite.setAccessToken(accessToken);
  process.env.KITE_ACCESS_TOKEN = accessToken;

  console.log("[DEBUG] Creating KiteTicker instance...");
  ticker = new KiteTicker({
    api_key: process.env.KITE_API_KEY!,
    access_token: accessToken,
  } as any);

  ticker.autoReconnect(true, 10);

  ticker.on("connect", async () => {
    console.log("[✅] KiteTicker CONNECTED");
    // Reset guard so a future genuine expiry is still caught after re-auth
    authExpiredHandled = false;

    // Load holdings on connect
    if (!cachedHoldings.length) {
      console.log("[DEBUG] No cached holdings, loading...");
      await loadHoldings();
    } else {
      console.log("[DEBUG] Holdings already cached, skipping load");
    }

    // Build symbol→token map from holdings for paper position price lookups
    cachedHoldings.forEach((h: any) => {
      const sym = h.tradingsymbol?.split(":").pop() || h.symbol;
      if (sym && h.instrument_token) {
        paperSymbolTokenMap[sym] = h.instrument_token;
      }
    });

    // Load previous-day closing prices (from DB cache or Kite OHLC)
    await loadPrevClose();

    // Resolve tokens for paper positions not already in holdings
    // (Now done per-socket in the connection handler so we have a userId)
    console.log(`[📊] Paper position token resolution deferred to per-socket connection`);

    // Subscribe to all tokens — holdings + Nifty50 + paper positions
    const paperTokens = Object.values(paperSymbolTokenMap).filter(Boolean);
    const rawTokens = [
      NIFTY50_TOKEN,
      ...cachedHoldings.map((h: any) => h.instrument_token).filter(Boolean),
      ...paperTokens,
    ];
    const tokens = [...new Set(rawTokens)];

    if (tokens.length === 0) {
      console.log("[⚠️] No tokens to subscribe to!");
      return;
    }

    // Subscribe in batches
    console.log(`[DEBUG] Subscribing to ${tokens.length} tokens (incl. ${paperTokens.length} paper positions)...`);
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

    // Send paper trading positions update (per-socket, scoped to each user)
    try {
      for (const [socketId, uid] of socketUserMap.entries()) {
        if (!uid) continue;
        const paperData = await buildPaperPositions(uid);
        if (paperData.data.length > 0) {
          io.to(socketId).emit("paper-positions-update", paperData);
        }
      }
    } catch (err: any) {
      console.error("[❌] Paper positions broadcast error:", err.message);
    }
  });

  ticker.on("disconnect", () => console.log("[⚠️] KiteTicker disconnected"));

  // Transient errors (network blip, timeout) are handled by autoReconnect.
  // We only log them — acting here would cause login loops on normal hiccups.
  ticker.on("error", (err: any) => {
    console.warn("[⚠️] KiteTicker error (autoReconnect will retry):", err?.message ?? err);
  });

  // noreconnect fires only after ALL retry attempts are exhausted —
  // this is the definitive signal that the token is invalid/expired.
  ticker.on("noreconnect", () => {
    console.error("[🔴] KiteTicker: all reconnect attempts exhausted – token invalid/expired");
    handleTokenExpiry(io);
  });

  console.log("[DEBUG] Calling ticker.connect()...");
  ticker.connect();
}

/**
 * Clears both tokens from .env.local and tells every connected browser to
 * re-authenticate. The authExpiredHandled guard ensures this runs at most once
 * per token lifetime so stale ticker listeners cannot corrupt a future login.
 */
function handleTokenExpiry(io: SocketIOServer) {
  if (authExpiredHandled) return;
  authExpiredHandled = true;

  console.log("[Auth] Clearing tokens from memory and notifying clients");

  // Silence + destroy old ticker BEFORE nullifying so lingering listeners
  // cannot fire again and accidentally clear a freshly-issued token.
  if (ticker) {
    try {
      ticker.removeAllListeners();
      ticker.disconnect();
    } catch { /* ignore cleanup errors */ }
    ticker = null;
  }

  // Remove both tokens from .env.local, process.env, and the kite singleton
  clearTokens();

  const loginUrl = `https://kite.zerodha.com/connect/login?api_key=${process.env.KITE_API_KEY ?? ""}&v=3`;
  io.emit("auth-required", { loginUrl });
}

// ============= SOCKET.IO =============

export function initializeSocket(httpServer: Server) {
  console.log("[DEBUG] Initializing Socket.IO...");
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", async (socket) => {
    console.log(`[✅] Client connected: ${socket.id}`);

    // Read credentials from the browser cookies sent with the handshake.
    const rawCookie = socket.handshake.headers.cookie ?? "";
    const accessToken = parseCookie(rawCookie, "kite_access_token");
    const apiKey = parseCookie(rawCookie, "kite_api_key");
    const userId = parseCookie(rawCookie, "kite_user_id");

    // Track userId for this socket so ticks can emit per-user paper positions
    socketUserMap.set(socket.id, userId);

    // Sync api_key into process.env so startTicker / KiteTicker can use it.
    if (apiKey && apiKey !== process.env.KITE_API_KEY) {
      process.env.KITE_API_KEY = apiKey;
    }

    if (!accessToken) {
      console.warn(`[⚠️] No kite_access_token cookie on socket ${socket.id} — cannot start ticker`);
      socket.emit("auth-required", {
        loginUrl: `https://kite.zerodha.com/connect/login?api_key=${process.env.KITE_API_KEY ?? ""}&v=3`,
      });
      return;
    }

    // If ticker was killed by token expiry, restart it with the fresh cookie token.
    if (!ticker) {
      console.log("[DEBUG] First client, starting ticker...");
      startTicker(io, accessToken);
    } else {
      console.log("[DEBUG] Ticker already running");
      // Still sync token so the kite singleton stays current (e.g. after re-login)
      kite.setAccessToken(accessToken);
      process.env.KITE_ACCESS_TOKEN = accessToken;
    }

    // Resolve paper position tokens for this user
    if (userId) {
      try {
        const paperAccount = await dbIndex.getAccount(userId);
        const unmappedSymbols = paperAccount.positions
          .map((p: any) => p.symbol)
          .filter((s: string) => !paperSymbolTokenMap[s]);

        if (unmappedSymbols.length > 0) {
          const nseInstruments = await kite.getInstruments("NSE").catch(() => []);
          nseInstruments.forEach((inst: any) => {
            if (unmappedSymbols.includes(inst.tradingsymbol)) {
              paperSymbolTokenMap[inst.tradingsymbol] = inst.instrument_token;
            }
          });
        }
      } catch (e: any) {
        console.warn("[⚠️] Could not resolve paper position tokens:", e.message);
      }
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
      socketUserMap.delete(socket.id);
    });
  });

  console.log("[DEBUG] Socket.IO initialization complete");
  return io;
}

export { buildPortfolio as getPortfolioData };
