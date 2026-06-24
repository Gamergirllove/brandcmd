import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated and hits a dashboard route,
  // check if onboarding is complete. If not, redirect to onboarding.
  // (Skip if already going to onboarding to avoid infinite redirect.)
  if (!pathname.startsWith("/onboarding")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", session.user.id)
      .single();

    if (profile && profile.onboarding_complete === false) {
      return NextResponse.redirect(new URL("/onboarding/onboarding", request.url));
    }
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
