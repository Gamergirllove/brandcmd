"""Tests for the profile router, including onboarding state and account deletion."""
from tests.conftest import TEST_USER_ID


def _profile_row(**overrides):
    row = {
        "id": TEST_USER_ID,
        "username": "dev_creator",
        "display_name": "Dev Creator",
        "avatar_url": None,
        "creator_handle": None,
        "creator_type": None,
        "onboarding_complete": False,
        "notification_prefs": {
            "weekly_report": True,
            "goal_complete": True,
            "milestone": False,
        },
    }
    row.update(overrides)
    return row


def test_get_profile(client, fake_supabase):
    fake_supabase.tables["profiles"] = [_profile_row()]

    body = client.get("/profile").json()

    assert body["id"] == TEST_USER_ID
    assert body["display_name"] == "Dev Creator"
    assert body["onboarding_complete"] is False
    assert body["notification_prefs"]["weekly_report"] is True


def test_get_profile_self_heals_missing_row(client, fake_supabase):
    """A failed signup trigger must not lock the user out of their dashboard."""
    fake_supabase.tables["profiles"] = []

    response = client.get("/profile")

    assert response.status_code == 200
    assert len(fake_supabase.tables["profiles"]) == 1
    assert fake_supabase.tables["profiles"][0]["id"] == TEST_USER_ID


def test_update_profile_fields(client, fake_supabase):
    fake_supabase.tables["profiles"] = [_profile_row()]

    body = client.patch(
        "/profile",
        json={
            "display_name": "Tasha Creates",
            "creator_handle": "tasha_creates",
            "creator_type": "gaming",
            "onboarding_complete": True,
        },
    ).json()

    assert body["display_name"] == "Tasha Creates"
    assert body["creator_handle"] == "tasha_creates"
    assert body["creator_type"] == "gaming"
    assert body["onboarding_complete"] is True


def test_update_notification_prefs(client, fake_supabase):
    fake_supabase.tables["profiles"] = [_profile_row()]

    body = client.patch(
        "/profile",
        json={
            "notification_prefs": {
                "weekly_report": False,
                "goal_complete": True,
                "milestone": True,
            }
        },
    ).json()

    assert body["notification_prefs"] == {
        "weekly_report": False,
        "goal_complete": True,
        "milestone": True,
    }
    assert fake_supabase.tables["profiles"][0]["notification_prefs"]["milestone"] is True


def test_update_requires_a_field(client, fake_supabase):
    fake_supabase.tables["profiles"] = [_profile_row()]

    assert client.patch("/profile", json={}).status_code == 400


def test_partial_update_leaves_other_fields_alone(client, fake_supabase):
    fake_supabase.tables["profiles"] = [
        _profile_row(creator_handle="original", creator_type="music")
    ]

    body = client.patch("/profile", json={"display_name": "New Name"}).json()

    assert body["display_name"] == "New Name"
    assert body["creator_handle"] == "original"
    assert body["creator_type"] == "music"


def test_delete_account_removes_tokens_and_auth_user(client, fake_supabase):
    fake_supabase.tables["profiles"] = [_profile_row()]
    fake_supabase.tables["platform_tokens"] = [
        {"user_id": TEST_USER_ID, "platform": "twitch", "access_token": "x"},
        {"user_id": TEST_USER_ID, "platform": "youtube", "access_token": "y"},
        {"user_id": "other-user", "platform": "twitch", "access_token": "z"},
    ]

    assert client.delete("/profile").status_code == 204

    # Only the caller's tokens are gone.
    remaining = fake_supabase.tables["platform_tokens"]
    assert len(remaining) == 1
    assert remaining[0]["user_id"] == "other-user"
    assert fake_supabase.deleted_users == [TEST_USER_ID]
