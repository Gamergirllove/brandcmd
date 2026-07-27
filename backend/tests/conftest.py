"""
Shared test fixtures.

The backend talks to Supabase through a small slice of the postgrest
query-builder API. `FakeSupabase` implements exactly that slice against
in-memory lists, which keeps the router tests honest about the queries they
issue without needing a live database.
"""
import os
from typing import Any, Dict, List, Optional

import pytest

# Settings are read at import time, so these must be set before `app` loads.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("BACKEND_URL", "https://api.test.local")
os.environ.setdefault("FRONTEND_URL", "https://app.test.local")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("TWITCH_CLIENT_ID", "twitch-client-id")
os.environ.setdefault("TWITCH_CLIENT_SECRET", "twitch-client-secret")
os.environ.setdefault("GOOGLE_CLIENT_ID", "google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "google-client-secret")
os.environ.setdefault("TWITTER_CLIENT_ID", "twitter-client-id")
os.environ.setdefault("TWITTER_CLIENT_SECRET", "twitter-client-secret")

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


class _Result:
    def __init__(self, data: Any):
        self.data = data


class _Query:
    """One chained query against a single fake table."""

    def __init__(self, store: "FakeSupabase", table: str):
        self._store = store
        self._table = table
        self._op = "select"
        self._payload: Any = None
        self._filters: List[tuple] = []
        self._limit: Optional[int] = None
        self._order: Optional[tuple] = None

    # -- verbs ---------------------------------------------------------
    def select(self, *_columns, **_kwargs) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, on_conflict: str = "") -> "_Query":
        self._op = "upsert"
        self._payload = payload
        self._on_conflict = [c.strip() for c in on_conflict.split(",") if c.strip()]
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    # -- modifiers -----------------------------------------------------
    def eq(self, column: str, value) -> "_Query":
        self._filters.append((column, value))
        return self

    def limit(self, count: int) -> "_Query":
        self._limit = count
        return self

    def single(self) -> "_Query":
        self._limit = 1
        return self

    def maybe_single(self) -> "_Query":
        self._limit = 1
        return self

    def order(self, column: str, desc: bool = False) -> "_Query":
        self._order = (column, desc)
        return self

    # -- execution -----------------------------------------------------
    def _matches(self, row: Dict) -> bool:
        return all(str(row.get(col)) == str(val) for col, val in self._filters)

    def execute(self) -> _Result:
        rows = self._store.tables.setdefault(self._table, [])
        self._store.calls.append((self._table, self._op, dict(self._filters)))

        if self._op == "select":
            found = [r for r in rows if self._matches(r)]
            if self._order:
                column, desc = self._order
                found.sort(key=lambda r: r.get(column) or "", reverse=desc)
            if self._limit is not None:
                found = found[: self._limit]
            return _Result([dict(r) for r in found])

        if self._op in ("insert", "upsert"):
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            written = []
            for payload in payloads:
                row = dict(payload)
                row.setdefault("id", f"{self._table}-{len(rows) + 1}")
                row.setdefault("created_at", "2026-07-26T00:00:00+00:00")

                existing = None
                if self._op == "upsert" and getattr(self, "_on_conflict", None):
                    existing = next(
                        (
                            r
                            for r in rows
                            if all(r.get(k) == row.get(k) for k in self._on_conflict)
                        ),
                        None,
                    )
                if existing is not None:
                    existing.update(row)
                    written.append(dict(existing))
                else:
                    rows.append(row)
                    written.append(dict(row))
            return _Result(written)

        if self._op == "update":
            updated = []
            for row in rows:
                if self._matches(row):
                    row.update(self._payload)
                    updated.append(dict(row))
            return _Result(updated)

        if self._op == "delete":
            removed = [dict(r) for r in rows if self._matches(r)]
            self._store.tables[self._table] = [r for r in rows if not self._matches(r)]
            return _Result(removed)

        raise AssertionError(f"unsupported op {self._op}")


class _FakeAdmin:
    def __init__(self, store: "FakeSupabase"):
        self._store = store

    def delete_user(self, user_id: str) -> None:
        self._store.deleted_users.append(user_id)


class _FakeAuth:
    def __init__(self, store: "FakeSupabase"):
        self.admin = _FakeAdmin(store)


class FakeSupabase:
    """Minimal stand-in for the Supabase client used by the app."""

    def __init__(self, tables: Optional[Dict[str, List[Dict]]] = None):
        self.tables: Dict[str, List[Dict]] = tables or {}
        self.calls: List[tuple] = []
        self.deleted_users: List[str] = []
        self.auth = _FakeAuth(self)

    def table(self, name: str) -> _Query:
        return _Query(self, name)


@pytest.fixture
def fake_supabase(monkeypatch) -> FakeSupabase:
    """
    Swap the Supabase client everywhere it is used.

    Each module does `from app.db import get_supabase`, which binds the name
    in that module — so patching `app.db` alone would miss them.
    """
    store = FakeSupabase()

    from app.routers import goals as goals_router
    from app.routers import profile as profile_router
    from app.services import token_store

    for module in (token_store, goals_router, profile_router):
        monkeypatch.setattr(module, "get_supabase", lambda: store)

    return store


@pytest.fixture
def client(fake_supabase):
    """TestClient with authentication stubbed out to TEST_USER_ID."""
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user
    from main import app

    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
