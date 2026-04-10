/**
 * In-memory token store for KITE_ACCESS_TOKEN.
 *
 * Tokens are held in process.env (Node.js runtime) and the global KiteConnect
 * singleton only. Nothing is written to .env.local — the cookie set by
 * /login is the durable auth signal used by the middleware.
 */

// ─── public API ─────────────────────────────────────────────────────────────

export function getAccessToken(): string {
  return process.env.KITE_ACCESS_TOKEN ?? "";
}

/**
 * Store the access token in process.env and update the KiteConnect singleton
 * so all API routes within this server session can use it immediately.
 */
export function setTokens(_requestToken: string, accessToken: string): void {
  process.env.KITE_ACCESS_TOKEN = accessToken;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kite = require("@/config/kite").default;
    kite.setAccessToken(accessToken);
  } catch { /* kite module may not be loaded yet */ }
}

/**
 * Clear the access token from process.env and the KiteConnect singleton.
 * Called when the token is found to be invalid or expired.
 */
export function clearTokens(): void {
  process.env.KITE_ACCESS_TOKEN = "";

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kite = require("@/config/kite").default;
    kite.setAccessToken("");
  } catch { /* ignore */ }
}

