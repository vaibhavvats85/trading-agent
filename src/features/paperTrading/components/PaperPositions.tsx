"use client";

import { useState } from "react";
import type { PaperPosition } from "@/lib/types";

interface PaperPositionsDisplayProps {
  positions: PaperPosition[];
  onClosePosition: (positionId: string, closePrice: number) => Promise<void>;
  isLoading?: boolean;
}

export default function PaperPositions({
  positions,
  onClosePosition,
  isLoading = false,
}: PaperPositionsDisplayProps) {
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [closePrices, setClosePrices] = useState<Record<string, string>>({});

  const handleCloseClick = async (positionId: string) => {
    const price = closePrices[positionId];
    if (!price) {
      alert("Please enter close price");
      return;
    }

    await onClosePosition(positionId, parseFloat(price));
    setClosingPositionId(null);
    setClosePrices((prev) => {
      const newPrices = { ...prev };
      delete newPrices[positionId];
      return newPrices;
    });
  };

  if (positions.length === 0) {
    return (
      <div className="glass rounded-lg p-6">
        <p className="text-center text-gray-400">No open paper trading positions</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-xl font-bold">📊 Open Positions ({positions.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700/50 border-b border-gray-700">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Symbol</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Qty</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">
                Entry Price
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">
                Current Price
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">
                Invested
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">Current</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-300">P&L</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const isPositive = position.pnl >= 0;
              const isClosing = closingPositionId === position.id;

              return (
                <tr
                  key={position.id}
                  className="border-b border-gray-700/50 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-blue-400">{position.symbol}</td>
                  <td className="px-6 py-4 text-right text-gray-300">{position.quantity}</td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹{position.entryPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹{position.currentPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹{position.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹{position.current.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-semibold ${
                      isPositive ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    ₹{position.pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    <br />
                    <span className="text-xs">
                      {isPositive ? "+" : ""}
                      {position.pnlPercent}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {!isClosing ? (
                      <button
                        onClick={() => setClosingPositionId(position.id)}
                        disabled={isLoading}
                        className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-50 text-red-400 rounded text-sm font-semibold transition-colors"
                      >
                        Close
                      </button>
                    ) : (
                      <div className="flex gap-2 items-center justify-center">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={closePrices[position.id] || ""}
                          onChange={(e) =>
                            setClosePrices((prev) => ({
                              ...prev,
                              [position.id]: e.target.value,
                            }))
                          }
                          className="w-20 px-2 py-1 bg-slate-700 text-white rounded text-sm"
                        />
                        <button
                          onClick={() => handleCloseClick(position.id)}
                          disabled={isLoading || !closePrices[position.id]}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setClosingPositionId(null)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
