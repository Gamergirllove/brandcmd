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

/** HUD corner brackets — 4 absolute-positioned L-shapes */
function HudCorners() {
  const cornerStyle = (pos: "tl" | "tr" | "bl" | "br"): React.CSSProperties => ({
    position: "absolute",
    width: "10px",
    height: "10px",
    borderColor: "#8B9C3A",
    borderStyle: "solid",
    opacity: 0.4,
    ...(pos === "tl" && { top: 6, left: 6, borderWidth: "1px 0 0 1px" }),
    ...(pos === "tr" && { top: 6, right: 6, borderWidth: "1px 1px 0 0" }),
    ...(pos === "bl" && { bottom: 6, left: 6, borderWidth: "0 0 1px 1px" }),
    ...(pos === "br" && { bottom: 6, right: 6, borderWidth: "0 1px 1px 0" }),
  });
  return (
    <>
      <div style={cornerStyle("tl")} />
      <div style={cornerStyle("tr")} />
      <div style={cornerStyle("bl")} />
      <div style={cornerStyle("br")} />
    </>
  );
}

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
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "#111115",
        border: "1px solid #2A2A34",
        borderLeft: "2px solid #8B9C3A",
      }}
    >
      {loading ? (
        <div className="space-y-3">
          <div className="h-3 w-24 rounded animate-pulse" style={{ background: "#18181E" }} />
          <div className="h-7 w-32 rounded animate-pulse" style={{ background: "#18181E" }} />
          <div className="h-3 w-20 rounded animate-pulse" style={{ background: "#18181E" }} />
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#555560" }}>
              {title}
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "#E8E8E8" }}>
              {value}
            </p>
            {delta !== undefined && delta !== null && (
              <div
                className="mt-1 flex items-center gap-1 text-xs font-medium"
                style={{ color: delta >= 0 ? "#3DBA6E" : "#E04545" }}
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
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "#4A5420" }}
          >
            <Icon className="h-4 w-4" style={{ color: "#A8BA48" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Metric tiles for one connected platform, driven by that platform's own extras. */
function PlatformCard({ metrics }: { metrics: PlatformMetrics }) {
  const config = PLATFORM_CONFIGS[metrics.platform];
  const raw = metrics.raw ?? {};

  const tiles: { label: string; value: string }[] = [];

  if (metrics.platform === "twitch") {
    tiles.push(
      { label: "Followers", value: formatNumber(metrics.followers) },
      { label: "Subscribers", value: formatNumber(Number(raw.subscribers ?? 0)) },
      { label: "Hours Streamed", value: String(raw.hours_streamed ?? 0) },
      { label: "Broadcasts", value: String(raw.broadcasts ?? 0) }
    );
  } else if (metrics.platform === "youtube") {
    tiles.push(
      { label: "Subscribers", value: formatNumber(metrics.followers) },
      { label: "Views", value: formatNumber(metrics.views) },
      { label: "Likes", value: formatNumber(metrics.likes) },
      { label: "Comments", value: formatNumber(metrics.comments) }
    );
  } else {
    tiles.push(
      { label: "Followers", value: formatNumber(metrics.followers) },
      { label: "Views", value: formatNumber(metrics.views) },
      { label: "Likes", value: formatNumber(metrics.likes) },
      { label: "Engagement", value: `${metrics.engagementRate.toFixed(1)}%` }
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#111115",
        border: "1px solid #2A2A34",
        borderTop: `2px solid ${config.color}`,
        position: "relative",
      }}
    >
      <HudCorners />
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: config.color }}
          >
            {config.name[0]}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#E8E8E8" }}>
              {config.name}
            </p>
            <p className="text-xs" style={{ color: "#555560" }}>
              {metrics.username ? `@${metrics.username}` : "Connected"}
            </p>
          </div>
        </div>

        {metrics.needsReconnect ? (
          <div
            className="flex items-start gap-2 rounded-lg p-3 text-xs"
            style={{
              background: "rgba(224,69,69,0.08)",
              border: "1px solid rgba(224,69,69,0.3)",
              color: "#E04545",
            }}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Access expired.{" "}
              <Link href="/connect" className="underline">
                Reconnect {config.name}
              </Link>
            </span>
          </div>
        ) : metrics.error ? (
          <p className="text-xs" style={{ color: "#888896" }}>
            Metrics unavailable right now. We&apos;ll retry on the next refresh.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-lg p-2"
                style={{ background: "#0A0A0C", border: "1px solid #2A2A34" }}
              >
                <p className="text-xs" style={{ color: "#555560" }}>
                  {tile.label}
                </p>
                <p className="font-semibold text-sm" style={{ color: "#E8E8E8" }}>
                  {tile.value}
                </p>
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
  // platform, which is the shape recharts wants for a multi-line chart.
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
    () => data?.timeSeries.filter((s) => s.data.length > 0).map((s) => s.platform) ?? [],
    [data]
  );

  const goalsOnTrack = goals.filter((g) => g.completed || g.progressPct >= 50).length;

  const viewsDelta = useMemo(() => {
    const deltas = connected
      .map((p) => p.viewsChange)
      .filter((d): d is number => d !== null);
    if (!deltas.length) return null;
    return deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }, [connected]);

  if (error) {
    return (
      <div
        className="rounded-xl px-5 py-4 text-sm"
        style={{
          background: "rgba(224,69,69,0.08)",
          border: "1px solid rgba(224,69,69,0.3)",
          color: "#E04545",
        }}
      >
        Could not load your analytics: {error}
      </div>
    );
  }

  const nothingConnected = !isLoading && connected.length === 0;

  return (
    <div className="space-y-6">
      {/* Time range tabs */}
      <div
        className="flex items-center gap-1 rounded-lg p-1 w-fit"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        {(["30d", "7d", "90d"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
            style={
              range === r
                ? {
                    background: "rgba(74,84,32,0.2)",
                    color: "#A8BA48",
                    border: "1px solid #4A5420",
                  }
                : { color: "#555560", border: "1px solid transparent" }
            }
          >
            {r === "30d" ? "Last 30 days" : r === "7d" ? "7 days" : "90 days"}
          </button>
        ))}
      </div>

      {nothingConnected ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: "#111115", border: "1px dashed #363640", position: "relative" }}
        >
          <HudCorners />
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "#4A5420" }}
          >
            <Plus className="h-6 w-6" style={{ color: "#8B9C3A" }} />
          </div>
          <p className="font-semibold" style={{ color: "#E8E8E8" }}>
            No platforms connected yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "#888896" }}>
            Connect Twitch or YouTube to start pulling live analytics into your command center.
          </p>
          <Link
            href="/connect"
            className="mt-5 inline-block rounded-lg px-5 py-2 text-sm font-bold"
            style={{ background: "#8B9C3A", color: "#000" }}
          >
            Connect a platform →
          </Link>
        </div>
      ) : (
        <>
          {/* Stats row */}
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
              value={goals.length ? `${goalsOnTrack} / ${goals.length} on track` : "None set"}
              icon={Target}
              loading={isLoading}
            />
          </div>

          {/* Views chart */}
          <div
            className="rounded-xl p-5"
            style={{ background: "#111115", border: "1px solid #2A2A34" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "#E8E8E8" }}>
                Daily views
              </h2>
              <div className="flex items-center gap-4 text-xs" style={{ color: "#888896" }}>
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
              <div className="h-64 animate-pulse rounded-lg" style={{ background: "#18181E" }} />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A34" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#555560" }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(Math.floor(chartData.length / 6), 0)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#555560" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatNumber(v)}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181E",
                      border: "1px solid #363640",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#E8E8E8",
                    }}
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
              <div
                className="flex h-64 items-center justify-center text-center text-sm"
                style={{ color: "#555560" }}
              >
                No daily activity in this period yet.
              </div>
            )}
          </div>

          {/* Platform cards row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {connected.map((metrics) => (
              <PlatformCard key={metrics.platform} metrics={metrics} />
            ))}

            <Link
              href="/connect"
              className="flex cursor-pointer items-center justify-center rounded-xl p-8 transition-colors"
              style={{ background: "transparent", border: "1px dashed #363640" }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "#8B9C3A";
                e.currentTarget.style.background = "rgba(139,156,58,0.04)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "#363640";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div className="text-center">
                <div
                  className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "#4A5420" }}
                >
                  <Plus className="h-5 w-5" style={{ color: "#8B9C3A" }} />
                </div>
                <p className="text-sm font-medium" style={{ color: "#888896" }}>
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
