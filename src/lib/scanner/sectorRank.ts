import kite from "@/config/kite";
import * as dbIndex from "@/lib/db/index";
import { EMA } from "technicalindicators";
import { getLastScanResults, updateTopSectors, type CachedScanResult } from "@/lib/scanner/scanResultsCache";

export type SectorMomentum = "ABOVE" | "BELOW" | "UNKNOWN";

export interface SectorRankResult {
  rank: number;
  sectorName: string;
  indexSymbol: string;
  stockCount: number;
  stocksAboveEma50: number;
  pctAboveEma50: number;           // 0–100
  indexPrice: number | null;       // latest sector index close
  indexEma20: number | null;       // 20 EMA of sector index
  indexEma50: number | null;       // 50 EMA of sector index
  distanceFromEma20Pct: number | null; // + above, - below
  momentum: SectorMomentum;
}

// ─── Sector definitions ───────────────────────────────────────────────────────
// indexSymbol must match the NSE INDICES tradingsymbol in Kite instruments list.
// industries[] must match (case-insensitive) the `industry` column from NSE Nifty100 CSV.
interface SectorDef {
  name: string;
  indexSymbol: string;
  industries: string[];
}

const SECTORS: SectorDef[] = [
  {
    name: "Financial Services",
    indexSymbol: "NIFTY FIN SERVICE",
    industries: ["financial services", "banking", "finance", "banks"],
  },
  {
    name: "Information Technology",
    indexSymbol: "NIFTY IT",
    industries: ["information technology", "software", "technology"],
  },
  {
    name: "Automobile",
    indexSymbol: "NIFTY AUTO",
    industries: ["automobile and auto components", "automobile", "auto components", "auto"],
  },
  {
    name: "Pharmaceuticals",
    indexSymbol: "NIFTY PHARMA",
    industries: ["pharmaceuticals", "pharma", "drugs", "drug"],
  },
  {
    name: "FMCG",
    indexSymbol: "NIFTY FMCG",
    industries: ["fast moving consumer goods", "fmcg", "consumer staples"],
  },
  {
    name: "Metals & Mining",
    indexSymbol: "NIFTY METAL",
    industries: ["metals & mining", "metals", "mining", "steel"],
  },
  {
    name: "Realty",
    indexSymbol: "NIFTY REALTY",
    industries: ["realty", "real estate", "construction"],
  },
  {
    name: "Healthcare",
    indexSymbol: "NIFTY HEALTHCARE",
    industries: ["healthcare", "hospital", "medical services", "health care"],
  },
  {
    name: "Oil & Gas",
    indexSymbol: "NIFTY OIL AND GAS",
    industries: ["oil, gas & consumable fuels", "oil", "petroleum", "gas", "oil gas"],
  },
  {
    name: "Consumer Durables",
    indexSymbol: "NIFTY CONSR DURBL",
    industries: ["consumer durables", "household", "consumer electronics"],
  },
  {
    name: "Capital Goods",
    indexSymbol: "NIFTY INDIA MFG",
    industries: ["capital goods", "industrial manufacturing", "manufacturing", "industrials"],
  },
  {
    name: "Power",
    indexSymbol: "NIFTY ENERGY",
    industries: ["power", "utilities", "electricity"],
  },
  {
    name: "Media",
    indexSymbol: "NIFTY MEDIA",
    industries: ["media", "entertainment", "telecom", "telecommunication"],
  },
];

// ─── Resolve sector index instrument tokens from NSE instruments list ─────────
async function resolveSectorIndexTokens(
  sectorDefs: SectorDef[]
): Promise<Map<string, number>> {
  const tokenMap = new Map<string, number>();
  try {
    const instruments = await kite.getInstruments("NSE");
    const indexInstruments = instruments.filter(
      (inst: any) => inst.segment === "INDICES" || inst.instrument_type === "INDEX"
    );

    for (const sector of sectorDefs) {
      const match = indexInstruments.find(
        (inst: any) =>
          inst.tradingsymbol?.toUpperCase() === sector.indexSymbol.toUpperCase()
      );
      if (match) {
        tokenMap.set(sector.indexSymbol, match.instrument_token);
      } else {
        console.warn(
          `[sectorRank] No token found for index "${sector.indexSymbol}" (${sector.name}). ` +
          `Available INDICES symbols: ${indexInstruments.map((i: any) => i.tradingsymbol).join(", ")}`
        );
      }
    }
  } catch (err) {
    console.error("[sectorRank] Failed to resolve sector index tokens:", err);
  }
  return tokenMap;
}

// ─── Fetch sector index EMAs (20 & 50) ──────────────────────────────────────
async function fetchSectorIndexData(
  token: number,
  indexSymbol: string
): Promise<{ price: number; ema20: number; ema50: number } | null> {
  try {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90); // 90 calendar days → ~63 trading days, enough for EMA50

    const candles = await kite.getHistoricalData(token, "day", from, to);
    if (!candles || candles.length < 50) {
      console.warn(`[sectorRank] Insufficient candles (${candles?.length ?? 0}) for ${indexSymbol}`);
      return null;
    }

    const closes = candles.map((c: any) => c.close);
    const ema20Arr = EMA.calculate({ values: closes, period: 20 });
    const ema50Arr = EMA.calculate({ values: closes, period: 50 });
    const ema20 = ema20Arr[ema20Arr.length - 1];
    const ema50 = ema50Arr[ema50Arr.length - 1];
    const price = closes[closes.length - 1];

    return { price, ema20, ema50 };
  } catch (err) {
    console.error(`[sectorRank] Failed to fetch index data for ${indexSymbol}:`, err);
    return null;
  }
}

