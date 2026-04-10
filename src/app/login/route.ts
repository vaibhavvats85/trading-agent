import { NextRequest, NextResponse } from "next/server";
import { KiteConnect } from "kiteconnect";
import kite from "@/config/kite";

const LOGIN_PAGE_HTML = (kiteLoginUrl: string, error?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login – Trading Agent</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 40px 48px;
      text-align: center;
      max-width: 380px;
      width: 100%;
    }
    h1 { color: #f1f5f9; font-size: 1.5rem; margin-bottom: 8px; }
    p  { color: #94a3b8; font-size: 0.95rem; margin-bottom: 28px; }
    .error { color: #f87171; font-size: 0.875rem; margin-bottom: 20px; }
    a.btn {
      display: inline-block;
      background: #2563eb;
      color: #fff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      transition: background 0.15s;
    }
    a.btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Trading Agent</h1>
    <p>Sign in with your Zerodha account to continue.</p>
    ${error ? `<p class="error">${error}</p>` : ""}
    <a class="btn" href="${kiteLoginUrl}">Login with Kite</a>
  </div>
</body>
</html>
`;

/**
 * GET /login
 *
 * Two modes:
 *  1. No query params → serve the login page with a "Login with Kite" button.
 *     API key is read from the kite_api_key cookie set by /setup.
 *  2. ?request_token=...&status=success → Kite OAuth callback.
 *     Exchange the one-time request_token for a persistent access_token
 *     using credentials from cookies, store it in an HTTP-only cookie,
 *     and redirect to /.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requestToken = searchParams.get("request_token");
  const status = searchParams.get("status");

  // Read API credentials from cookies (set by /setup)
  const apiKey = request.cookies.get("kite_api_key")?.value ?? "";
  const apiSecret = request.cookies.get("kite_api_secret")?.value ?? "";

  // If no setup cookies, send back to setup page
  if (!apiKey || !apiSecret) {
    return NextResponse.redirect(new URL("/setup", request.url), { status: 302 });
  }

  const kiteLoginUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}&v=3`;

  // ── Mode 1: Login page ──────────────────────────────────────────────────
  if (!requestToken || status !== "success") {
    return new NextResponse(LOGIN_PAGE_HTML(kiteLoginUrl), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // ── Mode 2: OAuth callback ──────────────────────────────────────────────
  try {
    const kiteClient = new KiteConnect({ api_key: apiKey });
    const session = await kiteClient.generateSession(requestToken, apiSecret);
    const accessToken: string = session.access_token;

    // Cache in process.env so socket/background code can use it in this server session.
    process.env.KITE_API_KEY = apiKey;
    process.env.KITE_ACCESS_TOKEN = accessToken;

    // Update the shared KiteConnect singleton.
    kite.setAccessToken(accessToken);

    console.log(`[Auth] ✅ Session generated for user: ${session.user_id}`);

    const response = NextResponse.redirect(new URL("/", request.url));

    const isProduction = process.env.NODE_ENV === "production";
    const baseOpts = [
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 24}`,
      "Path=/",
      ...(isProduction ? ["Secure"] : []),
    ].join("; ");

    response.headers.append("Set-Cookie", `kite_access_token=${accessToken}; ${baseOpts}`);
    response.headers.append("Set-Cookie", `kite_user_id=${session.user_id}; ${baseOpts}`);

    return response;
  } catch (err: any) {
    console.error("[Auth] ❌ Failed to generate session:", err?.message ?? err);
    return new NextResponse(
      LOGIN_PAGE_HTML(kiteLoginUrl, "Login failed. Please try again."),
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

