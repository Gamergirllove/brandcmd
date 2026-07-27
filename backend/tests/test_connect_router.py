"""
Tests for the OAuth connect flow.

The security-relevant behaviour here is state handling: a callback must
only be honoured for a state this server issued, for the platform it was
issued for, once, and it must never redirect off-site.
"""
from urllib.parse import parse_qs, urlparse

import pytest

from app.services.base import PlatformAuthError, PlatformTokens
from app.services.token_store import create_oauth_state
from tests.conftest import TEST_USER_ID


class StubService:
    requires_pkce = False

    def __init__(self, raises=None):
        self.raises = raises
        self.exchange_calls = []

    async def get_auth_url(self, state, code_verifier=None):
        return f"https://provider.test/authorize?state={state}"

    async def exchange_code(self, code, redirect_uri, code_verifier=None):
        self.exchange_calls.append((code, redirect_uri, code_verifier))
        if self.raises:
            raise self.raises
        return PlatformTokens(
            access_token="new-access",
            refresh_token="new-refresh",
            expires_at=None,
            scope="scope",
            platform_user_id=None,
            platform_username=None,
        )

    async def get_profile(self, tokens):
        return {"id": "12345", "username": "devcreator"}


class PkceStubService(StubService):
    requires_pkce = True


@pytest.fixture
def stub_build(monkeypatch):
    """Replace build_service with one returning a configurable stub."""
    from app.routers import connect as connect_router

    holder = {"service": StubService()}
    monkeypatch.setattr(connect_router, "build_service", lambda platform: holder["service"])
    return holder


def _redirect_params(response):
    parsed = urlparse(response.headers["location"])
    return parsed, parse_qs(parsed.query)


def test_connect_status_lists_every_supported_platform(client):
    body = client.get("/connect/status").json()

    platforms = {p["platform"] for p in body["platforms"]}
    assert {"twitch", "youtube", "instagram", "tiktok", "twitter"} <= platforms
    assert all(p["connected"] is False for p in body["platforms"])

    # Credentials are set for these in conftest; the rest report unconfigured.
    by_name = {p["platform"]: p for p in body["platforms"]}
    assert by_name["twitch"]["configured"] is True
    assert by_name["youtube"]["configured"] is True
    assert by_name["snapchat"]["configured"] is False


def test_oauth_url_persists_state(client, fake_supabase, stub_build):
    body = client.get("/connect/twitch/url").json()

    assert body["platform"] == "twitch"
    states = fake_supabase.tables["oauth_states"]
    assert len(states) == 1
    assert states[0]["user_id"] == TEST_USER_ID
    assert states[0]["state"] in body["url"]
    # Non-PKCE provider stores no verifier.
    assert states[0]["code_verifier"] is None


def test_oauth_url_generates_pkce_verifier_for_pkce_providers(
    client, fake_supabase, stub_build
):
    stub_build["service"] = PkceStubService()

    client.get("/connect/twitter/url")

    verifier = fake_supabase.tables["oauth_states"][0]["code_verifier"]
    assert verifier is not None
    assert 43 <= len(verifier) <= 128


def test_oauth_url_rejects_unknown_platform(client):
    assert client.get("/connect/myspace/url").status_code == 404


def test_oauth_url_reports_unconfigured_platform(client, monkeypatch):
    from app.routers import connect as connect_router

    monkeypatch.setattr(connect_router, "build_service", lambda platform: None)

    response = client.get("/connect/snapchat/url")
    assert response.status_code == 503


def test_return_path_must_be_relative(client, fake_supabase, stub_build):
    """An absolute return_path would make the callback an open redirect."""
    client.get("/connect/twitch/url?return_path=https://evil.test/steal")

    assert fake_supabase.tables["oauth_states"][0]["redirect_to"] == "/connect"


def test_protocol_relative_return_path_is_rejected(client, fake_supabase, stub_build):
    client.get("/connect/twitch/url?return_path=//evil.test/steal")

    assert fake_supabase.tables["oauth_states"][0]["redirect_to"] == "/connect"


def test_valid_return_path_is_kept(client, fake_supabase, stub_build):
    client.get("/connect/twitch/url?return_path=/onboarding")

    assert fake_supabase.tables["oauth_states"][0]["redirect_to"] == "/onboarding"


