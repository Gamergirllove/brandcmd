"""
twitch.py — TwitchService: OAuth 2.0 + Helix API.

Twitch exposes no per-day follower time series on Helix, so the daily
series is built from archived broadcasts (VODs) bucketed by publish date.
Point-in-time counters — followers, subscribers, live viewers — come back
in AnalyticsData.extra.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx

from .base import (
    AnalyticsData,
    BasePlatformService,
    DailyPoint,
    PlatformAPIError,
    PlatformAuthError,
    PlatformTokens,
)

_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"
_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
_HELIX = "https://api.twitch.tv/helix"

_SCOPES = "user:read:email channel:read:subscriptions moderator:read:followers"

# Twitch caps `first` at 100 for these endpoints.
_PAGE_SIZE = 100


class TwitchService(BasePlatformService):
    """
    OAuth 2.0 integration with Twitch.

    Credentials come from the Twitch Developer Console. Every Helix call
    needs both the bearer token and the Client-Id header — Twitch rejects
    requests carrying only one.
    """

    async def get_auth_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": _SCOPES,
            "state": state,
        }
        return f"{_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> PlatformTokens:
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(_TOKEN_URL, data=payload)
        data = resp.json()
        if resp.status_code != 200 or "access_token" not in data:
            raise PlatformAuthError(
                f"Twitch token exchange failed: {data.get('message', data)}"
            )
        return self._parse_tokens(data)

    async def refresh_token(self, refresh_token: str) -> PlatformTokens:
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(_TOKEN_URL, data=payload)
        data = resp.json()
        if resp.status_code != 200 or "access_token" not in data:
            raise PlatformAuthError(
                f"Twitch token refresh failed: {data.get('message', data)}"
            )
        tokens = self._parse_tokens(data)
        # Twitch rotates refresh tokens, but be defensive if one is omitted.
        if not tokens.refresh_token:
            tokens.refresh_token = refresh_token
        return tokens

    async def get_profile(self, tokens: PlatformTokens) -> dict:
        self._assert_token_valid(tokens)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{_HELIX}/users", headers=self._headers(tokens.access_token)
            )
            if resp.status_code != 200:
                raise PlatformAPIError(
                    f"Twitch users API error {resp.status_code}: {resp.text}"
                )
            users = resp.json().get("data", [])
            if not users:
                return {}

            user = users[0]
            user_id = user.get("id")
            followers = await self._get_follower_count(client, tokens, user_id)
            subscribers = await self._get_subscriber_count(client, tokens, user_id)
            live = await self._get_live_stream(client, tokens, user_id)

        return {
            "id": user_id,
            "username": user.get("login"),
            "display_name": user.get("display_name"),
            "description": user.get("description"),
            "thumbnail": user.get("profile_image_url"),
            "broadcaster_type": user.get("broadcaster_type"),
            "followers": followers,
            "subscribers": subscribers,
            "is_live": live is not None,
            "live_viewers": (live or {}).get("viewer_count", 0),
        }

    async def get_analytics(self, tokens: PlatformTokens, days: int = 30) -> AnalyticsData:
        self._assert_token_valid(tokens)
        profile = await self.get_profile(tokens)
        user_id = profile.get("id") or tokens.platform_user_id
        if not user_id:
            raise PlatformAPIError("Twitch analytics needs a broadcaster id but none was found")

        cutoff = datetime.utcnow() - timedelta(days=days)
        videos = await self._get_videos(tokens, user_id, cutoff)

        day_map: dict[str, DailyPoint] = defaultdict(lambda: DailyPoint(date=""))
        total_seconds = 0
        for video in videos:
            date_str = (video.get("created_at") or "")[:10]
            if not date_str:
                continue
            point = day_map[date_str]
            point.date = date_str
            point.views += int(video.get("view_count", 0) or 0)
            total_seconds += _parse_duration(video.get("duration", ""))

        daily_data = sorted(day_map.values(), key=lambda p: p.date)

        return AnalyticsData(
            followers=profile.get("followers", 0),
            total_views=sum(p.views for p in daily_data),
            daily_data=daily_data,
            extra={
                "subscribers": profile.get("subscribers", 0),
                "broadcasts": len(videos),
                "hours_streamed": round(total_seconds / 3600, 1),
                "avg_views_per_broadcast": (
                    round(sum(p.views for p in daily_data) / len(videos)) if videos else 0
                ),
                "is_live": profile.get("is_live", False),
                "live_viewers": profile.get("live_viewers", 0),
                "broadcaster_type": profile.get("broadcaster_type"),
            },
        )

    # ------------------------------------------------------------------
    # Helix helpers
    # ------------------------------------------------------------------

    def _headers(self, access_token: str) -> dict:
        return {
            "Authorization": f"Bearer {access_token}",
            "Client-Id": self.client_id,
        }

    async def _get_follower_count(
        self, client: httpx.AsyncClient, tokens: PlatformTokens, user_id: str
    ) -> int:
        """Total followers. `first=1` because we only want the `total` field."""
        resp = await client.get(
            f"{_HELIX}/channels/followers",
            params={"broadcaster_id": user_id, "first": 1},
            headers=self._headers(tokens.access_token),
        )
        if resp.status_code != 200:
            return 0
        return int(resp.json().get("total", 0) or 0)

    async def _get_subscriber_count(
        self, client: httpx.AsyncClient, tokens: PlatformTokens, user_id: str
    ) -> int:
        """
        Total subscribers. Affiliates and partners only — a plain account
        returns 400, which is expected rather than an error worth raising.
        """
        resp = await client.get(
            f"{_HELIX}/subscriptions",
            params={"broadcaster_id": user_id, "first": 1},
            headers=self._headers(tokens.access_token),
        )
        if resp.status_code != 200:
            return 0
        return int(resp.json().get("total", 0) or 0)

    async def _get_live_stream(
        self, client: httpx.AsyncClient, tokens: PlatformTokens, user_id: str
    ) -> Optional[dict]:
        """The current live stream, or None when the channel is offline."""
        resp = await client.get(
            f"{_HELIX}/streams",
            params={"user_id": user_id},
            headers=self._headers(tokens.access_token),
        )
        if resp.status_code != 200:
            return None
        streams = resp.json().get("data", [])
        return streams[0] if streams else None

    async def _get_videos(
        self, tokens: PlatformTokens, user_id: str, cutoff: datetime
    ) -> list[dict]:
        """Archived broadcasts newer than `cutoff`, following pagination."""
        videos: list[dict] = []
        cursor: Optional[str] = None
        headers = self._headers(tokens.access_token)

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                params: dict = {
                    "user_id": user_id,
                    "type": "archive",
                    "first": _PAGE_SIZE,
                    "sort": "time",
                }
                if cursor:
                    params["after"] = cursor

                resp = await client.get(f"{_HELIX}/videos", params=params, headers=headers)
                if resp.status_code != 200:
                    raise PlatformAPIError(
                        f"Twitch videos API error {resp.status_code}: {resp.text}"
                    )

                body = resp.json()
                page = body.get("data", [])
                if not page:
                    break

                reached_cutoff = False
                for video in page:
                    created = _parse_twitch_ts(video.get("created_at"))
                    if created and created < cutoff:
                        # Results are newest-first, so everything after this is older too.
                        reached_cutoff = True
                        break
                    videos.append(video)

                cursor = body.get("pagination", {}).get("cursor")
                if reached_cutoff or not cursor:
                    break

        return videos

    @staticmethod
    def _parse_tokens(data: dict) -> PlatformTokens:
        expires_in = data.get("expires_in")
        expires_at: Optional[datetime] = None
        if expires_in is not None:
            expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))

        scope = data.get("scope")
        if isinstance(scope, list):
            scope = " ".join(scope)

        return PlatformTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=expires_at,
            scope=scope,
            platform_user_id=None,
            platform_username=None,
        )


# ---------------------------------------------------------------------------
# Module helpers
# ---------------------------------------------------------------------------

def _parse_twitch_ts(value: Optional[str]) -> Optional[datetime]:
    """Parse a Helix RFC-3339 timestamp into a naive UTC datetime."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None


def _parse_duration(duration: str) -> int:
    """
    Convert a Twitch duration string ("3h21m34s", "45m", "12s") to seconds.
    Unparseable input counts as zero rather than raising.
    """
    if not duration:
        return 0

    total = 0
    number = ""
    units = {"h": 3600, "m": 60, "s": 1}
    for char in duration:
        if char.isdigit():
            number += char
        elif char in units and number:
            total += int(number) * units[char]
            number = ""
        else:
            number = ""
    return total
