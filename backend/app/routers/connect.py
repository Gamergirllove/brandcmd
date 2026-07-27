"""
connect.py — OAuth connect / disconnect for every supported platform.

The authorization URL and the code exchange are both delegated to the
platform's service class, so provider quirks (PKCE, TikTok's `client_key`,
Basic-auth token endpoints) live with that provider rather than in a
shared request body that fits none of them.
"""
import logging
import urllib.parse
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.dependencies import get_current_user
from app.models import (
    ConnectStatusResponse,
    DisconnectResponse,
    OAuthURLResponse,
    PlatformStatus,
)
from app.services.base import PlatformAuthError
from app.services.pkce import generate_code_verifier
from app.services.platform_factory import list_supported_platforms
from app.services.platform_router import build_service, callback_url, is_configured, is_supported
from app.services.token_store import (
    consume_oauth_state,
    create_oauth_state,
    delete_tokens,
    list_connected_platforms,
    store_tokens,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/connect", tags=["connect"])


DEFAULT_RETURN_PATH = "/connect"


def _safe_return_path(path: Optional[str]) -> str:
    """
    Constrain the post-connect return path to a relative URL on our own
    frontend. Anything else — an absolute URL, a protocol-relative one —
    would turn this endpoint into an open redirect.
    """
    if not path or not path.startswith("/") or path.startswith("//"):
        return DEFAULT_RETURN_PATH
    return path


def _frontend_redirect(return_path: str = DEFAULT_RETURN_PATH, **params: str) -> RedirectResponse:
    """Bounce the browser back to the frontend with the result of the attempt."""
    settings = get_settings()
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v})
    separator = "&" if "?" in return_path else "?"
    return RedirectResponse(
        url=f"{settings.frontend_url.rstrip('/')}{return_path}{separator}{query}",
        status_code=302,
    )


@router.get("/status", response_model=ConnectStatusResponse)
async def get_connect_status(user_id: str = Depends(get_current_user)):
    """Connection state for every supported platform, connected or not."""
    connected_records = await list_connected_platforms(user_id)
    connected_map = {r["platform"]: r for r in connected_records}

    platforms = []
    for platform in list_supported_platforms():
        record = connected_map.get(platform)
        platforms.append(
            PlatformStatus(
                platform=platform,
                connected=record is not None,
                configured=is_configured(platform),
                username=record.get("platform_username") if record else None,
                connected_at=record.get("created_at") if record else None,
                expires_at=record.get("expires_at") if record else None,
            )
        )
    return ConnectStatusResponse(platforms=platforms)


@router.get("/{platform}/url", response_model=OAuthURLResponse)
async def get_oauth_url(
    platform: str,
    return_path: Optional[str] = Query(
        default=None,
        description="Frontend path to return to after the connection completes, e.g. /onboarding",
    ),
    user_id: str = Depends(get_current_user),
):
    """Start an authorization: mint a state (and PKCE verifier) and hand back the provider URL."""
    platform = platform.lower()
    if not is_supported(platform):
        raise HTTPException(status_code=404, detail=f"Platform '{platform}' is not supported")

    service = build_service(platform)
    if service is None:
        raise HTTPException(
            status_code=503,
            detail=f"{platform} OAuth is not configured on this deployment",
        )

    code_verifier = generate_code_verifier() if service.requires_pkce else None
    state = await create_oauth_state(
        user_id,
        platform,
        code_verifier=code_verifier,
        redirect_to=_safe_return_path(return_path),
    )

    if service.requires_pkce:
        url = await service.get_auth_url(state, code_verifier=code_verifier)
    else:
        url = await service.get_auth_url(state)

    return OAuthURLResponse(url=url, platform=platform)


@router.get("/{platform}/callback")
async def oauth_callback(
    platform: str,
    code: Optional[str] = Query(default=None),
    state: str = Query(default=""),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
):
    """
    Provider callback. Always redirects back to the frontend — a raw JSON
    error here would strand the user on an API URL.
    """
    platform = platform.lower()

    if error:
        return _frontend_redirect(platform=platform, error=error_description or error)

    if not is_supported(platform):
        return _frontend_redirect(platform=platform, error="Unsupported platform")

    if not code:
        return _frontend_redirect(platform=platform, error="No authorization code returned")

    # Validates CSRF state, platform match, and expiry — and burns it.
    state_row = await consume_oauth_state(state, platform)
    if state_row is None:
        return _frontend_redirect(
            platform=platform,
            error="This connection link expired or was already used. Please try again.",
        )

    user_id = state_row["user_id"]
    return_path = _safe_return_path(state_row.get("redirect_to"))

    service = build_service(platform)
    if service is None:
        return _frontend_redirect(
            return_path, platform=platform, error=f"{platform} OAuth is not configured"
        )

    redirect_uri = callback_url(platform)

    try:
        if service.requires_pkce:
            tokens = await service.exchange_code(
                code, redirect_uri, code_verifier=state_row.get("code_verifier")
            )
        else:
            tokens = await service.exchange_code(code, redirect_uri)
    except PlatformAuthError as exc:
        logger.warning("OAuth exchange failed for %s: %s", platform, exc)
        return _frontend_redirect(return_path, platform=platform, error=str(exc))
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected OAuth exchange failure for %s", platform)
        return _frontend_redirect(
            return_path, platform=platform, error=f"Could not complete {platform} connection"
        )

    # Fill in the handle we display in the UI. Non-fatal: a profile call that
    # fails should not throw away a token we just successfully obtained.
    try:
        profile = await service.get_profile(tokens)
        tokens.platform_user_id = tokens.platform_user_id or profile.get("id")
        tokens.platform_username = tokens.platform_username or (
            profile.get("username") or profile.get("display_name")
        )
    except Exception:  # noqa: BLE001
        logger.warning("Could not read %s profile during connect", platform, exc_info=True)

    await store_tokens(user_id, platform, tokens)
    return _frontend_redirect(return_path, connected=platform)


@router.delete("/{platform}", response_model=DisconnectResponse)
async def disconnect_platform(platform: str, user_id: str = Depends(get_current_user)):
    platform = platform.lower()
    if not is_supported(platform):
        raise HTTPException(status_code=404, detail=f"Platform '{platform}' is not supported")

    deleted = await delete_tokens(user_id, platform)
    return DisconnectResponse(
        success=True,
        platform=platform,
        message=f"{'Disconnected' if deleted else 'Was not connected'} from {platform}",
    )
