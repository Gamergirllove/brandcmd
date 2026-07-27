"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchConnections,
  fetchGoals,
  fetchOverview,
  fetchProfile,
} from "@/lib/api";
import type { AnalyticsData, ConnectedPlatform, Goal, Profile } from "@/types";

interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

/**
 * Shared plumbing for the read hooks below: run `load`, track loading and
 * error state, and hand back a stable refetch.
 *
 * `load` must be referentially stable (a module-level function, or wrapped
 * in useCallback by the caller) — it is this hook's only dependency.
 */
function useAsync<T>(load: () => Promise<T>, initial: T): AsyncState<T> {
  const [data, setData] = useState<T>(initial);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setIsLoading(false);
    }
  }, [load]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, isLoading, error, refetch: run };
}

/** Cross-platform analytics for the last `days` days. */
export function useAnalytics(options: { days?: number } = {}) {
  const { days = 30 } = options;
  const load = useCallback(() => fetchOverview(days), [days]);
  return useAsync<AnalyticsData | null>(load, null);
}

/** Connection status for every platform the API supports. */
export function useConnections() {
  return useAsync<ConnectedPlatform[]>(fetchConnections, []);
}

/** The user's goals, with current values refreshed server-side. */
export function useGoals() {
  return useAsync<Goal[]>(fetchGoals, []);
}

/** The creator profile row. */
export function useProfile() {
  return useAsync<Profile | null>(fetchProfile, null);
}
