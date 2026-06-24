"use client";

import { useState, useMemo } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type PlatformTab = "twitch" | "youtube";
type DaysRange = 7 | 30 | 90;

const PLATFORM_CONFIG = {
  twitch: {
    name: "Twitch",
    color: "#9146FF",
    metrics: [
      { key: "followers", label: "Followers" },
      { key: "avgViewers", label: "Avg Viewers" },
      { key: "peakViewers", label: "Peak Viewers" },
      { key: "newSubs", label: "New Subs" },
    ],
  },
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    metrics: [
      { key: "subscribers", label: "Subscribers" },
      { key: "views", label: "Views" },
      { key: "watchTime", label: "Watch Time (h)" },
      { key: "newSubs", label: "New Subs" },
    ],
  },
};

function generateDailyData(days: number, platform: PlatformTab) {
  const data = [];
  const now = new Date();
  let base = platform === "twitch" ? 8400 : 12100;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    base += Math.floor(Math.random() * 80 - 10);
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.max(base, 0),
    });
  }
  return data;
}

function generateContentData(platform: PlatformTab) {
  if (platform === "twitch") {
    return [
      { name: "Minecraft Saturday", value: 1840 },
      { name: "Just Chatting", value: 1200 },
      { name: "Fortnite Stream", value: 980 },
      { name: "Game Night", value: 860 },
      { name: "Speedrun Attempt", value: 720 },
    ];
  }
  return [
    { name: "How I Hit 10K Subs", value: 24300 },
    { name: "Best Clips of 2025", value: 18700 },
    { name: "Minecraft Let's Play #12", value: 14200 },
    { name: "Stream Highlights", value: 9800 },
    { name: "Setup Tour 2025", value: 7400 },
  ];
}

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
  color: string;
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
      <p className="mt-1 text-xl font-bold" style={{ color: "#E8E8E8" }}>{value}</p>
      {delta !== undefined && (
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

export default function AnalyticsPage() {
  const [platform, setPlatform] = useState<PlatformTab>("twitch");
  const [days, setDays] = useState<DaysRange>(30);
  const { isLoading } = useAnalytics({ days });

  const config = PLATFORM_CONFIG[platform];

  const dailyData = useMemo(
    () => generateDailyData(days, platform),
    [days, platform]
  );

  const contentData = useMemo(
    () => generateContentData(platform),
    [platform]
  );

  const twitchMetricValues = {
    followers: { value: "8,420", delta: 3.2 },
    avgViewers: { value: "342", delta: 8.7 },
    peakViewers: { value: "1,204", delta: -2.1 },
    newSubs: { value: "127", delta: 14.3 },
  };

  const youtubeMetricValues = {
    subscribers: { value: "12,180", delta: 5.1 },
    views: { value: "94,300", delta: 12.4 },
    watchTime: { value: "1,240", delta: 7.9 },
    newSubs: { value: "89", delta: 3.6 },
  };

  const metricValues =
    platform === "twitch" ? twitchMetricValues : youtubeMetricValues;

  const tooltipStyle = {
    background: "#18181E",
    border: "1px solid #363640",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#E8E8E8",
  };

  return (
    <div className="space-y-6">
      {/* Platform selector */}
      <div
        className="flex items-center gap-1 rounded-lg p-1 w-fit"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        {(["twitch", "youtube"] as const).map((p) => {
          const cfg = PLATFORM_CONFIG[p];
          const isActive = platform === p;
          return (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
              style={
                isActive
                  ? p === "twitch"
                    ? {
                        background: "rgba(145,70,255,0.1)",
                        color: "#9146FF",
                        border: "1px solid rgba(145,70,255,0.3)",
                      }
                    : {
                        background: "rgba(255,0,0,0.1)",
                        color: "#FF0000",
                        border: "1px solid rgba(255,0,0,0.3)",
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

      {/* Metric cards */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {config.metrics.map((m) => {
          const mv = (metricValues as Record<string, { value: string; delta: number }>)[m.key];
          return (
            <MetricCard
              key={m.key}
              label={m.label}
              value={mv?.value ?? "—"}
              delta={mv?.delta}
              color={config.color}
            />
          );
        })}
      </div>

      {/* Line chart */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: "#E8E8E8" }}>
            Daily followers — {config.name}
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
                    ? { background: config.color, color: "#fff" }
                    : { color: "#555560" }
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div
            className="h-56 animate-pulse rounded-lg"
            style={{ background: "#18181E" }}
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A34" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#555560" }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(dailyData.length / 6)}
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
                formatter={(v: number) => [formatNumber(v), "Followers"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar chart */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        <h2 className="mb-4 font-semibold" style={{ color: "#E8E8E8" }}>
          Top {platform === "twitch" ? "streams" : "videos"} by views
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={contentData}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2A2A34" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#555560" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#888896" }}
              tickLine={false}
              axisLine={false}
              width={160}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [formatNumber(v), "Views"]}
            />
            <Bar dataKey="value" fill={config.color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
