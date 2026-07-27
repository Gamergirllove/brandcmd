"""
goals.py — Creator goals.

Goals store a target; the current value is derived from live platform
analytics on read, so a goal cannot drift out of sync with the numbers
shown elsewhere on the dashboard.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_supabase
from app.dependencies import get_current_user
from app.models import Goal, GoalCreate, GoalListResponse, GoalUpdate
from app.routers.analytics import _build_platform_stats
from app.services.platform_router import is_supported

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/goals", tags=["goals"])

_TABLE = "goals"

# Goal type → (platform, how to read the current value out of PlatformStats).
#
# Twitch publishes no average-concurrent-viewers figure on Helix, so
# twitch_avg_viewers approximates it with average views per archived
# broadcast. It tracks the same trend; it is not the number shown in
# Twitch's own creator dashboard.
_GOAL_METRICS = {
    "twitch_followers": ("twitch", lambda s: s.followers),
    "twitch_avg_viewers": ("twitch", lambda s: int((s.raw or {}).get("avg_views_per_broadcast", 0))),
    "youtube_subscribers": ("youtube", lambda s: s.followers),
    "youtube_monthly_views": ("youtube", lambda s: s.views_30d),
}


def _progress_pct(current: int, target: int) -> float:
    if target <= 0:
        return 0.0
    return round(min(current / target, 1.0) * 100, 1)


def _row_to_goal(row: Dict) -> Goal:
    target = int(row.get("target_value", 0) or 0)
    current = int(row.get("current_value", 0) or 0)
    return Goal(
        id=str(row["id"]),
        type=row.get("type", ""),
        platform=row.get("platform", ""),
        target_value=target,
        current_value=current,
        completed=bool(row.get("completed", False)),
        completed_at=row.get("completed_at"),
        created_at=row.get("created_at"),
        progress_pct=_progress_pct(current, target),
    )


async def _refresh_goal_values(user_id: str, rows: list[Dict]) -> list[Dict]:
    """
    Recompute current_value for each goal from live analytics, persisting any
    change. Platforms are fetched once each, not once per goal. If a platform
    fetch fails the stored value is kept — a transient API error should not
    reset someone's progress to zero.
    """
    needed = {
        _GOAL_METRICS[row["type"]][0]
        for row in rows
        if row.get("type") in _GOAL_METRICS
    }
    if not needed:
        return rows

    stats_by_platform = {}
    for platform in needed:
        try:
            stats_by_platform[platform] = await _build_platform_stats(platform, user_id, days=30)
        except Exception:  # noqa: BLE001
            logger.warning("Could not refresh goal metrics for %s", platform, exc_info=True)

    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    for row in rows:
        metric = _GOAL_METRICS.get(row.get("type", ""))
        if not metric:
            continue
        platform, extract = metric
        stats = stats_by_platform.get(platform)
        if stats is None or not stats.connected or stats.error:
            continue

        current = int(extract(stats) or 0)
        if current == int(row.get("current_value", 0) or 0):
            continue

        completed = current >= int(row.get("target_value", 0) or 0)
        patch: Dict = {"current_value": current}
        if completed and not row.get("completed"):
            patch["completed"] = True
            patch["completed_at"] = now
        elif not completed and row.get("completed"):
            # Target was raised, or the metric fell back below it.
            patch["completed"] = False
            patch["completed_at"] = None

        supabase.table(_TABLE).update(patch).eq("id", row["id"]).execute()
        row.update(patch)

    return rows


@router.get("", response_model=GoalListResponse)
async def list_goals(user_id: str = Depends(get_current_user)):
    """All goals for the current user, with current values refreshed."""
    supabase = get_supabase()
    result = (
        supabase.table(_TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []
    rows = await _refresh_goal_values(user_id, rows)
    return GoalListResponse(goals=[_row_to_goal(row) for row in rows])


@router.post("", response_model=Goal, status_code=201)
async def create_goal(body: GoalCreate, user_id: str = Depends(get_current_user)):
    platform = body.platform.lower()
    if not is_supported(platform):
        raise HTTPException(status_code=400, detail=f"Platform '{platform}' is not supported")
    if body.type not in _GOAL_METRICS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown goal type '{body.type}'. Supported: {', '.join(sorted(_GOAL_METRICS))}",
        )

    supabase = get_supabase()
    result = (
        supabase.table(_TABLE)
        .insert(
            {
                "user_id": user_id,
                "type": body.type,
                "platform": platform,
                "target_value": body.target_value,
                "current_value": 0,
                "completed": False,
            }
        )
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not create goal")

    rows = await _refresh_goal_values(user_id, rows)
    return _row_to_goal(rows[0])


@router.patch("/{goal_id}", response_model=Goal)
async def update_goal(goal_id: str, body: GoalUpdate, user_id: str = Depends(get_current_user)):
    patch: Dict = {}
    if body.target_value is not None:
        patch["target_value"] = body.target_value
    if body.completed is not None:
        patch["completed"] = body.completed
        patch["completed_at"] = (
            datetime.now(timezone.utc).isoformat() if body.completed else None
        )
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")

    supabase = get_supabase()
    result = (
        supabase.table(_TABLE)
        .update(patch)
        .eq("id", goal_id)
        .eq("user_id", user_id)  # scope to owner: an id alone must not be enough
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Goal not found")
    return _row_to_goal(rows[0])


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(goal_id: str, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table(_TABLE)
        .delete()
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not (result.data or []):
        raise HTTPException(status_code=404, detail="Goal not found")
    return None
