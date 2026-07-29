import Link from "next/link";
import { BarChart3, Target, FileText } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * Marketing landing page.
 *
 * A server component — there is no interactivity here beyond links, and
 * hover states belong in CSS. (This was previously forced client-side by
 * inline onMouseOver handlers, which a server component cannot serialise.)
 */

const FEATURES = [
  {
    icon: BarChart3,
    title: "Unified dashboard",
    description:
      "Every number in one place. Stop switching between Twitch and YouTube tabs.",
  },
  {
    icon: Target,
    title: "Goal tracking",
    description:
      "Set targets for followers, subscribers and views. They complete themselves when you hit them.",
  },
  {
    icon: FileText,
    title: "Performance reports",
    description:
      "Period summaries across every connected platform, exportable to CSV.",
  },
];

const PLATFORMS = [
  {
    name: "Twitch",
    color: "var(--twitch)",
    description: "Followers, subscribers, broadcasts, hours streamed, VOD views",
    available: true,
  },
  {
    name: "YouTube",
    color: "var(--youtube)",
    description: "Subscribers, views, likes, comments, daily analytics",
    available: true,
  },
  {
    name: "TikTok",
    color: "var(--text-dim)",
    description: "Followers, views, likes, shares, trending content",
    available: false,
  },
  {
    name: "Discord",
    color: "var(--text-dim)",
    description: "Server members, activity, growth trends",
    available: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-50 bg-surface"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BrandLogo size={28} />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted transition-colors hover:text-[var(--text)]"
            >
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary">
              Get started free
            </Link>
          </nav>
        </div>
        <div
          className="absolute bottom-0 left-6 h-px w-16"
          style={{ background: "var(--brand)" }}
        />
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--surface-3) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
            aria-hidden="true"
          />
          <div className="relative">
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
              Your creator command center
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-lg text-muted">
              Stop switching between dashboards. BrandCMD unifies your Twitch and
              YouTube analytics in one place.
            </p>

            <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
              {["Free to start", "Twitch + YouTube", "Live platform data"].map(
                (badge) => (
                  <span key={badge} className="pill-brand px-4 py-1.5 text-sm">
                    {badge}
                  </span>
                )
              )}
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/signup" className="btn-primary px-6 py-3 text-base">
                Get started free →
              </Link>
            </div>
            <p className="mt-4 text-sm text-dim">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-brand hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>

        {/* Features */}
        <section
          className="bg-surface py-20"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Everything you need to grow
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="card p-6 transition-colors hover:border-[var(--brand)]"
                >
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: "var(--brand-dim)" }}
                  >
                    <feature.icon
                      className="h-5 w-5"
                      style={{ color: "var(--brand-light)" }}
                    />
                  </div>
                  <h3 className="mb-2 font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Connect your platforms
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.name}
                  className="card card-topped p-5"
                  style={
                    {
                      "--accent-color": platform.color,
                      opacity: platform.available ? 1 : 0.5,
                    } as React.CSSProperties
                  }
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ background: platform.color }}
                    >
                      {platform.name[0]}
                    </div>
                    {!platform.available && (
                      <span className="pill-brand">Coming soon</span>
                    )}
                  </div>
                  <p className="mb-1 font-semibold">{platform.name}</p>
                  <p className="text-xs text-muted">{platform.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer
        className="bg-surface"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm">
          <p className="mb-3 text-dim">
            <span className="font-bold" style={{ color: "var(--text)" }}>
              BRAND
            </span>
            <span className="font-bold text-brand">CMD</span> © 2026
          </p>
          <div className="flex justify-center gap-6 text-dim">
            <Link
              href="/privacy"
              className="transition-colors hover:text-[var(--text-muted)]"
            >
              Privacy
            </Link>
            {/* No Terms link until one is actually drafted — a 404 in the
                footer is worse than no link, and placeholder legalese is
                worse than both. */}
          </div>
        </div>
      </footer>
    </div>
  );
}
