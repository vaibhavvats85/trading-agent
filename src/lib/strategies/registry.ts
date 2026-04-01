export interface StrategyMeta {
  id: string;
  name: string;
  description: string;
}

export const STRATEGIES: StrategyMeta[] = [
  {
    id: "swing",
    name: "Swing Trading",
    description: "Long-only pullback entry. Price > EMA50, RSI > 55, enter on breakout above pullback high. 1R stop, 2R trailing exit via DMA10.",
  },
  {
    id: "pullback",
    name: "Pullback",
    description: "Uptrend confirmed (Close > 200 DMA & 50 DMA), price within 2% of 20 EMA, and volume below 20-day avg (quiet healthy pullback).",
  },
  {
    id: "breakoutMomentum",
    name: "Breakout Momentum",
    description: "Close breaks above 20-day high with volume surge > 1.5x 20-day average. Confirms momentum-driven breakout.",
  },
];

export const DEFAULT_STRATEGY = "swing";
