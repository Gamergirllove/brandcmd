"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Link2,
  LineChart,
  Settings,
  LogOut,
  Menu,
  X,
  Target,
  FileText,
  Bell,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_MAIN = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/connect", label: "Platforms", icon: Link2 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: FileText },
];

const NAV_SECONDARY = [
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/analytics": "Analytics",
  "/connect": "Platforms",
  "/goals": "Goals",
  "/reports": "Reports",
  "/notifications": "Notifications",
  "/settings": "Settings",
};

function BrandLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12.5" stroke="#8B9C3A" strokeWidth="1.5"/>
        <path d="M14 5.5C14 5.5 8.5 8.5 8.5 14.5C8.5 18.2 11 20.5 14 20.5C17 20.5 19.5 18.2 19.5 14.5C19.5 8.5 14 5.5 14 5.5Z" fill="#18181E" stroke="#4A5420" strokeWidth="0.8"/>
        <path d="M8.5 14.5H11L12.5 11.5L15 17.5L16.5 14.5H19.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontWeight: 700, letterSpacing: "0.5px", color: "#E8E8E8", fontSize: "14px" }}>
        BRAND<span style={{ color: "#8B9C3A" }}>CMD</span>
      </span>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
      style={
        active
          ? {
              background: "rgba(74,84,32,0.2)",
              color: "#A8BA48",
              border: "1px solid #4A5420",
            }
          : {
              color: "#888896",
              border: "1px solid transparent",
            }
      }
      onMouseOver={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "#18181E";
          (e.currentTarget as HTMLAnchorElement).style.color = "#E8E8E8";
        }
      }}
      onMouseOut={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
          (e.currentTarget as HTMLAnchorElement).style.color = "#888896";
        }
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-bold"
          style={{ background: "#4A5420", color: "#A8BA48" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(3);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setLoadingUser(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
      setUserEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleSync() {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLastSynced(0);
    setSyncing(false);
  }

  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "??";

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      pathname === path || (path !== "/dashboard" && pathname.startsWith(path))
    )?.[1] ?? "BrandCMD";

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={cn(
        "flex h-full flex-col",
        mobile ? "w-56" : "hidden w-56 lg:flex"
      )}
      style={{ background: "#111115", borderRight: "1px solid #2A2A34" }}
    >
      {/* Top accent line */}
      <div
        style={{
          height: "1px",
          background: "linear-gradient(to right, transparent, #8B9C3A, transparent)",
          flexShrink: 0,
        }}
      />

      {/* Logo */}
      <div
        className="flex h-14 items-center px-4"
        style={{ borderBottom: "1px solid #2A2A34" }}
      >
        <BrandLogo />
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p
          className="mb-2 px-3 text-[9px] uppercase tracking-widest"
          style={{ color: "#555560" }}
        >
          Main
        </p>
        {NAV_MAIN.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              {...item}
              active={active}
              onClick={() => setSidebarOpen(false)}
            />
          );
        })}

        <div className="my-3" style={{ borderTop: "1px solid #2A2A34" }} />

        <p
          className="mb-2 px-3 text-[9px] uppercase tracking-widest"
          style={{ color: "#555560" }}
        >
          Account
        </p>
        {NAV_SECONDARY.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              {...item}
              active={active}
              badge={item.href === "/notifications" ? 2 : undefined}
              onClick={() => setSidebarOpen(false)}
            />
          );
        })}
      </nav>

      {/* User footer */}
      <div
        className="p-3"
        style={{ borderTop: "1px solid #2A2A34" }}
      >
        {loadingUser ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: "#4A5420",
                border: "1px solid #8B9C3A",
                color: "#A8BA48",
              }}
            >
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" style={{ color: "#E8E8E8" }}>
                {userEmail ?? "Creator"}
              </p>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{
                  background: "#18181E",
                  border: "1px solid #363640",
                  color: "#555560",
                }}
              >
                Free
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 transition-colors"
              title="Sign out"
              style={{ color: "#555560" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#E04545")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#555560")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0A0A0C" }}>
      {/* Desktop sidebar */}
      <SidebarContent />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-50">
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "#0A0A0C" }}>
        {/* Top bar */}
        <header
          className="flex h-14 items-center justify-between px-4 lg:px-6"
          style={{
            background: "#111115",
            borderBottom: "1px solid #2A2A34",
            position: "relative",
          }}
        >
          {/* Olive underline accent */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "16px",
              width: "60px",
              height: "1px",
              background: "#8B9C3A",
            }}
          />

          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden transition-colors"
              style={{ color: "#888896" }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {/* Mobile logo */}
            <div className="lg:hidden">
              <BrandLogo />
            </div>
            {/* Desktop page title */}
            <h1
              className="hidden text-base font-semibold lg:block"
              style={{ color: "#E8E8E8" }}
            >
              {pageTitle}
            </h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs sm:flex" style={{ color: "#888896" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3DBA6E" }} />
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  color: "#3DBA6E",
                  background: "rgba(61,186,110,0.1)",
                  border: "1px solid rgba(61,186,110,0.2)",
                }}
              >
                Synced {lastSynced === 0 ? "just now" : `${lastSynced} min ago`}
              </span>
            </span>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
              style={{
                border: "1px solid #363640",
                color: "#888896",
                background: "transparent",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "#4A5420")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "#363640")}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              Sync now
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
