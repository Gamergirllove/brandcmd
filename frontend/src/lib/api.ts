/**
 * api.ts — Typed client for the BrandCommand API.
 *
 * Every request carries the Supabase access token as a bearer credential;
 * the backend validates it and derives the user id from it. The API speaks
 * snake_case, the UI speaks camelCase, and the mapping happens here so no
 * component has to know both.
 */
import { supabase } from "@/lib/supabase";
import type {
  AnalyticsData,
  ConnectedPlatform,
  Goal,
  GoalType,
  Platform,
  PlatformMetrics,
  PlatformTimeSeries,
  Profile,
  ProfileUpdate,
} from "@/types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Wire types (what the backend actually returns)
// ---------------------------------------------------------------------------

interface WireDailyPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  followers_gained: number;
}

interface WirePlatformStats {
  platform: Platform;
  connected: boolean;
  username: string | null;
  followers: number;
  views_30d: number;
  likes_30d: number;
  comments_30d: number;
  shares_30d: number;
  engagement_rate: number;
  daily_data: WireDailyPoint[];
  raw: Record<string, unknown> | null;
  needs_reconnect: boolean;
  error: string | null;
}

interface WireOverview {
  total_followers: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_engagement: number;
  engagement_rate: number;
  platforms_connected: number;
  period_days: number;
  platforms: WirePlatformStats[];
  last_updated: string;
}

interface WirePlatformStatus {
  platform: Platform;
  connected: boolean;
  configured: boolean;
  username: string | null;
  connected_at: string | null;
  expires_at: string | null;
}

interface WireGoal {
  id: string;
  type: GoalType;
  platform: Platform;
  target_value: number;
  current_value: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string | null;
  progress_pct: number;
}

interface WireProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  creator_handle: string | null;
  creator_type: string | null;
  onboarding_complete: boolean;
  notification_prefs: {
    weekly_report: boolean;
    goal_complete: boolean;
    milestone: boolean;
  };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError("Not authenticated", 401);
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not set — the frontend does not know where the API lives.",
      500
    );
  }

  const headers = await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      (body && (body.detail ?? body.error ?? body.message)) ??
      `Request failed with status ${response.status}`;
    throw new ApiError(
      typeof detail === "string" ? detail : JSON.stringify(detail),
      response.status
    );
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Percentage change between the two halves of a daily series.
 *
 * The platform APIs give absolute counts, not period-over-period deltas, so
 * we derive the trend by comparing the most recent half of the window to the
 * half before it. Returns null when there isn't enough data to be meaningful
 * — callers should hide the indicator rather than render a fake 0%.
 */
