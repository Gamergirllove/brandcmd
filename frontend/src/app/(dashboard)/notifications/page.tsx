"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAnalytics, useConnections, useGoals } from "@/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";
import {
  GOAL_LABELS,
  PLATFORM_CONFIGS,
  type ConnectedPlatform,
  type Goal,
  type PlatformMetrics,
} from "@/types";
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Clock,
  Link2Off,
  Target,
  TrendingUp,
} from "lucide-react";

/**
 * Alerts are computed from current state each time this page loads — there
 * is no notification table behind them. That means they always reflect
 * reality, but they are not a history: an alert disappears once the
 * underlying condition clears.
 */

type Severity = "danger" | "warning" | "success" | "info";

interface Alert {
  id: string;
  severity: Severity;
  icon: React.ElementType;
  title: string;
  detail: string;
  /** Only set when we have a genuine timestamp for the event. */
  at?: string;
  action?: { label: string; href: string };
}

const SEVERITY_ORDER: Record<Severity, number> = {
  danger: 0,
  warning: 1,
  success: 2,
  info: 3,
};

const SEVERITY_STYLES: Record<Severity, { pill: string; color: string }> = {
  danger: { pill: "pill-danger", color: "var(--danger)" },
  warning: { pill: "pill-warning", color: "var(--warning)" },
  success: { pill: "pill-success", color: "var(--success)" },
  info: { pill: "pill-brand", color: "var(--brand-light)" },
};

function buildAlerts(
  platforms: PlatformMetrics[],
  connections: ConnectedPlatform[],
  goals: Goal[]
): Alert[] {
  const alerts: Alert[] = [];

  // --- Platform health -----------------------------------------------
  for (const platform of platforms) {
    if (!platform.connected) continue;
    const name = PLATFORM_CONFIGS[platform.platform].name;

    if (platform.needsReconnect) {
      alerts.push({
        id: `reconnect-${platform.platform}`,
        severity: "danger",
        icon: Link2Off,
        title: `${name} needs reconnecting`,
        detail:
          "The stored access token can no longer be refreshed, so this platform has stopped reporting data.",
        action: { label: "Reconnect", href: "/connect" },
      });
    } else if (platform.error) {
      alerts.push({
        id: `error-${platform.platform}`,
        severity: "warning",
        icon: AlertTriangle,
        title: `${name} metrics unavailable`,
        detail: platform.error,
      });
    }
  }

  // --- Credentials expiring soon --------------------------------------
  const soon = Date.now() + 3 * 24 * 60 * 60 * 1000;
  for (const connection of connections) {
    if (!connection.connected || !connection.accessTokenExpiry) continue;
    const expiry = new Date(connection.accessTokenExpiry).getTime();
    if (Number.isNaN(expiry) || expiry > soon) continue;

    const name = PLATFORM_CONFIGS[connection.platform].name;
    alerts.push({
      id: `expiring-${connection.platform}`,
      severity: "warning",
      icon: Clock,
      title: `${name} access expires soon`,
      detail:
        "It should refresh automatically. If this alert persists after a sync, reconnect the platform.",
      at: connection.accessTokenExpiry,
      action: { label: "View platforms", href: "/connect" },
    });
  }

  // --- Goals -----------------------------------------------------------
  for (const goal of goals) {
    const label = (GOAL_LABELS[goal.type] ?? goal.type).replace(
      "X",
      formatNumber(goal.targetValue)
    );

    if (goal.completed) {
      alerts.push({
        id: `goal-done-${goal.id}`,
        severity: "success",
        icon: CheckCircle2,
        title: "Goal reached",
        detail: `${label} — you're at ${formatNumber(goal.currentValue)}.`,
        at: goal.completedAt,
        action: { label: "View goals", href: "/goals" },
      });
    } else if (goal.progressPct >= 80) {
      alerts.push({
        id: `goal-close-${goal.id}`,
        severity: "info",
        icon: TrendingUp,
        title: "Goal within reach",
        detail: `${label} — ${goal.progressPct.toFixed(0)}% there, ${formatNumber(
          Math.max(goal.targetValue - goal.currentValue, 0)
        )} to go.`,
        action: { label: "View goals", href: "/goals" },
      });
    }
  }

  // --- Nudges -----------------------------------------------------------
  if (platforms.filter((p) => p.connected).length === 0) {
    alerts.push({
      id: "no-platforms",
      severity: "info",
      icon: Link2Off,
      title: "No platforms connected",
      detail: "Connect Twitch or YouTube to start tracking your audience.",
      action: { label: "Connect", href: "/connect" },
    });
  } else if (goals.length === 0) {
    alerts.push({
      id: "no-goals",
      severity: "info",
      icon: Target,
      title: "No goals set",
      detail:
        "Set a follower or view target and BrandCMD will track progress against live data.",
      action: { label: "Set a goal", href: "/goals" },
    });
  }

  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const Icon = alert.icon;
  const styles = SEVERITY_STYLES[alert.severity];

  return (
    <li
      className="card flex items-start gap-3 p-4"
      style={{ borderLeft: `2px solid ${styles.color}` }}
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--surface-2)", color: styles.color }}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{alert.title}</p>
          {alert.at && (
            <span className="text-xs text-dim">
              {new Date(alert.at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted">{alert.detail}</p>
      </div>

      {alert.action && (
        <Link href={alert.action.href} className="btn-secondary btn-sm shrink-0">
          {alert.action.label}
        </Link>
      )}
    </li>
  );
}

export default function NotificationsPage() {
  const { data, isLoading: loadingAnalytics, error } = useAnalytics({ days: 30 });
  const { data: connections, isLoading: loadingConnections } = useConnections();
  const { data: goals, isLoading: loadingGoals } = useGoals();

  const isLoading = loadingAnalytics || loadingConnections || loadingGoals;

  const alerts = useMemo(
    () => buildAlerts(data?.platforms ?? [], connections, goals),
    [data, connections, goals]
  );

  const needsAttention = alerts.filter(
    (a) => a.severity === "danger" || a.severity === "warning"
  ).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="heading text-xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted">
          Alerts computed from your current data every time this page loads.
        </p>
      </div>

      {error && (
        <div className="alert-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Could not load your data: {error}
        </div>
      )}

      {isLoading ? (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="skeleton h-20" />
          ))}
        </ul>
      ) : alerts.length === 0 ? (
        <div className="card-dashed p-10 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--brand-dim)" }}
          >
            <BellOff className="h-6 w-6 text-brand" />
          </div>
          <p className="heading">Nothing needs your attention</p>
          <p className="mt-1 text-sm text-muted">
            Every platform is reporting and no goals need a look.
          </p>
        </div>
      ) : (
        <>
          {needsAttention > 0 && (
            <div className="alert-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {needsAttention} {needsAttention === 1 ? "item needs" : "items need"}{" "}
                attention.
              </span>
            </div>
          )}

          <ul className="space-y-3">
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-dim">
        These are derived from your current data, not a stored history — an
        alert clears as soon as its cause does. Email delivery for these is
        configured under{" "}
        <Link href="/settings" className="underline">
          Settings
        </Link>
        , though sending is not implemented yet.
      </p>
    </div>
  );
}
