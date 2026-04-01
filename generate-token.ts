import dotenv from "dotenv";

dotenv.config();

const { KiteConnect } = require("kiteconnect");

const API_KEY = process.env.KITE_API_KEY!;
const API_SECRET = process.env.KITE_API_SECRET!;
const REQUEST_TOKEN = process.env.KITE_REQUEST_TOKEN;

if (!REQUEST_TOKEN) {
  console.error("❌ KITE_REQUEST_TOKEN not found in .env");
  console.log("\nSteps to get request token:");
  console.log("1. Open: https://kite.zerodha.com/");
  console.log("2. Login with your Zerodha account");
  console.log("3. You'll be redirected - copy the request_token from the URL");
  console.log("4. Add to .env: KITE_REQUEST_TOKEN=<token>");
  process.exit(1);
}

const kite = new KiteConnect({ api_key: API_KEY });
console.log(kite.getLoginURL());

kite
  .generateSession(REQUEST_TOKEN, API_SECRET)
  .then((response: any) => {
    console.log("\n✅ Session Generated Successfully!");
    console.log("\n📝 Add these to your .env file:\n");
    console.log("KITE_ACCESS_TOKEN=" + response.access_token);
    console.log("KITE_USER_ID=" + response.user_id);
    console.log("\n🔐 Your Access Token:");
    console.log(response.access_token);
    console.log("\n👤 Your User ID:");
    console.log(response.user_id);
  })
  .catch((error: any) => {
    console.error("❌ Error generating token:");
    console.error(error.message || error);
    process.exit(1);
  });