@pytest.mark.asyncio
async def test_callback_stores_tokens_and_redirects(client, fake_supabase, stub_build):
    state = await create_oauth_state(TEST_USER_ID, "twitch", redirect_to="/onboarding")

    response = client.get(
        f"/connect/twitch/callback?code=auth-code&state={state}", follow_redirects=False
    )

    assert response.status_code == 302
    parsed, params = _redirect_params(response)
    assert parsed.path == "/onboarding"
    assert params["connected"] == ["twitch"]

    stored = fake_supabase.tables["platform_tokens"]
    assert len(stored) == 1
    assert stored[0]["platform_username"] == "devcreator"
    assert stored[0]["platform_user_id"] == "12345"


@pytest.mark.asyncio
async def test_callback_rejects_forged_state(client, fake_supabase, stub_build):
    response = client.get(
        "/connect/twitch/callback?code=auth-code&state=forged", follow_redirects=False
    )

    assert response.status_code == 302
    _, params = _redirect_params(response)
    assert "expired or was already used" in params["error"][0]
    assert fake_supabase.tables.get("platform_tokens", []) == []


@pytest.mark.asyncio
async def test_callback_rejects_replayed_state(client, fake_supabase, stub_build):
    state = await create_oauth_state(TEST_USER_ID, "twitch")

    first = client.get(
        f"/connect/twitch/callback?code=code-1&state={state}", follow_redirects=False
    )
    second = client.get(
        f"/connect/twitch/callback?code=code-2&state={state}", follow_redirects=False
    )

    assert _redirect_params(first)[1]["connected"] == ["twitch"]
    assert "error" in _redirect_params(second)[1]


@pytest.mark.asyncio
async def test_callback_passes_pkce_verifier_to_exchange(client, fake_supabase, stub_build):
    service = PkceStubService()
    stub_build["service"] = service
    state = await create_oauth_state(TEST_USER_ID, "twitter", code_verifier="verifier-abc")

    client.get(
        f"/connect/twitter/callback?code=auth-code&state={state}", follow_redirects=False
    )

    assert service.exchange_calls[0][2] == "verifier-abc"


@pytest.mark.asyncio
async def test_callback_uses_backend_callback_url_for_exchange(
    client, fake_supabase, stub_build
):
    """The redirect_uri at exchange must match the one used at authorize."""
    service = StubService()
    stub_build["service"] = service
    state = await create_oauth_state(TEST_USER_ID, "twitch")

    client.get(f"/connect/twitch/callback?code=c&state={state}", follow_redirects=False)

    assert service.exchange_calls[0][1] == "https://api.test.local/connect/twitch/callback"


@pytest.mark.asyncio
async def test_callback_surfaces_provider_denial(client, fake_supabase, stub_build):
    response = client.get(
        "/connect/twitch/callback?error=access_denied&error_description=User+said+no",
        follow_redirects=False,
    )

    _, params = _redirect_params(response)
    assert params["error"] == ["User said no"]


@pytest.mark.asyncio
async def test_callback_reports_exchange_failure(client, fake_supabase, stub_build):
    stub_build["service"] = StubService(raises=PlatformAuthError("invalid_grant"))
    state = await create_oauth_state(TEST_USER_ID, "twitch")

    response = client.get(
        f"/connect/twitch/callback?code=bad&state={state}", follow_redirects=False
    )

    _, params = _redirect_params(response)
    assert "invalid_grant" in params["error"][0]
    assert fake_supabase.tables.get("platform_tokens", []) == []


def test_disconnect(client, fake_supabase):
    fake_supabase.tables["platform_tokens"] = [
        {"user_id": TEST_USER_ID, "platform": "twitch", "access_token": "x"}
    ]

    body = client.delete("/connect/twitch").json()
    assert body["success"] is True
    assert "Disconnected" in body["message"]
    assert fake_supabase.tables["platform_tokens"] == []

    # Idempotent: disconnecting again succeeds but says so.
    body = client.delete("/connect/twitch").json()
    assert "Was not connected" in body["message"]


def test_disconnect_rejects_unknown_platform(client):
    assert client.delete("/connect/myspace").status_code == 404
