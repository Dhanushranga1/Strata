"""
IncidentBridge — Incident Management & Post-Mortem.

War room for P1/P2 incidents with live timeline, commander, stakeholder comms.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/incidents", tags=["incidentbridge"])

SEVERITIES = ("p1", "p2", "p3", "p4")
STATUSES   = ("active", "investigating", "identified", "monitoring", "resolved")


def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"

def _require_rep(user: User):
    if _get_role(user.id) not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin required")

def _row(r, user_email: str = "") -> dict:
    return {
        "id":               str(r["id"]),
        "title":            r["title"],
        "description":      r.get("description"),
        "severity":         r["severity"],
        "status":           r["status"],
        "commander_id":     str(r["commander_id"]) if r.get("commander_id") else None,
        "commander_email":  r.get("commander_email"),
        "root_cause":       r.get("root_cause"),
        "resolution":       r.get("resolution"),
        "timeline":         r["timeline"] if r.get("timeline") is not None else [],
        "affected_services":list(r.get("affected_services") or []),
        "linked_ticket_ids":[str(x) for x in (r.get("linked_ticket_ids") or [])],
        "linked_change_id": str(r["linked_change_id"]) if r.get("linked_change_id") else None,
        "declared_at":      r["declared_at"].isoformat() if r.get("declared_at") else None,
        "resolved_at":      r["resolved_at"].isoformat() if r.get("resolved_at") else None,
        "postmortem_done":  bool(r.get("postmortem_done")),
        "duration_minutes": None if not r.get("resolved_at") else int((r["resolved_at"] - r["declared_at"]).total_seconds() / 60) if r.get("declared_at") else None,
        "created_at":       r["created_at"].isoformat() if r.get("created_at") else None,
    }

_SELECT = """
    SELECT i.*, u.email AS commander_email
    FROM app.incidents i
    LEFT JOIN auth.users u ON u.id = i.commander_id
"""


class IncidentIn(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "p2"
    commander_id: Optional[str] = None
    affected_services: List[str] = []
    linked_ticket_ids: List[str] = []
    linked_change_id: Optional[str] = None


class IncidentUpdateIn(BaseModel):
    message: str
    new_status: Optional[str] = None


class ResolveIn(BaseModel):
    resolution: str
    root_cause: Optional[str] = None


class PostmortemIn(BaseModel):
    root_cause: str
    timeline_summary: Optional[str] = None
    contributing_factors: Optional[str] = None
    what_went_well: Optional[str] = None
    what_went_poorly: Optional[str] = None
    action_items: List[dict] = []


# ── Platform stats ─────────────────────────────────────────────────────────────

@router.get("/platform-stats")
def incident_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT status, COUNT(*) FROM app.incidents WHERE organization_id=%s GROUP BY status",
            (org_id,),
        )
        counts = {r["status"]: int(r["count"]) for r in cur.fetchall()}
        cur.execute(
            "SELECT COUNT(*) FROM app.incidents WHERE organization_id=%s AND postmortem_done=false AND status='resolved'",
            (org_id,),
        )
        pending_pm = int(cur.fetchone()[0] or 0)

    active = sum(counts.get(s, 0) for s in ("active", "investigating", "identified", "monitoring"))
    critical_active = active > 0
    stats = [f"{active} active incident{'s' if active != 1 else ''}"] if active else ["0 active incidents"]
    if pending_pm:
        stats.append(f"{pending_pm} postmortem{'s' if pending_pm != 1 else ''} pending")
    return {"stats": stats, "health": "critical" if critical_active else "healthy"}


@router.get("/active")
def list_active(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"{_SELECT} WHERE i.organization_id=%s AND i.status NOT IN ('resolved') AND i.severity IN ('p1','p2') ORDER BY i.declared_at DESC",
            (org_id,),
        )
        rows = cur.fetchall()
    return {"incidents": [_row(r) for r in rows]}


@router.get("")
def list_incidents(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    org_id = require_org_context(request)
    conds = ["i.organization_id=%s"]
    params: list = [org_id]
    if severity:
        conds.append("i.severity=%s"); params.append(severity)
    if status:
        conds.append("i.status=%s"); params.append(status)
    where = " AND ".join(conds)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM app.incidents i WHERE {where}", params)
        total = int(cur.fetchone()[0])
        cur.execute(f"{_SELECT} WHERE {where} ORDER BY i.declared_at DESC LIMIT %s OFFSET %s", params + [limit, offset])
        rows = cur.fetchall()
    return {"incidents": [_row(r) for r in rows], "total": total}


@router.post("", status_code=201)
def declare_incident(
    body: IncidentIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    if body.severity not in SEVERITIES:
        raise HTTPException(400, f"severity must be one of: {', '.join(SEVERITIES)}")

    initial_entry = json.dumps([{
        "ts": datetime.utcnow().isoformat(),
        "actor_id": str(user.id),
        "action": "Incident declared",
    }])

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.incidents
               (organization_id, title, description, severity, status, commander_id,
                affected_services, linked_ticket_ids, linked_change_id, timeline)
               VALUES (%s,%s,%s,%s,'active',%s::uuid,%s::text[],%s::uuid[],%s::uuid,%s::jsonb)
               RETURNING *""",
            (org_id, body.title.strip(), body.description, body.severity,
             body.commander_id or None,
             list(body.affected_services), list(body.linked_ticket_ids),
             body.linked_change_id or None, initial_entry),
        )
        row = cur.fetchone()
        conn.commit()
    return _row(row)


