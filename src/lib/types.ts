// OHLC data structure
export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Technical indicators
export interface Indicators {
  price: number;
  rsi: number;
  ema50: number;
  dma10: number;
  recentSwingLow: number;
  isPullback: boolean;
  pullbackHigh: number;
  pullbackLow: number;
  // Extended indicators for additional strategies
  dma200: number;       // 200-period SMA
  dma50: number;        // 50-period SMA
  ema20: number;        // 20-period EMA
  volume: number;       // Latest candle volume
  avgVolume20: number;  // 20-day average volume
  high20: number;       // 20-day highest close (consolidation ceiling)
}

// Trade state management
export interface TradeState {
  isActive: boolean;
  entryPrice: number;
  stopLoss: number;
  riskAmount: number;
  target2R: number;
  trailingStop: boolean;
  trailingStopLevel: number;
}

// Trading signals
export type Signal = "BUY" | "SELL" | "NO TRADE" | "EXIT";

// OHLC prices
export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

// Tick data from KiteConnect
export interface Tick {
  instrument_token: number;
  last_price: number;
  ohlc?: OHLC;
  open_price?: number;
  high?: number;
  low?: number;
  change?: number;
  change_percent?: number;
  bid: number;
  ask: number;
  bid_quantity: number;
  ask_quantity: number;
  volume: number;
  timestamp: number;
  mode?: string;
}

// NSE instrument from KiteConnect
export interface Instrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  exchange: string;
  segment: string;
  instrument_type: string;
}

// Strategy configuration
export interface StrategyConfig {
  riskPercentage: number;         // 1% of capital
  capitalPerTrade: number;
  targetMultiplier: number;       // 2R
  trendFilterPeriod: number;      // 50 EMA
  momentumThreshold: number;      // RSI > 55
  trailingStopPeriod: number;     // 10 DMA
  lookbackCandles: number;        // For pullback detection
}

// Portfolio holding
export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  invested: number;
  current: number;
  pnl: number;
  pnlPercent: string;
  openPrice: number;
  todayPnl: number;
  todayPnlPercent: string;
  instrumentToken: number;
}

// Portfolio summary
export interface PortfolioSummary {
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
  totalPnlPercent: string;
  totalTodayPnl: number;
  totalTodayPnlPercent: string;
  nifty50?: {
    ltp: number;
    open: number;
    high: number;
    low: number;
    change: number;
    changePercent: number;
  };
}

// Scan result
export interface StrategySignal {
  strategyId: string;
  strategyName: string;
  signal: Signal;
}

export interface ScanResult {
  symbol: string;
  ltp: number;
  change: number;
  changePercent: string;
  ema50: number;
  rsi: number;
  dma10: number;
  pullback: boolean;
  signal: Signal;
  strategySignals: StrategySignal[];
  indicators: Indicators;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
}

// WebSocket message types
export interface PortfolioUpdateMessage {
  type: "portfolio-update";
  success: boolean;
  data: Holding[];
  summary: PortfolioSummary;
  timestamp: string;
}

export interface TickUpdateMessage {
  type: "tick-update";
  ticks: Tick[];
  timestamp: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
  timestamp: string;
}

export type WebSocketMessage = PortfolioUpdateMessage | TickUpdateMessage | ErrorMessage;

// Paper Trading Types
export type PaperOrderType = "BUY" | "SELL";
export type PaperOrderStatus = "PENDING" | "FILLED" | "CANCELLED";

export interface PaperOrder {
  id: string;
  symbol: string;
  orderType: PaperOrderType;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  status: PaperOrderStatus;
  createdAt: string;
  filledAt?: string;
  reason?: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  invested: number;
  current: number;
  pnl: number;
  pnlPercent: string;
  signalType: Signal;
  createdAt: string;
  updatedAt: string;
}

export interface PaperTradingAccount {
  totalCapital: number;
  availableBalance: number;
  investedAmount: number;
  totalPnl: number;
  totalPnlPercent: string;
  positions: PaperPosition[];
  openOrders: PaperOrder[];
}

export interface PlacePaperOrderRequest {
  symbol: string;
  orderType: PaperOrderType;
  quantity: number;
  pricePerUnit: number;
  signalType?: Signal;
}

export interface ClosePaperPositionRequest {
  positionId: string;
  currentPrice: number;
}

