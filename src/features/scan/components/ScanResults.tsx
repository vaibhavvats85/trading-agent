"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanResult } from "@/lib/types";
import type { SectorRankResult } from "@/lib/scanner/sectorRank";
import { usePaperTrading } from "@/features/paperTrading";
import { PlaceOrderModal } from "@/features/paperTrading";
import SectorRank from "./SectorRank";

const ITEMS_PER_PAGE = 20;

type SortColumn =
  | "symbol"
  | "price"
  | "change"
  | "rsi"
  | "ema50"
  | "dma10"
  | "pullback"
  | "signal";
type SortDirection = "asc" | "desc";

export default function ScanResults({
  onScanComplete,
}: { onScanComplete?: () => void } = {}) {
  // ──────────────────────────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────────────────────────

  // Scan State
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Sector Filtering State
  const [sectorFilterActive, setSectorFilterActive] = useState(false);
  const [sectorFiltering] = useState(false);
  const [topSectors, setTopSectors] = useState<SectorRankResult[]>([]);
  const [sectorFilterError] = useState<string | null>(
    null,
  );
  const [allSectors, setAllSectors] = useState<SectorRankResult[]>([]);
  const [sectorRefreshVersion, setSectorRefreshVersion] = useState(0);

  // UI State
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("signal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<ScanResult | null>(null);
  const [signalPopupStock, setSignalPopupStock] = useState<ScanResult | null>(
    null,
  );
  const [marketSignal, setMarketSignal] = useState<{
    signal: "GREEN" | "RED";
    close: number;
    dma200: number;
    dma50: number;
    distancePercent200: string;
    distancePercent50: string;
  } | null>(null);
  const [marketSignalLoading, setMarketSignalLoading] = useState(true);
  const [marketSignalError, setMarketSignalError] = useState<string | null>(
    null,
  );

  const { placeOrder, account } = usePaperTrading();
  const isInitialLoad = useRef(true);

  // ──────────────────────────────────────────────────────────────────────────────
  // LOAD FROM DB
  // ──────────────────────────────────────────────────────────────────────────────

  const loadFromDb = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[ScanResults] Loading scan results from DB...");

      const [scanResp, sectorResp] = await Promise.all([
        fetch("/api/scan", { cache: "no-store" }),
        fetch("/api/sector-rank", { cache: "no-store" }),
      ]);

      const scanData = await scanResp.json();
      const sectorData = await sectorResp.json();

      if (scanData.success && Array.isArray(scanData.data)) {
        const allStocks = scanData.data;

        if (sectorData.success && Array.isArray(sectorData.data)) {
          const allSectorData: SectorRankResult[] = sectorData.data;
          setAllSectors(allSectorData);
          const top5 = allSectorData.slice(0, 5);
          setTopSectors(top5);
          applyTopSectorFilter(top5, allStocks);
        } else {
          setResults(allStocks);
        }

        setLastUpdate(new Date());
        setCurrentPage(1);
        setSortColumn("signal");
        setSortDirection("desc");
        if (!isInitialLoad.current) onScanComplete?.();
        isInitialLoad.current = false;
        console.log(`[ScanResults] Loaded ${allStocks.length} stocks from DB`);
      } else {
        // No data in DB yet — show prompt to run first scan
        setError(
          scanData.error || "No scan data yet. Click \"Run Scan\" to populate."
        );
      }
    } catch (err: any) {
      setError(err.message || "Error loading scan data");
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // TRIGGER FRESH SCAN (manual)
  // ──────────────────────────────────────────────────────────────────────────────

  const triggerScan = async () => {
    try {
      setScanning(true);
      setScanError(null);
      console.log("[ScanResults] Triggering fresh scan...");

      const response = await fetch("/api/scan/trigger", {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success) {
        console.log(`[ScanResults] Scan complete: ${data.scanCount} stocks, ${data.sectorCount} sectors`);
        // Reload from DB to display updated results
        await loadFromDb();
      } else {
        setScanError(data.error || "Scan failed");
        console.error("[ScanResults] Trigger scan error:", data.error);
      }
    } catch (err: any) {
      setScanError(err.message || "Failed to trigger scan");
      console.error("[ScanResults] Trigger scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // STEP 3: FILTER STOCKS TO TOP 5 SECTORS (client-side, no API call)
  // ──────────────────────────────────────────────────────────────────────────────

  const applyTopSectorFilter = (top5: SectorRankResult[], allStocks: any[]) => {
    console.log(
      "[ScanResults] Step 3/3: Filtering stocks to top 5 sectors (client-side)...",
    );
    const topSectorNames = new Set(top5.map((s) => s.sectorName));
    const filtered = allStocks.filter((stock: any) => {
      const sectorName = resolveSectorName(stock.industry);
      return sectorName !== null && topSectorNames.has(sectorName);
    });
    setResults(filtered);
    setCurrentPage(1);
    setSectorFilterActive(true);
    setSectorRefreshVersion((v) => v + 1);
    console.log(
      `[ScanResults] ✓ Step 3 complete: ${filtered.length} stocks from top 5 sectors`,
    );
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ──────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadFromDb();
    setMarketSignalLoading(true);
    fetch("/api/market-scan")
      .then((r) => r.json())
      .then((d) =>
        d.success
          ? setMarketSignal(d.data)
          : setMarketSignalError(d.error || "Market scan failed"),
      )
      .catch((e) =>
        setMarketSignalError(e.message || "Failed to fetch market signal"),
      )
      .finally(() => setMarketSignalLoading(false));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────────

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortedResults = () => {
    const sorted = [...results].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof ScanResult];
      let bVal: any = b[sortColumn as keyof ScanResult];

      if (sortColumn === "signal") {
        const signalOrder = { BUY: 3, SELL: 2, "NO TRADE": 1 };
        aVal = signalOrder[a.signal as keyof typeof signalOrder] || 0;
        bVal = signalOrder[b.signal as keyof typeof signalOrder] || 0;
      }

      if (sortColumn === "pullback") {
        aVal = a.pullback ? 1 : 0;
        bVal = b.pullback ? 1 : 0;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

    return sorted;
  };

  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return " ↕";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  // Sector industry mappings (must match sectorRank.ts definitions)
  const SECTOR_INDUSTRY_MAP: Record<
    string,
    { name: string; keywords: string[] }
  > = {
    "Financial Services": {
      name: "Financial Services",
      keywords: ["financial services", "banking", "finance", "banks"],
    },
    "Information Technology": {
      name: "Information Technology",
      keywords: ["information technology", "software", "technology"],
    },
    Automobile: {
      name: "Automobile",
      keywords: [
        "automobile and auto components",
        "automobile",
        "auto components",
        "auto",
      ],
    },
    Pharmaceuticals: {
      name: "Pharmaceuticals",
      keywords: ["pharmaceuticals", "pharma", "drugs", "drug"],
    },
    FMCG: {
      name: "FMCG",
      keywords: ["fast moving consumer goods", "fmcg", "consumer staples"],
    },
    "Metals & Mining": {
      name: "Metals & Mining",
      keywords: ["metals & mining", "metals", "mining", "steel"],
    },
    Realty: {
      name: "Realty",
      keywords: ["realty", "real estate", "construction"],
    },
    Healthcare: {
      name: "Healthcare",
      keywords: ["healthcare", "hospital", "medical services", "health care"],
    },
    "Oil & Gas": {
      name: "Oil & Gas",
      keywords: [
        "oil, gas & consumable fuels",
        "oil",
        "petroleum",
        "gas",
        "oil gas",
      ],
    },
    "Consumer Durables": {
      name: "Consumer Durables",
      keywords: ["consumer durables", "household", "consumer electronics"],
    },
    "Capital Goods": {
      name: "Capital Goods",
      keywords: [
        "capital goods",
        "industrial manufacturing",
        "manufacturing",
        "industrials",
      ],
    },
    Power: {
      name: "Power",
      keywords: ["power", "utilities", "electricity"],
    },
    Media: {
      name: "Media",
      keywords: ["media", "entertainment", "telecom", "telecommunication"],
    },
  };

  // Resolve sector name from industry string (same logic as backend)
  const resolveSectorName = (industry: string | undefined): string | null => {
    if (!industry) return null;
    const lower = industry.toLowerCase().trim();

    let bestMatch: string | null = null;
    let bestMatchLength = 0;

    for (const [sectorName, { keywords }] of Object.entries(
      SECTOR_INDUSTRY_MAP,
    )) {
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        let isMatch = false;
        let matchLength = 0;

        // Exact match
        if (lower === keywordLower) {
          isMatch = true;
          matchLength = keyword.length;
        }
        // Word boundary match
        else {
          const lowerParts = lower.split(/[\s,&]+/).filter((p) => p.length > 0);
          const keywordParts = keywordLower
            .split(/[\s,&]+/)
            .filter((p) => p.length > 0);

          const allMatch = keywordParts.every((kp) =>
            lowerParts.some(
              (lp) => lp === kp || lp.includes(kp) || kp.includes(lp),
            ),
          );

          if (allMatch) {
            isMatch = true;
            matchLength = keyword.length;
          }
        }

        if (isMatch && matchLength > bestMatchLength) {
          bestMatch = sectorName;
          bestMatchLength = matchLength;
        }
      }
    }

    return bestMatch;
  };

  // Get sector rank for a stock based on its industry
  const getStockSectorRank = (stock: ScanResult): number | null => {
    if (!stock.industry || allSectors.length === 0) return null;

    const sectorName = resolveSectorName(stock.industry);
    if (!sectorName) return null;

    const matchingSector = allSectors.find((s) => s.sectorName === sectorName);
    return matchingSector ? matchingSector.rank : null;
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* DEBUG: Show data state during development */}
      {process.env.NODE_ENV === "development" && (
        <div className="mb-4 p-2 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">
          <p>
            📊 Data State: allSectors={allSectors.length} | topSectors=
            {topSectors.length} | sectorFiltering=
            {sectorFiltering ? "true" : "false"}
          </p>
        </div>
      )}

      {/* SECTOR RANKINGS TABLE */}
      {/* Show if we have sector ranking data (regardless of other states) */}
      {allSectors.length > 0 && (
        <div
          className="glass rounded-lg p-6 mb-6"
          key={`sectors-${allSectors[0]?.indexSymbol}-${sectorRefreshVersion}`}
        >
          <SectorRank externalSectors={allSectors} />
        </div>
      )}

      <div className="glass rounded-lg p-6">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">
              Stock Scanner{" "}
              {sectorFilterActive ? "— Top 5 Sectors" : "— NIFTY200"}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {sectorFilterActive
                ? "Showing only stocks from top 5 performing sectors"
                : "Scanning all NIFTY200 stocks with indicators"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <p className="text-sm text-gray-400">
                Last scan: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
            <button
              onClick={loadFromDb}
              disabled={loading || scanning}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 rounded-lg transition-colors text-sm font-semibold"
            >
              {loading ? "Loading..." : "Reload"}
            </button>
            <button
              onClick={triggerScan}
              disabled={scanning || loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
            >
              {scanning && (
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {scanning ? "Scanning..." : "Run Scan"}
            </button>
          </div>
        </div>

        {/* STEPS 2 & 3 COMPLETE */}
        {sectorFilterActive && topSectors.length > 0 && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-green-400 mb-2">
                ✓ Sector Analysis Complete: Top 5 Sectors
              </p>
              <div className="flex flex-wrap gap-2">
                {topSectors.map((sector) => (
                  <div
                    key={sector.indexSymbol}
                    className="inline-block px-3 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-300"
                  >
                    <span className="font-semibold">{sector.rank}.</span>{" "}
                    {sector.sectorName}
                    <span className="text-green-400/70 ml-1">
                      ({sector.pctAboveEma50.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-green-300 mt-2">
                Showing {results.length} stocks from these sectors
              </p>
            </div>
          </div>
        )}

        {/* SECTOR FILTERING IN PROGRESS */}
        {sectorFiltering && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
            <div className="inline-block animate-spin">
              <div className="w-4 h-4 border-2 border-yellow-600 border-t-yellow-400 rounded-full" />
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-400">
                Analyzing sectors...
              </p>
              <p className="text-xs text-yellow-300">
                Scanning all 13 sectors and their indicators
              </p>
            </div>
          </div>
        )}

        {/* SECTOR FILTER ERROR */}
        {sectorFilterError && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm font-semibold text-red-400 mb-1">
              Sector Filter Error
            </p>
            <p className="text-xs text-red-300">{sectorFilterError}</p>
          </div>
        )}

        {/* MARKET SIGNAL */}
        <div className="mb-5">
          {marketSignalLoading ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-600/30 bg-gray-700/20 text-gray-400 text-sm animate-pulse">
              <span>⏳</span>
              <span>Loading market signal...</span>
            </div>
          ) : marketSignalError ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-sm">
              <span>⚠️</span>
              <span>Market signal unavailable: {marketSignalError}</span>
            </div>
          ) : marketSignal ? (
            <div
              className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${marketSignal.signal === "GREEN" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}
            >
              <span className="text-xl">
                {marketSignal.signal === "GREEN" ? "🟢" : "🔴"}
              </span>
              <div>
                <p className="text-sm font-bold">
                  Market:{" "}
                  {marketSignal.signal === "GREEN" ? "Bullish" : "Bearish"} —
                  Nifty 50 {marketSignal.signal === "GREEN" ? "above" : "below"}{" "}
                  200 DMA
                </p>
                <p className="text-xs opacity-75">
                  Nifty: ₹{marketSignal.close.toFixed(2)}
                </p>
                <p className="text-xs opacity-75">
                  200 DMA: ₹{marketSignal.dma200.toFixed(2)} | Distance:{" "}
                  {Number(marketSignal.distancePercent200) >= 0 ? "+" : ""}
                  {marketSignal.distancePercent200}%
                </p>
                <p className="text-xs opacity-75">
                  50 DMA: ₹{marketSignal.dma50.toFixed(2)} | Distance:{" "}
                  {Number(marketSignal.distancePercent50) >= 0 ? "+" : ""}
                  {marketSignal.distancePercent50}%
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ERROR */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-6">
            <p className="font-semibold mb-2">⚠️ Scan Error</p>
            <p className="text-sm">{error}</p>
            {error.includes("Kite") && (
              <p className="text-xs mt-2 text-red-400/70">
                Please ensure Kite API credentials are properly configured and
                the API is accessible.
              </p>
            )}
          </div>
        )}

        {/* SCAN ERROR */}
        {scanError && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm font-semibold text-red-400 mb-1">Scan Error</p>
            <p className="text-xs text-red-300">{scanError}</p>
          </div>
        )}

        {/* SCANNING IN PROGRESS */}
        {scanning && (
          <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
            <div className="inline-block animate-spin">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-blue-400 rounded-full" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-400">Running full scan...</p>
              <p className="text-xs text-blue-300">Fetching indicators for all stocks & ranking sectors. This may take a minute.</p>
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && results.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin mb-4">
              <div className="w-8 h-8 border-4 border-gray-600 border-t-blue-400 rounded-full" />
            </div>
            <p className="text-gray-400 font-semibold">Loading scan data from database...</p>
            <p className="text-xs text-gray-500 mt-2">
              If no data appears, click "Run Scan" to populate
            </p>
          </div>
        )}

        {/* RESULTS TABLE */}
        {results.length > 0 && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th
                      onClick={() => handleSort("symbol")}
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      Symbol{renderSortIndicator("symbol")}
                    </th>
                    <th
                      onClick={() => handleSort("price")}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      Price{renderSortIndicator("price")}
                    </th>
                    <th
                      onClick={() => handleSort("change")}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      Change{renderSortIndicator("change")}
                    </th>
                    <th
                      onClick={() => handleSort("rsi")}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      RSI{renderSortIndicator("rsi")}
                    </th>
                    <th
                      onClick={() => handleSort("ema50")}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      EMA50{renderSortIndicator("ema50")}
                    </th>
                    <th
                      onClick={() => handleSort("dma10")}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      DMA10{renderSortIndicator("dma10")}
                    </th>
                    <th
                      onClick={() => handleSort("pullback")}
                      className="px-6 py-3 text-center text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      Pullback{renderSortIndicator("pullback")}
                    </th>
                    <th
                      onClick={() => handleSort("signal")}
                      className="px-6 py-3 text-center text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
                    >
                      Signal{renderSortIndicator("signal")}
                    </th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedResults()
                    .slice(
                      (currentPage - 1) * ITEMS_PER_PAGE,
                      currentPage * ITEMS_PER_PAGE,
                    )
                    .map((result, idx) => {
                      const changeIsPositive = result.change >= 0;
                      const signalColor =
                        result.signal === "BUY"
                          ? "text-green-400"
                          : result.signal === "SELL"
                            ? "text-red-400"
                            : "text-yellow-400";

                      return (
                        <tr
                          key={idx}
                          className="border-b border-gray-700/50 hover:bg-slate-700/20 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-semibold text-blue-400">
                              {result.symbol}
                            </div>
                            {result.industry && (
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-400">
                                  {result.industry}
                                </span>
                                {getStockSectorRank(result) !== null && (
                                  <span className="inline-block px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-purple-300 font-semibold">
                                    Rank #{getStockSectorRank(result)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-300">
                            ₹{result.ltp.toFixed(2)}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-semibold ${changeIsPositive ? "text-positive" : "text-negative"}`}
                          >
                            {changeIsPositive ? "+" : ""}
                            {result.change.toFixed(2)} ({result.changePercent}%)
                          </td>
                          <td className="px-6 py-4 text-right text-gray-300">
                            {result.rsi.toFixed(0)}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-300">
                            {result.ema50.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-300">
                            {result.dma10.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${result.pullback ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}
                            >
                              {result.pullback ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setSignalPopupStock(result)}
                              className={`font-semibold cursor-pointer hover:opacity-75 transition-opacity ${signalColor}`}
                              title="Click to view strategy signals"
                            >
                              {result.signal}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedStock(result);
                                setIsModalOpen(true);
                              }}
                              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              Paper Trade
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {results.length > ITEMS_PER_PAGE && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, results.length)} of{" "}
                  {results.length} results
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-2">
                    {Array.from({
                      length: Math.ceil(results.length / ITEMS_PER_PAGE),
                    }).map((_, i) =>
                      (i + 1 >= currentPage - 2 && i + 1 <= currentPage + 2) ||
                      i + 1 === 1 ||
                      i + 1 === Math.ceil(results.length / ITEMS_PER_PAGE) ? (
                        <button
                          key={i + 1}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-slate-700 text-gray-300 hover:bg-slate-600"}`}
                        >
                          {i + 1}
                        </button>
                      ) : null,
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage(
                        Math.min(
                          Math.ceil(results.length / ITEMS_PER_PAGE),
                          currentPage + 1,
                        ),
                      )
                    }
                    disabled={
                      currentPage === Math.ceil(results.length / ITEMS_PER_PAGE)
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STRATEGY SIGNALS POPUP */}
      {signalPopupStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {signalPopupStock.symbol}
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {signalPopupStock.industry || "—"}
                </p>
              </div>
              <button
                onClick={() => setSignalPopupStock(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-700/30 rounded border border-slate-600/50">
                <p className="text-xs text-gray-400 mb-1">Overall Signal</p>
                <p
                  className={`text-lg font-bold ${
                    signalPopupStock.signal === "BUY"
                      ? "text-green-400"
                      : signalPopupStock.signal === "SELL"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }`}
                >
                  {signalPopupStock.signal}
                </p>
              </div>

              <div className="border-t border-gray-700 pt-3">
                <p className="text-xs text-gray-400 mb-2 font-semibold">
                  Strategy Signals:
                </p>
                <div className="space-y-2">
                  {signalPopupStock.strategySignals?.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-700/20 rounded border border-slate-600/30"
                    >
                      <span className="text-sm text-gray-300">
                        {s.strategyName}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          s.signal === "BUY"
                            ? "text-green-400"
                            : s.signal === "SELL"
                              ? "text-red-400"
                              : "text-yellow-400"
                        }`}
                      >
                        {s.signal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSignalPopupStock(null)}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold text-white transition-colors mt-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      <PlaceOrderModal
        isOpen={isModalOpen}
        stock={selectedStock}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStock(null);
        }}
        onPlaceOrder={async (request) => await placeOrder(request)}
        totalCapital={account?.totalCapital}
      />
    </>
  );
}