// ─── Sequential batched fetch with delay to avoid rate limiting ───────────────
async function fetchEma20Batched(
  sectors: SectorDef[],
  tokenMap: Map<string, number>,
  batchSize = 3,
  delayMs = 400
): Promise<Map<string, { price: number; ema20: number; ema50: number } | null>> {
  const resultMap = new Map<string, { price: number; ema20: number; ema50: number } | null>();

  for (let i = 0; i < sectors.length; i += batchSize) {
    const batch = sectors.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (sector) => {
        const token = tokenMap.get(sector.indexSymbol);
        const data = token ? await fetchSectorIndexData(token, sector.indexSymbol) : null;
        return { indexSymbol: sector.indexSymbol, data };
      })
    );
    for (const r of batchResults) resultMap.set(r.indexSymbol, r.data);

    // Delay between batches to respect Kite's ~3 req/s historical data rate limit
    if (i + batchSize < sectors.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return resultMap;
}

// ─── Map a stock's industry to a sector ──────────────────────────────────────
function resolveSector(industry: string | null): SectorDef | null {
  if (!industry) return null;
  const lower = industry.toLowerCase().trim();

  // Find the best matching sector by checking each sector's industry keywords
  let bestMatch: SectorDef | null = null;
  let bestMatchLength = 0;

  for (const sector of SECTORS) {
    for (const keyword of sector.industries) {
      if (keyword.length <= 2) continue; // Skip very short keywords

      const keywordLower = keyword.toLowerCase();
      let isMatch = false;
      let matchLength = 0;

      // Check for exact match (e.g., "information technology" == "information technology")
      if (lower === keywordLower) {
        isMatch = true;
        matchLength = keyword.length;
      }
      // Check for word boundary match (e.g., "oil & gas" in "oil, gas & consumable fuels")
      else if (lower.includes(keywordLower) || keywordLower.includes(lower)) {
        // Validate it's a real word match, not a partial match
        const lowerParts = lower.split(/[\s,&]+/).filter((p) => p.length > 0);
        const keywordParts = keywordLower.split(/[\s,&]+/).filter((p) => p.length > 0);

        // Check if all keyword parts are present in the industry string
        const allMatch = keywordParts.every((kp) =>
          lowerParts.some((lp) => lp === kp || lp.includes(kp) || kp.includes(lp))
        );

        if (allMatch) {
          isMatch = true;
          matchLength = keyword.length;
        }
      }

      // Prefer longer matches (more specific)
      if (isMatch && matchLength > bestMatchLength) {
        bestMatch = sector;
        bestMatchLength = matchLength;
      }
    }
  }

  return bestMatch ?? null;
}

// ─── Post-scan sector filter (called by scan route after runScan) ─────────────
/**
 * Given the full scan results, ranks all sectors by % stocks above EMA50,
 * updates the topSectors pre-filter cache for the next scan run, and returns
 * the set of symbols that belong to the top-N sectors.
 *
 * This runs synchronously with the scan request so the user always sees
 * sector-filtered results in a single round trip.
 */
