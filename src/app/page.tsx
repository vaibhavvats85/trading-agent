"use client";

import { useState } from "react";
import { useSocket, PortfolioSummary, PortfolioTable } from "@/features/portfolio";
import { usePaperTrading, usePaperPositionPrices, PaperTradingAccount, PaperPositions } from "@/features/paperTrading";
import { ScanResults } from "@/features/scan";
import { Loading } from "@/features/shared";

type TabType = "portfolio" | "scan" | "paper-trading";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("portfolio");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isConnected, portfolio, summary, error, loading } = useSocket();
  const { account, loading: paperLoading, resetAccount, closePosition, refreshAccount } = usePaperTrading();
  
  // Use live positions with real-time prices
  const { positions: livePositions, refreshPrices } = usePaperPositionPrices(account?.positions || []);

  const handleClosePosition = async (positionId: string, closePrice: number) => {
    await closePosition(positionId, closePrice);
    // Refresh account after closing position
    setTimeout(refreshAccount, 500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPrices();
    setIsRefreshing(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                📈 Trading Agent
              </h1>
              <p className="text-gray-400">
                NIFTY 50 Swing Trading Scanner with Real-time Portfolio
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/docs"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/60 transition-all"
              >
                📖 Docs
              </a>
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-red-500"
                  } animate-pulse`}
                />
                <span className="text-sm text-gray-400">
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            <p className="font-medium">⚠️ Error: {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && <Loading />}

        {/* Content */}
        {!loading && (
          <>
            {/* Tab Navigation */}
            <div className="mb-6 flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab("portfolio")}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === "portfolio"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                    : "glass text-gray-300 hover:text-white"
                }`}
              >
                💼 My Portfolio
              </button>
              <button
                onClick={() => setActiveTab("scan")}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === "scan"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                    : "glass text-gray-300 hover:text-white"
                }`}
              >
                🔍 Scan Results
              </button>
              <button
                onClick={() => setActiveTab("paper-trading")}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === "paper-trading"
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg"
                    : "glass text-gray-300 hover:text-white"
                }`}
              >
                📊 Paper Trading
              </button>
            </div>

            {/* Portfolio Tab */}
            {activeTab === "portfolio" && (
              <div className="space-y-6">
                {/* Portfolio Summary */}
                {summary && <PortfolioSummary summary={summary} />}

                {/* Portfolio Holdings Table */}
                {portfolio.length > 0 ? (
                  <PortfolioTable holdings={portfolio} />
                ) : (
                  <div className="glass rounded-lg p-8 text-center">
                    <p className="text-gray-400">No holdings found</p>
                  </div>
                )}
              </div>
            )}

            {/* Scan Results Tab */}
            {activeTab === "scan" && <ScanResults />}

            {/* Paper Trading Tab */}
            {activeTab === "paper-trading" && (
              <div className="space-y-6">
                {paperLoading ? (
                  <Loading />
                ) : account ? (
                  <>
                    {/* Account Overview */}
                    <PaperTradingAccount 
                      account={account} 
                      onRefresh={handleRefresh}
                      isRefreshing={isRefreshing}
                    />

                    {/* Control Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={resetAccount}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Reset Account
                      </button>
                    </div>

                    {/* Positions Table */}
                    {livePositions.length > 0 ? (
                      <PaperPositions
                        positions={livePositions}
                        onClosePosition={handleClosePosition}
                        isLoading={paperLoading}
                      />
                    ) : (
                      <div className="glass rounded-lg p-8 text-center">
                        <p className="text-gray-400">No open positions</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="glass rounded-lg p-8 text-center">
                    <p className="text-gray-400">Failed to load paper trading account</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
