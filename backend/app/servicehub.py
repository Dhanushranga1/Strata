"""
ServiceHub — Employee Self-Service Portal.

Two surfaces:
  1. /api/portal/{org_slug}/... — public, no auth
  2. /api/servicehub/...       — authenticated admin management
"""
from __future__ import annotations

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(tags=["servicehub"])

# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"

def _require_rep(user: User):
    if _get_role(user.id) not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin required")

def _row(r) -> dict:
    return {
        "id":               str(r["id"]),
        "organization_id":  str(r["organization_id"]),
        "name":             r["name"],
        "description":      r.get("description"),
        "category":         r.get("category"),
        "icon":             r.get("icon") or "LayoutGrid",
        "form_schema":      r["form_schema"] if r.get("form_schema") is not None else [],
        "auto_assign_role": r.get("auto_assign_role"),
        "sla_priority":     r.get("sla_priority", 3),
        "estimated_time":   r.get("estimated_time"),
        "sort_order":       r.get("sort_order", 0),
        "is_active":        bool(r.get("is_active", True)),
        "is_public":        bool(r.get("is_public", False)),
        "created_at":       r["created_at"].isoformat() if r.get("created_at") else None,
    }

def _org_by_slug(slug: str) -> Optional[dict]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name FROM app.organizations WHERE slug = %s",
            (slug,),
        )
        return cur.fetchone()


# ── Admin management (/api/servicehub) ────────────────────────────────────────

admin_router = APIRouter(prefix="/api/servicehub")


