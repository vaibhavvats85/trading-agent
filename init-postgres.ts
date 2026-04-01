import { Pool } from "pg";
import axios from "axios";
import csvParser from "csvtojson";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DATABASE || "trading_agent",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
});

interface Instrument {
  symbol: string;
  name: string;
  industry: string;
  weight: number;
}

async function createTables() {
  console.log("📋 Creating tables...");
  
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) UNIQUE,
        balance DECIMAL(15,2) DEFAULT 100000,
        used_margin DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        symbol VARCHAR(50),
        quantity INTEGER,
        entry_price DECIMAL(10,2),
        current_price DECIMAL(10,2),
        pnl DECIMAL(15,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, symbol)
      );

      CREATE TABLE IF NOT EXISTS instruments (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(50) UNIQUE,
        name VARCHAR(255),
        industry VARCHAR(100),
        weight DECIMAL(5,2)
      );
    `);
    
    console.log("✓ Tables created successfully");
  } finally {
    client.release();
  }
}

async function fetchNifty100() {
  console.log("📥 Fetching NIFTY 100 constituents...");
  
  try {
    const url =
      "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv";
    const response = await axios.get(url);
    
    const data: Instrument[] = await csvParser().fromString(response.data);
    
    const instruments = data
      .map((row: any) => ({
        symbol: row["Symbol"]?.trim() || row["symbol"]?.trim() || "",
        name: row["Company Name"]?.trim() || row["name"]?.trim() || "",
        industry: row["Industry"]?.trim() || row["industry"]?.trim() || "",
        weight: parseFloat(row["Weight in Index"] || row["weight"] || "0"),
      }))
      .filter((inst: Instrument) => inst.symbol.length > 0);

    console.log(`✓ Fetched ${instruments.length} NIFTY 100 instruments`);
    return instruments;
  } catch (error) {
    console.error("❌ Error fetching NIFTY 100:", error);
    throw error;
  }
}

async function populateInstruments(instruments: Instrument[]) {
  console.log("💾 Populating instruments table...");
  
  const client = await pool.connect();
  try {
    for (const instrument of instruments) {
      await client.query(
        `INSERT INTO instruments (symbol, name, industry, weight) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (symbol) DO UPDATE SET
         name = $2, industry = $3, weight = $4`,
        [instrument.symbol, instrument.name, instrument.industry, instrument.weight]
      );
    }
    
    console.log(`✓ Populated ${instruments.length} instruments`);
  } finally {
    client.release();
  }
}

async function init() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        PostgreSQL Database Initialization                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  try {
    // Test connection
    console.log("🔌 Testing PostgreSQL connection...");
    await pool.query("SELECT 1");
    console.log("✓ Connected to PostgreSQL");
    console.log("");

    // Create tables
    await createTables();
    console.log("");

    // Fetch and populate NIFTY 100
    const instruments = await fetchNifty100();
    console.log("");
    
    await populateInstruments(instruments);
    console.log("");

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║              Initialization Complete! ✅                   ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
