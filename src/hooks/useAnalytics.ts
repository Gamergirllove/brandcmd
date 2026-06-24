"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { AnalyticsData, Platform, MetricKey } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface UseAnalyticsOptions {
  platform?: Platform;
  days?: number;
  metric?: MetricKey;
}

interface UseAnalyticsReturn {
  data: AnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export function useAnalytics(
  options: UseAnalyticsOptions = {}
): UseAnalyticsReturn {
  const { platform, days = 30 } = options;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeader();

      if (!headers.Authorization) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({ days: String(days) });
      if (platform) {
        params.append("platform", platform);
      }

      const response = await fetch(
        `${API_URL}/api/analytics?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          errBody.error ?? `Request failed with status ${response.status}`
        );
      }

      const json = await response.json();
      setData(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [platform, days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, isLoading, error, refetch: fetchAnalytics };
}

export async function connectPlatform(platform: Platform): Promise<void> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_URL}/api/connect/${platform}`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to connect ${platform}`);
  }

  const body = await response.json();

  // If backend returns an OAuth redirect URL, navigate to it
  if (body.auth_url) {
    window.location.href = body.auth_url;
  }
}

export async function disconnectPlatform(platform: Platform): Promise<void> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_URL}/api/connect/${platform}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to disconnect ${platform}`);
  }
}

export async function getConnectedPlatforms(): Promise<Platform[]> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_URL}/api/connect`, { headers });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  return (json.data ?? json).connected ?? [];
}
