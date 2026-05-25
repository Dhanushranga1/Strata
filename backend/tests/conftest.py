"""
Shared test fixtures for TicketPilot backend tests.

All tests use mocked DB connections by default so they can run
without a real PostgreSQL database.  Set SKIP_MOCK_DB=1 to use
a real connection (requires DATABASE_URL + DATABASE_PASSWORD in .env).
"""

from __future__ import annotations

import os
import sys
import json
import time
import uuid as uuid_lib
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any, AsyncGenerator

import jwt
import pytest
import pytest_asyncio

# Ensure backend is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Config ──────────────────────────────────────────────────────────────────

MOCK_DB = os.getenv("SKIP_MOCK_DB", "1") != "1"
# Use a known good test secret for HS256
TEST_JWT_SECRET = "test-secret-32-bytes-long-for-hs256-tests!!"
os.environ.setdefault("SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJtest-service-role-key")

# Patch Supabase client creation globally — prevents auth.py module-level
# SupabaseException when any test imports a module that depends on auth.
from unittest.mock import MagicMock, patch as _patch
_supabase_patcher = _patch("supabase.create_client", return_value=MagicMock())
_supabase_patcher.start()
TEST_USER_ID = "36615d00-04dd-4306-bb5b-3adef716b4c9"
TEST_ORG_ID = "3f795050-4b77-442d-ad3f-173fec358c25"
TEST_EMAIL = "test@ticketpilot.dev"


# ── JWT tokens ──────────────────────────────────────────────────────────────


def make_jwt(
    sub: str = TEST_USER_ID,
    email: str = TEST_EMAIL,
    role: str = "admin",
    exp_offset: int = 3600,
    alg: str = "HS256",
) -> str:
    """Create a signed JWT for testing."""
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "iss": "https://test-project.supabase.co/auth/v1",
        "iat": int(time.time()),
        "exp": int(time.time()) + exp_offset,
        "aud": "authenticated",
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm=alg)


def make_expired_jwt() -> str:
    return make_jwt(exp_offset=-3600)


def make_invalid_sig_jwt() -> str:
    payload = {
        "sub": TEST_USER_ID,
        "email": TEST_EMAIL,
        "role": "admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, "wrong-secret-for-signing", algorithm="HS256")


# ── Mock DB helpers ─────────────────────────────────────────────────────────


class MockCursor:
    """Simulates a psycopg3 cursor with dict-row behaviour."""

    def __init__(self, rows: list[dict] | None = None):
        self._rows = rows or []
        self._idx = 0

    def execute(self, query: str, params: Any = None):
        return self

    def fetchone(self):
        if self._idx < len(self._rows):
            r = self._rows[self._idx]
            self._idx += 1
            return r
        return None

    def fetchall(self):
        return self._rows

    def fetchval(self, col: int = 0):
        r = self.fetchone()
        return list(r.values())[col] if r else None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class MockConn:
    """Simulates a psycopg3 connection."""

    def __init__(self, rows: list[dict] | None = None):
        self._rows = rows
        self.committed = False

    def cursor(self):
        return MockCursor(self._rows)

    def commit(self):
        self.committed = True

    def rollback(self):
        pass

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


# ── pytest fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def jwt_admin() -> str:
    return make_jwt(role="admin")


@pytest.fixture
def jwt_rep() -> str:
    return make_jwt(role="rep")


@pytest.fixture
def jwt_customer() -> str:
    return make_jwt(role="customer")


@pytest.fixture
def jwt_expired() -> str:
    return make_expired_jwt()


@pytest.fixture
def mock_db() -> MagicMock:
    """Patch get_db_connection from db_sync to return a mock."""
    with patch("app.db_sync.get_db_connection") as mock:
        mock.return_value = MockConn()
        yield mock


@pytest.fixture
def mock_asyncpg(monkeypatch) -> MagicMock:
    """Patch asyncpg.connect to return an async mock."""
    mock_conn = AsyncMock()
    mock_conn.fetchval = AsyncMock(return_value=1)
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.close = AsyncMock()

    with patch("app.db.get_connection", new_callable=AsyncMock) as mock_fn:
        mock_fn.return_value = mock_conn
        yield mock_fn


# ── Async fixtures ──────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def async_client():
    """Provide a test client for the FastAPI app (async)."""
    from httpx import ASGITransport, AsyncClient
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
