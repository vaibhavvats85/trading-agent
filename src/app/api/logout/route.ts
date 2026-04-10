import { NextResponse } from "next/server";
import { clearTokens } from "@/lib/auth/tokenStore";

/**
 * GET /api/logout
 *
 * Clears the kite_access_token cookie (server-side, so httpOnly cookies
 * can actually be deleted) and clears the in-memory token.
 * Client-side JavaScript cannot delete httpOnly cookies directly.
 */
export async function GET() {
  clearTokens();

  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000")
  );

  response.headers.append(
    "Set-Cookie",
    "kite_access_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/"
  );

  return response;
}
