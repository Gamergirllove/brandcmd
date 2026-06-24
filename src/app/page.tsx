import Link from "next/link";
import { BarChart3, Target, FileText } from "lucide-react";

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

const FEATURES = [
  {
    icon: BarChart3,
    title: "Unified Dashboard",
    description: "See all your numbers in one place. Stop switching between Twitch and YouTube tabs.",
  },
  {
    icon: Target,
    title: "Goal Tracking",
    description: "Set milestones for followers, views, and subscribers. Auto-complete when you hit them.",
  },
  {
    icon: FileText,
    title: "Weekly Reports",
    description: "Auto-generated performance summaries delivered every Monday morning.",
  },
];

const PLATFORMS = [
  {
    name: "Twitch",
    color: "#9146FF",
    topColor: "#9146FF",
    description: "Followers, subscribers, avg viewers, hours streamed, chat stats",
    available: true,
  },
  {
    name: "YouTube",
    color: "#FF0000",
    topColor: "#FF0000",
    description: "Subscribers, views, watch time, revenue estimates, top videos",
    available: true,
  },
  {
    name: "TikTok",
    color: "#555560",
    topColor: "#555560",
    description: "Followers, views, likes, shares, trending content",
    available: false,
  },
  {
    name: "Discord",
    color: "#555560",
    topColor: "#555560",
    description: "Server members, activity, growth trends",
    available: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#0A0A0C", color: "#E8E8E8" }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "#111115", borderColor: "#2A2A34" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BrandLogo />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium transition-colors"
              style={{ color: "#888896" }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
              style={{ background: "#8B9C3A", color: "#000" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#A8BA48")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#8B9C3A")}
            >
              Get started free
            </Link>
          </nav>
        </div>
        {/* Olive underline accent bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "24px",
            width: "60px",
            height: "1px",
            background: "#8B9C3A",
          }}
        />
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section
          className="mx-auto max-w-4xl px-6 py-24 text-center"
          style={{ position: "relative" }}
        >
          {/* Dot grid bg */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle, #1A1A22 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              opacity: 0.6,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <h1
              className="mb-6 text-5xl font-extrabold tracking-tight sm:text-6xl"
              style={{ color: "#E8E8E8" }}
            >
              Your Creator Command Center
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-lg" style={{ color: "#888896" }}>
              Stop switching between dashboards. BrandCMD unifies your Twitch and YouTube
              analytics in one place.
            </p>

            {/* Trust badges */}
            <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
              {["Free to start", "Twitch + YouTube", "Real-time sync"].map((badge) => (
                <span
                  key={badge}
                  className="rounded-full px-4 py-1.5 text-sm font-medium"
                  style={{
                    border: "1px solid #8B9C3A",
                    color: "#A8BA48",
                    background: "rgba(139,156,58,0.08)",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/signup"
                className="rounded-lg px-6 py-3 text-base font-bold transition-colors"
                style={{ background: "#8B9C3A", color: "#000" }}
              >
                Get started free →
              </Link>
            </div>
            <p className="mt-4 text-sm" style={{ color: "#555560" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-medium" style={{ color: "#8B9C3A" }}>
                Sign in
              </Link>
            </p>
          </div>
        </section>

        {/* Feature Cards */}
        <section
          className="py-20"
          style={{ borderTop: "1px solid #2A2A34", background: "#111115" }}
        >
          <div className="mx-auto max-w-6xl px-6">
            <h2
              className="mb-12 text-center text-3xl font-bold"
              style={{ color: "#E8E8E8" }}
            >
              Everything you need to grow
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl p-6 transition-colors"
                  style={{ background: "#111115", border: "1px solid #2A2A34" }}
                  onMouseOver={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.borderColor = "#8B9C3A")
                  }
                  onMouseOut={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.borderColor = "#2A2A34")
                  }
                >
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: "#4A5420" }}
                  >
                    <f.icon className="h-5 w-5" style={{ color: "#A8BA48" }} />
                  </div>
                  <h3 className="mb-2 font-semibold" style={{ color: "#E8E8E8" }}>
                    {f.title}
                  </h3>
                  <p className="text-sm" style={{ color: "#888896" }}>
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform Section */}
        <section className="py-20" style={{ background: "#0A0A0C" }}>
          <div className="mx-auto max-w-6xl px-6">
            <h2
              className="mb-12 text-center text-3xl font-bold"
              style={{ color: "#E8E8E8" }}
            >
              Connect your platforms
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORMS.map((p) => (
                <div
                  key={p.name}
                  className="rounded-xl p-5"
                  style={{
                    background: "#111115",
                    border: "1px solid #2A2A34",
                    borderTop: `2px solid ${p.topColor}`,
                    opacity: p.available ? 1 : 0.5,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ background: p.color }}
                    >
                      {p.name[0]}
                    </div>
                    {!p.available && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          background: "#18181E",
                          color: "#8B9C3A",
                          border: "1px solid #4A5420",
                        }}
                      >
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mb-1 font-semibold" style={{ color: "#E8E8E8" }}>
                    {p.name}
                  </p>
                  <p className="text-xs" style={{ color: "#888896" }}>
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ background: "#111115", borderTop: "1px solid #2A2A34" }}>
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm">
          <p className="mb-3" style={{ color: "#555560" }}>
            <span style={{ fontWeight: 700, color: "#E8E8E8" }}>BRAND</span>
            <span style={{ fontWeight: 700, color: "#8B9C3A" }}>CMD</span>
            {" "}© 2026
          </p>
          <div className="flex justify-center gap-6" style={{ color: "#555560" }}>
            <Link href="/privacy" className="hover:text-[#888896]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#888896]">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
