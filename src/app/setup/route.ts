import { NextRequest, NextResponse } from "next/server";

const SETUP_PAGE_HTML = (error?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Setup – Trading Agent</title>
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
      max-width: 440px;
      width: 100%;
    }
    h1 { color: #f1f5f9; font-size: 1.5rem; margin-bottom: 8px; }
    p.subtitle { color: #94a3b8; font-size: 0.9rem; margin-bottom: 28px; }
    .error {
      color: #f87171;
      font-size: 0.875rem;
      margin-bottom: 20px;
      background: #1c1917;
      border: 1px solid #f87171;
      border-radius: 6px;
      padding: 10px 14px;
    }
    label {
      display: block;
      color: #94a3b8;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    input {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 10px 14px;
      color: #f1f5f9;
      font-size: 0.9rem;
      margin-bottom: 18px;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: #2563eb; }
    button {
      width: 100%;
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 12px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 4px;
    }
    button:hover { background: #1d4ed8; }
    .hint {
      color: #64748b;
      font-size: 0.78rem;
      margin-top: 16px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Trading Agent Setup</h1>
    <p class="subtitle">Enter your Zerodha Kite Connect API credentials to get started.</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form method="POST" action="/setup">
      <label for="api_key">API Key</label>
      <input id="api_key" name="api_key" type="text" placeholder="e.g. abc123xyz" autocomplete="off" required />

      <label for="api_secret">API Secret</label>
      <input id="api_secret" name="api_secret" type="password" placeholder="Your Kite API Secret" required />

      <label for="user_id">User ID</label>
      <input id="user_id" name="user_id" type="text" placeholder="e.g. AB1234" autocomplete="off" required />

      <button type="submit">Continue to Login →</button>
    </form>
    <p class="hint">Credentials are stored in an HTTP-only cookie and never logged.</p>
  </div>
</body>
</html>
`;

/**
 * GET /setup
 * Show the credentials setup form.
 */
export async function GET() {
  return new NextResponse(SETUP_PAGE_HTML(), {
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * POST /setup
 * Save API credentials in HTTP-only cookies, then redirect to /login.
 * The /login route will use these cookies to build the Kite OAuth URL.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const apiKey = formData.get("api_key")?.toString().trim() ?? "";
  const apiSecret = formData.get("api_secret")?.toString().trim() ?? "";
  const userId = formData.get("user_id")?.toString().trim() ?? "";

  if (!apiKey || !apiSecret || !userId) {
    return new NextResponse(SETUP_PAGE_HTML("All fields are required."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const cookieOpts = [
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`, // 30 days
    "Path=/",
    ...(isProduction ? ["Secure"] : []),
  ].join("; ");

  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.headers.append("Set-Cookie", `kite_api_key=${apiKey}; ${cookieOpts}`);
  response.headers.append("Set-Cookie", `kite_api_secret=${apiSecret}; ${cookieOpts}`);
  response.headers.append("Set-Cookie", `kite_user_id=${userId}; ${cookieOpts}`);
  return response;
}
