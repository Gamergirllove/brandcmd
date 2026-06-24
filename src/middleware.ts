import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/connect",
  "/analytics",
  "/settings",
  "/goals",
  "/reports",
  "/notifications",
  "/onboarding",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for Supabase session cookie (set by supabase-js auth)
  const hasCookie =
    request.cookies.has("sb-access-token") ||
    request.cookies.has("supabase-auth-token") ||
    Array.from(request.cookies.getAll()).some((c) =>
      c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
    );

  if (!hasCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/connect/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/goals/:path*",
    "/reports/:path*",
    "/notifications/:path*",
    "/onboarding/:path*",
  ],
};