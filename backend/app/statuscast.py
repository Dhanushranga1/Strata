"""
StatusCast — Public Service Status Page.

Public /api/statuscast/public/{org_slug} — no auth.
Admin /api/statuscast/* — authenticated.
"""
from __future__ import annotations

import logging
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statuscast", tags=["statuscast"])

STATUS_ORDER = ("operational", "maintenance", "degraded", "partial_outage", "major_outage")

def _worst_status(statuses: list) -> str:
    if not statuses:
        return "operational"
    return max(statuses, key=lambda s: STATUS_ORDER.index(s) if s in STATUS_ORDER else 0)

def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"

def _require_rep(user: User):
    if _get_role(user.id) not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin required")

def _org_by_slug(slug: str):
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM app.organizations WHERE slug=%s", (slug,))
        return cur.fetchone()


# ── Public endpoints ───────────────────────────────────────────────────────────

@router.get("/public/{org_slug}")
def public_status(org_slug: str):
    org = _org_by_slug(org_slug)
    if not org:
        raise HTTPException(404, "Organisation not found")
    org_id = str(org["id"])

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM app.status_services WHERE organization_id=%s AND is_active=true ORDER BY sort_order, name",
            (org_id,),
        )
        services = cur.fetchall()
        cur.execute(
            """SELECT sh.*, ss.name AS service_name
               FROM app.status_history sh
               LEFT JOIN app.status_services ss ON ss.id = sh.service_id
               WHERE sh.organization_id=%s
               ORDER BY sh.created_at DESC LIMIT 30""",
            (org_id,),
        )
        history = cur.fetchall()
        cur.execute(
            "SELECT created_at FROM app.status_history WHERE organization_id=%s ORDER BY created_at DESC LIMIT 1",
            (org_id,),
        )
        last_row = cur.fetchone()

    svc_statuses = [s["current_status"] for s in services]
    overall = _worst_status(svc_statuses)
    last_updated = last_row["created_at"].isoformat() if last_row else None

    return {
        "org_name": org["name"],
        "overall_status": overall,
        "last_updated": last_updated,
        "services": [
            {"id": str(s["id"]), "name": s["name"], "status": s["current_status"], "description": s.get("description")}
            for s in services
        ],
        "recent_history": [
            {
                "id": str(h["id"]),
                "title": h["title"],
                "body": h.get("body"),
                "status_impact": h["status_impact"],
                "service_name": h.get("service_name"),
                "created_at": h["created_at"].isoformat() if h.get("created_at") else None,
            }
            for h in history
        ],
    }


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/platform-stats")
def statuscast_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("status_cast"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT current_status FROM app.status_services WHERE organization_id=%s AND is_active=true",
            (org_id,),
        )
        statuses = [r["current_status"] for r in cur.fetchall()]
    overall = _worst_status(statuses)
    health = "healthy" if overall == "operational" else "critical" if overall == "major_outage" else "warning"
    label_map = {
        "operational": "All systems operational",
        "degraded": "Degraded performance",
        "partial_outage": "Partial outage",
        "major_outage": "Major outage",
        "maintenance": "Under maintenance",
    }
    return {"stats": [label_map.get(overall, overall)], "health": health}


class ServiceIn(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    current_status: str = "operational"


@router.get("/services")
def list_services(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("status_cast"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM app.status_services WHERE organization_id=%s ORDER BY sort_order, name", (org_id,))
        rows = cur.fetchall()
    return {"services": [{"id": str(r["id"]), "name": r["name"], "description": r.get("description"), "sort_order": r["sort_order"], "is_active": bool(r["is_active"]), "current_status": r["current_status"]} for r in rows]}


@router.post("/services", status_code=201)
def create_service(
    body: ServiceIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("status_cast"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO app.status_services (organization_id, name, description, sort_order, current_status) VALUES (%s,%s,%s,%s,%s) RETURNING *",
            (org_id, body.name.strip(), body.description, body.sort_order, body.current_status),
        )
        row = cur.fetchone()
        conn.commit()
    return {"id": str(row["id"]), "name": row["name"], "current_status": row["current_status"]}


@router.patch("/services/{service_id}")
def update_service(
    service_id: str,
    body: ServiceIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("status_cast"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE app.status_services SET name=%s, description=%s, sort_order=%s, current_status=%s WHERE id=%s::uuid AND organization_id=%s RETURNING *",
            (body.name.strip(), body.description, body.sort_order, body.current_status, service_id, org_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Service not found")
        conn.commit()
    return {"updated": True}


@router.delete("/services/{service_id}", status_code=204)
def delete_service(
    service_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("status_cast"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM app.status_services WHERE id=%s::uuid AND organization_id=%s", (service_id, org_id))
        conn.commit()


class StatusPostIn(BaseModel):
    title: str
    body: Optional[str] = None
    status_impact: str = "none"
    service_id: Optional[str] = None
    service_status: Optional[str] = None  # new status for the service
    incident_id: Optional[str] = None


@router.post("/post", status_code=201)
def post_update(
    body: StatusPostIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("status_cast"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        if body.service_id and body.service_status:
            cur.execute(
                "UPDATE app.status_services SET current_status=%s WHERE id=%s::uuid AND organization_id=%s",
                (body.service_status, body.service_id, org_id),
            )
        cur.execute(
            """INSERT INTO app.status_history
               (organization_id, service_id, title, body, status_impact, incident_id, posted_by)
               VALUES (%s,%s::uuid,%s,%s,%s,%s::uuid,%s::uuid) RETURNING id""",
            (org_id, body.service_id or None, body.title.strip(), body.body,
             body.status_impact, body.incident_id or None, user.id),
        )
        row = cur.fetchone()
        conn.commit()
    return {"id": str(row["id"])}
