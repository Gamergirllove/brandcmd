"""Tests for token encryption, persistence and OAuth state handling."""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.base import PlatformTokens
from app.services.token_store import (
    consume_oauth_state,
    create_oauth_state,
    decrypt_token,
    delete_tokens,
    encrypt_token,
    list_connected_platforms,
    retrieve_tokens,
    store_tokens,
)
from tests.conftest import TEST_USER_ID


def _tokens(**overrides) -> PlatformTokens:
    base = dict(
        access_token="access-abc",
        refresh_token="refresh-xyz",
        expires_at=datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc),
        scope="user:read:email",
        platform_user_id="12345",
        platform_username="devcreator",
    )
    base.update(overrides)
    return PlatformTokens(**base)


def test_encrypt_decrypt_roundtrip():
    encrypted = encrypt_token("super-secret-token")

    assert encrypted != "super-secret-token"
    assert decrypt_token(encrypted) == "super-secret-token"


def test_decrypt_returns_none_for_garbage():
    assert decrypt_token("not-a-fernet-token") is None


def test_encrypt_passes_through_none():
    assert encrypt_token(None) is None
    assert decrypt_token(None) is None


@pytest.mark.asyncio
async def test_store_then_retrieve_roundtrip(fake_supabase):
    await store_tokens(TEST_USER_ID, "twitch", _tokens())

    loaded = await retrieve_tokens(TEST_USER_ID, "twitch")

    assert loaded is not None
    assert loaded.access_token == "access-abc"
    assert loaded.refresh_token == "refresh-xyz"
    assert loaded.platform_username == "devcreator"
    assert loaded.expires_at == datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_tokens_are_encrypted_at_rest(fake_supabase):
    await store_tokens(TEST_USER_ID, "twitch", _tokens())

    row = fake_supabase.tables["platform_tokens"][0]
    assert row["access_token"] != "access-abc"
    assert row["refresh_token"] != "refresh-xyz"
    # Non-secret fields stay queryable in the clear.
    assert row["platform_username"] == "devcreator"
    assert row["scope"] == "user:read:email"


@pytest.mark.asyncio
async def test_store_tokens_upserts_rather_than_duplicating(fake_supabase):
    await store_tokens(TEST_USER_ID, "twitch", _tokens())
    await store_tokens(TEST_USER_ID, "twitch", _tokens(access_token="second-token"))

    assert len(fake_supabase.tables["platform_tokens"]) == 1
    loaded = await retrieve_tokens(TEST_USER_ID, "twitch")
    assert loaded.access_token == "second-token"


@pytest.mark.asyncio
async def test_retrieve_returns_none_when_not_connected(fake_supabase):
    assert await retrieve_tokens(TEST_USER_ID, "youtube") is None


@pytest.mark.asyncio
async def test_undecryptable_row_reads_as_not_connected(fake_supabase):
    """A key rotation shouldn't 500 the dashboard — it should read as disconnected."""
    fake_supabase.tables["platform_tokens"] = [
        {
            "user_id": TEST_USER_ID,
            "platform": "twitch",
            "access_token": "written-with-a-different-key",
            "refresh_token": None,
        }
    ]

    assert await retrieve_tokens(TEST_USER_ID, "twitch") is None


@pytest.mark.asyncio
async def test_delete_and_list(fake_supabase):
    await store_tokens(TEST_USER_ID, "twitch", _tokens())
    await store_tokens(TEST_USER_ID, "youtube", _tokens(platform_username="devtube"))

    listed = await list_connected_platforms(TEST_USER_ID)
    assert {r["platform"] for r in listed} == {"twitch", "youtube"}

    assert await delete_tokens(TEST_USER_ID, "twitch") is True
    assert await delete_tokens(TEST_USER_ID, "twitch") is False

    listed = await list_connected_platforms(TEST_USER_ID)
    assert {r["platform"] for r in listed} == {"youtube"}


# ---------------------------------------------------------------------------
# OAuth state
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_oauth_state_roundtrip(fake_supabase):
    state = await create_oauth_state(
        TEST_USER_ID, "twitter", code_verifier="verifier-123", redirect_to="/onboarding"
    )

    row = await consume_oauth_state(state, "twitter")

    assert row is not None
    assert row["user_id"] == TEST_USER_ID
    assert row["code_verifier"] == "verifier-123"
    assert row["redirect_to"] == "/onboarding"


@pytest.mark.asyncio
async def test_oauth_state_is_single_use(fake_supabase):
    state = await create_oauth_state(TEST_USER_ID, "twitch")

    assert await consume_oauth_state(state, "twitch") is not None
    assert await consume_oauth_state(state, "twitch") is None


@pytest.mark.asyncio
async def test_oauth_state_rejects_platform_mismatch(fake_supabase):
    """A state minted for one provider must not authorise another."""
    state = await create_oauth_state(TEST_USER_ID, "twitch")

    assert await consume_oauth_state(state, "youtube") is None
    # Still burned, so it cannot be replayed at the correct platform either.
    assert await consume_oauth_state(state, "twitch") is None


@pytest.mark.asyncio
async def test_oauth_state_rejects_expired(fake_supabase):
    state = await create_oauth_state(TEST_USER_ID, "twitch")
    expired = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    fake_supabase.tables["oauth_states"][0]["expires_at"] = expired

    assert await consume_oauth_state(state, "twitch") is None


@pytest.mark.asyncio
async def test_oauth_state_rejects_unknown(fake_supabase):
    assert await consume_oauth_state("never-issued", "twitch") is None
    assert await consume_oauth_state("", "twitch") is None
