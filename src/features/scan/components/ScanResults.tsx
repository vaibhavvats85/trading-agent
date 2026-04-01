"use client";

import { useEffect, useState } from "react";
import type { ScanResult, PlacePaperOrderRequest } from "@/lib/types";
import { usePaperTrading } from "@/features/paperTrading";
import { PlaceOrderModal } from "@/features/paperTrading";
import { STRATEGIES } from "@/lib/strategies/registry";

const ITEMS_PER_PAGE = 20;

type SortColumn = "symbol" | "price" | "change" | "rsi" | "ema50" | "dma10" | "pullback" | "signal";
type SortDirection = "asc" | "desc";

export default function ScanResults() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("signal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [activeIndicatorPopup, setActiveIndicatorPopup] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<ScanResult | null>(null);
  const [marketSignal, setMarketSignal] = useState<{ signal: "GREEN" | "RED"; close: number; dma200: number; distancePercent: string } | null>(null);
  const [marketSignalLoading, setMarketSignalLoading] = useState(true);
  const [marketSignalError, setMarketSignalError] = useState<string | null>(null);
  const { placeOrder } = usePaperTrading();

  const fetchScanResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/scan", {
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
        setLastUpdate(new Date());
        setCurrentPage(1);
      } else {
        const errorMsg = data.error || "Failed to fetch scan results";
        setError(errorMsg);
        console.error("[Scan] API error:", errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || "Error fetching scan results";
      setError(errorMsg);
      console.error("[Scan] Fetch error:", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch on mount - scan is manual only via refresh button (no auto intervals)
    fetchScanResults();
    // Market scan loads independently on mount
    setMarketSignalLoading(true);
    fetch("/api/market-scan")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setMarketSignal(d.data);
        } else {
          setMarketSignalError(d.error || "Market scan failed");
        }
      })
      .catch((e) => setMarketSignalError(e.message || "Failed to fetch market signal"))
      .finally(() => setMarketSignalLoading(false));
  }, []);

  const handleRefresh = () => fetchScanResults();

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortedResults = () => {
    const sorted = [...results].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof ScanResult];
      let bVal: any = b[sortColumn as keyof ScanResult];

      // Handle signal sorting
      if (sortColumn === "signal") {
        const signalOrder = { BUY: 3, SELL: 2, "NO TRADE": 1 };
        aVal = signalOrder[a.signal as keyof typeof signalOrder] || 0;
        bVal = signalOrder[b.signal as keyof typeof signalOrder] || 0;
      }

      // Handle pullback sorting (boolean: show pullbacks first)
      if (sortColumn === "pullback") {
        aVal = a.pullback ? 1 : 0;
        bVal = b.pullback ? 1 : 0;
      }

      // Handle numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Handle string comparison
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

  const handleOpenOrderModal = (stock: ScanResult) => {
    setSelectedStock(stock);
    setIsModalOpen(true);
  };

  const handleCloseOrderModal = () => {
    setIsModalOpen(false);
    setSelectedStock(null);
  };

  const handlePlaceOrder = async (request: PlacePaperOrderRequest) => {
    return await placeOrder(request);
  };

  return (
    <>
      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Stock Scanner</h2>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <p className="text-sm text-gray-400">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {loading ? "Scanning..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Market Signal Banner */}
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
            <div className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${
              marketSignal.signal === "GREEN"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              <span className="text-xl">
                {marketSignal.signal === "GREEN" ? "🟢" : "🔴"}
              </span>
              <div>
                <p className="text-sm font-bold">
                  Market: {marketSignal.signal === "GREEN" ? "Bullish" : "Bearish"} — Nifty 50 {marketSignal.signal === "GREEN" ? "above" : "below"} 200 DMA
                </p>
                <p className="text-xs opacity-75">
                  Nifty: ₹{marketSignal.close.toFixed(2)} &nbsp;|&nbsp; 200 DMA: ₹{marketSignal.dma200.toFixed(2)} &nbsp;|&nbsp; Distance: {Number(marketSignal.distancePercent) >= 0 ? "+" : ""}{marketSignal.distancePercent}%
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-6">
            <p className="font-semibold mb-2">⚠️ Scan Error</p>
            <p className="text-sm">{error}</p>
            {error.includes("Kite") && (
              <p className="text-xs mt-2 text-red-400/70">
                Please ensure Kite API credentials are properly configured and the API is accessible.
              </p>
            )}
          </div>
        )}

        {loading && results.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin mb-4">
              <div className="w-8 h-8 border-4 border-gray-600 border-t-blue-400 rounded-full" />
            </div>
            <p className="text-gray-400">Scanning stocks...</p>
          </div>
        )}

      {results.length > 0 && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th
                    onClick={() => handleSort("symbol")}
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    Symbol{renderSortIndicator("symbol")}
                  </th>
                  <th
                    onClick={() => handleSort("price")}
                    className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    Price{renderSortIndicator("price")}
                  </th>
                  <th
                    onClick={() => handleSort("change")}
                    className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    Change{renderSortIndicator("change")}
                  </th>
                  <th
                    onClick={() => handleSort("rsi")}
                    className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    RSI{renderSortIndicator("rsi")}
                  </th>
                  <th
                    onClick={() => handleSort("ema50")}
                    className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    EMA50{renderSortIndicator("ema50")}
                  </th>
                  <th
                    onClick={() => handleSort("dma10")}
                    className="px-6 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    DMA10{renderSortIndicator("dma10")}
                  </th>
                  <th
                    onClick={() => handleSort("pullback")}
                    className="px-6 py-3 text-center text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    Pullback{renderSortIndicator("pullback")}
                  </th>
                  <th
                    onClick={() => handleSort("signal")}
                    className="px-6 py-3 text-center text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                  >
                    Signal{renderSortIndicator("signal")}
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-300">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sortedResults = getSortedResults();
                  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
                  const endIdx = startIdx + ITEMS_PER_PAGE;
                  const paginatedResults = sortedResults.slice(startIdx, endIdx);

                  return paginatedResults.map((result, idx) => {
                    const changeIsPositive = result.change >= 0;
                    const signalColor =
                      result.signal === "BUY"
                        ? "text-green-400"
                        : result.signal === "SELL"
                        ? "text-red-400"
                        : "text-yellow-400";

                    const triggeredStrategies = (result.strategySignals ?? []).filter(
                      (s) => s.signal === "BUY" || s.signal === "SELL"
                    );
                    const allTriggered =
                      triggeredStrategies.length > 0 &&
                      triggeredStrategies.length === STRATEGIES.length;
                    const tooltipText = allTriggered
                      ? "All strategies"
                      : triggeredStrategies.length > 0
                      ? triggeredStrategies.map((s) => s.strategyName).join(", ")
                      : "No strategy triggered";
                    const popupKey = `${idx}-signal`;

                    return (
                      <tr
                        key={idx}
                        className="border-b border-gray-700/50 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-6 py-4 font-semibold text-blue-400">
                          <div className="relative inline-flex items-center gap-1">
                            {result.symbol}
                            <button
                              onClick={() => setActiveIndicatorPopup(activeIndicatorPopup === `${idx}-ind` ? null : `${idx}-ind`)}
                              className="text-gray-500 hover:text-blue-400 transition-colors text-xs leading-none"
                              title="Show indicators"
                            >
                              ⓘ
                            </button>
                            {activeIndicatorPopup === `${idx}-ind` && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setActiveIndicatorPopup(null)}
                                />
                                <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-slate-800 border border-gray-600 rounded-lg shadow-xl p-3 text-left">
                                  <p className="text-xs font-bold text-gray-300 mb-2 border-b border-gray-600 pb-1">
                                    Indicators — {result.symbol}
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                    {([
                                      ["Price",        result.indicators?.price?.toFixed(2)],
                                      ["RSI",          result.indicators?.rsi?.toFixed(1)],
                                      ["EMA 20",       result.indicators?.ema20?.toFixed(2)],
                                      ["EMA 50",       result.indicators?.ema50?.toFixed(2)],
                                      ["DMA 10",       result.indicators?.dma10?.toFixed(2)],
                                      ["DMA 50",       result.indicators?.dma50?.toFixed(2)],
                                      ["DMA 200",      result.indicators?.dma200?.toFixed(2)],
                                      ["Volume",       result.indicators?.volume?.toLocaleString()],
                                      ["Avg Vol 20",   result.indicators?.avgVolume20?.toFixed(0)],
                                      ["High 20",      result.indicators?.high20?.toFixed(2)],
                                      ["Swing Low",    result.indicators?.recentSwingLow?.toFixed(2)],
                                      ["Pullback Hi",  result.indicators?.pullbackHigh?.toFixed(2)],
                                      ["Pullback Lo",  result.indicators?.pullbackLow?.toFixed(2)],
                                      ["Pullback",     result.indicators?.isPullback ? "Yes" : "No"],
                                    ] as [string, string | undefined][]).map(([label, val]) => (
                                      <div key={label} className="flex justify-between text-xs py-0.5">
                                        <span className="text-gray-400">{label}</span>
                                        <span className="text-gray-200 font-mono">{val ?? "—"}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-300">
                          ₹{result.ltp.toFixed(2)}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-semibold ${
                            changeIsPositive ? "text-positive" : "text-negative"
                          }`}
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
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              result.pullback
                                ? "bg-green-500/20 text-green-400"
                                : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {result.pullback ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setActivePopup(activePopup === popupKey ? null : popupKey)}
                              title={tooltipText}
                              className={`font-semibold hover:underline cursor-pointer ${signalColor}`}
                            >
                              {result.signal}
                            </button>
                            {activePopup === popupKey && (
                              <>
                                {/* Transparent overlay to close popup on outside click */}
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setActivePopup(null)}
                                />
                                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-800 border border-gray-600 rounded-lg shadow-xl p-3 text-left">
                                  <p className="text-xs font-bold text-gray-300 mb-2 border-b border-gray-600 pb-1">
                                    Strategy Signals
                                  </p>
                                  {(result.strategySignals ?? []).map((s) => (
                                    <div key={s.strategyId} className="flex items-center justify-between py-1">
                                      <span className="text-xs text-gray-400">{s.strategyName}</span>
                                      <span className={`text-xs font-semibold ${
                                        s.signal === "BUY" ? "text-green-400"
                                        : s.signal === "SELL" ? "text-red-400"
                                        : "text-gray-500"
                                      }`}>
                                        {s.signal}
                                      </span>
                                    </div>
                                  ))}
                                  {allTriggered && (
                                    <p className="text-xs text-blue-400 font-semibold mt-2 pt-1 border-t border-gray-600">✓ All strategies agree</p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleOpenOrderModal(result)}
                            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            Paper Trade
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.length > ITEMS_PER_PAGE && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, results.length)} of{" "}
                {results.length} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-semibold"
                >
                  ← Previous
                </button>
                <div className="flex items-center gap-2">
                  {(() => {
                    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
                    const pages = [];
                    const maxVisible = 5;
                    let startPage = Math.max(1, currentPage - 2);
                    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                    if (endPage - startPage < maxVisible - 1) {
                      startPage = Math.max(1, endPage - maxVisible + 1);
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${
                            currentPage === i
                              ? "bg-blue-600 text-white"
                              : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                          }`}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pages;
                  })()}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(Math.ceil(results.length / ITEMS_PER_PAGE), p + 1)
                    )
                  }
                  disabled={currentPage === Math.ceil(results.length / ITEMS_PER_PAGE)}
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

      {/* Place Order Modal - Rendered outside glass container */}
      <PlaceOrderModal
        isOpen={isModalOpen}
        stock={selectedStock}
        onClose={handleCloseOrderModal}
        onPlaceOrder={handlePlaceOrder}
      />
    </>
  );
}
