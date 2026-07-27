"""Tests for the goals router, including live-value refresh on read."""
import pytest

from app.models import PlatformStats
from tests.conftest import TEST_USER_ID


@pytest.fixture
def stub_stats(monkeypatch):
    """Control what _build_platform_stats returns per platform."""
    from app.routers import goals as goals_router

    registry: dict = {}

    async def fake_build(platform, user_id, days=30):
        return registry.get(platform, PlatformStats(platform=platform, connected=False))

    monkeypatch.setattr(goals_router, "_build_platform_stats", fake_build)

    def configure(mapping):
        registry.clear()
        registry.update(mapping)

    return configure


def _goal_row(**overrides):
    row = {
        "id": "goal-1",
        "user_id": TEST_USER_ID,
        "type": "twitch_followers",
        "platform": "twitch",
        "target_value": 10000,
        "current_value": 0,
        "completed": False,
        "completed_at": None,
        "created_at": "2026-07-01T00:00:00+00:00",
    }
    row.update(overrides)
    return row


def test_create_goal(client, fake_supabase, stub_stats):
    stub_stats({})

    response = client.post(
        "/goals",
        json={"type": "twitch_followers", "platform": "twitch", "target_value": 10000},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["type"] == "twitch_followers"
    assert body["target_value"] == 10000
    assert body["completed"] is False
    assert len(fake_supabase.tables["goals"]) == 1


def test_create_goal_rejects_unknown_type(client, fake_supabase, stub_stats):
    stub_stats({})

    response = client.post(
        "/goals",
        json={"type": "become_famous", "platform": "twitch", "target_value": 10},
    )

    assert response.status_code == 400
    assert "Unknown goal type" in response.json()["detail"]


def test_create_goal_rejects_non_positive_target(client, fake_supabase, stub_stats):
    stub_stats({})

    response = client.post(
        "/goals",
        json={"type": "twitch_followers", "platform": "twitch", "target_value": 0},
    )

    assert response.status_code == 422


def test_list_refreshes_current_value_from_live_stats(client, fake_supabase, stub_stats):
    fake_supabase.tables["goals"] = [_goal_row()]
    stub_stats(
        {"twitch": PlatformStats(platform="twitch", connected=True, followers=6200)}
    )

    body = client.get("/goals").json()

    goal = body["goals"][0]
    assert goal["current_value"] == 6200
    assert goal["progress_pct"] == 62.0
    assert goal["completed"] is False
    # Refreshed value is persisted, not just computed for the response.
    assert fake_supabase.tables["goals"][0]["current_value"] == 6200


def test_goal_completes_when_target_reached(client, fake_supabase, stub_stats):
    fake_supabase.tables["goals"] = [_goal_row()]
    stub_stats(
        {"twitch": PlatformStats(platform="twitch", connected=True, followers=12000)}
    )

    goal = client.get("/goals").json()["goals"][0]

    assert goal["completed"] is True
    assert goal["completed_at"] is not None
    # Progress is capped so the bar can't overflow.
    assert goal["progress_pct"] == 100.0


def test_youtube_monthly_views_goal_reads_views_not_followers(
    client, fake_supabase, stub_stats
):
    fake_supabase.tables["goals"] = [
        _goal_row(type="youtube_monthly_views", platform="youtube", target_value=100000)
    ]
    stub_stats(
        {
            "youtube": PlatformStats(
                platform="youtube", connected=True, followers=12180, views_30d=94300
            )
        }
    )

    goal = client.get("/goals").json()["goals"][0]

    assert goal["current_value"] == 94300


def test_twitch_avg_viewers_goal_reads_from_raw(client, fake_supabase, stub_stats):
    fake_supabase.tables["goals"] = [
        _goal_row(type="twitch_avg_viewers", target_value=500)
    ]
    stub_stats(
        {
            "twitch": PlatformStats(
                platform="twitch",
                connected=True,
                raw={"avg_views_per_broadcast": 342},
            )
        }
    )

    goal = client.get("/goals").json()["goals"][0]

    assert goal["current_value"] == 342


def test_refresh_keeps_stored_value_when_platform_errors(
    client, fake_supabase, stub_stats
):
    """A provider outage must not reset someone's progress to zero."""
    fake_supabase.tables["goals"] = [_goal_row(current_value=6200)]
    stub_stats(
        {
            "twitch": PlatformStats(
                platform="twitch", connected=True, followers=0, error="Helix is down"
            )
        }
    )

    goal = client.get("/goals").json()["goals"][0]

    assert goal["current_value"] == 6200


def test_refresh_keeps_stored_value_when_platform_disconnected(
    client, fake_supabase, stub_stats
):
    fake_supabase.tables["goals"] = [_goal_row(current_value=6200)]
    stub_stats({})

    goal = client.get("/goals").json()["goals"][0]

    assert goal["current_value"] == 6200


def test_update_goal_target(client, fake_supabase, stub_stats):
    stub_stats({})
    fake_supabase.tables["goals"] = [_goal_row(current_value=6200)]

    body = client.patch("/goals/goal-1", json={"target_value": 6000}).json()

    assert body["target_value"] == 6000


def test_update_goal_scoped_to_owner(client, fake_supabase, stub_stats):
    """Knowing a goal id must not be enough to modify it."""
    stub_stats({})
    fake_supabase.tables["goals"] = [
        _goal_row(id="someone-elses", user_id="99999999-9999-9999-9999-999999999999")
    ]

    response = client.patch("/goals/someone-elses", json={"target_value": 1})

    assert response.status_code == 404


def test_update_goal_requires_a_field(client, fake_supabase, stub_stats):
    stub_stats({})
    fake_supabase.tables["goals"] = [_goal_row()]

    assert client.patch("/goals/goal-1", json={}).status_code == 400


def test_delete_goal(client, fake_supabase, stub_stats):
    stub_stats({})
    fake_supabase.tables["goals"] = [_goal_row()]

    assert client.delete("/goals/goal-1").status_code == 204
    assert fake_supabase.tables["goals"] == []
    assert client.delete("/goals/goal-1").status_code == 404


def test_delete_goal_scoped_to_owner(client, fake_supabase, stub_stats):
    stub_stats({})
    fake_supabase.tables["goals"] = [
        _goal_row(id="someone-elses", user_id="99999999-9999-9999-9999-999999999999")
    ]

    assert client.delete("/goals/someone-elses").status_code == 404
    assert len(fake_supabase.tables["goals"]) == 1
