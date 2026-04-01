import { KiteConnect } from "kiteconnect";

const kite = new KiteConnect({ api_key: process.env.KITE_API_KEY! });

if (process.env.KITE_ACCESS_TOKEN) {
  kite.setAccessToken(process.env.KITE_ACCESS_TOKEN);
  console.log("✅ Kite authenticated with access token");
} else {
  console.error("❌ KITE_ACCESS_TOKEN not found in .env.local");
  console.log("\nTo get access token:");
  console.log("1. Copy .env.example to .env.local");
  console.log("2. Add KITE_REQUEST_TOKEN to .env.local");
  console.log("3. Run: npm run generate-token");
}

export default kite;
