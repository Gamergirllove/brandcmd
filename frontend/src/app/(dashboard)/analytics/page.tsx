"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";
import { PLATFORM_CONFIGS, type Platform, type PlatformMetrics } from "@/types";
import { ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type DaysRange = 7 | 30 | 90;

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#111115",
        border: "1px solid #2A2A34",
        borderLeft: "2px solid #8B9C3A",
      }}
    >
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "#555560" }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-bold" style={{ color: "#E8E8E8" }}>
        {value}
      </p>
      {delta !== undefined && delta !== null && (
        <div
          className="mt-1 flex items-center gap-0.5 text-xs font-medium"
          style={{ color: delta >= 0 ? "#3DBA6E" : "#E04545" }}
        >
          {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/** The four headline metrics for a platform, using its own extras where it has them. */
function metricsFor(m: PlatformMetrics): { label: string; value: string; delta?: number | null }[] {
  const raw = m.raw ?? {};

  if (m.platform === "twitch") {
    return [
      { label: "Followers", value: formatNumber(m.followers), delta: m.followersChange },
      { label: "Subscribers", value: formatNumber(Number(raw.subscribers ?? 0)) },
      { label: "Hours Streamed", value: String(raw.hours_streamed ?? 0) },
      { label: "Avg Views / Broadcast", value: formatNumber(Number(raw.avg_views_per_broadcast ?? 0)) },
    ];
  }

  if (m.platform === "youtube") {
    return [
      { label: "Subscribers", value: formatNumber(m.followers), delta: m.followersChange },
      { label: "Views", value: formatNumber(m.views), delta: m.viewsChange },
      { label: "Likes", value: formatNumber(m.likes), delta: m.likesChange },
      { label: "Comments", value: formatNumber(m.comments), delta: m.commentsChange },
    ];
  }

  return [
    { label: "Followers", value: formatNumber(m.followers), delta: m.followersChange },
    { label: "Views", value: formatNumber(m.views), delta: m.viewsChange },
    { label: "Likes", value: formatNumber(m.likes), delta: m.likesChange },
    { label: "Engagement Rate", value: `${m.engagementRate.toFixed(1)}%` },
  ];
}

const tooltipStyle = {
  background: "#18181E",
  border: "1px solid #363640",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#E8E8E8",
};

export default function AnalyticsPage() {
  const [days, setDays] = useState<DaysRange>(30);
  const { data, isLoading, error } = useAnalytics({ days });
  const [platform, setPlatform] = useState<Platform | null>(null);

  const connected = useMemo(
    () => (data?.platforms ?? []).filter((p) => p.connected),
    [data]
  );

  // Default to the first connected platform once data arrives, and recover if
  // the selected one gets disconnected.
  useEffect(() => {
    if (!connected.length) return;
    if (!platform || !connected.some((p) => p.platform === platform)) {
      setPlatform(connected[0].platform);
    }
  }, [connected, platform]);

  const active = connected.find((p) => p.platform === platform) ?? null;
  const series = data?.timeSeries.find((s) => s.platform === platform)?.data ?? [];
  const config = platform ? PLATFORM_CONFIGS[platform] : null;

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
        Could not load analytics: {error}
      </div>
    );
  }

  if (!isLoading && connected.length === 0) {
    return (
      <div
        className="rounded-xl p-10 text-center"
        style={{ background: "#111115", border: "1px dashed #363640" }}
      >
        <p className="font-semibold" style={{ color: "#E8E8E8" }}>
          Nothing to analyze yet
        </p>
        <p className="mt-1 text-sm" style={{ color: "#888896" }}>
          Connect a platform and your analytics will appear here.
        </p>
        <Link
          href="/connect"
          className="mt-5 inline-block rounded-lg px-5 py-2 text-sm font-bold"
          style={{ background: "#8B9C3A", color: "#000" }}
        >
          Connect a platform →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform selector */}
      <div
        className="flex flex-wrap items-center gap-1 rounded-lg p-1 w-fit"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        {connected.map((p) => {
          const cfg = PLATFORM_CONFIGS[p.platform];
          const isActive = platform === p.platform;
          return (
            <button
              key={p.platform}
              onClick={() => setPlatform(p.platform)}
              className="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
              style={
                isActive
                  ? {
                      background: `${cfg.color}1A`,
                      color: cfg.color,
                      border: `1px solid ${cfg.color}4D`,
                    }
                  : { color: "#555560", border: "1px solid transparent" }
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: isActive ? cfg.color : "#363640" }}
              />
              {cfg.name}
            </button>
          );
        })}
      </div>

      {active?.needsReconnect && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(224,69,69,0.08)",
            border: "1px solid rgba(224,69,69,0.3)",
            color: "#E04545",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {config?.name} access expired.{" "}
            <Link href="/connect" className="underline font-medium">
              Reconnect it
            </Link>{" "}
            to resume tracking.
          </span>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {isLoading || !active
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl"
                style={{ background: "#18181E" }}
              />
            ))
          : metricsFor(active).map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} delta={m.delta} />
            ))}
      </div>

      {/* Daily views */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: "#E8E8E8" }}>
            Daily views — {config?.name ?? "—"}
          </h2>
          <div
            className="flex items-center gap-1 rounded-lg p-0.5"
            style={{ border: "1px solid #2A2A34" }}
          >
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                style={
                  days === d
                    ? { background: config?.color ?? "#8B9C3A", color: "#fff" }
                    : { color: "#555560" }
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-lg" style={{ background: "#18181E" }} />
        ) : series.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A34" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#555560" }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(Math.floor(series.length / 6), 0)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#555560" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v)}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [formatNumber(v), "Views"]}
              />
              <Line
                type="monotone"
                dataKey="views"
                stroke={config?.color ?? "#8B9C3A"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex h-56 items-center justify-center text-sm"
            style={{ color: "#555560" }}
          >
            No daily data for this platform in the last {days} days.
          </div>
        )}
      </div>

      {/* Engagement breakdown */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        <h2 className="mb-4 font-semibold" style={{ color: "#E8E8E8" }}>
          Daily engagement breakdown
        </h2>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-lg" style={{ background: "#18181E" }} />
        ) : series.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2A2A34" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#555560" }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(Math.floor(series.length / 6), 0)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#555560" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v)}
                width={48}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatNumber(v)} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#888896" }} />
              <Bar dataKey="likes" stackId="e" fill="#8B9C3A" name="Likes" />
              <Bar dataKey="comments" stackId="e" fill="#4A5420" name="Comments" />
              <Bar dataKey="shares" stackId="e" fill="#A8BA48" name="Shares" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex h-48 items-center justify-center text-sm"
            style={{ color: "#555560" }}
          >
            No engagement recorded in this period.
          </div>
        )}
      </div>
    </div>
  );
}
