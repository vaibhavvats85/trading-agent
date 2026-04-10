"use client";

import type { Holding } from "@/lib/types";

interface PortfolioTableProps {
  holdings: Holding[];
}

export default function PortfolioTable({ holdings }: PortfolioTableProps) {
  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-gray-700">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                Symbol
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                Quantity
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                Avg Price
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                Current Price
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                Invested
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                Current Value
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                P&L (Total)
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                P&L (Today)
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding, idx) => {
              const pnl = typeof holding.pnl === "number" ? holding.pnl : 0;
              // Use server-computed todayPnl: (currentPrice - prevClose) × quantity
              const todayPnl = typeof holding.todayPnl === "number" ? holding.todayPnl : 0;
              const todayPnlPercent =
                typeof holding.todayPnlPercent === "string" ? holding.todayPnlPercent : "0.00";
              const isPositive = pnl >= 0;
              const isDayPositive = todayPnl >= 0;

              return (
                <tr
                  key={idx}
                  className="border-b border-gray-700/50 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-blue-400">
                    {holding.symbol ?? "N/A"}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300">
                    {typeof holding.quantity === "number" ? holding.quantity : 0}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹
                    {typeof holding.avgPrice === "number"
                      ? holding.avgPrice.toFixed(2)
                      : "0"}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹
                    {typeof holding.currentPrice === "number"
                      ? holding.currentPrice.toFixed(2)
                      : "0"}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹
                    {typeof holding.invested === "number"
                      ? holding.invested.toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })
                      : "0"}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    ₹
                    {typeof holding.current === "number"
                      ? holding.current.toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })
                      : "0"}
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-semibold ${
                      isPositive ? "text-positive" : "text-negative"
                    }`}
                  >
                    ₹
                    {typeof pnl === "number"
                      ? pnl.toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })
                      : "0"}
                    <br />
                    <span className="text-xs">
                      {isPositive ? "+" : ""}
                      {typeof holding.pnlPercent === "string"
                        ? holding.pnlPercent
                        : "0"}
                      %
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-semibold ${
                      isDayPositive ? "text-positive" : "text-negative"
                    }`}
                  >
                    ₹
                    {typeof todayPnl === "number"
                      ? todayPnl.toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })
                      : "0"}
                    <br />
                    <span className="text-xs">
                      {isDayPositive ? "+" : ""}
                      {todayPnlPercent}%
                    </span>
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
