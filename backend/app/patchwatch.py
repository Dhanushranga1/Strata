"""
PatchWatch — Patch Management for SMEs.

Tracks patches per asset and severity. Surfaces critical unpatched items.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/patches", tags=["patches"])

SEVERITIES = ("critical", "high", "medium", "low")
STATUSES   = ("needed", "scheduled", "applied", "deferred", "not_applicable")


def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"

def _require_rep(user: User):
    if _get_role(user.id) not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin required")


class PatchIn(BaseModel):
    patch_name: str
    cve_id: Optional[str] = None
    patch_severity: str = "medium"
    asset_id: Optional[str] = None
    status: str = "needed"
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None


class StatusUpdateIn(BaseModel):
    status: str
    notes: Optional[str] = None


def _row(r) -> dict:
    return {
        "id":             str(r["id"]),
        "organization_id":str(r["organization_id"]),
        "asset_id":       str(r["asset_id"]) if r.get("asset_id") else None,
        "asset_name":     r.get("asset_name"),
        "asset_tag":      r.get("asset_tag"),
        "patch_name":     r["patch_name"],
        "cve_id":         r.get("cve_id"),
        "patch_severity": r["patch_severity"],
        "status":         r["status"],
        "scheduled_at":   r["scheduled_at"].isoformat() if r.get("scheduled_at") else None,
        "applied_at":     r["applied_at"].isoformat() if r.get("applied_at") else None,
        "applied_by":     str(r["applied_by"]) if r.get("applied_by") else None,
        "notes":          r.get("notes"),
        "created_at":     r["created_at"].isoformat() if r.get("created_at") else None,
        "updated_at":     r["updated_at"].isoformat() if r.get("updated_at") else None,
    }


_SELECT = """
    SELECT pr.*,
           a.name AS asset_name, a.asset_tag AS asset_tag
    FROM app.patch_records pr
    LEFT JOIN app.assets a ON a.id = pr.asset_id
"""


# ── Platform stats ─────────────────────────────────────────────────────────────

@router.get("/platform-stats")
def patch_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("patches"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT patch_severity, COUNT(*) FROM app.patch_records
               WHERE organization_id = %s AND status = 'needed'
               GROUP BY patch_severity""",
            (org_id,),
        )
        rows = {r["patch_severity"]: int(r["count"]) for r in cur.fetchall()}

    critical = rows.get("critical", 0)
    total    = sum(rows.values())
    health   = "critical" if critical > 0 else "warning" if total > 10 else "healthy"
    stats    = [f"{total} patches needed"]
    if critical:
        stats.append(f"{critical} critical")
    return {"stats": stats, "health": health}


# ── Dashboard summary ─────────────────────────────────────────────────────────

@router.get("/dashboard")
def patch_dashboard(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("patches"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Counts by severity × status
        cur.execute(
            """SELECT patch_severity, status, COUNT(*)
               FROM app.patch_records WHERE organization_id = %s
               GROUP BY patch_severity, status""",
            (org_id,),
        )
        matrix: dict = {}
        for r in cur.fetchall():
            sev = r["patch_severity"]
            st  = r["status"]
            matrix.setdefault(sev, {})[st] = int(r["count"])

        # Overdue critical (needed + no schedule or scheduled in the past)
        cur.execute(
            """SELECT COUNT(*) FROM app.patch_records
               WHERE organization_id = %s AND status IN ('needed', 'scheduled')
               AND patch_severity = 'critical'
               AND (scheduled_at IS NULL OR scheduled_at < NOW())""",
            (org_id,),
        )
        overdue_critical = int(cur.fetchone()[0] or 0)

        # Scheduled next 7 days
        cur.execute(
            """SELECT COUNT(*) FROM app.patch_records
               WHERE organization_id = %s AND status = 'scheduled'
               AND scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'""",
            (org_id,),
        )
        scheduled_week = int(cur.fetchone()[0] or 0)

    sev_summary = []
    for sev in SEVERITIES:
        counts = matrix.get(sev, {})
        needed = counts.get("needed", 0) + counts.get("scheduled", 0)
        applied = counts.get("applied", 0)
        total_sev = sum(counts.values())
        pct = round(applied / total_sev * 100) if total_sev else 0
        sev_summary.append({
            "severity": sev,
            "needed": needed,
            "applied": applied,
            "total": total_sev,
            "pct_patched": pct,
        })

    return {
        "severity_summary":  sev_summary,
        "overdue_critical":  overdue_critical,
        "scheduled_week":    scheduled_week,
    }


# ── CRUD ───────────────────────────────────────────────────────────────────────

@router.get("")
def list_patches(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("patches"),
    severity: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    asset_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    org_id = require_org_context(request)
    conds  = ["pr.organization_id = %s"]
    params: list = [org_id]
    if severity:
        conds.append("pr.patch_severity = %s")
        params.append(severity)
    if status_filter:
        conds.append("pr.status = %s")
        params.append(status_filter)
    if asset_id:
        conds.append("pr.asset_id = %s::uuid")
        params.append(asset_id)

    where = " AND ".join(conds)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM app.patch_records pr WHERE {where}", params)
        total = cur.fetchone()[0]
        cur.execute(
            f"{_SELECT} WHERE {where} ORDER BY "
            "CASE pr.patch_severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, "
            "pr.created_at DESC LIMIT %s OFFSET %s",
            params + [limit, offset],
        )
        rows = cur.fetchall()

    return {"patches": [_row(r) for r in rows], "total": total}


@router.post("", status_code=201)
def create_patch(
    body: PatchIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("patches"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    if not body.patch_name.strip():
        raise HTTPException(400, "Patch name required")
    if body.patch_severity not in SEVERITIES:
        raise HTTPException(400, f"severity must be one of: {', '.join(SEVERITIES)}")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.patch_records
               (organization_id, asset_id, patch_name, cve_id, patch_severity, status, scheduled_at, notes)
               VALUES (%s, %s::uuid, %s, %s, %s, %s, %s::timestamptz, %s)
               RETURNING *""",
            (org_id,
             body.asset_id or None,
             body.patch_name.strip(), body.cve_id,
             body.patch_severity, body.status,
             body.scheduled_at or None, body.notes),
        )
        row = cur.fetchone()
        conn.commit()

    return _row(row)


@router.put("/{patch_id}/status")
def update_patch_status(
    patch_id: str,
    body: StatusUpdateIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("patches"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    if body.status not in STATUSES:
        raise HTTPException(400, f"status must be one of: {', '.join(STATUSES)}")

    applied_at  = "NOW()" if body.status == "applied" else "NULL"
    applied_by  = user.id if body.status == "applied" else None

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""UPDATE app.patch_records
               SET status = %s, applied_at = {applied_at}, applied_by = %s::uuid,
                   notes = COALESCE(%s, notes), updated_at = NOW()
               WHERE id = %s::uuid AND organization_id = %s
               RETURNING *""",
            (body.status, applied_by, body.notes, patch_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Patch record not found")
        conn.commit()

    return _row(row)


@router.delete("/{patch_id}", status_code=204)
def delete_patch(
    patch_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("patches"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM app.patch_records WHERE id = %s::uuid AND organization_id = %s",
            (patch_id, org_id),
        )
        conn.commit()
