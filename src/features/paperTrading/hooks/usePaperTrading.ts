"use client";

import { useEffect, useState } from "react";
import type { PaperTradingAccount, PlacePaperOrderRequest } from "@/lib/types";

export function usePaperTrading() {
  const [account, setAccount] = useState<PaperTradingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch account on mount
  const fetchAccount = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/paper-trading/account", {
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success) {
        setAccount(data.data);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch paper trading account");
      }
    } catch (err: any) {
      setError(err.message || "Error fetching account");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  // Place an order
  const placeOrder = async (request: PlacePaperOrderRequest) => {
    try {
      const response = await fetch("/api/paper-trading/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        cache: "no-store",
      });

      const data = await response.json();

      if (data.success) {
        setAccount(data.data.account);
        setError(null);
        return { success: true, message: data.message };
      } else {
        const errorMsg = data.error || "Failed to place order";
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || "Error placing order";
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  };

  // Close a position
  const closePosition = async (positionId: string, currentPrice: number) => {
    try {
      const response = await fetch("/api/paper-trading/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, currentPrice }),
        cache: "no-store",
      });

      const data = await response.json();

      if (data.success) {
        setAccount(data.data);
        setError(null);
        return { success: true, message: data.message };
      } else {
        const errorMsg = data.error || "Failed to close position";
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || "Error closing position";
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  };

  // Reset account
  const resetAccount = async () => {
    try {
      const response = await fetch("/api/paper-trading/reset", {
        method: "POST",
        cache: "no-store",
      });

      const data = await response.json();

      if (data.success) {
        setAccount(data.data);
        setError(null);
        return { success: true, message: data.message };
      } else {
        const errorMsg = data.error || "Failed to reset account";
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || "Error resetting account";
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  };

  return {
    account,
    loading,
    error,
    placeOrder,
    closePosition,
    resetAccount,
    refreshAccount: fetchAccount,
  };
}
