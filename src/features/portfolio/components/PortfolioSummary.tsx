"use client";

import type { PortfolioSummary as PortfolioSummaryType } from "@/lib/types";

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType;
}

export default function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  // Handle undefined or null values
  if (!summary) {
    return <div className="text-gray-400">Loading portfolio summary...</div>;
  }

  const totalPnl = typeof summary.totalPnl === "number" ? summary.totalPnl : 0;
  const totalTodayPnl = typeof summary.totalTodayPnl === "number" ? summary.totalTodayPnl : 0;
  const isPositive = totalPnl >= 0;
  const isDayPositive = totalTodayPnl >= 0;

  return (
    <>
      {/* Portfolio Stats Row */}
      <div className="flex items-center justify-between gap-6 mb-6 p-4 bg-slate-800/50 rounded-lg border border-gray-700 overflow-x-auto">
        <div>
          <p className="text-gray-400 text-sm">Total Invested</p>
          <p className="text-lg font-bold">
            ₹
            {typeof summary.totalInvested === "number"
              ? summary.totalInvested.toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })
              : "0"}
          </p>
        </div>

        <div>
          <p className="text-gray-400 text-sm">Current Value</p>
          <p className="text-lg font-bold">
            ₹
            {typeof summary.totalCurrent === "number"
              ? summary.totalCurrent.toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })
              : "0"}
          </p>
        </div>

        <div>
          <p className="text-gray-400 text-sm">Overall P&L</p>
          <p className={`text-lg font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
            ₹
            {typeof totalPnl === "number"
              ? totalPnl.toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })
              : "0"}
          </p>
          <p className={`text-xs ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}
            {typeof summary.totalPnlPercent === "string"
              ? summary.totalPnlPercent
              : "0"}
            %
          </p>
        </div>

        <div>
          <p className="text-gray-400 text-sm">Today's P&L</p>
          <p className={`text-lg font-bold ${isDayPositive ? "text-green-400" : "text-red-400"}`}>
            ₹
            {typeof totalTodayPnl === "number"
              ? totalTodayPnl.toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })
              : "0"}
          </p>
          <p className={`text-xs ${isDayPositive ? "text-green-400" : "text-red-400"}`}>
            {isDayPositive ? "+" : ""}
            {typeof summary.totalTodayPnlPercent === "string"
              ? summary.totalTodayPnlPercent
              : "0"}
            %
          </p>
        </div>

        {/* NIFTY50 Display */}
        {summary.nifty50 && (
          <div>
            <p className="text-gray-400 text-sm">NIFTY50</p>
            <p className="text-lg font-bold">
              {typeof summary.nifty50.ltp === "number"
                ? summary.nifty50.ltp.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })
                : "0"}
            </p>
            <p
              className={`text-xs ${
                (summary.nifty50.change ?? 0) >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {(summary.nifty50.change ?? 0) >= 0 ? "+" : ""}
              {typeof summary.nifty50.change === "number"
                ? summary.nifty50.change.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })
                : "0"}{" "}
              ({typeof summary.nifty50.changePercent === "number"
                ? summary.nifty50.changePercent.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })
                : "0"}
              %)
            </p>
          </div>
        )}
      </div>
    </>
  );
}
