import axios from "axios";
import csv from "csvtojson";

/**
 * Fetch NIFTY 100 constituents from the official CSV URL
 */
export async function fetchNifty100Constituents(): Promise<
  Array<{ symbol: string; name: string; industry?: string; weight?: number }>
> {
  try {
    console.log("📥 Fetching NIFTY 100 constituents from CSV...");

    // Fetch the CSV file
    const response = await axios.get(
      "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv",
      {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (!response.data) {
      throw new Error("Empty response from CSV URL");
    }

    // Parse CSV
    const jsonData = await csv().fromString(response.data);

    console.log(`✓ Parsed ${jsonData.length} records from CSV`);

    // Transform the data to match our schema
    // The CSV might have different column names, so we need to handle them
    const instruments = jsonData
      .map((row: any) => {
        // Handle different possible column names
        const symbol =
          row["Symbol"] ||
          row["symbol"] ||
          row["SYMBOL"] ||
          row["Trading Symbol"] ||
          row["trading symbol"] ||
          "";

        const name =
          row["Company Name"] ||
          row["company name"] ||
          row["Name"] ||
          row["name"] ||
          "";

        const industry =
          row["Industry"] ||
          row["industry"] ||
          row["Sector"] ||
          row["sector"] ||
          undefined;

        const weight =
          row["Weight in Index"] ||
          row["weight in index"] ||
          row["Weight"] ||
          row["weight"] ||
          undefined;

        return {
          symbol: symbol.trim(),
          name: name.trim(),
          industry: industry ? String(industry).trim() : undefined,
          weight: weight ? parseFloat(String(weight)) : undefined,
        };
      })
      .filter((inst: any) => inst.symbol && inst.name); // Filter out empty rows

    console.log(`✓ Transformed ${instruments.length} instruments`);

    return instruments;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ Failed to fetch NIFTY 100 CSV: ${error.message}`);
      if (error.response?.status) {
        console.error(`   HTTP Status: ${error.response.status}`);
      }
    } else {
      console.error(`❌ Error fetching NIFTY 100 constituents:`, error);
    }
    throw error;
  }
}

/**
 * Extract symbols from instruments
 */
export function extractSymbols(
  instruments: Array<{ symbol: string; name: string; industry?: string; weight?: number }>
): string[] {
  return instruments.map((inst) => inst.symbol);
}
