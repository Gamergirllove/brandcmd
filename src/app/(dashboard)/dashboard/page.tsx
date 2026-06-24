"use client";

import { useState, useEffect, useMemo } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";
import {
  Users,
  Eye,
  TrendingUp,
  Target,
  ArrowUp,
  ArrowDown,
  Plus,
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

function generateMockGrowth() {
  const data = [];
  const now = new Date();
  let twitch = 8400;
  let youtube = 12100;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    twitch += Math.floor(Math.random() * 120 - 20);
    youtube += Math.floor(Math.random() * 180 - 30);
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      twitch: Math.max(twitch, 0),
      youtube: Math.max(youtube, 0),
    });
  }
  return data;
}

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
  delta?: number;
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
            {delta !== undefined && (
              <div
                className="mt-1 flex items-center gap-1 text-xs font-medium"
                style={{ color: delta >= 0 ? "#3DBA6E" : "#E04545" }}
              >
                {delta >= 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                {Math.abs(delta).toFixed(1)}% vs last period
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

export default function DashboardPage() {
  const { data, isLoading } = useAnalytics({ days: 30 });
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [chartData, setChartData] = useState<ReturnType<typeof generateMockGrowth>>([]);

  useEffect(() => {
    setChartData(generateMockGrowth());
  }, []);

  const twitchConnected = data?.platforms.find((p) => p.platform === "twitch");
  const youtubeConnected = data?.platforms.find((p) => p.platform === "youtube");

  const twitchMetrics = useMemo(
    () => ({
      followers: twitchConnected?.followers ?? 8420,
      avgViewers: 342,
      hoursStreamed: 48,
      newSubs: 127,
    }),
    [twitchConnected]
  );

  const youtubeMetrics = useMemo(
    () => ({
      subscribers: youtubeConnected?.followers ?? 12180,
      views: youtubeConnected?.views ?? 94300,
      watchTime: "1,240h",
      newSubs: 89,
    }),
    [youtubeConnected]
  );

  const totalFollowers =
    (twitchConnected?.followers ?? twitchMetrics.followers) +
    (youtubeConnected?.followers ?? youtubeMetrics.subscribers);

  const totalViews = youtubeConnected?.views ?? youtubeMetrics.views;
  const engagementRate = data?.summary.engagementRate ?? 4.7;

  const displayedChartData = useMemo(() => {
    if (!chartData.length) return [];
    if (range === "7d") return chartData.slice(-7);
    if (range === "90d") return chartData;
    return chartData.slice(-30);
  }, [chartData, range]);

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

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Followers"
          value={formatNumber(totalFollowers)}
          delta={3.2}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="Total Views / 30d"
          value={formatNumber(totalViews)}
          delta={8.1}
          icon={Eye}
          loading={isLoading}
        />
        <StatCard
          title="Engagement Rate"
          value={`${engagementRate.toFixed(1)}%`}
          delta={-0.4}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          title="Goals"
          value="2 / 3 on track"
          icon={Target}
          loading={isLoading}
        />
      </div>

      {/* Follower Growth Chart */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#111115", border: "1px solid #2A2A34" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: "#E8E8E8" }}>Follower growth</h2>
          <div className="flex items-center gap-4 text-xs" style={{ color: "#888896" }}>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#9146FF" }} />
              Twitch
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FF0000" }} />
              YouTube
            </span>
          </div>
        </div>
        {displayedChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={displayedChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A34" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#555560" }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(displayedChartData.length / 6)}
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
              <Line
                type="monotone"
                dataKey="twitch"
                stroke="#9146FF"
                strokeWidth={2}
                dot={false}
                name="Twitch"
              />
              <Line
                type="monotone"
                dataKey="youtube"
                stroke="#FF0000"
                strokeWidth={2}
                dot={false}
                name="YouTube"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex h-64 items-center justify-center text-sm"
            style={{ color: "#555560" }}
          >
            Loading chart…
          </div>
        )}
      </div>

      {/* Platform cards row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Twitch card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "#111115",
            border: "1px solid #2A2A34",
            borderTop: "2px solid #9146FF",
            position: "relative",
          }}
        >
          <HudCorners />
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: "#9146FF" }}
              >
                T
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#E8E8E8" }}>Twitch</p>
                <p className="text-xs" style={{ color: "#555560" }}>@yourchannel</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Followers", value: formatNumber(twitchMetrics.followers) },
                { label: "Avg Viewers", value: formatNumber(twitchMetrics.avgViewers) },
                { label: "Hours Streamed", value: String(twitchMetrics.hoursStreamed) },
                { label: "New Subs", value: String(twitchMetrics.newSubs) },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg p-2"
                  style={{ background: "#0A0A0C", border: "1px solid #2A2A34" }}
                >
                  <p className="text-xs" style={{ color: "#555560" }}>{m.label}</p>
                  <p className="font-semibold text-sm" style={{ color: "#E8E8E8" }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* YouTube card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "#111115",
            border: "1px solid #2A2A34",
            borderTop: "2px solid #FF0000",
            position: "relative",
          }}
        >
          <HudCorners />
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: "#FF0000" }}
              >
                Y
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#E8E8E8" }}>YouTube</p>
                <p className="text-xs" style={{ color: "#555560" }}>Your Channel</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Subscribers", value: formatNumber(youtubeMetrics.subscribers) },
                { label: "Views", value: formatNumber(youtubeMetrics.views) },
                { label: "Watch Time", value: youtubeMetrics.watchTime },
                { label: "New Subs", value: String(youtubeMetrics.newSubs) },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg p-2"
                  style={{ background: "#0A0A0C", border: "1px solid #2A2A34" }}
                >
                  <p className="text-xs" style={{ color: "#555560" }}>{m.label}</p>
                  <p className="font-semibold text-sm" style={{ color: "#E8E8E8" }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add platform card */}
        <div
          className="flex cursor-pointer items-center justify-center rounded-xl p-8 transition-colors"
          style={{
            background: "transparent",
            border: "1px dashed #363640",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#8B9C3A";
            (e.currentTarget as HTMLDivElement).style.background = "rgba(139,156,58,0.04)";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#363640";
            (e.currentTarget as HTMLDivElement).style.background = "transparent";
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
            <p className="text-xs mt-1" style={{ color: "#555560" }}>
              TikTok, Discord coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
