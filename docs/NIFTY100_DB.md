# NIFTY 100 Database Integration

This document explains the NIFTY 100 stocks database integration setup and how to use it.

## Overview

The application now fetches NIFTY 100 constituents from the official NSE CSV file and stores them in the SQLite database. This allows the scanner and trading system to work with dynamically loaded stock data instead of hardcoded values.

## CSV Source

- **URL**: https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv
- **Updated**: Fetched fresh each time the population script is run
- **Format**: CSV with columns: Symbol, Company Name, Industry, Weight in Index

## Database Schema

A new `instruments` table has been added to store the NIFTY 100 constituents:

```sql
CREATE TABLE instruments (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry TEXT,
  weight REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Setup Steps

### 1. Initialize and Populate Database

Run the population script to fetch NIFTY 100 data and store it in the database:

```bash
npm run populate-nifty100
```

This script will:
- Initialize the database
- Fetch 100 NIFTY constituents from the official CSV URL
- Parse and validate the data
- Clear existing instruments and insert fresh data
- Display a summary of the loaded instruments

**Output Example:**
```
╔════════════════════════════════════════════════════════════╗
║     NIFTY 100 Constituents Database Populator             ║
╚════════════════════════════════════════════════════════════╝

🗄️  Initializing database...
✓ Database initialized

📥 Fetching NIFTY 100 constituents from CSV...
✓ Parsed 100 records from CSV
✓ Transformed 100 instruments
✓ Successfully fetched 100 instruments

💾 Inserting instruments into database...
✓ Instruments inserted successfully

📊 Database now contains 100 instruments

📋 Sample of stored instruments:
═══════════════════════════════════════════════════════════
  • ABB          | ABB India Ltd. - Capital Goods
  • ADANIENSOL   | Adani Energy Solutions Ltd. - Power
  ... (96 more)
═══════════════════════════════════════════════════════════

✅ NIFTY 100 constituents successfully loaded into database!
```

## API Endpoints

### Get All Instruments

```bash
GET /api/instruments
```

**Response:**
```json
{
  "success": true,
  "count": 100,
  "data": [
    {
      "id": 1,
      "symbol": "ABB",
      "name": "ABB India Ltd.",
      "industry": "Capital Goods",
      "weight": 3.45
    },
    ...
  ]
}
```

### Get Specific Instruments

```bash
GET /api/instruments?symbols=RELIANCE,TCS,INFY
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 71,
      "symbol": "RELIANCE",
      "name": "Reliance Industries Ltd.",
      "industry": "Refineries",
      "weight": 8.95
    },
    ...
  ]
}
```

## Database Service Functions

New functions added to `src/lib/db/service.ts`:

### `insertInstruments(instruments)`
Insert or update instruments in the database. Clears existing data first.

```typescript
import { insertInstruments } from "@/lib/db/service";

insertInstruments([
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", industry: "Refineries", weight: 8.95 },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd.", industry: "IT", weight: 1.23 },
]);
```

### `getInstruments()`
Fetch all instruments from the database.

```typescript
import { getInstruments } from "@/lib/db/service";

const allInstruments = getInstruments();
// Returns array of 100 instruments
```

### `getInstrumentsBySymbols(symbols)`
Fetch specific instruments by their symbols.

```typescript
import { getInstrumentsBySymbols } from "@/lib/db/service";

const instruments = getInstrumentsBySymbols(["RELIANCE", "TCS", "INFY"]);
```

### `getInstrumentCount()`
Get the total count of instruments in the database.

```typescript
import { getInstrumentCount } from "@/lib/db/service";

const count = getInstrumentCount(); // Returns 100
```

## Scanner Integration

The scanner (`src/lib/scanner/scan.ts`) has been updated to:

1. Load NIFTY 100 symbols from the database instead of hardcoded values
2. Automatically fetch instrument tokens from KiteConnect
3. Scan all 100 stocks for swing trading signals

**Updated behavior:**
- Scanner now scans NIFTY 100 (was NIFTY 50)
- Symbols are dynamically loaded from the database
- More comprehensive market coverage

## Files Modified

### Database
- `src/lib/db/init.ts` - Added instruments table
- `src/lib/db/service.ts` - Added instrument management functions

### Utilities
- `src/lib/utils/nifty100.ts` - New file: Functions to fetch and parse NIFTY 100 CSV

### API
- `src/app/api/instruments/route.ts` - New API endpoint to query instruments

### Scanner
- `src/lib/scanner/scan.ts` - Updated to use database symbols instead of hardcoded values

### Configuration
- `package.json` - Added `populate-nifty100` script

## Re-running Population

To update the database with the latest NIFTY 100 constituents:

```bash
npm run populate-nifty100
```

This will:
- Fetch fresh data from the official NSE CSV
- Clear the existing instruments table
- Insert the latest 100 constituents
- Display a summary with sample instruments

## Error Handling

The population script includes robust error handling:
- Network timeouts (10 seconds)
- Invalid CSV format
- Empty or malformed data
- Database errors

If an error occurs, the script will:
- Display a descriptive error message
- Log the issue details
- Exit with code 1 (failure)

## Performance Considerations

### Caching
- The scanner caches KiteConnect instruments for 1 hour
- Database queries are indexed on the symbol column for fast lookups

### Concurrency
- Historical data fetching uses a concurrency limit of 3 requests
- Prevents overwhelming the API and respecting rate limits

## Future Enhancements

Potential improvements:
1. Scheduled job to automatically update NIFTY 100 constituents
2. Support for multiple indices (NIFTY 50, NIFTY 200, etc.)
3. Additional metadata (market cap, PE ratio, etc.)
4. Historical price data caching
5. Sector-based filtering

## Troubleshooting

### Issue: Database not initialized
**Solution:**
```bash
npm run populate-nifty100
```

### Issue: CSV fetch fails
**Possible causes:**
- Network connectivity issues
- URL returns rate limit error (429)
- Server temporarily down

**Solution:**
- Wait a few minutes and retry
- Check internet connection
- Verify the NSE website is accessible

### Issue: Symbol not found in API
**Solution:**
- Verify the symbol is in the NIFTY 100
- Check the database has been populated recently
- Run `npm run populate-nifty100` to refresh the data

## References

- NSE Official NIFTY 100 List: https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv
- Better SQLite3: https://github.com/WiseLibs/better-sqlite3
- csvtojson: https://github.com/Keyang/node-csvtojson
