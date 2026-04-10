import { KiteConnect } from "kiteconnect";

// ─── Lazy singleton ──────────────────────────────────────────────────────────
// Nothing is created at module load time. The KiteConnect instance is
// instantiated the first time any method is called on it — at request/runtime.
// API key and access token are sourced from cookies (via request headers set
// by middleware), NOT from .env. They are cached in process.env as a runtime
// in-session store for background code (socket/server.js).

let _kite: KiteConnect | null = null;
let _lastApiKey = "";

function instance(): KiteConnect {
  const apiKey = process.env.KITE_API_KEY ?? "";
  // Re-create if api_key changed (different user logged in)
  if (!_kite || _lastApiKey !== apiKey) {
    _lastApiKey = apiKey;
    _kite = new KiteConnect({ api_key: apiKey });
    if (process.env.KITE_ACCESS_TOKEN) {
      _kite.setAccessToken(process.env.KITE_ACCESS_TOKEN);
    }
  }
  return _kite;
}

/**
 * Returns the kite singleton with the access token and api_key synced from
 * the current request's headers (x-kite-token, x-kite-api-key set by middleware).
 *
 * next/headers is required dynamically so this file is safe to import from
 * server.js / socket/init.ts — no Next.js request pipeline needed at load time.
 */
export function getKite(): KiteConnect {
  try {
    // Dynamic require keeps 'next/headers' out of the server.js module graph
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers } = require("next/headers");
    const token: string = headers().get("x-kite-token") ?? "";
    const apiKey: string = headers().get("x-kite-api-key") ?? "";

    // Sync api_key into process.env so instance() picks it up
    if (apiKey && apiKey !== process.env.KITE_API_KEY) {
      process.env.KITE_API_KEY = apiKey;
    }

    const kite = instance();

    if (token && token !== process.env.KITE_ACCESS_TOKEN) {
      process.env.KITE_ACCESS_TOKEN = token;
      kite.setAccessToken(token);
    }

    return kite;
  } catch {
    // Outside Next.js request context (socket/init.ts, server.js) — ignore
    return instance();
  }
}

/**
 * Proxy default export so `import kite from "@/config/kite"` works without
 * triggering instantiation at module load time.
 * All property accesses (kite.getHoldings(), kite.setAccessToken(), …) are
 * forwarded to the lazily-created real instance.
 */
const kiteProxy = new Proxy({} as KiteConnect, {
  get(_target, prop: string | symbol) {
    return (instance() as any)[prop as string];
  },
});

export default kiteProxy;

