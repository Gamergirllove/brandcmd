"""
profile.py — Creator profile and onboarding state.

The profiles row is normally created by the handle_new_user trigger. GET
recreates it if it is somehow missing so a user can never be locked out of
their own dashboard by a failed trigger.
"""
import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_supabase
from app.dependencies import get_current_user
from app.models import NotificationPrefs, Profile, ProfileUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])

_TABLE = "profiles"
_FIELDS = (
    "id, username, display_name, avatar_url, creator_handle, "
    "creator_type, onboarding_complete, notification_prefs"
)


def _row_to_profile(row: Dict) -> Profile:
    prefs = row.get("notification_prefs") or {}
    return Profile(
        id=str(row["id"]),
        username=row.get("username"),
        display_name=row.get("display_name"),
        avatar_url=row.get("avatar_url"),
        creator_handle=row.get("creator_handle"),
        creator_type=row.get("creator_type"),
        onboarding_complete=bool(row.get("onboarding_complete", False)),
        notification_prefs=NotificationPrefs(**prefs) if isinstance(prefs, dict) else NotificationPrefs(),
    )


@router.get("", response_model=Profile)
async def get_profile(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table(_TABLE).select(_FIELDS).eq("id", user_id).limit(1).execute()
    rows = result.data or []

    if not rows:
        logger.info("No profiles row for %s — creating one", user_id)
        created = supabase.table(_TABLE).insert({"id": user_id}).execute()
        rows = created.data or []
        if not rows:
            raise HTTPException(status_code=500, detail="Could not load or create profile")

    return _row_to_profile(rows[0])


@router.delete("", status_code=204)
async def delete_account(user_id: str = Depends(get_current_user)):
    """
    Delete the caller's account and everything attached to it.

    Tokens are removed explicitly (rather than relying on the cascade) so
    that a failure deleting the auth user still leaves no usable platform
    credentials behind. goals, analytics_cache and api_usage_log cascade
    from profiles, which in turn cascades from auth.users.
    """
    supabase = get_supabase()

    supabase.table("platform_tokens").delete().eq("user_id", user_id).execute()

    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to delete auth user %s", user_id)
        raise HTTPException(
            status_code=500,
            detail="Could not delete the account. Your platform connections were removed; "
            "please contact support to finish deletion.",
        ) from exc

    return None


@router.patch("", response_model=Profile)
async def update_profile(body: ProfileUpdate, user_id: str = Depends(get_current_user)):
    patch: Dict = {}
    if body.display_name is not None:
        patch["display_name"] = body.display_name
    if body.creator_handle is not None:
        patch["creator_handle"] = body.creator_handle
    if body.creator_type is not None:
        patch["creator_type"] = body.creator_type
    if body.onboarding_complete is not None:
        patch["onboarding_complete"] = body.onboarding_complete
    if body.notification_prefs is not None:
        patch["notification_prefs"] = body.notification_prefs.model_dump()

    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")

    supabase = get_supabase()
    result = supabase.table(_TABLE).update(patch).eq("id", user_id).execute()
    rows = result.data or []
    if not rows:
        # Row missing entirely — create it with the patch applied.
        created = supabase.table(_TABLE).insert({"id": user_id, **patch}).execute()
        rows = created.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Profile not found")

    return _row_to_profile(rows[0])
