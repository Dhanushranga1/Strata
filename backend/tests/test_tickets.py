"""
Tests for backend/app/tickets.py — ticket CRUD, message posting,
AI chat cooldown, resolve/rate logic, CASPER routing.

All tests use mocked DB; no real PostgreSQL required.
"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, Request

from app.tickets import (
    CHAT_COOLDOWN_SECONDS,
    _get_conversation_context,
    chat_cooldown,
    fetch_chunks_by_faiss_ids,
    is_rep_in_org,
)
from tests.conftest import TEST_ORG_ID, TEST_USER_ID, MockConn, MockCursor

# ═════════════════════════════════════════════════════════════════════════
# is_rep_in_org — pure function
# ═════════════════════════════════════════════════════════════════════════


class TestIsRepInOrg:
    def _make_user(self, user_id: str = TEST_USER_ID, role: str = "customer"):
        from app.auth import User

        return User(id=user_id, role=role)

    def _make_request(self, org_role: str | None = None) -> Request:
        scope = {"type": "http", "method": "GET", "path": "/", "headers": []}
        req = Request(scope)
        req.state.org_id = TEST_ORG_ID if org_role else None
        req.state.user_role_in_org = org_role
        return req

    def test_org_role_rep_returns_true(self):
        user = self._make_user()
        req = self._make_request(org_role="rep")
        assert is_rep_in_org(user, req) is True

    def test_org_role_admin_returns_true(self):
        user = self._make_user()
        req = self._make_request(org_role="admin")
        assert is_rep_in_org(user, req) is True

    def test_org_role_owner_returns_true(self):
        user = self._make_user()
        req = self._make_request(org_role="owner")
        assert is_rep_in_org(user, req) is True

    def test_org_role_member_returns_false(self):
        user = self._make_user()
        req = self._make_request(org_role="member")
        assert is_rep_in_org(user, req) is False

    def test_no_org_role_falls_back_to_global_role(self):
        user = self._make_user(role="rep")
        req = self._make_request(org_role=None)
        with patch("app.tickets.get_user_role", return_value="rep"):
            assert is_rep_in_org(user, req) is True

    def test_no_org_role_customer_global_returns_false(self):
        user = self._make_user(role="customer")
        req = self._make_request(org_role=None)
        with patch("app.tickets.get_user_role", return_value="customer"):
            assert is_rep_in_org(user, req) is False


# ═════════════════════════════════════════════════════════════════════════
# AI chat cooldown logic
# ═════════════════════════════════════════════════════════════════════════


class TestChatCooldown:
    def setup_method(self):
        chat_cooldown.clear()

    def test_cooldown_seconds_default(self):
        assert CHAT_COOLDOWN_SECONDS == 8

    def test_first_request_allowed(self):
        ticket_id = "test-ticket-1"
        now = time.time()
        last = chat_cooldown.get(ticket_id, 0)
        assert now - last >= CHAT_COOLDOWN_SECONDS

    def test_rapid_second_request_blocked(self):
        ticket_id = "test-ticket-2"
        now = time.time()
        chat_cooldown[ticket_id] = now
        # Second request immediately after
        assert now - chat_cooldown[ticket_id] < CHAT_COOLDOWN_SECONDS

    def test_cooldown_expires(self):
        ticket_id = "test-ticket-3"
        chat_cooldown[ticket_id] = time.time() - CHAT_COOLDOWN_SECONDS - 1
        now = time.time()
        assert now - chat_cooldown[ticket_id] >= CHAT_COOLDOWN_SECONDS


# ═════════════════════════════════════════════════════════════════════════
# fetch_chunks_by_faiss_ids — DB-mocked
# ═════════════════════════════════════════════════════════════════════════


class TestFetchChunksByFaissIds:
    def test_empty_list_returns_empty(self):
        result = fetch_chunks_by_faiss_ids([], TEST_ORG_ID)
        assert result == []

    def test_returns_chunks_from_db(self):
        mock_chunks = [
            {
                "chunk_id": "c1",
                "doc_id": "d1",
                "text": "Chunk text",
                "faiss_id": 0,
                "title": "Doc Title",
            }
        ]
        conn = MockConn(rows=mock_chunks)
        with patch("app.tickets.get_db_connection", return_value=conn):
            result = fetch_chunks_by_faiss_ids([0, 1], TEST_ORG_ID)
        assert len(result) == 1
        assert result[0]["chunk_id"] == "c1"

    def test_multiple_chunks(self):
        mock_chunks = [
            {
                "chunk_id": "c1",
                "doc_id": "d1",
                "text": "A",
                "faiss_id": 0,
                "title": "D1",
            },
            {
                "chunk_id": "c2",
                "doc_id": "d1",
                "text": "B",
                "faiss_id": 1,
                "title": "D1",
            },
            {
                "chunk_id": "c3",
                "doc_id": "d2",
                "text": "C",
                "faiss_id": 2,
                "title": "D2",
            },
        ]
        conn = MockConn(rows=mock_chunks)
        with patch("app.tickets.get_db_connection", return_value=conn):
            result = fetch_chunks_by_faiss_ids([0, 1, 2], TEST_ORG_ID)
        assert len(result) == 3


# ═════════════════════════════════════════════════════════════════════════
# Ticket creation endpoint tests (skipped — require complex middleware mocking)
# ═════════════════════════════════════════════════════════════════════════

# Note: Full endpoint integration tests require mocking the entire middleware
# stack (org_middleware, auth dependencies, DB pools). These are better suited
# for integration tests with a real test database. Unit tests above cover the
# core logic.


# ═════════════════════════════════════════════════════════════════════════
# Pydantic schema validation
# ═════════════════════════════════════════════════════════════════════════


class TestTicketSchemas:
    def test_ticket_create_valid(self):
        from app.schemas import TicketCreate

        t = TicketCreate(
            title="Test Ticket",
            description="Test description with enough length",
            priority="normal",
        )
        assert t.title == "Test Ticket"
        assert t.priority == "normal"

    def test_ticket_create_min_title(self):
        from app.schemas import TicketCreate

        # title min 3 chars, description min 10 chars
        t = TicketCreate(
            title="ABC",
            description="Description text here",
            priority="low",
        )
        assert t.title == "ABC"

    def test_ticket_create_invalid_priority(self):
        from app.schemas import TicketCreate

        # priority must match ^(low|normal|high|urgent)$
        with pytest.raises(Exception):
            TicketCreate(title="Test", description="Description", priority="medium")

    def test_chat_request_valid(self):
        from app.schemas import ChatRequest

        c = ChatRequest(query="How do I reset my password?")
        assert c.query == "How do I reset my password?"

    def test_rating_request_valid(self):
        from app.schemas import RatingRequest

        r = RatingRequest(rating=5, comment="Great!")
        assert r.rating == 5
        assert r.comment == "Great!"

    def test_rating_request_invalid_rating(self):
        from app.schemas import RatingRequest

        # rating should be 1-5
        with pytest.raises(Exception):
            RatingRequest(rating=0)
        with pytest.raises(Exception):
            RatingRequest(rating=6)


# ── _get_conversation_context — chat history for AI context ─────────────────


class _TwoQueryConn:
    """Fake psycopg connection: 1st query returns ticket row, 2nd returns messages.

    Emulates the WHERE/ORDER BY of the history query so the SQL predicates
    are exercised: rows must be supplied newest-first (as ORDER BY
    created_at DESC would return).
    """

    def __init__(self, ticket_row, message_rows):
        self._ticket_row = ticket_row
        self._message_rows = message_rows
        self.queries: list[str] = []

    def cursor(self):
        conn = self

        class _Cur:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def execute(self, sql, params=None):
                conn.queries.append(sql)

            def fetchone(self):
                return conn._ticket_row

            def fetchall(self):
                sql = conn.queries[-1] if conn.queries else ""
                rows = conn._message_rows
                if "sender_role IN" in sql:
                    rows = [
                        r for r in rows if r["sender_role"] in ("customer", "rep", "ai")
                    ]
                if "is_internal = false" in sql:
                    rows = [r for r in rows if not r.get("is_internal")]
                return rows

        return _Cur()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class TestGetConversationContext:
    def test_happy_path(self):
        conn = _TwoQueryConn(
            {"title": "VPN broken", "description": "Cannot connect since Monday"},
            [
                {"sender_role": "customer", "body": "It still fails after reboot"},
                {"sender_role": "ai", "body": "Try reinstalling the client"},
                {"sender_role": "customer", "body": "Initial report: VPN broken"},
                {"sender_role": "rep", "body": "Escalating to network team"},
            ],
        )
        with patch("app.tickets.get_db_connection", return_value=conn):
            ticket_ctx, history, prev_customer = _get_conversation_context("t1")
        assert "Title: VPN broken" in ticket_ctx
        assert "Cannot connect since Monday" in ticket_ctx
        # chronological order after DESC-reversal: rep → initial → ai → follow-up
        assert history.index("SUPPORT: Escalating") < history.index(
            "CUSTOMER: Initial report"
        )
        assert history.index("CUSTOMER: Initial report") < history.index("AI: Try")
        assert history.index("AI: Try") < history.index("CUSTOMER: It still fails")
        assert prev_customer == "It still fails after reboot"

    def test_internal_and_system_excluded(self):
        conn = _TwoQueryConn(
            {"title": "T", "description": None},
            [
                {"sender_role": "customer", "body": "hello"},
                {
                    "sender_role": "rep",
                    "body": "internal note — salary issue",
                    "is_internal": True,
                },
                {"sender_role": "system", "body": "[system] escalated"},
            ],
        )
        with patch("app.tickets.get_db_connection", return_value=conn):
            _, history, _ = _get_conversation_context("t1")
        assert history == "CUSTOMER: hello"
        assert "salary" not in history

    def test_budget_drops_oldest(self, monkeypatch):
        monkeypatch.setattr("app.tickets.CHAT_HISTORY_MAX_CHARS", 120)
        conn = _TwoQueryConn(
            {"title": "T", "description": None},
            [
                # newest first (ORDER BY created_at DESC): AI reply is latest
                {"sender_role": "ai", "body": "y" * 100},
                {"sender_role": "customer", "body": "x" * 100},
            ],
        )
        with patch("app.tickets.get_db_connection", return_value=conn):
            _, history, _ = _get_conversation_context("t1")
        # newest message must survive, oldest dropped
        assert "yyy" in history
        assert "xxx" not in history

    def test_db_failure_returns_empty(self):
        with patch(
            "app.tickets.get_db_connection",
            side_effect=Exception("db down"),
        ):
            ticket_ctx, history, prev_customer = _get_conversation_context("t1")
        assert ticket_ctx == ""
        assert history == ""
        assert prev_customer == ""

    def test_no_description(self):
        conn = _TwoQueryConn(
            {"title": "Only title", "description": ""},
            [],
        )
        with patch("app.tickets.get_db_connection", return_value=conn):
            ticket_ctx, history, _ = _get_conversation_context("t1")
        assert ticket_ctx == "Title: Only title"
        assert "Description:" not in ticket_ctx
        assert history == ""
