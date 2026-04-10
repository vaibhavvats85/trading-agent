"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "@/features/portfolio";
import type { PaperPosition } from "@/lib/types";

/**
 * Hook to update paper trading positions with real-time prices via WebSocket
 * Listens to paper-positions-update event from KiteTicker prices
 */
export function usePaperPositionPrices(positions: PaperPosition[]) {
  const { socket, isConnected } = useSocket();
  const [updatedPositions, setUpdatedPositions] = useState<PaperPosition[]>(positions);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Update displayed positions when input changes (initial load)
  useEffect(() => {
    setUpdatedPositions(positions);
  }, [positions]);

  // Subscribe to WebSocket paper positions updates with real-time KiteTicker prices
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log("📡 WebSocket not connected for paper positions");
      return;
    }

    const handlePaperPositionsUpdate = (data: any) => {
      if (data.success && data.data && Array.isArray(data.data)) {
        setUpdatedPositions(data.data);
        setLastUpdateTime(new Date());
        console.log("📊 Paper positions updated via WebSocket with real-time prices", data.data);
      }
    };

    socket.on("paper-positions-update", handlePaperPositionsUpdate);
    console.log("🔌 Paper Trading: Listening to paper-positions-update WebSocket event");

    return () => {
      socket.off("paper-positions-update", handlePaperPositionsUpdate);
    };
  }, [socket, isConnected]);

  // Fallback: Manual refresh function if websocket is unavailable
  const refreshPrices = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/paper-trading/account", {
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success && data.data && data.data.positions) {
        setUpdatedPositions(data.data.positions);
        setLastUpdateTime(new Date());
        console.log("✅ Paper positions manually refreshed from API");
      }
    } catch (error) {
      console.error("❌ Error refreshing paper positions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    positions: updatedPositions,
    isLoading,
    lastUpdateTime,
    refreshPrices,
    isLive: isConnected,
  };
}
