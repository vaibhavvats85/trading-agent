#!/usr/bin/env ts-node
/**
 * Script to populate the database with NIFTY 100 constituents
 * Run with: npx ts-node populate-nifty100.ts
 */

import { initializeDatabase } from "./src/lib/db/init";
import * as dbIndex from "./src/lib/db/index";
import { fetchNifty200Constituents } from "./src/lib/utils/nifty200";

async function main() {
  try {
    console.log(
      "\n╔════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║     NIFTY 200 Constituents Database Populator             ║",
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n",
    );

    // Initialize database
    console.log("🗄️  Initializing database...");
    initializeDatabase();
    console.log("✓ Database initialized\n");

    // Fetch NIFTY 200 constituents
    console.log("📥 Fetching NIFTY 200 constituents from CSV...");
    const instruments = await fetchNifty200Constituents();

    if (instruments.length === 0) {
      throw new Error("No instruments found in CSV");
    }

    console.log(`✓ Successfully fetched ${instruments.length} instruments\n`);

    // Insert into database
    console.log("💾 Inserting instruments into database...");
    await dbIndex.insertInstruments(instruments);
    console.log("✓ Instruments inserted successfully\n");

    // Verify
    const count = await dbIndex.getInstrumentCount();
    console.log(`📊 Database now contains ${count} instruments\n`);

    // Display sample
    console.log("📋 Sample of stored instruments:");
    console.log("═══════════════════════════════════════════════════════════");
    instruments.slice(0, 10).forEach((inst) => {
      const weight = inst.weight ? ` (${inst.weight.toFixed(2)}%)` : "";
      const industry = inst.industry ? ` - ${inst.industry}` : "";
      console.log(
        `  • ${inst.symbol.padEnd(12)} | ${inst.name}${industry}${weight}`,
      );
    });
    if (instruments.length > 10) {
      console.log(`  ... and ${instruments.length - 10} more`);
    }
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    console.log("✅ NIFTY 100 constituents successfully loaded into database!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to populate database:", error);
    process.exit(1);
  }
}

main();
