# Nifty 200 — Stock Scanning Strategy

> Swing trading scan strategy for the Nifty 200 universe.
> Designed to work alongside the Pullback in Uptrend entry/exit system.

---

## Why Nifty 200

| Factor                      | Reason                                                          |
| --------------------------- | --------------------------------------------------------------- |
| Liquidity                   | Sufficient daily volume — no getting stuck in positions         |
| Institutional participation | FIIs/DIIs active → trends more reliable, less operator-driven   |
| Data quality                | Clean price action, fewer gaps, better technical setups         |
| Avoid Nifty 500             | Adds 300 mid/small caps that are illiquid and technically noisy |

---

## STEP 1 — Pre-Scan Filters

> Run first. Cheap checks on current day data only. Eliminates ~60% of stocks before any indicator computation.

### Price Range

```
Min price : ₹100    ← avoid penny stocks / excessive % volatility
Max price : ₹5,000  ← avoid stocks where 1 share consumes too much capital
```

### Volume Filter

```
20-day avg daily volume     > 5,00,000 shares
OR 20-day avg traded value  > ₹10 crore
← ensures you can enter and exit without slippage
```

### Exchange

```
NSE only (exclude BSE)
← better liquidity, tighter spreads
```

### Exclude

```
- Stocks within 5 days of earnings / results announcement
- Stocks that gapped > 5% in the last 5 days
- PSU banks (high event risk from RBI / government policy)
```

---

## STEP 2 — Sector Filter

> Run second. Eliminates bad sectors before scanning individual stocks.

### Rank All Nifty Sectors By

```
1. % of stocks in sector trading above their 50 EMA
2. Sector index vs its own 20 EMA (momentum signal)
```

### Rule

```
Only scan stocks from the top 5 ranked sectors.
Skip any sector where sector index < its own 50 EMA.
```

> **Why this matters:** Even strong individual stocks get dragged down in weak sectors.
> In Feb 2025, only IT and Pharma were holding up. Scanning all sectors equally
> would have generated bad signals from 70% of the universe.

### Sectors That Trend Cleanly (Prefer These)

```
✓ Private Banks       ✓ Information Technology
✓ Pharmaceuticals     ✓ Consumer Goods (FMCG)
✓ Automobiles         ✓ Consumer Discretionary
```

### Sectors to Avoid (Structurally Noisy)

```
✗ PSU Banks     — policy-driven, unpredictable gaps
✗ Metals        — commodity-driven, mean-reverting
✗ PSU Capex     — BHEL, HAL, BEL — news-driven, not technically clean
✗ Real Estate   — DLF, GODREJPROP — illiquid price action
```

---

## STEP 3 — Technical Scan Conditions

> Run in this exact sequence. Each step is more expensive to compute.
> Fail fast — only stocks passing all prior steps reach the next.

### 3a. Trend (eliminates ~50% of remaining stocks)

```
close > EMA(50)          ← stock is in an uptrend
close > SMA(200)         ← long-term trend aligned
SMA(50) > SMA(200)       ← golden cross structure (optional, but powerful filter)
```

### 3b. Momentum (eliminates ~30% of remaining stocks)

```
RSI(14) > 55             ← sufficient momentum to sustain move
RSI(14) < 75             ← not overbought — bad risk/reward at extremes
volume today < 20-day avg volume   ← quiet pullback, not a distribution day
```

### 3c. Pullback Structure (most expensive — run last)

```
Lookback window: 20 candles

swingHigh = highest high in last 20 candles
swingLow  = lowest low after swingHigh (minimum 2 candles after)

Conditions:
  current close < swingHigh    ← actually in a pullback
  current close > swingLow     ← structure hasn't broken down
  pullback depth = (swingHigh − close) / swingHigh

  pullback depth > 3%          ← not a real pullback if shallower
  pullback depth < 15%         ← too deep, trend likely broken
```

### 3d. Entry Trigger

```
close > swingHigh                        ← breakout above pullback high
volume on trigger day > 20-day avg       ← breakout confirmed by volume
```

---

## STEP 4 — Quality Scoring

> After filters, you'll typically have 5–15 stocks. Score each to decide which to trade.
> Only trade stocks scoring 5 or above.

