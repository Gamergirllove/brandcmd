from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class DailyDataPoint(BaseModel):
    date: str  # ISO date string e.g. "2024-05-01"
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    impressions: int = 0
    followers_gained: int = 0


class PlatformStats(BaseModel):
    platform: str
    connected: bool = False
    username: Optional[str] = None
    followers: int = 0
    views_30d: int = 0
    likes_30d: int = 0
    comments_30d: int = 0
    shares_30d: int = 0
    engagement_rate: float = 0.0  # percentage
    daily_data: List[DailyDataPoint] = Field(default_factory=list)
    raw: Optional[Dict[str, Any]] = None  # platform-specific extra fields
    # Set when the stored credentials can no longer be used — the UI should
    # prompt a reconnect rather than showing this platform as healthy.
    needs_reconnect: bool = False
    # Populated when a fetch failed; the platform stays connected but its
    # numbers are unavailable this request.
    error: Optional[str] = None


class AnalyticsOverview(BaseModel):
    total_followers: int = 0
    total_views: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    total_engagement: int = 0
    engagement_rate: float = 0.0
    platforms_connected: int = 0
    period_days: int = 30
    platforms: List[PlatformStats] = Field(default_factory=list)
    last_updated: str


class CompareResponse(BaseModel):
    platforms: List[PlatformStats] = Field(default_factory=list)
    metric_leaders: Dict[str, str] = Field(default_factory=dict)  # metric -> platform name


# ---------------------------------------------------------------------------
# Platform connections
# ---------------------------------------------------------------------------

class PlatformStatus(BaseModel):
    platform: str
    connected: bool
    configured: bool = False  # deployment has OAuth credentials for it
    username: Optional[str] = None
    connected_at: Optional[str] = None
    expires_at: Optional[str] = None


class ConnectStatusResponse(BaseModel):
    platforms: List[PlatformStatus]


class OAuthURLResponse(BaseModel):
    url: str
    platform: str


class DisconnectResponse(BaseModel):
    success: bool
    platform: str
    message: str


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    type: str
    platform: str
    target_value: int = Field(..., gt=0)


class GoalUpdate(BaseModel):
    target_value: Optional[int] = Field(default=None, gt=0)
    completed: Optional[bool] = None


class Goal(BaseModel):
    id: str
    type: str
    platform: str
    target_value: int
    current_value: int = 0
    completed: bool = False
    completed_at: Optional[str] = None
    created_at: Optional[str] = None
    # Convenience for the UI so it doesn't recompute the same ratio everywhere.
    progress_pct: float = 0.0


class GoalListResponse(BaseModel):
    goals: List[Goal] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

class NotificationPrefs(BaseModel):
    weekly_report: bool = True
    goal_complete: bool = True
    milestone: bool = False


class Profile(BaseModel):
    id: str
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    creator_handle: Optional[str] = None
    creator_type: Optional[str] = None
    onboarding_complete: bool = False
    notification_prefs: NotificationPrefs = Field(default_factory=NotificationPrefs)


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    creator_handle: Optional[str] = None
    creator_type: Optional[str] = None
    onboarding_complete: Optional[bool] = None
    notification_prefs: Optional[NotificationPrefs] = None
