import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

/**
 * Browser-side Supabase client.
 *
 * Uses createBrowserClient (not createClient) so the session is written to
 * cookies rather than localStorage — that is what lets middleware and route
 * handlers see the same session the browser has.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type SupabaseClient = typeof supabase;
