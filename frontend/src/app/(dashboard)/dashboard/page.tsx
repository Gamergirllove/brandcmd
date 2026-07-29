"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAnalytics, useGoals } from "@/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";
import { PLATFORM_CONFIGS, type PlatformMetrics } from "@/types";
import {
  Users,
  Eye,
  TrendingUp,
  Target,
  ArrowUp,
  ArrowDown,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
type RangeKey = keyof typeof RANGES;

const TOOLTIP_STYLE = {
  background: "var(--surface-2)",
  border: "1px solid var(--line-strong)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text)",
};

function StatCard({
  title,
  value,
  delta,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  delta?: number | null;
  icon: React.ElementType;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="card card-accent space-y-3 p-5">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-7 w-32" />
        <div className="skeleton h-3 w-20" />
      </div>
    );
  }

  return (
    <div className="card card-accent flex items-start justify-between p-5">
      <div>
        <p className="label-caps">{title}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {delta !== undefined && delta !== null && (
          <div
            className="mt-1 flex items-center gap-1 text-xs font-medium"
            style={{ color: delta >= 0 ? "var(--success)" : "var(--danger)" }}
          >
            {delta >= 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(delta).toFixed(1)}% vs previous period
          </div>
        )}
      </div>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--brand-dim)" }}
      >
        <Icon className="h-4 w-4" style={{ color: "var(--brand-light)" }} />
      </div>
    </div>
  );
}

