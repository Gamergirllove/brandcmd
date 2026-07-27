// Platforms the MVP dashboard surfaces. The API supports more (see
// PLATFORM_CONFIGS); these are the two the product leads with.
export type MvpPlatform = "twitch" | "youtube";

export type Platform =
  | "twitch"
  | "youtube"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "pinterest"
  | "linkedin"
  | "snapchat"
  | "facebook"
  | "discord"
  | "kick";

export const MVP_PLATFORMS: MvpPlatform[] = ["twitch", "youtube"];

export interface PlatformConfig {
  id: Platform;
  name: string;
  color: string;
  textColor: string;
  icon: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  twitch: {
    id: "twitch",
    name: "Twitch",
    color: "#9146FF",
    textColor: "#ffffff",
    icon: "twitch",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    textColor: "#ffffff",
    icon: "youtube",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    color: "#000000",
    textColor: "#ffffff",
    icon: "tiktok",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    color: "#E1306C",
    textColor: "#ffffff",
    icon: "instagram",
  },
  twitter: {
    id: "twitter",
    name: "Twitter / X",
    color: "#1DA1F2",
    textColor: "#ffffff",
    icon: "twitter",
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    color: "#E60023",
    textColor: "#ffffff",
    icon: "pinterest",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    color: "#0A66C2",
    textColor: "#ffffff",
    icon: "linkedin",
  },
  snapchat: {
    id: "snapchat",
    name: "Snapchat",
    color: "#FFFC00",
    textColor: "#000000",
    icon: "snapchat",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    textColor: "#ffffff",
    icon: "facebook",
  },
  discord: {
    id: "discord",
    name: "Discord",
    color: "#5865F2",
    textColor: "#ffffff",
    icon: "discord",
  },
  kick: {
    id: "kick",
    name: "Kick.com",
    color: "#53FC18",
    textColor: "#000000",
    icon: "kick",
  },
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface PlatformMetrics {
  platform: Platform;
  connected: boolean;
  username?: string;
  followers: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  // Period-over-period trend, derived from the daily series.
  // null when the window holds too little data to compare.
  followersChange: number | null;
  viewsChange: number | null;
  likesChange: number | null;
  commentsChange: number | null;
  sharesChange: number | null;
  // Stored credentials no longer work — prompt a reconnect.
  needsReconnect?: boolean;
  // This platform's fetch failed; its numbers are unavailable right now.
  error?: string;
  // Platform-specific extras (Twitch subscribers, YouTube watch time, …).
  raw: Record<string, unknown>;
}

export interface DailyDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  followers: number;
}

export interface PlatformTimeSeries {
  platform: Platform;
  data: DailyDataPoint[];
}

export interface AnalyticsData {
  summary: {
    totalFollowers: number;
    totalViews: number;
    totalLikes: number;
    totalEngagement: number;
    engagementRate: number;
    connectedPlatforms: number;
  };
  platforms: PlatformMetrics[];
  timeSeries: PlatformTimeSeries[];
  periodDays: number;
  lastUpdated: string;
}

export interface ConnectedPlatform {
  platform: Platform;
  connected: boolean;
  // Whether this deployment has OAuth credentials for the platform at all.
  configured: boolean;
  username?: string;
  connectedAt?: string;
  accessTokenExpiry?: string;
}

export type MetricKey = "followers" | "views" | "likes" | "comments" | "shares";

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  weeklyReport: boolean;
  goalComplete: boolean;
  milestone: boolean;
}

export interface Profile {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  creatorHandle?: string;
  creatorType?: string;
  onboardingComplete: boolean;
  notificationPrefs: NotificationPrefs;
}

export interface ProfileUpdate {
  displayName?: string;
  creatorHandle?: string;
  creatorType?: string;
  onboardingComplete?: boolean;
  notificationPrefs?: NotificationPrefs;
}

// ---------------------------------------------------------------------------
// Onboarding + goals
// ---------------------------------------------------------------------------

export enum CreatorType {
  Gaming = "gaming",
  Music = "music",
  Lifestyle = "lifestyle",
  TechEducation = "tech_education",
  ArtDesign = "art_design",
  Other = "other",
}

export enum GoalType {
  TwitchFollowers = "twitch_followers",
  TwitchAvgViewers = "twitch_avg_viewers",
  YouTubeSubscribers = "youtube_subscribers",
  YouTubeMonthlyViews = "youtube_monthly_views",
}

/** Which platform each goal type reads its current value from. */
export const GOAL_PLATFORMS: Record<GoalType, MvpPlatform> = {
  [GoalType.TwitchFollowers]: "twitch",
  [GoalType.TwitchAvgViewers]: "twitch",
  [GoalType.YouTubeSubscribers]: "youtube",
  [GoalType.YouTubeMonthlyViews]: "youtube",
};

export const GOAL_LABELS: Record<GoalType, string> = {
  [GoalType.TwitchFollowers]: "Reach X Twitch followers",
  [GoalType.TwitchAvgViewers]: "Hit X avg viewers on Twitch",
  [GoalType.YouTubeSubscribers]: "Reach X YouTube subscribers",
  [GoalType.YouTubeMonthlyViews]: "Reach X monthly YouTube views",
};

export interface OnboardingData {
  creatorHandle: string;
  displayName: string;
  creatorType: CreatorType | null;
  twitchConnected: boolean;
  youtubeConnected: boolean;
  goalType: GoalType | null;
  goalTargetValue: number | null;
}

export interface Goal {
  id: string;
  type: GoalType;
  platform: Platform;
  targetValue: number;
  currentValue: number;
  completed: boolean;
  completedAt?: string;
  createdAt?: string;
  progressPct: number;
}
