"""
Tests for platform_router — credential resolution, callback URLs, and the
refresh-on-expiry path that keeps stored tokens usable.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.base import PlatformAuthError, PlatformTokens
from app.services.platform_router import (
    build_service,
    callback_url,
    get_service_with_tokens,
    is_configured,
    is_supported,
)
from app.services.token_store import retrieve_tokens, store_tokens
from app.services.twitch import TwitchService
from tests.conftest import TEST_USER_ID


def test_callback_url_points_at_backend():
    assert callback_url("twitch") == "https://api.test.local/connect/twitch/callback"


def test_is_supported():
    assert is_supported("twitch")
    assert is_supported("YouTube")
    assert not is_supported("myspace")


def test_is_configured_reflects_credentials():
    # conftest sets Twitch and Google credentials, not Snapchat.
    assert is_configured("twitch") is True
    assert is_configured("youtube") is True
    assert is_configured("snapchat") is False
    assert is_configured("myspace") is False


def test_build_service_returns_typed_service():
    service = build_service("twitch")

    assert isinstance(service, TwitchService)
    assert service.client_id == "twitch-client-id"
    assert service.redirect_uri == "https://api.test.local/connect/twitch/callback"


def test_build_service_returns_none_without_credentials():
    assert build_service("snapchat") is None
    assert build_service("myspace") is None


def _tokens(expires_at, refresh_token="refresh-original") -> PlatformTokens:
    return PlatformTokens(
        access_token="access-original",
        refresh_token=refresh_token,
        expires_at=expires_at,
        scope="user:read:email",
        platform_user_id="12345",
        platform_username="devcreator",
    )


@pytest.mark.asyncio
async def test_returns_none_when_not_connected(fake_supabase):
    assert await get_service_with_tokens("twitch", TEST_USER_ID) is None


@pytest.mark.asyncio
async def test_valid_token_is_used_as_is(fake_supabase, monkeypatch):
    await store_tokens(
        TEST_USER_ID, "twitch", _tokens(datetime.now(timezone.utc) + timedelta(hours=2))
    )

    async def fail_refresh(self, refresh_token):
        raise AssertionError("refresh must not be called for a valid token")

    monkeypatch.setattr(TwitchService, "refresh_token", fail_refresh)

    service, tokens = await get_service_with_tokens("twitch", TEST_USER_ID)

    assert tokens.access_token == "access-original"
    assert isinstance(service, TwitchService)


@pytest.mark.asyncio
async def test_expired_token_is_refreshed_and_persisted(fake_supabase, monkeypatch):
    await store_tokens(
        TEST_USER_ID, "twitch", _tokens(datetime.now(timezone.utc) - timedelta(minutes=5))
    )

    async def fake_refresh(self, refresh_token):
        assert refresh_token == "refresh-original"
        return PlatformTokens(
            access_token="access-refreshed",
            refresh_token="refresh-rotated",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=4),
            scope=None,
            platform_user_id=None,
            platform_username=None,
        )

    monkeypatch.setattr(TwitchService, "refresh_token", fake_refresh)

    _, tokens = await get_service_with_tokens("twitch", TEST_USER_ID)

    assert tokens.access_token == "access-refreshed"
    assert tokens.refresh_token == "refresh-rotated"
    # Identity fields the provider omitted are carried forward.
    assert tokens.platform_username == "devcreator"
    assert tokens.platform_user_id == "12345"
    assert tokens.scope == "user:read:email"

    # And the refreshed set replaced the stored one.
    stored = await retrieve_tokens(TEST_USER_ID, "twitch")
    assert stored.access_token == "access-refreshed"


@pytest.mark.asyncio
async def test_token_expiring_within_skew_is_refreshed(fake_supabase, monkeypatch):
    """A token with seconds left would expire mid-request; refresh it early."""
    await store_tokens(
        TEST_USER_ID, "twitch", _tokens(datetime.now(timezone.utc) + timedelta(seconds=10))
    )
    called = []

    async def fake_refresh(self, refresh_token):
        called.append(refresh_token)
        return PlatformTokens(
            access_token="access-refreshed",
            refresh_token=refresh_token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=4),
            scope=None,
            platform_user_id=None,
            platform_username=None,
        )

    monkeypatch.setattr(TwitchService, "refresh_token", fake_refresh)

    await get_service_with_tokens("twitch", TEST_USER_ID)

    assert called == ["refresh-original"]


@pytest.mark.asyncio
async def test_expired_without_refresh_token_raises(fake_supabase):
    await store_tokens(
        TEST_USER_ID,
        "twitch",
        _tokens(datetime.now(timezone.utc) - timedelta(minutes=5), refresh_token=None),
    )

    with pytest.raises(PlatformAuthError, match="Reconnect"):
        await get_service_with_tokens("twitch", TEST_USER_ID)


@pytest.mark.asyncio
async def test_token_without_expiry_is_never_refreshed(fake_supabase, monkeypatch):
    """Long-lived tokens (e.g. Instagram) report no expiry — don't churn them."""
    await store_tokens(TEST_USER_ID, "twitch", _tokens(None))

    async def fail_refresh(self, refresh_token):
        raise AssertionError("refresh must not be called when no expiry is known")

    monkeypatch.setattr(TwitchService, "refresh_token", fail_refresh)

    _, tokens = await get_service_with_tokens("twitch", TEST_USER_ID)

    assert tokens.access_token == "access-original"