/** Metric tiles for one connected platform, driven by that platform's extras. */
function PlatformCard({ metrics }: { metrics: PlatformMetrics }) {
  const config = PLATFORM_CONFIGS[metrics.platform];
  const raw = metrics.raw ?? {};

  const tiles =
    metrics.platform === "twitch"
      ? [
          { label: "Followers", value: formatNumber(metrics.followers) },
          {
            label: "Subscribers",
            value: formatNumber(Number(raw.subscribers ?? 0)),
          },
          { label: "Hours Streamed", value: String(raw.hours_streamed ?? 0) },
          { label: "Broadcasts", value: String(raw.broadcasts ?? 0) },
        ]
      : metrics.platform === "youtube"
        ? [
            { label: "Subscribers", value: formatNumber(metrics.followers) },
            { label: "Views", value: formatNumber(metrics.views) },
            { label: "Likes", value: formatNumber(metrics.likes) },
            { label: "Comments", value: formatNumber(metrics.comments) },
          ]
        : [
            { label: "Followers", value: formatNumber(metrics.followers) },
            { label: "Views", value: formatNumber(metrics.views) },
            { label: "Likes", value: formatNumber(metrics.likes) },
            {
              label: "Engagement",
              value: `${metrics.engagementRate.toFixed(1)}%`,
            },
          ];

  return (
    <div
      className="card card-topped hud relative overflow-hidden"
      style={{ "--accent-color": config.color } as React.CSSProperties}
    >
      <div className="hud-full absolute inset-0" aria-hidden="true" />
      <div className="relative px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: config.color }}
          >
            {config.name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{config.name}</p>
            <p className="truncate text-xs text-dim">
              {metrics.username ? `@${metrics.username}` : "Connected"}
            </p>
          </div>
        </div>

        {metrics.needsReconnect ? (
          <div className="alert-danger text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Access expired.{" "}
              <Link href="/connect" className="underline">
                Reconnect {config.name}
              </Link>
            </span>
          </div>
        ) : metrics.error ? (
          <p className="text-xs text-muted">
            Metrics unavailable right now. We&apos;ll retry on the next refresh.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="card-inset p-2">
                <p className="text-xs text-dim">{tile.label}</p>
                <p className="text-sm font-semibold">{tile.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data, isLoading, error } = useAnalytics({ days: RANGES[range] });
  const { data: goals } = useGoals();

  const connected = useMemo(
    () => (data?.platforms ?? []).filter((p) => p.connected),
    [data]
  );

  // Merge every platform's daily series into one row per date, one key per
  // platform — the shape recharts wants for a multi-line chart.
  const chartData = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, Record<string, string | number>>();

    for (const series of data.timeSeries) {
      for (const point of series.data) {
        const row = byDate.get(point.date) ?? { date: point.date };
        row[series.platform] = point.views;
        byDate.set(point.date, row);
      }
    }

    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [data]);

  const chartPlatforms = useMemo(
    () =>
      data?.timeSeries.filter((s) => s.data.length > 0).map((s) => s.platform) ??
      [],
    [data]
  );

  const goalsOnTrack = goals.filter(
    (g) => g.completed || g.progressPct >= 50
  ).length;

  const viewsDelta = useMemo(() => {
    const deltas = connected
      .map((p) => p.viewsChange)
      .filter((d): d is number => d !== null);
    if (!deltas.length) return null;
    return deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }, [connected]);

  if (error) {
    return (
      <div className="alert-danger">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Could not load your analytics: {error}
      </div>
    );
  }

  const nothingConnected = !isLoading && connected.length === 0;

  return (
    <div className="space-y-6">
      <div className="segmented">
        {(["30d", "7d", "90d"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={
              range === key
                ? "segmented-item segmented-item-active"
                : "segmented-item"
            }
          >
            {key === "30d"
              ? "Last 30 days"
              : key === "7d"
                ? "7 days"
                : "90 days"}
          </button>
        ))}
      </div>

      {nothingConnected ? (
        <div className="card-dashed hud relative p-10 text-center">
          <div className="hud-full absolute inset-0" aria-hidden="true" />
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--brand-dim)" }}
          >
            <Plus className="h-6 w-6 text-brand" />
          </div>
          <p className="heading">No platforms connected yet</p>
          <p className="mt-1 text-sm text-muted">
            Connect Twitch or YouTube to start pulling live analytics into your
            command center.
          </p>
          <Link href="/connect" className="btn-primary mt-5">
            Connect a platform →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Followers"
              value={formatNumber(data?.summary.totalFollowers ?? 0)}
              icon={Users}
              loading={isLoading}
            />
            <StatCard
              title={`Total Views / ${range}`}
              value={formatNumber(data?.summary.totalViews ?? 0)}
              delta={viewsDelta}
              icon={Eye}
              loading={isLoading}
            />
            <StatCard
              title="Engagement Rate"
              value={`${(data?.summary.engagementRate ?? 0).toFixed(1)}%`}
              icon={TrendingUp}
              loading={isLoading}
            />
            <StatCard
              title="Goals"
              value={
                goals.length
                  ? `${goalsOnTrack} / ${goals.length} on track`
                  : "None set"
              }
              icon={Target}
              loading={isLoading}
            />
          </div>

          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="heading">Daily views</h2>
              <div className="flex items-center gap-4 text-xs text-muted">
                {chartPlatforms.map((platform) => (
                  <span key={platform} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: PLATFORM_CONFIGS[platform].color }}
                    />
                    {PLATFORM_CONFIGS[platform].name}
                  </span>
                ))}
              </div>
            </div>
            {isLoading ? (
              <div className="skeleton h-64" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={chartData}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--text-dim)" }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(Math.floor(chartData.length / 6), 0)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-dim)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatNumber(v)}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [formatNumber(value)]}
                  />
                  {chartPlatforms.map((platform) => (
                    <Line
                      key={platform}
                      type="monotone"
                      dataKey={platform}
                      stroke={PLATFORM_CONFIGS[platform].color}
                      strokeWidth={2}
                      dot={false}
                      name={PLATFORM_CONFIGS[platform].name}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-center text-sm text-dim">
                No daily activity in this period yet.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {connected.map((metrics) => (
              <PlatformCard key={metrics.platform} metrics={metrics} />
            ))}

            <Link
              href="/connect"
              className="card-dashed flex items-center justify-center p-8"
            >
              <div className="text-center">
                <div
                  className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "var(--brand-dim)" }}
                >
                  <Plus className="h-5 w-5 text-brand" />
                </div>
                <p className="text-sm font-medium text-muted">
                  Connect another platform
                </p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