@router.get("/{incident_id}")
def get_incident(
    incident_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"{_SELECT} WHERE i.id=%s::uuid AND i.organization_id=%s", (incident_id, org_id))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Incident not found")
    return _row(row)


@router.post("/{incident_id}/update")
def add_update(
    incident_id: str,
    body: IncidentUpdateIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    if body.new_status and body.new_status not in STATUSES:
        raise HTTPException(400, f"status must be one of: {', '.join(STATUSES)}")

    entry: dict = {
        "ts":      datetime.utcnow().isoformat(),
        "actor_id": str(user.id),
        "action":  body.message,
    }
    if body.new_status:
        entry["status_change"] = body.new_status

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE app.incidents
               SET timeline = timeline || %s::jsonb,
                   status   = COALESCE(%s, status),
                   updated_at = NOW()
               WHERE id=%s::uuid AND organization_id=%s
               RETURNING *""",
            (json.dumps([entry]), body.new_status, incident_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Incident not found")
        conn.commit()
    return _row(row)


@router.post("/{incident_id}/resolve")
def resolve_incident(
    incident_id: str,
    body: ResolveIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    entry = json.dumps([{
        "ts": datetime.utcnow().isoformat(),
        "actor_id": str(user.id),
        "action": f"Incident resolved. {body.resolution}",
        "status_change": "resolved",
    }])
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE app.incidents
               SET status='resolved', resolved_at=NOW(), resolution=%s,
                   root_cause=COALESCE(%s, root_cause),
                   timeline=timeline || %s::jsonb, updated_at=NOW()
               WHERE id=%s::uuid AND organization_id=%s RETURNING *""",
            (body.resolution, body.root_cause, entry, incident_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Incident not found")
        conn.commit()
    return _row(row)


@router.post("/{incident_id}/postmortem", status_code=201)
def upsert_postmortem(
    incident_id: str,
    body: PostmortemIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.incidents WHERE id=%s::uuid AND organization_id=%s", (incident_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Incident not found")
        cur.execute(
            """INSERT INTO app.incident_postmortems
               (incident_id, root_cause, timeline_summary, contributing_factors,
                what_went_well, what_went_poorly, action_items, written_by)
               VALUES (%s::uuid,%s,%s,%s,%s,%s,%s::jsonb,%s::uuid)
               ON CONFLICT (incident_id) DO UPDATE
               SET root_cause=%s, timeline_summary=%s, contributing_factors=%s,
                   what_went_well=%s, what_went_poorly=%s, action_items=%s::jsonb,
                   written_by=%s::uuid, updated_at=NOW()
               RETURNING *""",
            (incident_id, body.root_cause, body.timeline_summary, body.contributing_factors,
             body.what_went_well, body.what_went_poorly, json.dumps(body.action_items), user.id,
             body.root_cause, body.timeline_summary, body.contributing_factors,
             body.what_went_well, body.what_went_poorly, json.dumps(body.action_items), user.id),
        )
        row = cur.fetchone()
        cur.execute(
            "UPDATE app.incidents SET postmortem_done=true, updated_at=NOW() WHERE id=%s::uuid",
            (incident_id,),
        )
        conn.commit()
    return {
        "id": str(row["id"]),
        "incident_id": str(row["incident_id"]),
        "root_cause": row["root_cause"],
        "action_items": row["action_items"] if row.get("action_items") is not None else [],
        "written_by": str(row["written_by"]) if row.get("written_by") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


@router.delete("/{incident_id}", status_code=204)
def delete_incident(
    incident_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("incidents"),
):
    org_id = require_org_context(request)
    if _get_role(user.id) not in ("admin", "owner"):
        raise HTTPException(403, "Admin required")
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM app.incidents WHERE id=%s::uuid AND organization_id=%s", (incident_id, org_id))
        conn.commit()
