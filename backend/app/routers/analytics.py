"""
analytics.py — Cross-platform analytics endpoints.

Every platform service exposes the same two methods (get_profile /
get_analytics), so this router is platform-agnostic: adding a provider
means adding a service, not a branch here.
"""
import asyncio
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.models import AnalyticsOverview, CompareResponse, DailyDataPoint, PlatformStats
from app.services.base import PlatformAuthError, TokenExpiredError
from app.services.platform_router import get_service_with_tokens, is_supported
from app.services.token_store import list_connected_platforms

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _engagement_rate(likes: int, comments: int, shares: int, views: int, followers: int) -> float:
    """
    Engagement as a percentage. Prefer views as the denominator (it measures
    reach of the content); fall back to followers for platforms that report no
    view counts. Returns 0.0 when neither is available.
    """
    engagement = likes + comments + shares
    denominator = views or followers
    if not denominator:
        return 0.0
    return round((engagement / denominator) * 100, 2)


async def _build_platform_stats(platform: str, user_id: str, days: int) -> PlatformStats:
    """
    Fetch one platform's stats. Never raises: a platform that is missing,
    expired, or erroring comes back flagged so one bad integration cannot
    take down the whole dashboard.
    """
    try:
        resolved = await get_service_with_tokens(platform, user_id)
    except PlatformAuthError as exc:
        return PlatformStats(
            platform=platform, connected=True, needs_reconnect=True, error=str(exc)
        )

    if resolved is None:
        return PlatformStats(platform=platform, connected=False)

    service, tokens = resolved

    try:
        profile = await service.get_profile(tokens)
        analytics = await service.get_analytics(tokens, days=days)
    except (PlatformAuthError, TokenExpiredError) as exc:
        return PlatformStats(
            platform=platform,
            connected=True,
            username=tokens.platform_username,
            needs_reconnect=True,
            error=str(exc),
        )
    except Exception as exc:  # noqa: BLE001 — one provider outage must not 500 the page
        return PlatformStats(
            platform=platform,
            connected=True,
            username=tokens.platform_username,
            error=f"{type(exc).__name__}: {exc}",
        )

    daily = [DailyDataPoint(**asdict(point)) for point in analytics.daily_data]
    followers = analytics.followers or int(profile.get("followers", 0) or 0)

    raw: Dict = dict(analytics.extra)
    raw.setdefault("profile", {k: v for k, v in profile.items() if k != "id"})

    return PlatformStats(
        platform=platform,
        connected=True,
        username=(
            profile.get("username")
            or profile.get("display_name")
            or tokens.platform_username
        ),
        followers=followers,
        views_30d=analytics.total_views,
        likes_30d=analytics.total_likes,
        comments_30d=analytics.total_comments,
        shares_30d=analytics.total_shares,
        engagement_rate=_engagement_rate(
            analytics.total_likes,
            analytics.total_comments,
            analytics.total_shares,
            analytics.total_views,
            followers,
        ),
        daily_data=daily,
        raw=raw,
    )


async def _gather_stats(user_id: str, days: int) -> List[PlatformStats]:
    """Fetch every connected platform concurrently."""
    connected = await list_connected_platforms(user_id)
    platforms = [record["platform"] for record in connected]
    if not platforms:
        return []
    return list(
        await asyncio.gather(
            *(_build_platform_stats(platform, user_id, days) for platform in platforms)
        )
    )


@router.get("/overview", response_model=AnalyticsOverview)
async def get_overview(
    days: int = Query(default=30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
):
    """Aggregate totals plus a per-platform breakdown for the last `days` days."""
    platform_stats = await _gather_stats(user_id, days)

    total_followers = sum(p.followers for p in platform_stats)
    total_views = sum(p.views_30d for p in platform_stats)
    total_likes = sum(p.likes_30d for p in platform_stats)
    total_comments = sum(p.comments_30d for p in platform_stats)
    total_shares = sum(p.shares_30d for p in platform_stats)

    return AnalyticsOverview(
        total_followers=total_followers,
        total_views=total_views,
        total_likes=total_likes,
        total_comments=total_comments,
        total_shares=total_shares,
        total_engagement=total_likes + total_comments + total_shares,
        engagement_rate=_engagement_rate(
            total_likes, total_comments, total_shares, total_views, total_followers
        ),
        platforms_connected=len(platform_stats),
        period_days=days,
        platforms=platform_stats,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/compare", response_model=CompareResponse)
async def compare_platforms(
    days: int = Query(default=30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
):
    """Side-by-side platform comparison with a leader per metric."""
    platform_stats = await _gather_stats(user_id, days)

    metric_leaders: Dict[str, str] = {}
    # Only rank platforms that actually returned numbers.
    ranked = [p for p in platform_stats if p.connected and not p.error]
    if ranked:
        metrics = {
            "followers": lambda p: p.followers,
            "views": lambda p: p.views_30d,
            "likes": lambda p: p.likes_30d,
            "comments": lambda p: p.comments_30d,
            "shares": lambda p: p.shares_30d,
            "engagement_rate": lambda p: p.engagement_rate,
        }
        for metric, key_fn in metrics.items():
            best = max(ranked, key=key_fn)
            if key_fn(best):
                metric_leaders[metric] = best.platform

    return CompareResponse(platforms=platform_stats, metric_leaders=metric_leaders)


@router.get("/{platform}", response_model=PlatformStats)
async def get_platform_analytics(
    platform: str,
    days: int = Query(default=30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
):
    """Stats for a single platform, including its daily series."""
    platform = platform.lower()
    if not is_supported(platform):
        raise HTTPException(status_code=404, detail=f"Platform '{platform}' is not supported")

    stats = await _build_platform_stats(platform, user_id, days)
    if not stats.connected:
        raise HTTPException(
            status_code=404,
            detail=f"Platform '{platform}' is not connected for this account",
        )
    return stats
