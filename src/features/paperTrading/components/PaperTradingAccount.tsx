"use client";

import type { PaperTradingAccount } from "@/lib/types";

interface PaperTradingAccountDisplayProps {
  account: PaperTradingAccount;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  isLive?: boolean;
  lastUpdateTime?: Date | null;
}

export default function PaperTradingAccount({ 
  account, 
  onRefresh,
  isRefreshing = false,
  isLive = false,
  lastUpdateTime = null,
}: PaperTradingAccountDisplayProps) {
  if (!account) {
    return <div className="p-4 text-gray-400">Loading account data...</div>;
  }

  const isPositiveReturn = parseFloat(account.totalPnlPercent || "0") >= 0;

  return (
    <>
      {/* Account Stats Row */}
      <div className="flex items-center justify-between gap-6 mb-6 p-4 bg-slate-800/50 rounded-lg border border-gray-700">
        <div>
          <p className="text-gray-400 text-sm">Total Capital</p>
          <p className="text-lg font-bold">₹{(account.totalCapital || 0).toLocaleString("en-IN")}</p>
        </div>

        <div>
          <p className="text-gray-400 text-sm">Available Balance</p>
          <p className="text-lg font-bold text-green-400">
            ₹{(account.availableBalance || 0).toLocaleString("en-IN")}
          </p>
        </div>

        <div>
          <p className="text-gray-400 text-sm">Invested</p>
          <p className="text-lg font-bold text-blue-400">
            ₹{(account.investedAmount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gray-400 text-sm">Total P&L</p>
            {isLive ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                LIVE
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-600/30 text-gray-500 border border-gray-600/30">
                DELAYED
              </span>
            )}
          </div>
          <p className={`text-lg font-bold ${isPositiveReturn ? "text-green-400" : "text-red-400"}`}>
            ₹{(account.totalPnl || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <p className={`text-xs ${isPositiveReturn ? "text-green-400" : "text-red-400"}`}>
            {isPositiveReturn ? "+" : ""}
            {account.totalPnlPercent}%
            {lastUpdateTime && (
              <span className="text-gray-500 ml-1">· {lastUpdateTime.toLocaleTimeString()}</span>
            )}
          </p>
        </div>

        <div className="text-right">
          <p className="text-gray-400 text-sm">Open Positions</p>
          <p className="text-lg font-bold text-white">{(account.positions || []).length}</p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="ml-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            title="Refresh P&L with real-time prices"
          >
            {isRefreshing ? "⟳" : "↻"} Refresh
          </button>
        )}
      </div>
    </>
  );
}
