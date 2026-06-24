"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";

function BrandLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12.5" stroke="#8B9C3A" strokeWidth="1.5"/>
        <path d="M14 5.5C14 5.5 8.5 8.5 8.5 14.5C8.5 18.2 11 20.5 14 20.5C17 20.5 19.5 18.2 19.5 14.5C19.5 8.5 14 5.5 14 5.5Z" fill="#18181E" stroke="#4A5420" strokeWidth="0.8"/>
        <path d="M8.5 14.5H11L12.5 11.5L15 17.5L16.5 14.5H19.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontWeight: 700, letterSpacing: "0.5px", color: "#E8E8E8" }}>
        BRAND<span style={{ color: "#8B9C3A" }}>CMD</span>
      </span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirectedFrom);
  }

  async function handleOAuthLogin(provider: "google" | "twitch") {
    setOauthLoading(provider);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectedFrom}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setOauthLoading(null);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "#0A0A0C" }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo />
          <p className="text-sm" style={{ color: "#888896" }}>Your creator command center</p>
        </div>

        <div
          className="rounded-xl p-8"
          style={{ background: "#111115", border: "1px solid #2A2A34" }}
        >
          <h1 className="mb-1 text-xl font-semibold" style={{ color: "#E8E8E8" }}>
            Welcome back
          </h1>
          <p className="mb-6 text-sm" style={{ color: "#888896" }}>
            Sign in with your email or a connected platform.
          </p>

          {error && (
            <div
              className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              style={{
                background: "rgba(224,69,69,0.08)",
                border: "1px solid rgba(224,69,69,0.3)",
                color: "#E04545",
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" style={{ color: "#888896" }}>Email</Label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: "#0A0A0C",
                  border: "1px solid #363640",
                  color: "#E8E8E8",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" style={{ color: "#888896" }}>Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs hover:underline"
                  style={{ color: "#555560" }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: "#0A0A0C",
                  border: "1px solid #363640",
                  color: "#E8E8E8",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
              style={{ background: "#8B9C3A", color: "#000" }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.background = "#A8BA48")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#8B9C3A")}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full" style={{ borderTop: "1px solid #2A2A34" }} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 text-xs" style={{ background: "#111115", color: "#555560" }}>
                Or continue with
              </span>
            </div>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={!!oauthLoading}
              onClick={() => handleOAuthLogin("google")}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: "#18181E",
                border: "1px solid #363640",
                color: "#E8E8E8",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "#4A5420")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "#363640")}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "#4285F4" }}
              >
                G
              </span>
              <span className="flex-1 text-left">Continue with Google (YouTube)</span>
              {oauthLoading === "google" && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>

            <button
              type="button"
              disabled={!!oauthLoading}
              onClick={() => handleOAuthLogin("twitch")}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: "#18181E",
                border: "1px solid #363640",
                color: "#9146FF",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "#9146FF")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "#363640")}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "#9146FF" }}
              >
                T
              </span>
              <span className="flex-1 text-left">Continue with Twitch</span>
              {oauthLoading === "twitch" && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
          </div>
        </div>

        <p className="text-center text-sm" style={{ color: "#888896" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium hover:underline" style={{ color: "#8B9C3A" }}>
            Get started free
          </Link>
        </p>
      </div>
    </div>
  );
}
