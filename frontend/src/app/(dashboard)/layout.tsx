"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BrandLogo } from "@/components/BrandLogo";
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

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("nav-link", active && "nav-link-active")}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
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
  const [loadedAt] = useState(() => Date.now());
  const [minutesSinceLoad, setMinutesSinceLoad] = useState(0);

  // Data is fetched when a page mounts, so "synced" means "since this view
  // loaded". Ticking once a minute keeps that label honest.
  useEffect(() => {
    const timer = setInterval(
      () => setMinutesSinceLoad(Math.floor((Date.now() - loadedAt) / 60000)),
      60000
    );
    return () => clearInterval(timer);
  }, [loadedAt]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setLoadingUser(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/login");
        setUserEmail(session?.user?.email ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function handleSync() {
    // Every page fetches its data on mount, so a reload is a real re-sync:
    // it re-requests live platform analytics through the API.
    setSyncing(true);
    window.location.reload();
  }

  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "??";

  const pageTitle =
    Object.entries(PAGE_TITLES).find(
      ([path]) =>
        pathname === path || (path !== "/dashboard" && pathname.startsWith(path))
    )?.[1] ?? "BrandCMD";

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={cn(
        "flex h-full w-56 flex-col bg-surface",
        mobile ? "" : "hidden lg:flex"
      )}
      style={{ borderRight: "1px solid var(--line)" }}
    >
      {/* Top accent line */}
      <div
        className="h-px shrink-0"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--brand), transparent)",
        }}
      />

      <div className="divider flex h-14 items-center px-4">
        <BrandLogo />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="label-caps mb-2 px-3">Main</p>
        {NAV_MAIN.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)
            }
          />
        ))}

        <div className="divider my-3" />

        <p className="label-caps mb-2 px-3">Account</p>
        {NAV_SECONDARY.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      <div className="divider p-3">
        {loadingUser ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: "var(--brand-dim)",
                border: "1px solid var(--brand)",
                color: "var(--brand-light)",
              }}
            >
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {userEmail ?? "Creator"}
              </p>
              <span className="pill-neutral mt-0.5 text-[9px]">Free</span>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 text-dim transition-colors hover:text-[var(--danger)]"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarContent />

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 z-50 h-full">
            <SidebarContent mobile />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="relative flex h-14 items-center justify-between bg-surface px-4 lg:px-6"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          {/* Olive underline accent */}
          <div
            className="absolute bottom-0 left-4 h-px w-16"
            style={{ background: "var(--brand)" }}
          />

          <div className="flex items-center gap-3">
            <button
              className="text-muted transition-colors hover:text-[var(--text)] lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <div className="lg:hidden">
              <BrandLogo />
            </div>
            <h1 className="heading hidden text-base lg:block">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="pill-success hidden sm:inline-flex">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--success)" }}
              />
              Synced{" "}
              {minutesSinceLoad === 0 ? "just now" : `${minutesSinceLoad}m ago`}
            </span>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-secondary btn-sm"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", syncing && "animate-spin")}
              />
              <span className="hidden sm:inline">Sync now</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
