"""
Tests for the analytics router.

These pin down the contract the frontend consumes, and the failure
behaviour that keeps one broken integration from taking down the page.
"""
from datetime import datetime, timedelta

import pytest

from app.services.base import (
    AnalyticsData,
    DailyPoint,
    PlatformAuthError,
    PlatformTokens,
)
from tests.conftest import TEST_USER_ID


class StubService:
    """Stands in for a real platform service."""

    def __init__(self, profile=None, analytics=None, raises=None):
        self._profile = profile or {"id": "1", "username": "devcreator", "followers": 100}
        self._analytics = analytics or AnalyticsData()
        self._raises = raises

    async def get_profile(self, tokens):
        if self._raises:
            raise self._raises
        return self._profile

    async def get_analytics(self, tokens, days=30):
        if self._raises:
            raise self._raises
        return self._analytics


def _tokens() -> PlatformTokens:
    return PlatformTokens(
        access_token="token",
        refresh_token=None,
        expires_at=datetime.utcnow() + timedelta(hours=1),
        scope=None,
        platform_user_id="1",
        platform_username="devcreator",
    )


@pytest.fixture
def stub_platforms(monkeypatch):
    """
    Register stub services per platform. Returns a setter the test calls with
    a {platform: StubService | Exception} mapping.
    """
    from app.routers import analytics as analytics_router

    registry: dict = {}

    async def fake_get_service_with_tokens(platform, user_id):
        entry = registry.get(platform)
        if entry is None:
            return None
        if isinstance(entry, Exception):
            raise entry
        return entry, _tokens()

    async def fake_list_connected(user_id):
        return [{"platform": p} for p in registry]

    monkeypatch.setattr(
        analytics_router, "get_service_with_tokens", fake_get_service_with_tokens
    )
    monkeypatch.setattr(analytics_router, "list_connected_platforms", fake_list_connected)

    def configure(mapping):
        registry.clear()
        registry.update(mapping)

    return configure


def _analytics(followers, views, likes=0, comments=0, shares=0, daily=None, extra=None):
    return AnalyticsData(
        followers=followers,
        total_views=views,
        total_likes=likes,
        total_comments=comments,
        total_shares=shares,
        daily_data=daily or [],
        extra=extra or {},
    )


def test_overview_aggregates_across_platforms(client, stub_platforms):
    stub_platforms(
        {
            "twitch": StubService(
                profile={"id": "1", "username": "devcreator"},
                analytics=_analytics(8420, 12000, extra={"subscribers": 127}),
            ),
            "youtube": StubService(
                profile={"id": "2", "username": "devtube"},
                analytics=_analytics(12180, 94300, likes=4000, comments=500),
            ),
        }
    )

    body = client.get("/analytics/overview").json()

    assert body["total_followers"] == 20600
    assert body["total_views"] == 106300
    assert body["total_engagement"] == 4500
    assert body["platforms_connected"] == 2
    assert body["period_days"] == 30
    assert {p["platform"] for p in body["platforms"]} == {"twitch", "youtube"}
    assert body["last_updated"]


def test_overview_is_empty_when_nothing_connected(client, stub_platforms):
    stub_platforms({})

    body = client.get("/analytics/overview").json()

    assert body["platforms_connected"] == 0
    assert body["total_followers"] == 0
    assert body["platforms"] == []


def test_engagement_rate_uses_views_as_denominator(client, stub_platforms):
    stub_platforms(
        {"youtube": StubService(analytics=_analytics(1000, 10000, likes=400, comments=100))}
    )

    body = client.get("/analytics/overview").json()

    # (400 + 100) / 10000 = 5%
    assert body["engagement_rate"] == 5.0
    assert body["platforms"][0]["engagement_rate"] == 5.0


def test_engagement_rate_falls_back_to_followers_without_views(client, stub_platforms):
    stub_platforms(
        {"linkedin": StubService(analytics=_analytics(2000, 0, likes=100))}
    )

    body = client.get("/analytics/overview").json()

    # No view data, so followers is the denominator: 100 / 2000 = 5%
    assert body["platforms"][0]["engagement_rate"] == 5.0


