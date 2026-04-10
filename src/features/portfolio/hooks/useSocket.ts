import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { PortfolioUpdateMessage, Holding, PortfolioSummary } from "@/lib/types";

interface UseSocketResult {
  socket: Socket | null;
  isConnected: boolean;
  portfolio: Holding[];
  summary: PortfolioSummary | null;
  error: string | null;
  loading: boolean;
}

/**
 * Hook to manage portfolio data via WebSocket
 * Holdings are always streamed from WebSocket, not from REST API polling
 */
export function useSocket(): UseSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always use Socket.io for portfolio updates
    const socketInstance = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
      {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      }
    );

    socketInstance.on("connect", () => {
      console.log("✅ Connected to WebSocket server");
      setIsConnected(true);
      setError(null);
    });

    socketInstance.on("disconnect", () => {
      console.log("📡 Disconnected from WebSocket server");
      setIsConnected(false);
    });

    socketInstance.on("portfolio-update", (data: PortfolioUpdateMessage) => {
      if (data.success) {
        setPortfolio(data.data);
        setSummary(data.summary);
        setError(null);
      } else {
        setError("Failed to fetch portfolio data");
      }
      setLoading(false);
    });

    socketInstance.on("auth-required", () => {
      console.warn("🔐 Kite token expired – redirecting to logout");
      socketInstance.disconnect();
      // The cookie is httpOnly, so JS cannot clear it directly.
      // Hit the server-side logout endpoint which clears the cookie and
      // redirects to /login.
      window.location.href = "/api/logout";
    });

    socketInstance.on("error", (err: any) => {
      console.error("❌ WebSocket error:", err);
      setError(err.message || "Connection error");
    });

    socketInstance.on("connect_error", (error: any) => {
      console.error("❌ Connection error:", error);
      setError(error.message || "Failed to connect");
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return {
    socket,
    isConnected,
    portfolio,
    summary,
    error,
    loading,
  };
}