| Condition                                   | Score |
| ------------------------------------------- | ----- |
| RSI between 55–65 (ideal momentum zone)     | +2    |
| Volume on trigger day > 1.5× average        | +2    |
| Price > SMA(200)                            | +2    |
| Sector is in top 3 ranked sectors           | +1    |
| Pullback depth between 5–10%                | +1    |
| SMA(50) > SMA(200) — golden cross structure | +1    |
| Earnings within 10 days                     | −2    |
| Stock gapped up to entry (chasing)          | −2    |
| RSI > 70 at entry (overbought)              | −1    |

```
Maximum score : 9
Minimum to trade : 5
Take top 4–5 stocks by score only
```

---

## STEP 5 — Timing Filters

### Best Days to Enter

```
Tuesday, Wednesday, Thursday
← Monday has gap risk from weekend news
← Friday has weekend risk; traders close positions
```

### Market Conditions

```
Nifty 50 > SMA(200)    ← master market filter (GREEN signal)
India VIX < 18         ← above 18 = elevated fear, setups fail more often
Nifty itself in a pullback or just breaking out ← ideal environment
```

### Avoid Entering During

```
- Week of RBI monetary policy announcement
- Week of Union Budget
- Nifty earnings season peak (first 3 weeks of Jan, Apr, Jul, Oct)
```

---

## Scanner Output Format

For each stock passing all filters, compute and display:

```
Symbol        : TITAN
Score         : 7 / 9
Sector        : Consumer Discretionary  (#2 ranked)

Entry         : ₹3,240   ← swingHigh breakout level
Stop Loss     : ₹3,080   ← swingLow
Target (2R)   : ₹3,560
Risk (1R)     : ₹160 / share

Quantity      : 31 shares   (₹5,000 risk ÷ ₹160)
Capital Used  : ₹1,00,440   (20% of ₹5L)

RSI           : 61.2   ✓
EMA(50)       : ₹3,190  ✓  (price above)
Pullback Depth: 4.8%   ✓
Volume        : 1.2× average  ✓
```

---

## Position Sizing Rules

```
riskCapital  = totalCapital × 0.01     ← risk 1% per trade (₹5,000 on ₹5L)
riskAmount   = entryPrice − swingLow   ← 1R in price terms
quantity     = floor(riskCapital / riskAmount)
capitalUsed  = quantity × entryPrice
```

### The 4-Position Rule

```
Max open positions at any time : 4

Position 1 : ₹1,00,000 – ₹1,25,000
Position 2 : ₹1,00,000 – ₹1,25,000
Position 3 : ₹1,00,000 – ₹1,25,000
Position 4 : ₹1,00,000 – ₹1,25,000
Cash Reserve: ₹1,00,000  ← always keep 20% in cash

If 4 positions are open and a new signal fires → skip it.
Never compromise position sizing to fit a 5th trade.
```

---

## Daily Scan Cadence

```
4:00pm — After market close
  1. Check master market filter (Nifty > SMA200) → if RED, stop here
  2. Run pre-scan filters on all 200 stocks
  3. Run sector filter → identify top 5 sectors
  4. Run technical scan on remaining stocks
  5. Score and rank shortlist
  6. Output tomorrow's watchlist with entry, stop, target pre-calculated

9:00am — Next morning, before market open
  Review watchlist and remove stocks with:
    Overnight gap > 3%   ← entry price is now invalid
    Major overnight news affecting the stock or sector
  Set price alerts at swingHigh for remaining watchlist stocks

During market hours
  Alert fires when price crosses swingHigh
  Verify: is volume confirming? Is broader market stable?
  Enter on closing price of that candle (not intraday)
```

---

## Stocks to Permanently Exclude

Even though they're in Nifty 200, these cause structurally bad setups:

```
PSU Banks    : SBIN, PNB, CANBK, BANKBARODA
Metals       : HINDALCO, JSWSTEEL, TATASTEEL
PSU Capex    : BHEL, HAL, BEL
Real Estate  : DLF, GODREJPROP
```

---

## Key Benchmarks (After 30+ Signals)

```
Win Rate      > 40%
Avg Loss      ≈ −1R     (stop loss working correctly)
Avg Win       > +2R     (trailing stop letting winners run)
Expectancy    > +0.5R per trade
```

---

_Last updated: April 2026 · Strategy version: 0.1_
