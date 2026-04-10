import { NextRequest, NextResponse } from "next/server";

/**
 * Auth middleware — cookies are the single source of truth.
 *
 * Flow:
 *   1. /setup — always allowed (credentials entry form)
 *   2. /login — always allowed (Kite OAuth page + callback)
 *   3. Any other route:
 *      a. No kite_api_key cookie → redirect to /setup
 *      b. No kite_access_token cookie → redirect to /login (or 401 for API routes)
 *      c. Both present → forward tokens as request headers for server-side use
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/setup") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // Step 1: ensure credentials have been configured
  const apiKey = request.cookies.get("kite_api_key")?.value;
  if (!apiKey) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Not configured: please complete setup at /setup." },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // Step 2: ensure user is authenticated
  const token = request.cookies.get("kite_access_token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized: session not found. Please log in." },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated – forward token, api_key, and user_id via headers for server-side use.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-kite-token", token);
  requestHeaders.set("x-kite-api-key", apiKey);
  const userId = request.cookies.get("kite_user_id")?.value ?? "";
  if (userId) requestHeaders.set("x-kite-user-id", userId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