class CatalogIn(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    icon: str = "LayoutGrid"
    form_schema: list = []
    auto_assign_role: Optional[str] = None
    sla_priority: int = 3
    estimated_time: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    is_public: bool = False


@admin_router.get("/catalog")
def list_catalog(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("service_hub"),
    include_inactive: bool = False,
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        if include_inactive:
            cur.execute(
                "SELECT * FROM app.service_catalog WHERE organization_id = %s ORDER BY sort_order, name",
                (org_id,),
            )
        else:
            cur.execute(
                "SELECT * FROM app.service_catalog WHERE organization_id = %s AND is_active = true ORDER BY sort_order, name",
                (org_id,),
            )
        rows = cur.fetchall()
    return {"catalog": [_row(r) for r in rows]}


@admin_router.post("/catalog", status_code=201)
def create_catalog_item(
    body: CatalogIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("service_hub"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    import json
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.service_catalog
               (organization_id, name, description, category, icon, form_schema,
                auto_assign_role, sla_priority, estimated_time, sort_order,
                is_active, is_public, created_by)
               VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s::uuid)
               RETURNING *""",
            (org_id, body.name.strip(), body.description, body.category, body.icon,
             json.dumps(body.form_schema), body.auto_assign_role,
             body.sla_priority, body.estimated_time, body.sort_order,
             body.is_active, body.is_public, user.id),
        )
        row = cur.fetchone()
        conn.commit()
    return _row(row)


@admin_router.patch("/catalog/{item_id}")
def update_catalog_item(
    item_id: str,
    body: CatalogIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("service_hub"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    import json
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE app.service_catalog
               SET name=%s, description=%s, category=%s, icon=%s, form_schema=%s::jsonb,
                   auto_assign_role=%s, sla_priority=%s, estimated_time=%s,
                   sort_order=%s, is_active=%s, is_public=%s, updated_at=NOW()
               WHERE id=%s::uuid AND organization_id=%s RETURNING *""",
            (body.name.strip(), body.description, body.category, body.icon,
             json.dumps(body.form_schema), body.auto_assign_role,
             body.sla_priority, body.estimated_time, body.sort_order,
             body.is_active, body.is_public, item_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Catalog item not found")
        conn.commit()
    return _row(row)


@admin_router.delete("/catalog/{item_id}", status_code=204)
def delete_catalog_item(
    item_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("service_hub"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM app.service_catalog WHERE id=%s::uuid AND organization_id=%s",
            (item_id, org_id),
        )
        conn.commit()


@admin_router.get("/platform-stats")
def servicehub_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("service_hub"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM app.service_catalog WHERE organization_id=%s AND is_active=true",
            (org_id,),
        )
        active = int(cur.fetchone()[0] or 0)
        cur.execute(
            "SELECT COUNT(*) FROM app.service_catalog WHERE organization_id=%s AND is_public=true AND is_active=true",
            (org_id,),
        )
        public = int(cur.fetchone()[0] or 0)
    stats = [f"{active} services"] if active else ["No services yet"]
    if public:
        stats.append(f"{public} public")
    return {"stats": stats, "health": "healthy"}


# ── Public portal (/api/portal/{org_slug}) ─────────────────────────────────────

portal_router = APIRouter(prefix="/api/portal")


@portal_router.get("/{org_slug}/catalog")
def portal_catalog(org_slug: str):
    org = _org_by_slug(org_slug)
    if not org:
        raise HTTPException(404, "Organisation not found")
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT * FROM app.service_catalog
               WHERE organization_id=%s AND is_public=true AND is_active=true
               ORDER BY sort_order, name""",
            (str(org["id"]),),
        )
        rows = cur.fetchall()
    return {
        "org_name": org["name"],
        "catalog": [_row(r) for r in rows],
    }


@portal_router.get("/{org_slug}/kb")
def portal_kb(org_slug: str, q: Optional[str] = None):
    org = _org_by_slug(org_slug)
    if not org:
        raise HTTPException(404, "Organisation not found")
    with get_db_connection() as conn:
        cur = conn.cursor()
        if q:
            cur.execute(
                """SELECT id, title, category, view_count FROM app.knowledge_articles
                   WHERE organization_id=%s AND is_public=true AND is_published=true
                   AND (title ILIKE %s OR content ILIKE %s)
                   ORDER BY view_count DESC LIMIT 10""",
                (str(org["id"]), f"%{q}%", f"%{q}%"),
            )
        else:
            cur.execute(
                """SELECT id, title, category, view_count FROM app.knowledge_articles
                   WHERE organization_id=%s AND is_public=true AND is_published=true
                   ORDER BY view_count DESC LIMIT 5""",
                (str(org["id"]),),
            )
        articles = [{"id": str(r["id"]), "title": r["title"], "category": r.get("category"), "view_count": r.get("view_count", 0)} for r in cur.fetchall()]
    return {"articles": articles}


class PortalRequestIn(BaseModel):
    form_data: dict
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None


@portal_router.post("/{org_slug}/request/{catalog_id}", status_code=201)
def portal_submit(org_slug: str, catalog_id: str, body: PortalRequestIn):
    org = _org_by_slug(org_slug)
    if not org:
        raise HTTPException(404, "Organisation not found")
    org_id = str(org["id"])

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM app.service_catalog WHERE id=%s::uuid AND organization_id=%s AND is_public=true AND is_active=true",
            (catalog_id, org_id),
        )
        item = cur.fetchone()
    if not item:
        raise HTTPException(404, "Service not found")

    requester = body.requester_name or body.form_data.get("requester_name") or "Anonymous"
    title = f"{item['name']} — {requester}"

    # Build structured description from form data
    lines = [f"**Service:** {item['name']}"]
    if body.requester_name:
        lines.append(f"**Requester:** {body.requester_name}")
    if body.requester_email:
        lines.append(f"**Email:** {body.requester_email}")
    for k, v in body.form_data.items():
        if k not in ("requester_name", "requester_email") and v:
            label = k.replace("_", " ").title()
            lines.append(f"**{label}:** {v}")
    description = "\n".join(lines)

    priority_map = {1: "urgent", 2: "high", 3: "medium", 4: "low", 5: "low"}
    priority = priority_map.get(item.get("sla_priority", 3), "medium")

    import json
    meta = json.dumps({"source": "portal", "catalog_id": catalog_id, "catalog_name": item["name"]})

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.tickets
               (organization_id, title, description, status, priority, meta)
               VALUES (%s, %s, %s, 'open', %s, %s::jsonb)
               RETURNING id""",
            (org_id, title, description, priority, meta),
        )
        ticket_id = str(cur.fetchone()["id"])
        conn.commit()

    return {
        "ticket_id": ticket_id,
        "estimated_time": item.get("estimated_time") or "We'll get back to you soon",
        "message": "Your request has been received. The IT team has been notified.",
    }


# Combine into the main router (exported as `router`)
router.include_router(admin_router)
router.include_router(portal_router)
