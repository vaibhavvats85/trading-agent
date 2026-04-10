"use client";

import { useState, useEffect } from "react";
import type { ScanResult, PlacePaperOrderRequest } from "@/lib/types";

interface PlaceOrderModalProps {
  isOpen: boolean;
  stock: ScanResult | null;
  onClose: () => void;
  onPlaceOrder: (request: PlacePaperOrderRequest) => Promise<{ success: boolean; message: string }>;
  totalCapital?: number;
  maxQty?: number;
}

function calcTradeParams(stock: ScanResult, orderType: "BUY" | "SELL", totalCapital?: number) {
  const entry = stock.ltp;
  const swingLow = stock.indicators?.recentSwingLow ?? 0;

  let stopLoss: number;
  if (orderType === "BUY") {
    const useSwingLow =
      swingLow > 0 && swingLow < entry && (entry - swingLow) / entry <= 0.1;
    stopLoss = useSwingLow ? swingLow : entry * 0.97;
  } else {
    stopLoss = entry * 1.03;
  }

  const risk = Math.abs(entry - stopLoss);
  const target =
    orderType === "BUY" ? entry + 2 * risk : entry - 2 * risk;

  const allocation = totalCapital ? totalCapital / 4 : 0;
  const qty = allocation > 0 ? Math.floor(allocation / entry) : 1;

  return { stopLoss, target, qty };
}

export default function PlaceOrderModal({
  isOpen,
  stock,
  onClose,
  onPlaceOrder,
  totalCapital,
  maxQty = 1000,
}: PlaceOrderModalProps) {
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Recalculate whenever the modal opens or order type changes
  useEffect(() => {
    if (!stock) return;
    const { qty } = calcTradeParams(stock, orderType, totalCapital);
    setQuantity(String(qty > 0 ? qty : 1));
  }, [stock, orderType, totalCapital]);

  if (!isOpen || !stock) return null;

  const { stopLoss, target } = calcTradeParams(stock, orderType, totalCapital);
  const qty = parseInt(quantity) || 0;
  const totalAmount = qty * stock.ltp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!quantity || qty <= 0) {
      setMessage("Please enter valid quantity");
      return;
    }

    setLoading(true);
    const { stopLoss: sl, target: tgt } = calcTradeParams(stock, orderType, totalCapital);
    const result = await onPlaceOrder({
      symbol: stock.symbol,
      orderType,
      quantity: qty,
      pricePerUnit: stock.ltp,
      signalType: stock.signal,
      stopLoss: sl,
      target: tgt,
    });

    setLoading(false);

    if (result.success) {
      setMessage(result.message);
      setTimeout(() => {
        onClose();
        setQuantity("1");
        setOrderType("BUY");
        setMessage(null);
      }, 2000);
    } else {
      setMessage(result.message);
    }
  };

  const getButtonClass = (type: "BUY" | "SELL") => {
    if (orderType === type) {
      return type === "BUY"
        ? "bg-green-500 hover:bg-green-600 text-white"
        : "bg-red-500 hover:bg-red-600 text-white";
    }
    return "bg-slate-700 hover:bg-slate-600 text-gray-300";
  };

  const getSubmitButtonClass = () => {
    return orderType === "BUY"
      ? "bg-green-500 hover:bg-green-600 text-white"
      : "bg-red-500 hover:bg-red-600 text-white";
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Container for proper centering */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-sm border border-gray-600 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-gray-600 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">{stock.symbol}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Current Price + Trade Params */}
            <div className="mb-4 pb-4 border-b border-gray-700">
              <p className="text-sm text-gray-400 mb-1">Current Price</p>
              <p className="text-2xl font-bold text-blue-400">₹{stock.ltp.toFixed(2)}</p>
            </div>

            {/* Pre-calculated SL / Target */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Stop Loss</p>
                <p className="text-sm font-bold text-red-400">₹{stopLoss.toFixed(2)}</p>
                <p className="text-xs text-gray-500">
                  {(Math.abs(stock.ltp - stopLoss) / stock.ltp * 100).toFixed(1)}% away
                </p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Target (2R)</p>
                <p className="text-sm font-bold text-green-400">₹{target.toFixed(2)}</p>
                <p className="text-xs text-gray-500">
                  {(Math.abs(target - stock.ltp) / stock.ltp * 100).toFixed(1)}% away
                </p>
              </div>
            </div>

            {/* Order Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Order Type</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOrderType("BUY")}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${getButtonClass("BUY")}`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("SELL")}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${getButtonClass("SELL")}`}
                >
                  SELL
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Quantity</label>
              <input
                type="number"
                min="1"
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Total Amount */}
            <div className="bg-slate-800/60 rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400 mb-1">Total Amount</p>
              <p className="text-xl font-bold text-blue-400">
                ₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Signal Info */}
            {stock.signal !== "NO TRADE" && (
              <div
                className={`rounded-lg p-3 text-sm font-semibold border ${
                  stock.signal === "BUY"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                }`}
              >
                Signal: {stock.signal}
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                className={`rounded-lg p-3 text-sm font-semibold border ${
                  message.includes("Failed") || message.includes("Insufficient")
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "bg-green-500/20 text-green-400 border-green-500/30"
                }`}
              >
                {message}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all text-white disabled:opacity-50 ${getSubmitButtonClass()}`}
              >
                {loading ? "Placing..." : `${orderType} Now`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
