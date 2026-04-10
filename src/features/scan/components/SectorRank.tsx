"use client";

import { useEffect, useState } from "react";
import type { SectorRankResult } from "@/lib/scanner/sectorRank";

export default function SectorRank({
  externalSectors = null,
}: {
  externalSectors?: SectorRankResult[] | null;
} = {}) {
  const [sectors, setSectors] = useState<SectorRankResult[]>(
    externalSectors || [],
  );
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Always update sectors when externalSectors changes
    if (externalSectors && externalSectors.length > 0) {
      console.log(
        "[SectorRank] Updating with external sectors:",
        externalSectors.length,
      );
      console.log("[SectorRank] First sector data:", externalSectors[0]);
      setSectors(externalSectors);
    }
  }, [externalSectors]);

  return (
    <div className="glass rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">Sector Rankings</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Ranked by % stocks above 50 EMA · Sectors below their 50 EMA excluded from top picks
          </p>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-white transition-colors text-sm px-2 py-1"
        >
          {collapsed ? "▼ Show" : "▲ Hide"}
        </button>
      </div>

      {!collapsed && (
        <>
          {sectors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs">
                    <th className="py-2 px-3 text-left w-8">#</th>
                    <th className="py-2 px-3 text-left">Sector</th>
                    <th className="py-2 px-3 text-center">
                      Stocks Above EMA50
                    </th>
                    <th className="py-2 px-3 text-center w-40">
                      % Above EMA50
                    </th>
                    <th className="py-2 px-3 text-right">Index Price</th>
                    <th className="py-2 px-3 text-right">50 EMA</th>
                    <th className="py-2 px-3 text-center">Momentum</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s) => {
                    const hasScanData = s.stockCount > 0;
                    const hasIndexData = s.indexPrice !== null;
                    const barPct = Math.round(s.pctAboveEma50);
                    const barColor =
                      barPct >= 70
                        ? "bg-green-500"
                        : barPct >= 40
                          ? "bg-yellow-500"
                          : "bg-red-500";
                    const momentumColor =
                      s.momentum === "ABOVE"
                        ? "text-green-400"
                        : s.momentum === "BELOW"
                          ? "text-red-400"
                          : "text-gray-500";

                    return (
                      <tr
                        key={s.indexSymbol}
                        className={`border-b border-gray-700/40 hover:bg-slate-700/20 transition-colors ${
                          s.indexEma50 !== null && s.indexPrice !== null && s.indexPrice < s.indexEma50
                            ? "opacity-50"
                            : ""
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              s.rank === 1
                                ? "bg-yellow-500/20 text-yellow-400"
                                : s.rank === 2
                                  ? "bg-gray-400/20 text-gray-300"
                                  : s.rank === 3
                                    ? "bg-orange-700/20 text-orange-400"
                                    : "bg-slate-700 text-gray-400"
                            }`}
                          >
                            {s.rank}
                          </span>
                        </td>

                        {/* Sector */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">
                              {s.sectorName}
                            </p>
                            {s.indexEma50 !== null && s.indexPrice !== null && s.indexPrice < s.indexEma50 && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded whitespace-nowrap">
                                ↓ 50 EMA
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {s.indexSymbol}
                          </p>
                        </td>

                        {/* Stocks above EMA50 count */}
                        <td className="py-2.5 px-3 text-center text-gray-300">
                          {hasScanData ? (
                            `${s.stocksAboveEma50} / ${s.stockCount}`
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>

                        {/* % bar */}
                        <td className="py-2.5 px-3">
                          {hasScanData ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-700 rounded-full h-1.5 min-w-[60px]">
                                <div
                                  className={`h-1.5 rounded-full ${barColor} transition-all`}
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                              <span
                                className={`text-xs font-semibold w-8 text-right ${
                                  barPct >= 70
                                    ? "text-green-400"
                                    : barPct >= 40
                                      ? "text-yellow-400"
                                      : "text-red-400"
                                }`}
                              >
                                {barPct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">
                              Run scan first
                            </span>
                          )}
                        </td>

                        {/* Index price */}
                        <td className="py-2.5 px-3 text-right text-gray-300 font-mono text-xs">
                          {hasIndexData ? (
                            `₹${s.indexPrice!.toFixed(2)}`
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>

                        {/* 50 EMA */}
                        <td className="py-2.5 px-3 text-right text-gray-400 font-mono text-xs">
                          {s.indexEma50 !== null ? (
                            `₹${s.indexEma50.toFixed(2)}`
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>

                        {/* Momentum */}
                        <td className="py-2.5 px-3 text-center">
                          {s.momentum !== "UNKNOWN" ? (
                            <div
                              className={`inline-flex flex-col items-center ${momentumColor}`}
                            >
                              <span className="font-bold text-xs">
                                {s.momentum === "ABOVE"
                                  ? "🟢 Above"
                                  : "🔴 Below"}
                              </span>
                              {s.distanceFromEma20Pct !== null && (
                                <span className="text-xs opacity-75">
                                  {s.distanceFromEma20Pct >= 0 ? "+" : ""}
                                  {s.distanceFromEma20Pct.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">📊 No sector data available</p>
              <p className="text-xs mt-1">Run a NIFTY100 scan first to calculate sector rankings</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