export async function filterToTopSectors(
  scanResults: { symbol: string; ltp: number; ema50: number }[],
  topN = 5
): Promise<Set<string>> {
  const dbInstruments = await dbIndex.getInstruments();
  const industryMap = new Map<string, string | null>(
    dbInstruments.map((inst) => [inst.symbol, inst.industry ?? null])
  );

  // Group scan results by sector
  const sectorSymbolMap = new Map<
    string,
    { sector: SectorDef; symbols: string[]; aboveEma50: number }
  >();
  const unmatched: string[] = [];
  for (const stock of scanResults) {
    const industry = industryMap.get(stock.symbol) ?? null;
    const sector = resolveSector(industry);
    if (!sector) {
      unmatched.push(`${stock.symbol}(${industry ?? "NO_INDUSTRY"})`);
      continue;
    }
    const entry = sectorSymbolMap.get(sector.indexSymbol) ?? {
      sector,
      symbols: [],
      aboveEma50: 0,
    };
    entry.symbols.push(stock.symbol);
    if (stock.ltp > stock.ema50) entry.aboveEma50 += 1;
    sectorSymbolMap.set(sector.indexSymbol, entry);
  }

  // Rank all sectors by pctAboveEma50, keep top N
  const topEntries = SECTORS.map((sector) => {
    const data = sectorSymbolMap.get(sector.indexSymbol);
    const total = data?.symbols.length ?? 0;
    const pct = total > 0 ? ((data!.aboveEma50 / total) * 100) : 0;
    return { sector, data, pct };
  })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, topN);

  // Update the topSectors cache so the next scan's pre-filter is correct
  updateTopSectors(
    topEntries.map((t) => ({ name: t.sector.name, industries: t.sector.industries }))
  );

  if (unmatched.length > 0) {
    console.warn(`[filterToTopSectors] ${unmatched.length} stocks had no matching sector: ${unmatched.join(", ")}`);
  }

  console.log(
    `[filterToTopSectors] Top ${topN} sectors: ` +
    topEntries
      .map((t) => `${t.sector.name} (${t.pct.toFixed(0)}%, ${t.data?.symbols.length ?? 0} stocks)`)
      .join(" | ")
  );

  // Return the set of symbols from those top sectors
  const symbolSet = new Set<string>();
  for (const { data } of topEntries) {
    if (data) data.symbols.forEach((s) => symbolSet.add(s));
  }
  console.log(`[filterToTopSectors] symbolSet size: ${symbolSet.size} (from ${scanResults.length} input stocks)`);
  return symbolSet;
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function runSectorRank(passedScanResults?: CachedScanResult[]): Promise<SectorRankResult[]> {
  // Step 1: load DB instruments to get industry per symbol
  const dbInstruments = await dbIndex.getInstruments();
  const industryMap = new Map<string, string | null>(
    dbInstruments.map((inst) => [inst.symbol, inst.industry ?? null])
  );

  // Step 2: get scan results — prefer caller-passed results, fall back to shared cache
  const scanResults = passedScanResults ?? getLastScanResults().results;
  console.log(`[runSectorRank] Using ${scanResults.length} scan results (${passedScanResults ? "passed directly" : "from cache"})`);

  // Step 3: group scan results by sector
  const sectorStockMap = new Map<string, { aboveEma50: number; total: number }>();
  for (const stock of scanResults) {
    const industry = industryMap.get(stock.symbol) ?? null;
    const sector = resolveSector(industry);
    if (!sector) continue;

    const existing = sectorStockMap.get(sector.indexSymbol) ?? { aboveEma50: 0, total: 0 };
    existing.total += 1;
    if (stock.ltp > stock.ema50) existing.aboveEma50 += 1;
    sectorStockMap.set(sector.indexSymbol, existing);
  }

  // Step 4: resolve sector index tokens for ALL sectors
  const tokenMap = await resolveSectorIndexTokens(SECTORS);

  // Step 5: fetch EMA20 for ALL sector indices in batches to respect rate limits
  const ema20Map = await fetchEma20Batched(SECTORS, tokenMap);

  // Step 6: build full results for all sectors
  const results: Omit<SectorRankResult, "rank">[] = SECTORS.map((sector) => {
    const stocks = sectorStockMap.get(sector.indexSymbol);
    const ema20Data = ema20Map.get(sector.indexSymbol);

    const stockCount = stocks?.total ?? 0;
    const stocksAboveEma50 = stocks?.aboveEma50 ?? 0;
    const pctAboveEma50 = stockCount > 0 ? (stocksAboveEma50 / stockCount) * 100 : 0;

    const indexPrice = ema20Data?.price ?? null;
    const indexEma20 = ema20Data?.ema20 ?? null;
    const indexEma50 = ema20Data?.ema50 ?? null;
    const distanceFromEma20Pct =
      indexPrice !== null && indexEma20 !== null && indexEma20 > 0
        ? ((indexPrice - indexEma20) / indexEma20) * 100
        : null;

    let momentum: SectorMomentum = "UNKNOWN";
    if (indexPrice !== null && indexEma20 !== null) {
      momentum = indexPrice > indexEma20 ? "ABOVE" : "BELOW";
    }

    return {
      sectorName: sector.name,
      indexSymbol: sector.indexSymbol,
      stockCount,
      stocksAboveEma50,
      pctAboveEma50,
      indexPrice,
      indexEma20,
      indexEma50,
      distanceFromEma20Pct,
      momentum,
    };
  });

  // Step 7: rank all sectors by pctAboveEma50 desc, tiebreak by distanceFromEma20 desc
  results.sort((a, b) => {
    if (b.pctAboveEma50 !== a.pctAboveEma50) return b.pctAboveEma50 - a.pctAboveEma50;
    const aD = a.distanceFromEma20Pct ?? -Infinity;
    const bD = b.distanceFromEma20Pct ?? -Infinity;
    return bD - aD;
  });

  const ranked = results.map((r, i) => ({ ...r, rank: i + 1 }));

  // Update the scan pre-filter cache with top 5
  // TODO: re-enable to skip sectors whose index is below its 50 EMA
  // const eligibleRanked = ranked.filter((r) =>
  //   r.indexPrice === null || r.indexEma50 === null || r.indexPrice >= r.indexEma50
  // );
  const TOP_N = 5;
  updateTopSectors(
    ranked.slice(0, TOP_N).map((r) => ({
      name: r.sectorName,
      industries: SECTORS.find((s) => s.indexSymbol === r.indexSymbol)!.industries,
    }))
  );

  // Return all 13 ranked sectors for display
  return ranked;
}
