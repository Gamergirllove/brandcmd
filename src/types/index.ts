// MVP platforms (active). Others kept as future type values.
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

export interface PlatformMetrics {
  platform: Platform;
  followers: number;
  followersChange: number;
  views: number;
  viewsChange: number;
  likes: number;
  likesChange: number;
  comments: number;
  commentsChange: number;
  shares: number;
  sharesChange: number;
  engagementRate: number;
  connected: boolean;
  connectedAt?: string;
  username?: string;
}

export interface DailyDataPoint {
  date: string;
  views: number;
  likes: number;
  followers: number;
  comments: number;
  shares: number;
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
    engagementRate: number;
    connectedPlatforms: number;
  };
  platforms: PlatformMetrics[];
  timeSeries: PlatformTimeSeries[];
  lastUpdated: string;
}

export interface ConnectedPlatform {
  platform: Platform;
  connected: boolean;
  username?: string;
  connectedAt?: string;
  accessTokenExpiry?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
  connectedPlatforms: ConnectedPlatform[];
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export type MetricKey = "followers" | "views" | "likes" | "comments" | "shares";

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

// Onboarding types
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
  user_id: string;
  type: GoalType;
  target_value: number;
  current_value: number;
  platform: MvpPlatform;
  completed: boolean;
  created_at: string;
}
