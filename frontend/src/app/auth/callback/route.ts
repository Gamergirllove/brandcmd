import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * OAuth / magic-link callback.
 *
 * Exchanges the code for a session using the cookie-backed server client so
 * the resulting session is written to cookies the browser and middleware can
 * both read.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Only allow relative paths — an absolute `next` would let this
      // endpoint redirect to any host.
      const target = next.startsWith("/") ? next : "/dashboard";
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
