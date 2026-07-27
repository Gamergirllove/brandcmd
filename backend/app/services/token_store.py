"""
token_store.py — Encrypted persistence for OAuth tokens and in-flight OAuth state.

Access and refresh tokens are encrypted with Fernet before they touch the
database; everything else on the row (expiry, scope, platform handle) is
non-secret and stored in the clear so it can be queried and displayed.
"""
from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings
from app.db import get_supabase
from app.services.base import PlatformTokens

_TABLE = "platform_tokens"
_STATE_TABLE = "oauth_states"

# How long an in-flight authorisation stays valid.
OAUTH_STATE_TTL = timedelta(minutes=15)


# ---------------------------------------------------------------------------
# Encryption
# ---------------------------------------------------------------------------

def _get_fernet() -> Fernet:
    """
    Build the Fernet instance used for token encryption.

    Prefers TOKEN_ENCRYPTION_KEY. A proper 44-character Fernet key is used
    as-is; anything else (including the SECRET_KEY fallback) is stretched to
    one with SHA-256 so a short key never breaks startup.
    """
    settings = get_settings()
    raw_key = settings.token_encryption_key or settings.secret_key
    key_bytes = raw_key.encode() if isinstance(raw_key, str) else raw_key

    if len(key_bytes) == 44:
        try:
            return Fernet(key_bytes)
        except (ValueError, TypeError):
            pass  # Not a real Fernet key — fall through and derive one.

    digest = hashlib.sha256(key_bytes).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_token(value: Optional[str]) -> Optional[str]:
    """Encrypt a single token string. None passes through untouched."""
    if value is None:
        return None
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_token(value: Optional[str]) -> Optional[str]:
    """Decrypt a single token string. Returns None if it cannot be read."""
    if value is None:
        return None
    try:
        return _get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def _to_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _from_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        # Postgres renders timestamptz as e.g. 2026-07-26T10:00:00+00:00,
        # but also sometimes with a trailing Z.
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _row_to_tokens(row: Dict[str, Any]) -> Optional[PlatformTokens]:
    access_token = decrypt_token(row.get("access_token"))
    if not access_token:
        # Undecryptable row — treat as not connected rather than crashing.
        return None
    return PlatformTokens(
        access_token=access_token,
        refresh_token=decrypt_token(row.get("refresh_token")),
        expires_at=_from_iso(row.get("expires_at")),
        scope=row.get("scope"),
        platform_user_id=row.get("platform_user_id"),
        platform_username=row.get("platform_username"),
    )


# ---------------------------------------------------------------------------
# Token CRUD
# ---------------------------------------------------------------------------

async def store_tokens(user_id: str, platform: str, tokens: PlatformTokens) -> None:
    """Encrypt and upsert a token set for a user/platform pair."""
    supabase = get_supabase()
    record: Dict[str, Any] = {
        "user_id": user_id,
        "platform": platform,
        "access_token": encrypt_token(tokens.access_token),
        "refresh_token": encrypt_token(tokens.refresh_token),
        "expires_at": _to_iso(tokens.expires_at),
        "scope": tokens.scope,
        "platform_user_id": tokens.platform_user_id,
        "platform_username": tokens.platform_username,
        "updated_at": _to_iso(datetime.now(timezone.utc)),
    }
    # uq_user_platform makes this a single round trip.
    supabase.table(_TABLE).upsert(record, on_conflict="user_id,platform").execute()


async def retrieve_tokens(user_id: str, platform: str) -> Optional[PlatformTokens]:
    """Load and decrypt the token set for a user/platform pair."""
    supabase = get_supabase()
    result = (
        supabase.table(_TABLE)
        .select("access_token, refresh_token, expires_at, scope, platform_user_id, platform_username")
        .eq("user_id", user_id)
        .eq("platform", platform)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    return _row_to_tokens(rows[0])


async def delete_tokens(user_id: str, platform: str) -> bool:
    """Delete a stored token set. Returns True if a row was removed."""
    supabase = get_supabase()
    result = (
        supabase.table(_TABLE)
        .delete()
        .eq("user_id", user_id)
        .eq("platform", platform)
        .execute()
    )
    return bool(result.data)


async def list_connected_platforms(user_id: str) -> List[Dict[str, Any]]:
    """Connection records for a user — no token decryption involved."""
    supabase = get_supabase()
    result = (
        supabase.table(_TABLE)
        .select("platform, platform_username, expires_at, created_at, updated_at")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# OAuth state (CSRF token + PKCE verifier)
# ---------------------------------------------------------------------------

async def create_oauth_state(
    user_id: str,
    platform: str,
    code_verifier: Optional[str] = None,
    redirect_to: Optional[str] = None,
) -> str:
    """
    Persist a new CSRF state (plus PKCE verifier where the provider needs one)
    and return the opaque state value to send to the provider.
    """
    supabase = get_supabase()
    state = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    supabase.table(_STATE_TABLE).insert(
        {
            "state": state,
            "user_id": user_id,
            "platform": platform,
            "code_verifier": code_verifier,
            "redirect_to": redirect_to,
            "created_at": _to_iso(now),
            "expires_at": _to_iso(now + OAUTH_STATE_TTL),
        }
    ).execute()
    return state


async def consume_oauth_state(state: str, platform: str) -> Optional[Dict[str, Any]]:
    """
    Look up a state value, delete it, and return its row — but only if it
    matches the platform and has not expired. Single-use by construction:
    the row is gone whether or not it validated.
    """
    if not state:
        return None

    supabase = get_supabase()
    result = (
        supabase.table(_STATE_TABLE)
        .select("state, user_id, platform, code_verifier, redirect_to, expires_at")
        .eq("state", state)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None

    row = rows[0]
    supabase.table(_STATE_TABLE).delete().eq("state", state).execute()

    if row.get("platform") != platform:
        return None

    expires_at = _from_iso(row.get("expires_at"))
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None

    return row
