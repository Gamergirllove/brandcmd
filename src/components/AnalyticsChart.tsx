"use client";

import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PLATFORM_CONFIGS, type Platform } from "@/types";
import { formatNumber, formatDate } from "@/lib/utils";

interface SeriesConfig {
  key: string;
  label: string;
  platform?: Platform;
  color?: string;
}

interface AnalyticsChartProps {
  data: Record<string, string | number>[];
  series: SeriesConfig[];
  type?: "line" | "bar";
  height?: number;
  xKey?: string;
  formatXAxis?: (value: string) => string;
}

function resolveColor(s: SeriesConfig, index: number): string {
  if (s.color) return s.color;
  if (s.platform) return PLATFORM_CONFIGS[s.platform].color;
  const defaults = [
    "#6366f1",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];
  return defaults[index % defaults.length];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg text-sm">
      <p className="mb-2 font-medium text-foreground">
        {label ? formatDate(label) : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function AnalyticsChart({
  data,
  series,
  type = "line",
  height = 300,
  xKey = "date",
  formatXAxis = formatDate,
}: AnalyticsChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed text-muted-foreground"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const commonProps = {
    data,
    margin: { top: 5, right: 20, left: 0, bottom: 5 },
  };

  const axisProps = {
    tick: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
    axisLine: false,
    tickLine: false,
  };

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart {...commonProps}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatXAxis}
            {...axisProps}
          />
          <YAxis tickFormatter={formatNumber} {...axisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={resolveColor(s, i)}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart {...commonProps}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatXAxis}
          {...axisProps}
        />
        <YAxis tickFormatter={formatNumber} {...axisProps} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={resolveColor(s, i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
