/**
 * Module-level cache for the last successful scan results.
 * Shared between the scan API route and the sector rank service so that
 * sector rank can compute "% stocks above EMA50" without re-fetching all historical data.
 */
export interface CachedScanResult {
  symbol: string;
  ltp: number;
  ema50: number;
}

let _lastResults: CachedScanResult[] = [];
let _lastResultsTime = 0;

export function updateScanResultsCache(results: CachedScanResult[]): void {
  _lastResults = results;
  _lastResultsTime = Date.now();
}

export function getLastScanResults(): { results: CachedScanResult[]; time: number } {
  return { results: _lastResults, time: _lastResultsTime };
}

// ─── Top-sector cache (updated after each sector rank run) ───────────────────
// Stores the flat list of industry keywords belonging to the last top-N sectors.
// The scanner uses this to restrict which symbols it processes on the next run.
export interface CachedTopSector {
  name: string;
  industries: string[];
}

let _topSectors: CachedTopSector[] | null = null;

export function updateTopSectors(sectors: CachedTopSector[]): void {
  _topSectors = sectors;
}

/** Returns the cached top sectors, or null if sector rank has never run. */
export function getTopSectors(): CachedTopSector[] | null {
  return _topSectors;
}
