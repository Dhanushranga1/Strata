"""
ChangeBoard — Lightweight Change Management for SMEs.

RFC workflow: Draft → Pending Approval → Approved → Scheduled → In Progress → Completed/Failed.
High-risk changes are blocked during org-defined blackout windows.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/changes", tags=["changes"])

RISK_LEVELS = ("low", "standard", "high", "emergency")
STATUSES    = ("draft", "pending_approval", "approved", "scheduled",
               "in_progress", "completed", "failed", "cancelled")


def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"

def _require_rep(user: User):
    if _get_role(user.id) not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin required")

def _require_admin(user: User):
    if _get_role(user.id) not in ("admin", "owner"):
        raise HTTPException(403, "Admin required")


def _row(r) -> dict:
    return {
        "id":               str(r["id"]),
        "organization_id":  str(r["organization_id"]),
        "title":            r["title"],
        "description":      r.get("description"),
        "risk_level":       r["risk_level"],
        "status":           r["status"],
        "requested_by":     str(r["requested_by"]) if r.get("requested_by") else None,
        "requester_email":  r.get("requester_email"),
        "approved_by":      str(r["approved_by"]) if r.get("approved_by") else None,
        "approver_email":   r.get("approver_email"),
        "scheduled_at":     r["scheduled_at"].isoformat() if r.get("scheduled_at") else None,
        "completed_at":     r["completed_at"].isoformat() if r.get("completed_at") else None,
        "rollback_plan":    r.get("rollback_plan"),
        "linked_ticket_id": str(r["linked_ticket_id"]) if r.get("linked_ticket_id") else None,
        "blackout_check":   bool(r.get("blackout_check")),
        "notes":            r.get("notes"),
        "created_at":       r["created_at"].isoformat() if r.get("created_at") else None,
        "updated_at":       r["updated_at"].isoformat() if r.get("updated_at") else None,
    }

def _blackout_row(r) -> dict:
    return {
        "id":       str(r["id"]),
        "name":     r["name"],
        "start_at": r["start_at"].isoformat(),
        "end_at":   r["end_at"].isoformat(),
    }

_SELECT = """
    SELECT c.*,
           req.email AS requester_email,
           apr.email AS approver_email
    FROM app.changes c
    LEFT JOIN auth.users req ON req.id = c.requested_by
    LEFT JOIN auth.users apr ON apr.id = c.approved_by
"""


# ── Platform stats ─────────────────────────────────────────────────────────────

@router.get("/platform-stats")
def change_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT status, COUNT(*) FROM app.changes
               WHERE organization_id = %s
               GROUP BY status""",
            (org_id,),
        )
        counts = {r["status"]: int(r["count"]) for r in cur.fetchall()}

        cur.execute(
            """SELECT COUNT(*) FROM app.change_blackouts
               WHERE organization_id = %s AND NOW() BETWEEN start_at AND end_at""",
            (org_id,),
        )
        active_blackouts = int(cur.fetchone()[0] or 0)

    pending = counts.get("pending_approval", 0)
    in_prog = counts.get("in_progress", 0)
    health  = "warning" if active_blackouts > 0 else ("warning" if pending > 5 else "healthy")
    stats   = []
    if pending:
        stats.append(f"{pending} awaiting approval")
    if in_prog:
        stats.append(f"{in_prog} in progress")
    if active_blackouts:
        stats.append("blackout active")
    if not stats:
        total = sum(counts.values())
        stats = [f"{total} changes total"]
    return {"stats": stats, "health": health}


# ── Blackout windows ──────────────────────────────────────────────────────────

@router.get("/blackouts")
def list_blackouts(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT * FROM app.change_blackouts
               WHERE organization_id = %s
               ORDER BY start_at DESC LIMIT 50""",
            (org_id,),
        )
        rows = cur.fetchall()
    return {"blackouts": [_blackout_row(r) for r in rows]}


class BlackoutIn(BaseModel):
    name: str
    start_at: str
    end_at: str


@router.post("/blackouts", status_code=201)
def create_blackout(
    body: BlackoutIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.change_blackouts
               (organization_id, name, start_at, end_at, created_by)
               VALUES (%s, %s, %s::timestamptz, %s::timestamptz, %s::uuid)
               RETURNING *""",
            (org_id, body.name.strip(), body.start_at, body.end_at, user.id),
        )
        row = cur.fetchone()
        conn.commit()
    return _blackout_row(row)


@router.delete("/blackouts/{blackout_id}", status_code=204)
def delete_blackout(
    blackout_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM app.change_blackouts WHERE id = %s::uuid AND organization_id = %s",
            (blackout_id, org_id),
        )
        conn.commit()


# ── CRUD ───────────────────────────────────────────────────────────────────────

