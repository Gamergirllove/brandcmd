"""
platform_router.py — Adapter between HTTP routers and platform service classes.

Owns three things the routers should not have to know about:
  * which Settings fields hold a platform's credentials,
  * the OAuth callback URL (it must be byte-identical at authorize and
    exchange time or providers reject the exchange),
  * refreshing an access token that expired since it was stored.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from app.config import get_settings
from app.services.base import BasePlatformService, PlatformAuthError, PlatformTokens
from app.services.platform_factory import get_platform_service, list_supported_platforms
from app.services.token_store import retrieve_tokens, store_tokens

SUPPORTED_PLATFORMS = set(list_supported_platforms())

# Refresh a little before the token actually expires so a slow request
# doesn't start valid and finish rejected.
_REFRESH_SKEW = timedelta(seconds=60)

# Map platform → (client_id_attr, client_secret_attr) on Settings
_CREDS_MAP = {
    "twitch":    ("twitch_client_id",    "twitch_client_secret"),
    "youtube":   ("youtube_client_id",   "youtube_client_secret"),
    "instagram": ("instagram_client_id", "instagram_client_secret"),
    "tiktok":    ("tiktok_client_key",   "tiktok_client_secret"),
    "twitter":   ("twitter_client_id",   "twitter_client_secret"),
    "pinterest": ("pinterest_client_id", "pinterest_client_secret"),
    "linkedin":  ("linkedin_client_id",  "linkedin_client_secret"),
    "facebook":  ("facebook_client_id",  "facebook_client_secret"),
    "snapchat":  ("snapchat_client_id",  "snapchat_client_secret"),
}


def callback_url(platform: str) -> str:
    """
    The OAuth redirect URI for a platform.

    Points at the backend, not the frontend: the provider posts the code
    here, we exchange it, then bounce the browser to the frontend. This
    exact string must also be registered in each provider's console.
    """
    settings = get_settings()
    return f"{settings.backend_url.rstrip('/')}/connect/{platform}/callback"


def is_supported(platform: str) -> bool:
    return platform.lower() in SUPPORTED_PLATFORMS


def is_configured(platform: str) -> bool:
    """True when this deployment has credentials for the platform."""
    creds = _CREDS_MAP.get(platform.lower())
    if not creds:
        return False
    return bool(getattr(get_settings(), creds[0], ""))


def build_service(platform: str) -> Optional[BasePlatformService]:
    """
    Construct a credentialed service with no user tokens attached.
    Returns None when the platform is unknown or unconfigured.
    """
    platform = platform.lower()
    creds = _CREDS_MAP.get(platform)
    if not creds:
        return None

    settings = get_settings()
    client_id = getattr(settings, creds[0], "")
    client_secret = getattr(settings, creds[1], "")
    if not client_id:
        return None

    return get_platform_service(platform, client_id, client_secret, callback_url(platform))


def _is_expired(tokens: PlatformTokens) -> bool:
    if not tokens.expires_at:
        return False
    expires_at = tokens.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at - _REFRESH_SKEW <= datetime.now(timezone.utc)


async def get_service_with_tokens(
    platform: str, user_id: str
) -> Optional[Tuple[BasePlatformService, PlatformTokens]]:
    """
    Return a service plus the user's current tokens, refreshing first if the
    access token has expired. Returns None when the platform is unsupported,
    unconfigured, or not connected by this user.

    Raises PlatformAuthError if a refresh was required but failed — the caller
    should surface that as "reconnect this platform" rather than as zeroed data.
    """
    platform = platform.lower()
    service = build_service(platform)
    if service is None:
        return None

    tokens = await retrieve_tokens(user_id, platform)
    if tokens is None:
        return None

    if _is_expired(tokens):
        if not tokens.refresh_token:
            raise PlatformAuthError(
                f"{platform} access token expired and no refresh token is stored. "
                "Reconnect the account."
            )
        refreshed = await service.refresh_token(tokens.refresh_token)
        # Providers vary on what they re-send; carry forward what we already know.
        refreshed.refresh_token = refreshed.refresh_token or tokens.refresh_token
        refreshed.platform_user_id = refreshed.platform_user_id or tokens.platform_user_id
        refreshed.platform_username = refreshed.platform_username or tokens.platform_username
        refreshed.scope = refreshed.scope or tokens.scope
        await store_tokens(user_id, platform, refreshed)
        tokens = refreshed

    return service, tokens


async def get_service(platform: str, user_id: str) -> Optional[BasePlatformService]:
    """
    Backwards-compatible accessor: the service alone, with the (possibly
    refreshed) tokens attached as ``service.tokens``.
    """
    result = await get_service_with_tokens(platform, user_id)
    if result is None:
        return None
    service, tokens = result
    service.tokens = tokens  # type: ignore[attr-defined]
    return service
