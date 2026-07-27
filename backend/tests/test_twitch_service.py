"""Tests for TwitchService against mocked Helix responses."""
from datetime import datetime, timedelta

import httpx
import pytest
import respx

from app.services.base import PlatformAuthError, PlatformTokens
from app.services.twitch import TwitchService, _parse_duration

HELIX = "https://api.twitch.tv/helix"
TOKEN_URL = "https://id.twitch.tv/oauth2/token"


@pytest.fixture
def service() -> TwitchService:
    return TwitchService(
        client_id="client-id",
        client_secret="client-secret",
        redirect_uri="https://api.test.local/connect/twitch/callback",
    )


@pytest.fixture
def tokens() -> PlatformTokens:
    return PlatformTokens(
        access_token="access-token",
        refresh_token="refresh-token",
        expires_at=datetime.utcnow() + timedelta(hours=1),
        scope="user:read:email",
        platform_user_id="12345",
        platform_username="devcreator",
    )


def _mock_profile_calls(respx_mock, *, followers=8420, subscribers=127, live=False):
    respx_mock.get(f"{HELIX}/users").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "12345",
                        "login": "devcreator",
                        "display_name": "DevCreator",
                        "description": "Streaming things",
                        "profile_image_url": "https://static-cdn.jtvnw.net/avatar.png",
                        "broadcaster_type": "affiliate",
                    }
                ]
            },
        )
    )
    respx_mock.get(f"{HELIX}/channels/followers").mock(
        return_value=httpx.Response(200, json={"total": followers, "data": []})
    )
    respx_mock.get(f"{HELIX}/subscriptions").mock(
        return_value=httpx.Response(200, json={"total": subscribers, "data": []})
    )
    respx_mock.get(f"{HELIX}/streams").mock(
        return_value=httpx.Response(
            200,
            json={"data": [{"viewer_count": 342}] if live else []},
        )
    )


@pytest.mark.asyncio
@respx.mock
async def test_get_profile_aggregates_helix_endpoints(service, tokens):
    _mock_profile_calls(respx.mock, live=True)

    profile = await service.get_profile(tokens)

    assert profile["id"] == "12345"
    assert profile["username"] == "devcreator"
    assert profile["followers"] == 8420
    assert profile["subscribers"] == 127
    assert profile["is_live"] is True
    assert profile["live_viewers"] == 342


@pytest.mark.asyncio
@respx.mock
async def test_helix_calls_send_client_id_header(service, tokens):
    """Helix rejects a bearer token without the matching Client-Id."""
    route = respx.get(f"{HELIX}/users").mock(
        return_value=httpx.Response(200, json={"data": []})
    )

    await service.get_profile(tokens)

    request = route.calls[0].request
    assert request.headers["Client-Id"] == "client-id"
    assert request.headers["Authorization"] == "Bearer access-token"


@pytest.mark.asyncio
@respx.mock
async def test_get_analytics_buckets_vods_by_day(service, tokens):
    _mock_profile_calls(respx.mock)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    respx.get(f"{HELIX}/videos").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {"created_at": f"{today}T18:00:00Z", "view_count": 1200, "duration": "3h20m"},
                    {"created_at": f"{today}T09:00:00Z", "view_count": 300, "duration": "45m"},
                    {"created_at": f"{yesterday}T20:00:00Z", "view_count": 800, "duration": "2h"},
                ],
                "pagination": {},
            },
        )
    )

    analytics = await service.get_analytics(tokens, days=30)

    assert analytics.followers == 8420
    assert analytics.total_views == 2300
    # Two broadcasts on the same day collapse into one point.
    assert len(analytics.daily_data) == 2
    assert analytics.daily_data[-1].date == today
    assert analytics.daily_data[-1].views == 1500
    assert analytics.extra["subscribers"] == 127
    assert analytics.extra["broadcasts"] == 3
    assert analytics.extra["hours_streamed"] == pytest.approx(6.08, abs=0.02)


@pytest.mark.asyncio
@respx.mock
async def test_get_analytics_stops_at_cutoff(service, tokens):
    """VODs older than the window are excluded, newest-first ordering assumed."""
    _mock_profile_calls(respx.mock)
    recent = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    ancient = (datetime.utcnow() - timedelta(days=400)).strftime("%Y-%m-%dT%H:%M:%SZ")

    respx.get(f"{HELIX}/videos").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {"created_at": recent, "view_count": 100, "duration": "1h"},
                    {"created_at": ancient, "view_count": 999999, "duration": "1h"},
                ],
                "pagination": {},
            },
        )
    )

    analytics = await service.get_analytics(tokens, days=30)

    assert analytics.total_views == 100
    assert analytics.extra["broadcasts"] == 1


@pytest.mark.asyncio
@respx.mock
async def test_subscriber_count_tolerates_non_affiliate(service, tokens):
    """A plain (non-affiliate) channel gets 400 from /subscriptions; that's not an error."""
    _mock_profile_calls(respx.mock)
    respx.get(f"{HELIX}/subscriptions").mock(
        return_value=httpx.Response(400, json={"error": "Bad Request"})
    )

    profile = await service.get_profile(tokens)

    assert profile["subscribers"] == 0
    assert profile["followers"] == 8420


@pytest.mark.asyncio
@respx.mock
async def test_refresh_token_keeps_old_refresh_when_omitted(service):
    respx.post(TOKEN_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": "new-access",
                "expires_in": 14400,
                "scope": ["user:read:email", "channel:read:subscriptions"],
            },
        )
    )

    refreshed = await service.refresh_token("original-refresh")

    assert refreshed.access_token == "new-access"
    assert refreshed.refresh_token == "original-refresh"
    # Twitch returns scope as a list; PlatformTokens.scope is a string.
    assert refreshed.scope == "user:read:email channel:read:subscriptions"


@pytest.mark.asyncio
@respx.mock
async def test_exchange_code_raises_on_provider_error(service):
    respx.post(TOKEN_URL).mock(
        return_value=httpx.Response(400, json={"message": "Invalid authorization code"})
    )

    with pytest.raises(PlatformAuthError, match="Invalid authorization code"):
        await service.exchange_code("bad-code", "https://api.test.local/cb")


@pytest.mark.asyncio
async def test_auth_url_contains_state_and_redirect(service):
    url = await service.get_auth_url("state-token")

    assert url.startswith("https://id.twitch.tv/oauth2/authorize?")
    assert "state=state-token" in url
    assert "client_id=client-id" in url
    assert "response_type=code" in url


@pytest.mark.parametrize(
    "duration,expected",
    [
        ("3h21m34s", 12094),
        ("45m", 2700),
        ("12s", 12),
        ("2h", 7200),
        ("", 0),
        ("garbage", 0),
    ],
)
def test_parse_duration(duration, expected):
    assert _parse_duration(duration) == expected
