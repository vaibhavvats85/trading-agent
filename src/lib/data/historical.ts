import kite from "@/config/kite";
import { Candle } from "@/lib/types";

async function fetchHistorical(token: number): Promise<Candle[]> {
  const from = new Date();
  from.setDate(from.getDate() - 290);
  const to = new Date();

  return kite.getHistoricalData(token, "day", from, to);
}

export default fetchHistorical;