def test_platform_error_is_isolated_not_fatal(client, stub_platforms):
    """One provider blowing up must not take the whole overview down."""
    stub_platforms(
        {
            "twitch": StubService(raises=RuntimeError("Helix is down")),
            "youtube": StubService(analytics=_analytics(12180, 94300)),
        }
    )

    response = client.get("/analytics/overview")
    assert response.status_code == 200

    body = response.json()
    twitch = next(p for p in body["platforms"] if p["platform"] == "twitch")
    youtube = next(p for p in body["platforms"] if p["platform"] == "youtube")

    assert twitch["connected"] is True
    assert "Helix is down" in twitch["error"]
    assert twitch["followers"] == 0
    # The healthy platform still reports real numbers.
    assert youtube["followers"] == 12180
    assert body["total_followers"] == 12180


def test_expired_credentials_flag_needs_reconnect(client, stub_platforms):
    stub_platforms({"twitch": PlatformAuthError("token expired and no refresh token stored")})

    body = client.get("/analytics/overview").json()
    twitch = body["platforms"][0]

    assert twitch["connected"] is True
    assert twitch["needs_reconnect"] is True
    assert "expired" in twitch["error"]


def test_daily_series_is_passed_through(client, stub_platforms):
    stub_platforms(
        {
            "youtube": StubService(
                analytics=_analytics(
                    100,
                    300,
                    daily=[
                        DailyPoint(date="2026-07-24", views=100, likes=10, followers_gained=3),
                        DailyPoint(date="2026-07-25", views=200, likes=20, followers_gained=5),
                    ],
                )
            )
        }
    )

    body = client.get("/analytics/overview").json()
    daily = body["platforms"][0]["daily_data"]

    assert len(daily) == 2
    assert daily[1] == {
        "date": "2026-07-25",
        "views": 200,
        "likes": 20,
        "comments": 0,
        "shares": 0,
        "impressions": 0,
        "followers_gained": 5,
    }


def test_platform_extras_surface_as_raw(client, stub_platforms):
    stub_platforms(
        {
            "twitch": StubService(
                analytics=_analytics(8420, 1000, extra={"subscribers": 127, "hours_streamed": 48.5})
            )
        }
    )

    body = client.get("/analytics/overview").json()

    assert body["platforms"][0]["raw"]["subscribers"] == 127
    assert body["platforms"][0]["raw"]["hours_streamed"] == 48.5


def test_days_parameter_is_validated(client, stub_platforms):
    stub_platforms({})

    assert client.get("/analytics/overview?days=7").json()["period_days"] == 7
    assert client.get("/analytics/overview?days=0").status_code == 422
    assert client.get("/analytics/overview?days=400").status_code == 422


def test_single_platform_endpoint(client, stub_platforms):
    stub_platforms({"twitch": StubService(analytics=_analytics(8420, 12000))})

    body = client.get("/analytics/twitch").json()
    assert body["platform"] == "twitch"
    assert body["followers"] == 8420

    # Connected-but-not-this-one → 404, unknown platform → 404
    assert client.get("/analytics/youtube").status_code == 404
    assert client.get("/analytics/myspace").status_code == 404


def test_compare_picks_metric_leaders(client, stub_platforms):
    stub_platforms(
        {
            "twitch": StubService(analytics=_analytics(8420, 120000, likes=10)),
            "youtube": StubService(analytics=_analytics(12180, 94300, likes=4000)),
        }
    )

    body = client.get("/analytics/compare").json()

    assert body["metric_leaders"]["followers"] == "youtube"
    assert body["metric_leaders"]["views"] == "twitch"
    assert body["metric_leaders"]["likes"] == "youtube"


def test_compare_excludes_errored_platforms_from_leaders(client, stub_platforms):
    stub_platforms(
        {
            "twitch": StubService(raises=RuntimeError("down")),
            "youtube": StubService(analytics=_analytics(12180, 94300)),
        }
    )

    body = client.get("/analytics/compare").json()

    assert body["metric_leaders"]["followers"] == "youtube"
    assert len(body["platforms"]) == 2
