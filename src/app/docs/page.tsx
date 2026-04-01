"use client";

import { useState } from "react";
import Link from "next/link";

const sections = [
  { id: "architecture", label: "Architecture", icon: "⬡" },
  { id: "apis", label: "Kite APIs", icon: "⟁" },
  { id: "components", label: "Components", icon: "◈" },
  { id: "appstructure", label: "App Structure", icon: "⊞" },
  { id: "roadmap", label: "Roadmap", icon: "◎" },
];

const CodeBlock = ({ code, language = "js" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg overflow-hidden my-4 font-mono">
      <div className="flex justify-between items-center p-3 border-b border-slate-700 bg-slate-900">
        <span className="text-xs text-slate-400 uppercase tracking-widest">{language}</span>
        <button
          onClick={handleCopy}
          className={`text-xs border border-slate-600 px-2.5 py-1 rounded transition-all ${
            copied ? "text-green-400 border-green-500" : "text-slate-400 hover:text-slate-300"
          }`}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="m-0 p-4 overflow-x-auto text-sm leading-relaxed text-blue-300">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "warning" | "info" | "red" }) => {
  const colors = {
    default: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    warning: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    info: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return (
    <span className={`border rounded text-xs px-2 py-1 font-semibold tracking-wide uppercase ${colors[variant]}`}>
      {children}
    </span>
  );
};

const Table = ({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) => (
  <div className="overflow-x-auto my-4">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className="text-left px-4 py-2 border-b border-slate-700 text-slate-300 font-mono text-xs font-semibold uppercase tracking-wider bg-slate-900"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-slate-800">
            {row.map((cell, j) => (
              <td
                key={j}
                className={`px-4 py-2 ${
                  j === 0 ? "text-blue-300 font-mono text-xs" : "text-slate-400 text-sm"
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Step = ({ number, title, children }: { number: string | number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4 mb-6">
    <div className="flex-shrink-0 w-7 h-7 rounded-full border border-slate-600 flex items-center justify-center text-blue-400 text-xs font-mono mt-0.5">
      {number}
    </div>
    <div>
      <div className="text-gray-200 font-semibold mb-1 text-sm">{title}</div>
      <div className="text-slate-400 text-sm leading-relaxed">{children}</div>
    </div>
  </div>
);

const Callout = ({ type = "info", title, children }: { type?: "info" | "warning" | "tip"; title: string; children: React.ReactNode }) => {
  const styles = {
    info: "bg-cyan-500/10 border-cyan-500/30 border-l-cyan-500",
    warning: "bg-yellow-500/10 border-yellow-500/30 border-l-yellow-500",
    tip: "bg-green-500/10 border-green-500/30 border-l-green-500",
  };
  const icons = { info: "ℹ", warning: "⚠", tip: "◈" };
  const iconColors = { info: "text-cyan-400", warning: "text-yellow-400", tip: "text-green-400" };
  
  return (
    <div className={`${styles[type]} border border-l-4 rounded-lg p-4 my-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`${iconColors[type]} text-lg`}>{icons[type]}</span>
        <span className={`${iconColors[type]} text-xs font-semibold uppercase tracking-wide`}>{title}</span>
      </div>
      <div className="text-slate-400 text-sm leading-relaxed">{children}</div>
    </div>
  );
};

const SectionHeader = ({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) => (
  <div className="mb-8 pb-4 border-b border-slate-700">
    <div className="flex items-center gap-3 mb-2">
      <span className="text-2xl text-blue-400">{icon}</span>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
    </div>
    <p className="ml-10 text-slate-400 text-sm">{subtitle}</p>
  </div>
);

const textStyles = {
  prose: "text-slate-400 text-sm leading-relaxed mb-4",
  h3: "text-lg font-semibold text-gray-200 mt-6 mb-3",
  inlineCode: "font-mono text-xs bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-blue-300",
};

export default function TradingSystemDocs() {
  const [activeSection, setActiveSection] = useState("architecture");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-700 p-6 sticky top-0 h-screen overflow-y-auto bg-slate-900/50">
        <Link href="/" className="inline-flex items-center gap-2 mb-6 text-blue-400 hover:text-blue-300 transition-colors">
          <span>←</span>
          <span className="text-sm font-semibold">Back</span>
        </Link>
        
        <div className="pb-4 border-b border-slate-700 mb-6">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">System Docs</div>
          <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Trading Agent</div>
          <div className="text-xs text-slate-500 mt-1">v0.1 · Kite Connect</div>
        </div>
        
        <nav className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === s.id
                  ? "bg-slate-700 text-white border-l-2 border-blue-500"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <span className="text-lg opacity-70">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Quick Links</div>
          {[
            { label: "Kite Connect Docs", href: "https://kite.trade/docs/connect/v3/" },
            { label: "NSE Instruments", href: "https://www.nseindia.com" },
            { label: "Kite Console", href: "https://console.zerodha.com" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-slate-500 hover:text-slate-300 mb-2"
            >
              ↗ {l.label}
            </a>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl p-12 overflow-y-auto">
        {/* Page Header */}
        <div className="mb-12">
          <div className="flex gap-3 mb-4">
            <Badge>Paper Trading</Badge>
            <Badge variant="info">Kite API</Badge>
            <Badge variant="warning">₹5L Capital</Badge>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Swing Trading System
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Setup Guide</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
            A complete reference for building your paper trading infrastructure
            using Kite Connect APIs, NSE data, and a Next.js frontend.
          </p>
        </div>

        {/* ── ARCHITECTURE ── */}
        {activeSection === "architecture" && (
          <div>
            <SectionHeader
              icon="⬡"
              title="System Architecture"
              subtitle="How the pieces fit together"
            />
            <p className={textStyles.prose}>
              Kite provides no built-in paper trading mode. You use real market
              data but simulate order execution yourself. This gives you
              production-quality data with zero financial risk during learning.
            </p>
            <Table
              headers={["Kite Provides", "You Build"]}
              rows={[
                [
                  "Live market data (quotes, OHLC)",
                  "Paper trade logic (no real orders)",
                ],
                [
                  "Historical data for scanning",
                  "Virtual portfolio & P&L tracker",
                ],
                ["Instrument search across NSE/BSE", "Entry/exit rules engine"],
                [
                  "Real order placement (when ready)",
                  "Trade journal & analytics",
                ],
              ]}
            />
            <h3 className={textStyles.h3}>The 3-Layer System</h3>
            <CodeBlock
              language="plaintext"
              code={`Layer 1: SCAN
  → Find candidates matching your setup criteria
  → Runs daily at 4pm after market close

Layer 2: ANALYZE
  → Score each candidate (risk/reward, confirmations)
  → Auto-compute entry, stop loss, target, position size

Layer 3: EXECUTE
  → Paper trade with defined rules
  → Log outcome, track P&L, measure expectancy`}
            />
            <h3 className={textStyles.h3}>The Feedback Loop</h3>
            <CodeBlock
              language="plaintext"
              code={`Review paper trades
  → Identify what setups worked
    → Refine scan/analyze rules
      → Repeat with better edge`}
            />
            <Callout type="tip" title="Key Insight">
              The system is only as good as the strategy. An agent executing a
              bad strategy just loses money faster and more consistently. The
              4-week observation phase validates before you deploy real capital.
            </Callout>
            <h3 className={textStyles.h3}>Market Filter — The Master Switch</h3>
            <p className={textStyles.prose}>
              Before any scan runs, one check gates everything:
            </p>
            <CodeBlock
              language="plaintext"
              code={`Check Nifty 50 close vs 200 DMA

  Nifty > 200 DMA → 🟢 Green light — scan for longs
  Nifty < 200 DMA → 🔴 Red light  — no new trades, stay in cash`}
            />
            <Callout type="warning" title="Jan–Mar 2026 Context">
              Nifty was below its 200 DMA for most of Jan–Mar 2026. A correctly
              implemented system would have kept you in cash — preserving your
              ₹5L while most retail traders were down 4–8%.
            </Callout>
          </div>
        )}

        {/* ── KITE APIs ── */}
        {activeSection === "apis" && (
          <div>
            <SectionHeader
              icon="⟁"
              title="Kite APIs"
              subtitle="The 4 endpoints you'll actually use"
            />
            <Callout type="warning" title="Kite Connect Subscription">
              Historical data API requires Kite Connect at ₹2,000/month. For
              initial paper trading you can manually verify signals on Kite Web
              and subscribe only when you're ready to automate.
            </Callout>

            <h3 className={textStyles.h3}>1. Instruments — Your Stock Universe</h3>
            <p className={textStyles.prose}>
              Pull the full NSE instrument list once daily. The{" "}
              <code className={textStyles.inlineCode}>instrument_token</code> is your key for
              all subsequent calls.
            </p>
            <CodeBlock
              language="http"
              code={`GET https://api.kite.trade/instruments/NSE

// Returns CSV with columns:
// instrument_token, tradingsymbol, name,
// expiry, strike, tick_size, lot_size, instrument_type`}
            />
            <CodeBlock
              language="js"
              code={`// Parse and cache tokens for your universe
const response = await fetch('https://api.kite.trade/instruments/NSE', {
  headers: { 'Authorization': \`token \${apiKey}:\${accessToken}\` }
});
const csv = await response.text();
// Parse CSV → filter NSE 200 stocks by tradingsymbol`}
            />

            <h3 className={textStyles.h3}>2. Historical Data — Core Scanner Engine</h3>
            <p className={textStyles.prose}>
              Your most important API. Pull daily candles to compute EMAs, check
              trends, find pullbacks.
            </p>
            <CodeBlock
              language="http"
              code={`GET https://api.kite.trade/instruments/historical/{token}/day
  ?from=2025-10-01
  &to=2026-03-31

// Returns: date, open, high, low, close, volume`}
            />
            <CodeBlock
              language="js"
              code={`async function getHistoricalData(token, from, to) {
  const url = \`https://api.kite.trade/instruments/historical/\${token}/day\`
            + \`?from=\${from}&to=\${to}\`;
  const res = await fetch(url, { headers: authHeaders });
  const { data } = await res.json();
  return data.candles; // [[date, o, h, l, c, vol], ...]
}

// Compute 200 DMA from candles
function computeSMA(candles, period) {
  return candles.slice(-period)
    .reduce((sum, c) => sum + c[4], 0) / period; // c[4] = close
}`}
            />

            <h3 className={textStyles.h3}>3. OHLC — Fast Bulk Screening</h3>
            <p className={textStyles.prose}>
              Lighter than full quotes. Use for bulk screening across 200+
              stocks quickly.
            </p>
            <CodeBlock
              language="http"
              code={`GET https://api.kite.trade/ohlc
  ?i=NSE:SBIN&i=NSE:TCS&i=NSE:WIPRO&i=NSE:RELIANCE

// Returns: last_price, ohlc { open, high, low, close }
// Up to 1000 instruments per call`}
            />

            <h3 className={textStyles.h3}>4. Quotes — Real-Time Snapshot</h3>
            <p className={textStyles.prose}>
              Use for trade management — checking if stop loss or target has
              been hit during market hours.
            </p>
            <CodeBlock
              language="http"
              code={`GET https://api.kite.trade/quote
  ?i=NSE:RELIANCE&i=NSE:INFY

// Returns full depth: LTP, OHLC, volume,
// bid/ask, 52w high/low, OI, etc.`}
            />

            <h3 className={textStyles.h3}>Authentication Flow</h3>
            <CodeBlock
              language="js"
              code={`// 1. Redirect user to Kite login
const loginUrl =
  \`https://kite.zerodha.com/connect/login?api_key=\${API_KEY}&v=3\`;

// 2. Kite redirects back with request_token
// GET /callback?request_token=xxx&status=success

// 3. Exchange for access_token
const response = await fetch('https://api.kite.trade/session/token', {
  method: 'POST',
  body: new URLSearchParams({
    api_key: API_KEY,
    request_token: requestToken,
    checksum: sha256(API_KEY + requestToken + API_SECRET)
  })
});
const { access_token } = await response.json();
// Store access_token in session — valid for one trading day`}
            />
          </div>
        )}

        {/* ── COMPONENTS ── */}
        {activeSection === "components" && (
          <div>
            <SectionHeader
              icon="◈"
              title="System Components"
              subtitle="What to build and in what order"
            />

            <h3 className={textStyles.h3}>Component 1 — Market Filter</h3>
            <Badge>Run once daily · 4pm</Badge>
            <CodeBlock
              language="plaintext"
              code={`1. Pull Nifty 50 historical data (last 200 days)
2. Compute 200 DMA = avg of last 200 closes
3. Get today's Nifty closing price
4. If close > 200 DMA → set marketSignal = "GREEN"
5. If close < 200 DMA → set marketSignal = "RED", skip scan`}
            />

            <h3 className={textStyles.h3}>Component 2 — Daily Stock Scanner</h3>
            <Badge>Runs only if market signal is GREEN</Badge>
            <p className="text-slate-400 text-sm leading-relaxed mb-4 mt-3">
              <strong className="text-gray-200">
                Setup B — Pullback in Uptrend (Start Here)
              </strong>
            </p>
            <CodeBlock
              language="plaintext"
              code={`For each stock in NSE 200 universe:
  1. Pull 200 days of daily candles
  2. Compute 200 DMA, 50 DMA, 20 EMA
  3. ✓ Close > 200 DMA            ← uptrend confirmed
  4. ✓ Close > 50 DMA             ← medium trend intact
  5. ✓ Close within 2% of 20 EMA  ← pullback happening
  6. ✓ Volume < 20-day avg         ← quiet pullback (healthy)
  → Flag as "Pullback Candidate"`}
            />

            <p className={textStyles.prose}>
              <strong className="text-gray-200">
                Setup A — Breakout Momentum
              </strong>
            </p>
            <CodeBlock
              language="plaintext"
              code={`For each stock:
  1. Find 20-day high (consolidation ceiling)
  2. ✓ Today's close > 20-day high   ← breakout confirmed
  3. ✓ Volume > 1.5x 20-day avg      ← confirmed by volume
  → Flag as "Breakout Candidate"`}
            />

            <h3 className={textStyles.h3}>Component 3 — Trade Entry Calculator</h3>
            <CodeBlock
              language="js"
              code={`function calculateTrade(ltp, swingLow, capital = 500000) {
  const riskPerTrade  = capital * 0.01;           // 1% = ₹5,000
  const entry         = ltp;
  const stopLoss      = swingLow * 0.99;          // 1% below swing low
  const riskPerShare  = entry - stopLoss;
  const target        = entry + riskPerShare * 2; // 1:2 R:R minimum
  const quantity      = Math.floor(riskPerTrade / riskPerShare);
  const capitalUsed   = quantity * entry;

  return { entry, stopLoss, target, quantity, capitalUsed };
}

// Example: LTP=500, swingLow=480, capital=500000
// → entry=500, stop=475.2, target=549.6
// → qty=202 shares, capital used=₹1,01,000`}
            />

            <h3 className={textStyles.h3}>Component 4 — Paper Trade Manager</h3>
            <Badge>Run daily · 4pm</Badge>
            <CodeBlock
              language="js"
              code={`async function checkExits(openTrades) {
  const symbols = openTrades.map(t => \`NSE:\${t.symbol}\`);
  const quotes  = await getOHLC(symbols);

  return openTrades.map(trade => {
    const { low, close } = quotes[trade.symbol];
    const daysHeld = daysSince(trade.entryDate);

    if (low <= trade.stopLoss) return { ...trade, status: 'STOPPED',   exitPrice: trade.stopLoss };
    if (close >= trade.target) return { ...trade, status: 'TARGET',    exitPrice: trade.target };
    if (daysHeld >= 10)        return { ...trade, status: 'TIME_STOP', exitPrice: close };
    return trade; // still open
  });
}`}
            />

            <h3 className={textStyles.h3}>Component 5 — Trade Journal Analytics</h3>
            <CodeBlock
              language="js"
              code={`function computeStats(closedTrades) {
  const wins   = closedTrades.filter(t => t.pnl > 0);
  const losses = closedTrades.filter(t => t.pnl <= 0);

  const winRate    = wins.length / closedTrades.length;
  const avgWin     = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
  const avgLoss    = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length);

  // The most important number
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

  return { winRate, avgWin, avgLoss, expectancy };
  // expectancy > 0 → you have edge
  // expectancy < 0 → strategy needs work
}`}
            />

            <Callout type="tip" title="The One Number That Matters">
              Expectancy = (Win% × Avg Win) − (Loss% × Avg Loss). A 45% win rate
              with ₹8K avg win and ₹3K avg loss gives ₹3,600 expectancy per
              trade — profitable even losing more than half your trades.
            </Callout>
          </div>
        )}

        {/* ── APP STRUCTURE ── */}
        {activeSection === "appstructure" && (
          <div>
            <SectionHeader
              icon="⊞"
              title="Next.js App Structure"
              subtitle="How to organise your codebase"
            />

            <CodeBlock
              language="plaintext"
              code={`/app
  /scanner              ← Daily scan results, flagged stocks
  /paper-trading        ← Active trades, entry logger, P&L
  /portfolio            ← Equity curve, win rate, expectancy
  /journal              ← Full trade history with notes

/app/api
  /auth/callback        ← Kite OAuth callback
  /scan                 ← Server action: runs scanner
  /market-filter        ← Server action: Nifty 200 DMA check
  /trades               ← CRUD for paper trades

/lib
  /kite.js              ← Kite API wrapper
  /indicators.js        ← SMA, EMA, volume calculations
  /scanner.js           ← Setup A & B filter logic
  /position-sizer.js    ← Risk/reward calculator`}
            />

            <h3 className={textStyles.h3}>The One Cron Job You Need</h3>
            <p className={textStyles.prose}>
              Runs at 4pm daily after market close. Use Vercel Cron or a simple
              cron on your server.
            </p>
            <CodeBlock
              language="js"
              code={`// /app/api/cron/daily/route.js
export async function GET() {
  // 1. Check market filter
  const marketSignal = await checkMarketFilter(); // 'GREEN' | 'RED'

  if (marketSignal === 'GREEN') {
    // 2. Run scanner on NSE 200
    const candidates = await runDailyScanner();
    await saveCandidates(candidates);
  }

  // 3. Update all open paper trade statuses
  await checkAndUpdateExits();

  // 4. (Optional) Push daily digest notification
  await sendDailyDigest();

  return Response.json({ status: 'done', signal: marketSignal });
}`}
            />

            <h3 className={textStyles.h3}>Kite API Wrapper</h3>
            <CodeBlock
              language="js"
              code={`// /lib/kite.js
const BASE = 'https://api.kite.trade';

const headers = () => ({
  'X-Kite-Version': '3',
  'Authorization': \`token \${process.env.KITE_API_KEY}:\${getAccessToken()}\`
});

export const kite = {
  historical: (token, from, to) =>
    fetch(\`\${BASE}/instruments/historical/\${token}/day?from=\${from}&to=\${to}\`,
      { headers: headers() }).then(r => r.json()),

  ohlc: (symbols) =>
    fetch(\`\${BASE}/ohlc?\${symbols.map(s => \`i=\${s}\`).join('&')}\`,
      { headers: headers() }).then(r => r.json()),

  quote: (symbols) =>
    fetch(\`\${BASE}/quote?\${symbols.map(s => \`i=\${s}\`).join('&')}\`,
      { headers: headers() }).then(r => r.json()),
};`}
            />

            <h3 className={textStyles.h3}>Database Schema (Paper Trades)</h3>
            <CodeBlock
              language="sql"
              code={`CREATE TABLE paper_trades (
  id            SERIAL PRIMARY KEY,
  symbol        VARCHAR(20)    NOT NULL,
  setup_type    VARCHAR(10),             -- 'PULLBACK' | 'BREAKOUT'
  entry_date    DATE,
  entry_price   DECIMAL(10,2),
  stop_loss     DECIMAL(10,2),
  target        DECIMAL(10,2),
  quantity      INT,
  exit_date     DATE,
  exit_price    DECIMAL(10,2),
  status        VARCHAR(20),             -- 'OPEN' | 'TARGET' | 'STOPPED' | 'TIME_STOP'
  pnl           DECIMAL(10,2),
  market_signal VARCHAR(5),              -- 'GREEN' | 'RED' at time of entry
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);`}
            />
          </div>
        )}

        {/* ── ROADMAP ── */}
        {activeSection === "roadmap" && (
          <div>
            <SectionHeader
              icon="◎"
              title="Build Roadmap"
              subtitle="Fastest path to paper trading"
            />

            <h3 className={textStyles.h3}>Weekend MVP — Start Paper Trading in 2 Days</h3>
            <Step number="1" title="Day 1 Morning — Auth + Market Filter">
              Set up Kite Connect OAuth in Next.js. Pull Nifty 50 historical
              data and compute 200 DMA. Display a green/red market signal on
              your dashboard.
            </Step>
            <Step number="2" title="Day 1 Afternoon — NSE 200 Scanner">
              Pull the NSE 200 instrument list. Run the pullback filter (200
              DMA, 50 DMA, 20 EMA checks). Display the watchlist with
              entry/stop/target auto-computed.
            </Step>
            <Step number="3" title="Day 2 — Paper Trade Logger">
              Build a simple form to log a trade from the watchlist. Store
              entry, stop, target, quantity. Show open trades with unrealised
              P&L.
            </Step>
            <Step number="4" title="Day 2 Evening — Daily Cron">
              Set up the 4pm cron job to auto-update trade statuses (stopped out
              / target hit / still open).
            </Step>

            <Callout type="tip" title="That's the MVP">
              After 2 days you can start paper trading manually from Day 3.
              Everything else — full automation, analytics dashboard, breakout
              scanner — is incremental from here.
            </Callout>

            <h3 className={textStyles.h3}>Phase Timeline</h3>
            <Table
              headers={["Phase", "Duration", "Goal", "Capital at Risk"]}
              rows={[
                [
                  "Observe",
                  "Week 1–4",
                  "Watch signals, no trades. Validate setup logic.",
                  "₹0",
                ],
                [
                  "Paper Trade",
                  "Week 5–8",
                  "Trade every signal. Track P&L, win rate, expectancy.",
                  "₹0",
                ],
                [
                  "Refine",
                  "Week 9–12",
                  "Double down on what works. Cut what doesn't.",
                  "₹0",
                ],
                [
                  "Deploy",
                  "Week 13+",
                  "1–2 real positions at ₹50K each. System validated.",
                  "₹1L real",
                ],
              ]}
            />

            <h3 className={textStyles.h3}>Risk Rules — Non-Negotiable</h3>
            <Table
              headers={["Rule", "Value", "Why"]}
              rows={[
                [
                  "Max risk per trade",
                  "1% of capital = ₹5,000",
                  "Survive 10 consecutive losses",
                ],
                [
                  "Max simultaneous positions",
                  "4–5 at a time",
                  "Don't over-concentrate ₹5L",
                ],
                ["Max loss per week", "3% = ₹15,000", "Stop and review if hit"],
                [
                  "Time stop",
                  "Exit if no move in 10 days",
                  "Capital opportunity cost",
                ],
                [
                  "Market filter",
                  "No longs if Nifty < 200 DMA",
                  "Protects against trend trades",
                ],
              ]}
            />

            <Callout
              type="info"
              title="The One Behaviour That Determines Success"
            >
              Will you follow your system's signals even when your gut says
              otherwise? The agent solves the discovery problem. But you still
              have to execute without overriding it emotionally — especially
              during a 3-trade losing streak, which is completely normal.
            </Callout>

            <h3 className={textStyles.h3}>Expectancy Benchmark</h3>
            <CodeBlock
              language="plaintext"
              code={`Target after 30+ paper trades:
  Win Rate:    > 40%
  Avg Win:     > 2× Avg Loss  (1:2 R:R enforced at entry)
  Expectancy:  > ₹1,500 per trade

  At 10 trades/month  →  ₹15,000/month expectancy
  On ₹5L capital      →  3% monthly return
  Annualised          →  ~36–45% (with compounding)`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
