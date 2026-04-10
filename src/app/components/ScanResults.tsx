"use client";

import { useEffect, useState } from "react";
import type { ScanResult, PlacePaperOrderRequest } from "@/lib/types";
import { usePaperTrading } from "@/features/paperTrading";
import { PlaceOrderModal } from "@/features/paperTrading";

const ITEMS_PER_PAGE = 20;

type SortColumn = "symbol" | "price" | "change" | "rsi" | "ema50" | "dma10" | "signal";
type SortDirection = "asc" | "desc";

export default function ScanResults() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("signal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<ScanResult | null>(null);
  const { placeOrder, account } = usePaperTrading();

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
        setError(data.error || "Failed to fetch scan results");
      }
    } catch (err: any) {
      setError(err.message || "Error fetching scan results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch on mount
    fetchScanResults();

    // Refresh every 30 seconds
    const interval = setInterval(fetchScanResults, 30000);

    return () => clearInterval(interval);
  }, []);

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
    <div className="glass rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Stock Scanner Results</h2>
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <p className="text-sm text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={fetchScanResults}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {loading ? "Scanning..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-6">
          {error}
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
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-300">
                    Pullback
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

                    return (
                      <tr
                        key={idx}
                        className="border-b border-gray-700/50 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-6 py-4 font-semibold text-blue-400">
                          {result.symbol}
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
                        <td className={`px-6 py-4 text-center font-semibold ${signalColor}`}>
                          {result.signal}
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

      {/* Place Order Modal */}
      <PlaceOrderModal
        isOpen={isModalOpen}
        stock={selectedStock}
        onClose={handleCloseOrderModal}
        onPlaceOrder={handlePlaceOrder}
        totalCapital={account?.totalCapital}
      />
    </div>
  );
}
