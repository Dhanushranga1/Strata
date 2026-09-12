"""Entitlements — feature-gating for Open Core tiers.

Public API:
  get_entitlements(org_id)  ->  OrgEntitlements   (60 s TTL cache)
  requires_feature(name)    ->  FastAPI Depends decorator (raises HTTP 402)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from ..db_sync import get_db_connection
from ..org_middleware import require_org_context
from .models import OrgEntitlements
from .plans import FEATURE_MIN_PLAN, PLANS

logger = logging.getLogger(__name__)

_CACHE_TTL = 60  # seconds
_cache: dict[str, tuple[OrgEntitlements, datetime]] = {}


def get_entitlements(org_id: str) -> OrgEntitlements:
    """Return entitlements for org_id, using a 60-second stale-serving cache."""
    now = datetime.utcnow()
    cached = _cache.get(org_id)
    if cached:
        ent, expires_at = cached
        if now < expires_at:
            return ent
        # stale — serve while refreshing below

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT plan_id FROM app.organizations WHERE id = %s",
                    (org_id,),
                )
                row = cur.fetchone()
                plan_id: str = (row["plan_id"] if row else None) or "community"

                cur.execute(
                    """
                    SELECT ai_queries_used FROM app.org_usage
                    WHERE organization_id = %s
                      AND month_start = date_trunc('month', CURRENT_DATE)::date
                    """,
                    (org_id,),
                )
                usage_row = cur.fetchone()
                ai_queries_used: int = usage_row["ai_queries_used"] if usage_row else 0

        plan = PLANS.get(plan_id, PLANS["community"])
        ent = OrgEntitlements(
            plan_id=plan_id,
            features=plan["features"],
            limits=plan["limits"],
            ai_queries_used=ai_queries_used,
        )
        _cache[org_id] = (ent, now + timedelta(seconds=_CACHE_TTL))
        return ent

    except Exception:
        logger.exception("Failed to fetch entitlements for org %s", org_id)
        if cached:
            ent, _ = cached
            _cache[org_id] = (ent, now + timedelta(seconds=_CACHE_TTL))
            return ent
        # Fallback: community-tier entitlements (fail safe, not fail closed)
        plan = PLANS["community"]
        return OrgEntitlements(
            plan_id="community",
            features=plan["features"],
            limits=plan["limits"],
        )


def requires_feature(feature_name: str) -> Callable:
    """FastAPI dependency — raises HTTP 402 if the org lacks the feature."""

    def dependency(request: Request) -> None:
        org_id = require_org_context(request)
        ent = get_entitlements(org_id)
        if not ent.features.get(feature_name, False):
            upgrade_to = FEATURE_MIN_PLAN.get(feature_name, "starter")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "code": "feature_not_available",
                    "feature": feature_name,
                    "upgrade_to": upgrade_to,
                },
            )

    return Depends(dependency)


def increment_ai_query(org_id: str) -> None:
    """Increment ai_queries_used for the current month. Raises HTTP 402 if quota exhausted.

    Atomic: the UPDATE rejects the increment server-side when the limit is
    already reached (no check-then-increment race under concurrency).
    """
    ent = get_entitlements(org_id)
    limit = ent.limits.get("ai_queries", 0)

    # -1 means unlimited (enterprise)
    if limit == -1:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO app.org_usage (organization_id, month_start, ai_queries_used)
                        VALUES (%s, date_trunc('month', CURRENT_DATE)::date, 1)
                        ON CONFLICT (organization_id, month_start)
                        DO UPDATE SET ai_queries_used = app.org_usage.ai_queries_used + 1
                        """,
                        (org_id,),
                    )
                conn.commit()
            _cache.pop(org_id, None)
        except Exception:
            logger.warning("Failed to increment AI query count for org %s", org_id)
        return

    if limit == 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "ai_quota_exhausted",
                "message": "AI queries not available on your plan. Upgrade to use AI features.",
                "upgrade_to": "starter",
            },
        )

    # Single-statement quota check + increment — the UPDATE's WHERE clause
    # is the source of truth, so concurrent requests cannot overrun.
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app.org_usage (organization_id, month_start, ai_queries_used)
                VALUES (%s, date_trunc('month', CURRENT_DATE)::date, 1)
                ON CONFLICT (organization_id, month_start)
                DO UPDATE SET ai_queries_used = app.org_usage.ai_queries_used + 1
                WHERE app.org_usage.ai_queries_used < %s
                """,
                (org_id, limit),
            )
            incremented = cur.rowcount == 1
        conn.commit()
    _cache.pop(org_id, None)

    if not incremented:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "ai_quota_exhausted",
                "message": f"Monthly AI query limit reached ({limit}). Resets next month or upgrade.",
                "used": limit,
                "limit": limit,
                "upgrade_to": "business",
            },
        )


def enforce_agent_seat(org_id: str) -> None:
    """Raise HTTP 402 if the org is at its plan's team-member cap.

    Call BEFORE inserting into app.organization_members (non-founder
    paths: add member, invite accept, admin add). -1 = unlimited.
    """
    ent = get_entitlements(org_id)
    limit = ent.limits.get("agents", -1)
    if limit == -1:
        return
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM app.organization_members WHERE organization_id = %s",
                (org_id,),
            )
            current = cur.fetchone()["n"]
    if current >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "agent_seat_limit",
                "message": (
                    f"Team member limit reached ({limit} on the "
                    f"{ent.plan_id} plan). Upgrade to add more members."
                ),
                "used": current,
                "limit": limit,
                "upgrade_to": "business",
            },
        )


__all__ = [
    "get_entitlements",
    "requires_feature",
    "increment_ai_query",
    "enforce_agent_seat",
    "OrgEntitlements",
]
