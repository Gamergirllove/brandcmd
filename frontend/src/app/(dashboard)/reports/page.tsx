"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatNumber } from "@/lib/utils";
import { PLATFORM_CONFIGS, type AnalyticsData, type PlatformMetrics } from "@/types";
import { Download, ArrowUp, ArrowDown, Minus, FileText, AlertTriangle } from "lucide-react";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

const COLUMNS = [
  { key: "followers", label: "Followers", trend: "followersChange" },
  { key: "views", label: "Views", trend: "viewsChange" },
  { key: "likes", label: "Likes", trend: "likesChange" },
  { key: "comments", label: "Comments", trend: "commentsChange" },
  { key: "shares", label: "Shares", trend: "sharesChange" },
] as const;

function Trend({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-dim" title="Not enough data in this period to compare">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium"
      style={{ color: positive ? "var(--success)" : "var(--danger)" }}
    >
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/** Build a CSV from the same numbers shown in the table. */
function toCsv(data: AnalyticsData, days: number): string {
  const header = [
    "platform",
    "username",
    "followers",
    "views",
    "likes",
    "comments",
    "shares",
    "engagement_rate_pct",
    "status",
  ];

  const rows = data.platforms
    .filter((p) => p.connected)
    .map((p) => [
      p.platform,
      p.username ?? "",
      p.followers,
      p.views,
      p.likes,
      p.comments,
      p.shares,
      p.engagementRate.toFixed(2),
      p.needsReconnect ? "needs_reconnect" : p.error ? "error" : "ok",
    ]);

  const totals = [
    "TOTAL",
    "",
    data.summary.totalFollowers,
    data.summary.totalViews,
    data.summary.totalLikes,
    data.platforms.reduce((n, p) => n + p.comments, 0),
    data.platforms.reduce((n, p) => n + p.shares, 0),
    data.summary.engagementRate.toFixed(2),
    "",
  ];

  // Quote every field and escape embedded quotes — usernames can contain commas.
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    `"BrandCommand report — last ${days} days"`,
    `"Generated","${new Date().toISOString()}"`,
    "",
    header.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
    totals.map(escape).join(","),
  ];

  return lines.join("\n");
}

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card-accent p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, error } = useAnalytics({ days });

  const connected = useMemo(
    () => (data?.platforms ?? []).filter((p) => p.connected),
    [data]
  );

  const totals = useMemo(() => {
    if (!data) return null;
    return {
      comments: connected.reduce((n, p) => n + p.comments, 0),
      shares: connected.reduce((n, p) => n + p.shares, 0),
    };
  }, [data, connected]);

  const periodLabel = RANGES.find((r) => r.days === days)?.label ?? `${days} days`;

  function handleExport() {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    download(`brandcmd-report-${days}d-${stamp}.csv`, toCsv(data, days));
  }

  if (error) {
    return (
      <div className="alert-danger">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Could not load your report: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="heading text-xl">Performance report</h1>
          <p className="mt-1 text-sm text-muted">
            Every connected platform over the last {periodLabel}, generated from
            live data.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isLoading || connected.length === 0}
          className="btn-secondary btn-sm shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="segmented">
        {RANGES.map((range) => (
          <button
            key={range.days}
            onClick={() => setDays(range.days)}
            className={
              days === range.days
                ? "segmented-item segmented-item-active"
                : "segmented-item"
            }
          >
            {range.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
          <div className="skeleton h-64" />
        </div>
      ) : connected.length === 0 ? (
        <div className="card-dashed p-10 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--brand-dim)" }}
          >
            <FileText className="h-6 w-6 text-brand" />
          </div>
          <p className="heading">Nothing to report yet</p>
          <p className="mt-1 text-sm text-muted">
            Connect a platform and your reports will build themselves.
          </p>
          <Link href="/connect" className="btn-primary mt-5">
            Connect a platform →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              label="Total followers"
              value={formatNumber(data?.summary.totalFollowers ?? 0)}
            />
            <SummaryTile
              label={`Views / ${periodLabel}`}
              value={formatNumber(data?.summary.totalViews ?? 0)}
            />
            <SummaryTile
              label="Total engagement"
              value={formatNumber(data?.summary.totalEngagement ?? 0)}
            />
            <SummaryTile
              label="Engagement rate"
              value={`${(data?.summary.engagementRate ?? 0).toFixed(2)}%`}
            />
          </div>

          {/* Wide table scrolls inside its own container rather than the page */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="divider" style={{ borderTop: "none" }}>
                  <th className="label-caps px-4 py-3 text-left font-medium">
                    Platform
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="label-caps px-4 py-3 text-right font-medium"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="label-caps px-4 py-3 text-right font-medium">
                    Engagement
                  </th>
                </tr>
              </thead>
              <tbody>
                {connected.map((platform) => {
                  const config = PLATFORM_CONFIGS[platform.platform];
                  return (
                    <tr
                      key={platform.platform}
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ background: config.color }}
                          >
                            {config.name[0]}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium">{config.name}</p>
                            {platform.username && (
                              <p className="truncate text-xs text-dim">
                                @{platform.username}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {platform.needsReconnect || platform.error ? (
                        <td colSpan={COLUMNS.length + 1} className="px-4 py-3">
                          <span
                            className={
                              platform.needsReconnect
                                ? "pill-danger"
                                : "pill-warning"
                            }
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {platform.needsReconnect
                              ? "Reconnect required — no data for this period"
                              : "Metrics unavailable this request"}
                          </span>
                        </td>
                      ) : (
                        <>
                          {COLUMNS.map((col) => (
                            <td key={col.key} className="px-4 py-3 text-right">
                              <div className="font-medium">
                                {formatNumber(
                                  platform[col.key as keyof PlatformMetrics] as number
                                )}
                              </div>
                              <Trend
                                value={
                                  platform[
                                    col.trend as keyof PlatformMetrics
                                  ] as number | null
                                }
                              />
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-medium">
                            {platform.engagementRate.toFixed(2)}%
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    borderTop: "1px solid var(--line-strong)",
                    background: "var(--bg)",
                  }}
                >
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatNumber(data?.summary.totalFollowers ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatNumber(data?.summary.totalViews ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatNumber(data?.summary.totalLikes ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatNumber(totals?.comments ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatNumber(totals?.shares ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {(data?.summary.engagementRate ?? 0).toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-dim">
            Percentages compare the most recent half of the period against the
            half before it. A dash means the period holds too little data to
            compare. Report generated{" "}
            {data?.lastUpdated
              ? new Date(data.lastUpdated).toLocaleString()
              : "just now"}
            .
          </p>
        </>
      )}
    </div>
  );
}