class ChangeIn(BaseModel):
    title: str
    description: Optional[str] = None
    risk_level: str = "standard"
    rollback_plan: Optional[str] = None
    linked_ticket_id: Optional[str] = None
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
def list_changes(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    org_id = require_org_context(request)
    conds  = ["c.organization_id = %s"]
    params: list = [org_id]
    if status:
        conds.append("c.status = %s")
        params.append(status)
    if risk_level:
        conds.append("c.risk_level = %s")
        params.append(risk_level)

    where = " AND ".join(conds)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM app.changes c WHERE {where}", params)
        total = cur.fetchone()[0]
        cur.execute(
            f"{_SELECT} WHERE {where} ORDER BY c.created_at DESC LIMIT %s OFFSET %s",
            params + [limit, offset],
        )
        rows = cur.fetchall()
    return {"changes": [_row(r) for r in rows], "total": total}


@router.post("", status_code=201)
def create_change(
    body: ChangeIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    if not body.title.strip():
        raise HTTPException(400, "Title required")
    if body.risk_level not in RISK_LEVELS:
        raise HTTPException(400, f"risk_level must be one of: {', '.join(RISK_LEVELS)}")

    # Check for active blackout window if high/emergency risk
    blackout_active = False
    if body.risk_level in ("high", "emergency"):
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT COUNT(*) FROM app.change_blackouts
                   WHERE organization_id = %s AND NOW() BETWEEN start_at AND end_at""",
                (org_id,),
            )
            blackout_active = int(cur.fetchone()[0] or 0) > 0

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.changes
               (organization_id, title, description, risk_level, rollback_plan,
                linked_ticket_id, scheduled_at, notes, requested_by, blackout_check)
               VALUES (%s, %s, %s, %s, %s, %s::uuid, %s::timestamptz, %s, %s::uuid, %s)
               RETURNING *""",
            (org_id, body.title.strip(), body.description, body.risk_level,
             body.rollback_plan, body.linked_ticket_id or None,
             body.scheduled_at or None, body.notes, user.id, blackout_active),
        )
        row = cur.fetchone()
        conn.commit()

    return _row(row)


@router.get("/{change_id}")
def get_change(
    change_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"{_SELECT} WHERE c.id = %s::uuid AND c.organization_id = %s",
            (change_id, org_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Change not found")
    return _row(row)


def _transition(change_id: str, org_id: str, user: User,
                allowed_from: tuple, new_status: str,
                extra_sets: str = "", extra_params: list = None):
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT status FROM app.changes WHERE id = %s::uuid AND organization_id = %s",
            (change_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Change not found")
        if row["status"] not in allowed_from:
            raise HTTPException(400, f"Cannot transition from '{row['status']}' to '{new_status}'")

        params = [new_status] + (extra_params or []) + [change_id, org_id]
        cur.execute(
            f"""UPDATE app.changes
               SET status = %s, {extra_sets or 'updated_at = NOW()'}
               WHERE id = %s::uuid AND organization_id = %s
               RETURNING *""",
            params,
        )
        updated = cur.fetchone()
        conn.commit()

    # Re-fetch with joined emails
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"{_SELECT} WHERE c.id = %s::uuid AND c.organization_id = %s",
            (change_id, org_id),
        )
        return _row(cur.fetchone())


@router.post("/{change_id}/submit")
def submit_change(
    change_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    return _transition(change_id, org_id, user,
                       ("draft",), "pending_approval",
                       "updated_at = NOW()")


@router.post("/{change_id}/approve")
def approve_change(
    change_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_admin(user)

    # Block high/emergency if blackout is active
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT risk_level FROM app.changes WHERE id = %s::uuid AND organization_id = %s",
            (change_id, org_id),
        )
        ch = cur.fetchone()
    if ch and ch["risk_level"] in ("high", "emergency"):
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT COUNT(*) FROM app.change_blackouts
                   WHERE organization_id = %s AND NOW() BETWEEN start_at AND end_at""",
                (org_id,),
            )
            if int(cur.fetchone()[0] or 0) > 0:
                raise HTTPException(409, "Cannot approve high/emergency change during an active blackout window")

    return _transition(change_id, org_id, user,
                       ("pending_approval",), "approved",
                       "approved_by = %s::uuid, updated_at = NOW()", [user.id])


@router.post("/{change_id}/reject")
def reject_change(
    change_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    return _transition(change_id, org_id, user,
                       ("pending_approval",), "cancelled",
                       "updated_at = NOW()")


class ScheduleIn(BaseModel):
    scheduled_at: str


@router.post("/{change_id}/schedule")
def schedule_change(
    change_id: str,
    body: ScheduleIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    return _transition(change_id, org_id, user,
                       ("approved",), "scheduled",
                       "scheduled_at = %s::timestamptz, updated_at = NOW()", [body.scheduled_at])


@router.post("/{change_id}/start")
def start_change(
    change_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    return _transition(change_id, org_id, user,
                       ("approved", "scheduled"), "in_progress",
                       "updated_at = NOW()")


class CompleteIn(BaseModel):
    outcome: str  # "completed" or "failed"
    notes: Optional[str] = None


@router.post("/{change_id}/complete")
def complete_change(
    change_id: str,
    body: CompleteIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    if body.outcome not in ("completed", "failed"):
        raise HTTPException(400, "outcome must be 'completed' or 'failed'")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT status FROM app.changes WHERE id = %s::uuid AND organization_id = %s",
            (change_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Change not found")
        if row["status"] != "in_progress":
            raise HTTPException(400, "Change must be in_progress to complete")

        cur.execute(
            """UPDATE app.changes
               SET status = %s, completed_at = NOW(),
                   notes = COALESCE(%s, notes), updated_at = NOW()
               WHERE id = %s::uuid AND organization_id = %s""",
            (body.outcome, body.notes, change_id, org_id),
        )
        conn.commit()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"{_SELECT} WHERE c.id = %s::uuid AND c.organization_id = %s",
            (change_id, org_id),
        )
        return _row(cur.fetchone())


@router.delete("/{change_id}", status_code=204)
def delete_change(
    change_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("change_board"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM app.changes WHERE id = %s::uuid AND organization_id = %s AND status = 'draft'",
            (change_id, org_id),
        )
        conn.commit()