function trend(points: WireDailyPoint[], key: keyof WireDailyPoint): number | null {
  if (points.length < 4) return null;

  const midpoint = Math.floor(points.length / 2);
  const sum = (slice: WireDailyPoint[]) =>
    slice.reduce((acc, point) => acc + (Number(point[key]) || 0), 0);

  const previous = sum(points.slice(0, midpoint));
  const current = sum(points.slice(midpoint));

  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function toPlatformMetrics(stats: WirePlatformStats): PlatformMetrics {
  return {
    platform: stats.platform,
    connected: stats.connected,
    username: stats.username ?? undefined,
    followers: stats.followers,
    views: stats.views_30d,
    likes: stats.likes_30d,
    comments: stats.comments_30d,
    shares: stats.shares_30d,
    engagementRate: stats.engagement_rate,
    followersChange: trend(stats.daily_data, "followers_gained"),
    viewsChange: trend(stats.daily_data, "views"),
    likesChange: trend(stats.daily_data, "likes"),
    commentsChange: trend(stats.daily_data, "comments"),
    sharesChange: trend(stats.daily_data, "shares"),
    needsReconnect: stats.needs_reconnect,
    error: stats.error ?? undefined,
    raw: stats.raw ?? {},
  };
}

function toTimeSeries(stats: WirePlatformStats): PlatformTimeSeries {
  return {
    platform: stats.platform,
    data: stats.daily_data.map((point) => ({
      date: point.date,
      views: point.views,
      likes: point.likes,
      comments: point.comments,
      shares: point.shares,
      followers: point.followers_gained,
    })),
  };
}

function toAnalyticsData(wire: WireOverview): AnalyticsData {
  return {
    summary: {
      totalFollowers: wire.total_followers,
      totalViews: wire.total_views,
      totalLikes: wire.total_likes,
      totalEngagement: wire.total_engagement,
      engagementRate: wire.engagement_rate,
      connectedPlatforms: wire.platforms_connected,
    },
    platforms: wire.platforms.map(toPlatformMetrics),
    timeSeries: wire.platforms.map(toTimeSeries),
    periodDays: wire.period_days,
    lastUpdated: wire.last_updated,
  };
}

function toGoal(wire: WireGoal): Goal {
  return {
    id: wire.id,
    type: wire.type,
    platform: wire.platform,
    targetValue: wire.target_value,
    currentValue: wire.current_value,
    completed: wire.completed,
    completedAt: wire.completed_at ?? undefined,
    createdAt: wire.created_at ?? undefined,
    progressPct: wire.progress_pct,
  };
}

function toProfile(wire: WireProfile): Profile {
  return {
    id: wire.id,
    username: wire.username ?? undefined,
    displayName: wire.display_name ?? undefined,
    avatarUrl: wire.avatar_url ?? undefined,
    creatorHandle: wire.creator_handle ?? undefined,
    creatorType: wire.creator_type ?? undefined,
    onboardingComplete: wire.onboarding_complete,
    notificationPrefs: {
      weeklyReport: wire.notification_prefs?.weekly_report ?? true,
      goalComplete: wire.notification_prefs?.goal_complete ?? true,
      milestone: wire.notification_prefs?.milestone ?? false,
    },
  };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function fetchOverview(days = 30): Promise<AnalyticsData> {
  const wire = await request<WireOverview>(`/analytics/overview?days=${days}`);
  return toAnalyticsData(wire);
}

export async function fetchPlatformAnalytics(
  platform: Platform,
  days = 30
): Promise<{ metrics: PlatformMetrics; series: PlatformTimeSeries }> {
  const wire = await request<WirePlatformStats>(
    `/analytics/${platform}?days=${days}`
  );
  return { metrics: toPlatformMetrics(wire), series: toTimeSeries(wire) };
}

// ---------------------------------------------------------------------------
// Platform connections
// ---------------------------------------------------------------------------

export async function fetchConnections(): Promise<ConnectedPlatform[]> {
  const wire = await request<{ platforms: WirePlatformStatus[] }>("/connect/status");
  return wire.platforms.map((p) => ({
    platform: p.platform,
    connected: p.connected,
    configured: p.configured,
    username: p.username ?? undefined,
    connectedAt: p.connected_at ?? undefined,
    accessTokenExpiry: p.expires_at ?? undefined,
  }));
}

/**
 * Returns the provider authorization URL to send the browser to.
 *
 * `returnPath` is where the backend sends the browser once the provider
 * calls back — defaults to /connect, but the onboarding wizard passes its
 * own path so a mid-wizard connection returns to the wizard.
 */
export async function fetchConnectUrl(
  platform: Platform,
  returnPath?: string
): Promise<string> {
  const query = returnPath ? `?return_path=${encodeURIComponent(returnPath)}` : "";
  const wire = await request<{ url: string; platform: string }>(
    `/connect/${platform}/url${query}`
  );
  return wire.url;
}

export async function disconnectPlatform(platform: Platform): Promise<void> {
  await request(`/connect/${platform}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export async function fetchGoals(): Promise<Goal[]> {
  const wire = await request<{ goals: WireGoal[] }>("/goals");
  return wire.goals.map(toGoal);
}

export async function createGoal(input: {
  type: GoalType;
  platform: Platform;
  targetValue: number;
}): Promise<Goal> {
  const wire = await request<WireGoal>("/goals", {
    method: "POST",
    body: JSON.stringify({
      type: input.type,
      platform: input.platform,
      target_value: input.targetValue,
    }),
  });
  return toGoal(wire);
}

export async function updateGoal(
  id: string,
  patch: { targetValue?: number; completed?: boolean }
): Promise<Goal> {
  const wire = await request<WireGoal>(`/goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      target_value: patch.targetValue,
      completed: patch.completed,
    }),
  });
  return toGoal(wire);
}

export async function deleteGoal(id: string): Promise<void> {
  await request(`/goals/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchProfile(): Promise<Profile> {
  return toProfile(await request<WireProfile>("/profile"));
}

export async function updateProfile(patch: ProfileUpdate): Promise<Profile> {
  const body: Record<string, unknown> = {};
  if (patch.displayName !== undefined) body.display_name = patch.displayName;
  if (patch.creatorHandle !== undefined) body.creator_handle = patch.creatorHandle;
  if (patch.creatorType !== undefined) body.creator_type = patch.creatorType;
  if (patch.onboardingComplete !== undefined)
    body.onboarding_complete = patch.onboardingComplete;
  if (patch.notificationPrefs !== undefined) {
    body.notification_prefs = {
      weekly_report: patch.notificationPrefs.weeklyReport,
      goal_complete: patch.notificationPrefs.goalComplete,
      milestone: patch.notificationPrefs.milestone,
    };
  }

  const wire = await request<WireProfile>("/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return toProfile(wire);
}

/** Permanently deletes the account, its tokens, goals and cached analytics. */
export async function deleteAccount(): Promise<void> {
  await request("/profile", { method: "DELETE" });
}
