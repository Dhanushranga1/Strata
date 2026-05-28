"""
ProcureFlow — Procurement & Purchase Approvals.

Workflow: pending → approved/rejected → ordered → delivered → (asset auto-created)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/procurement", tags=["procurement"])


# ── Permission helpers ─────────────────────────────────────────────────────────

def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"

def _require_rep(user: User):
    role = _get_role(user.id)
    if role not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin required")
    return role

def _require_admin(user: User):
    role = _get_role(user.id)
    if role not in ("admin", "owner"):
        raise HTTPException(403, "Admin required")
    return role


# ── Pydantic models ────────────────────────────────────────────────────────────

class PurchaseRequestIn(BaseModel):
    title: str
    description: Optional[str] = None
    quantity: int = 1
    unit_price: Optional[float] = None
    vendor_id: Optional[str] = None
    department: Optional[str] = None
    justification: Optional[str] = None
    notes: Optional[str] = None


class StatusUpdateIn(BaseModel):
    status: str
    po_number: Optional[str] = None
    notes: Optional[str] = None


class DeliverIn(BaseModel):
    notes: Optional[str] = None
    create_asset: bool = False
    asset_name: Optional[str] = None
    asset_category: Optional[str] = None


def _row_to_dict(r) -> dict:
    total = None
    if r.get("quantity") and r.get("unit_price") is not None:
        total = round(r["quantity"] * float(r["unit_price"]), 2)
    return {
        "id":              str(r["id"]),
        "organization_id": str(r["organization_id"]),
        "requested_by":    str(r["requested_by"]),
        "requester_email": r.get("requester_email"),
        "approved_by":     str(r["approved_by"]) if r.get("approved_by") else None,
        "approver_email":  r.get("approver_email"),
        "vendor_id":       str(r["vendor_id"]) if r.get("vendor_id") else None,
        "vendor_name":     r.get("vendor_name"),
        "title":           r["title"],
        "description":     r.get("description"),
        "quantity":        r["quantity"],
        "unit_price":      float(r["unit_price"]) if r.get("unit_price") is not None else None,
        "total_price":     total,
        "department":      r.get("department"),
        "justification":   r.get("justification"),
        "status":          r["status"],
        "po_number":       r.get("po_number"),
        "ordered_at":      r["ordered_at"].isoformat() if r.get("ordered_at") else None,
        "delivered_at":    r["delivered_at"].isoformat() if r.get("delivered_at") else None,
        "linked_asset_id": str(r["linked_asset_id"]) if r.get("linked_asset_id") else None,
        "notes":           r.get("notes"),
        "created_at":      r["created_at"].isoformat() if r.get("created_at") else None,
        "updated_at":      r["updated_at"].isoformat() if r.get("updated_at") else None,
    }


_SELECT = """
    SELECT pr.*,
           ru.email AS requester_email,
           au.email AS approver_email,
           v.name   AS vendor_name
    FROM app.purchase_requests pr
    LEFT JOIN auth.users ru ON ru.id = pr.requested_by
    LEFT JOIN auth.users au ON au.id = pr.approved_by
    LEFT JOIN app.vendors v  ON v.id  = pr.vendor_id
"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/platform-stats")
def procure_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT status, COUNT(*) FROM app.purchase_requests WHERE organization_id = %s GROUP BY status",
            (org_id,),
        )
        counts = {r["status"]: r["count"] for r in cur.fetchall()}

    pending = counts.get("pending", 0)
    total   = sum(counts.values())
    health  = "warning" if pending > 5 else "healthy" if total == 0 else "healthy"
    stats   = [f"{total} requests"]
    if pending:
        stats.append(f"{pending} pending approval")
    return {"stats": stats, "health": health}


@router.get("")
def list_purchase_requests(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    org_id   = require_org_context(request)
    is_rep   = _get_role(user.id) in ("rep", "admin", "owner")

    with get_db_connection() as conn:
        cur = conn.cursor()
        conds  = ["pr.organization_id = %s"]
        params: list = [org_id]
        if not is_rep:
            conds.append("pr.requested_by = %s")
            params.append(user.id)
        if status_filter:
            conds.append("pr.status = %s")
            params.append(status_filter)

        where = " AND ".join(conds)
        cur.execute(f"SELECT COUNT(*) FROM app.purchase_requests pr WHERE {where}", params)
        total = cur.fetchone()[0]

        cur.execute(
            f"{_SELECT} WHERE {where} ORDER BY pr.created_at DESC LIMIT %s OFFSET %s",
            params + [limit, offset],
        )
        rows = cur.fetchall()

    return {"requests": [_row_to_dict(r) for r in rows], "total": total}


@router.post("", status_code=201)
def create_purchase_request(
    body: PurchaseRequestIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    org_id = require_org_context(request)
    if not body.title.strip():
        raise HTTPException(400, "Title required")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.purchase_requests
               (organization_id, requested_by, vendor_id, title, description,
                quantity, unit_price, department, justification, notes)
               VALUES (%s, %s, %s::uuid, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (org_id, user.id,
             body.vendor_id or None, body.title.strip(),
             body.description, body.quantity, body.unit_price,
             body.department, body.justification, body.notes),
        )
        row = cur.fetchone()
        conn.commit()

    return _row_to_dict(row)


@router.get("/{pr_id}")
def get_purchase_request(
    pr_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"{_SELECT} WHERE pr.id = %s::uuid AND pr.organization_id = %s",
            (pr_id, org_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Purchase request not found")
    is_rep = _get_role(user.id) in ("rep", "admin", "owner")
    if not is_rep and str(row["requested_by"]) != user.id:
        raise HTTPException(403, "Access denied")
    return _row_to_dict(row)


@router.post("/{pr_id}/approve", status_code=200)
def approve_request(
    pr_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    return _transition(pr_id, org_id, user.id, "approved", "pending")


@router.post("/{pr_id}/reject", status_code=200)
def reject_request(
    pr_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    return _transition(pr_id, org_id, user.id, "rejected", "pending")


@router.post("/{pr_id}/order", status_code=200)
def mark_ordered(
    pr_id: str,
    body: StatusUpdateIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE app.purchase_requests
               SET status = 'ordered', ordered_at = NOW(),
                   po_number = COALESCE(%s, po_number),
                   notes = COALESCE(%s, notes), updated_at = NOW()
               WHERE id = %s::uuid AND organization_id = %s AND status = 'approved'
               RETURNING *""",
            (body.po_number, body.notes, pr_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(400, "Request not found or not in approved state")
        conn.commit()
    return _row_to_dict(row)


@router.post("/{pr_id}/deliver", status_code=200)
def mark_delivered(
    pr_id: str,
    body: DeliverIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    """Mark delivered and optionally auto-create asset in AssetLog."""
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT pr.*, v.name AS vendor_name FROM app.purchase_requests pr
               LEFT JOIN app.vendors v ON v.id = pr.vendor_id
               WHERE pr.id = %s::uuid AND pr.organization_id = %s AND pr.status = 'ordered'""",
            (pr_id, org_id),
        )
        pr = cur.fetchone()
        if not pr:
            raise HTTPException(400, "Request not found or not in ordered state")

        asset_id = None
        if body.create_asset:
            # Auto-create asset in AssetLog
            asset_name = body.asset_name or pr["title"]
            category   = body.asset_category or "other"
            cur.execute(
                "SELECT prefix, next_number FROM app.asset_tag_sequences WHERE organization_id = %s FOR UPDATE",
                (org_id,),
            )
            seq = cur.fetchone()
            if not seq:
                cur.execute(
                    "INSERT INTO app.asset_tag_sequences (organization_id) VALUES (%s) RETURNING prefix, next_number",
                    (org_id,),
                )
                seq = cur.fetchone()
            asset_tag = f"{seq['prefix']}{seq['next_number']:04d}"
            cur.execute(
                "UPDATE app.asset_tag_sequences SET next_number = next_number + 1 WHERE organization_id = %s",
                (org_id,),
            )
            cur.execute(
                """INSERT INTO app.assets
                   (organization_id, asset_tag, name, category, status, purchase_price, department)
                   VALUES (%s, %s, %s, %s, 'active', %s, %s)
                   RETURNING id""",
                (org_id, asset_tag, asset_name, category,
                 pr.get("unit_price"), pr.get("department")),
            )
            asset_id = str(cur.fetchone()["id"])

        cur.execute(
            """UPDATE app.purchase_requests
               SET status = 'delivered', delivered_at = NOW(),
                   linked_asset_id = %s::uuid,
                   notes = COALESCE(%s, notes), updated_at = NOW()
               WHERE id = %s::uuid AND organization_id = %s
               RETURNING *""",
            (asset_id, body.notes, pr_id, org_id),
        )
        row = cur.fetchone()
        conn.commit()

    if asset_id:
        try:
            from .casper import casper_engine
            casper_engine.embed_entity(
                "asset", asset_id,
                f"[asset] {body.asset_name or pr['title']} {body.asset_category or 'other'}",
                org_id,
            )
        except Exception:
            pass

    return _row_to_dict(row)


@router.post("/{pr_id}/cancel", status_code=200)
def cancel_request(
    pr_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("procurement"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT requested_by FROM app.purchase_requests WHERE id = %s::uuid AND organization_id = %s",
            (pr_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        is_admin = _get_role(user.id) in ("admin", "owner")
        if not is_admin and str(row["requested_by"]) != user.id:
            raise HTTPException(403, "Cannot cancel another user's request")
        cur.execute(
            """UPDATE app.purchase_requests
               SET status = 'cancelled', updated_at = NOW()
               WHERE id = %s::uuid AND organization_id = %s
               AND status IN ('pending', 'approved')
               RETURNING *""",
            (pr_id, org_id),
        )
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(400, "Request cannot be cancelled in its current state")
        conn.commit()
    return _row_to_dict(updated)


def _transition(pr_id: str, org_id: str, approver_id: str, new_status: str, from_status: str) -> dict:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE app.purchase_requests
               SET status = %s, approved_by = %s, updated_at = NOW()
               WHERE id = %s::uuid AND organization_id = %s AND status = %s
               RETURNING *""",
            (new_status, approver_id, pr_id, org_id, from_status),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(400, f"Request not found or not in '{from_status}' state")
        conn.commit()
    return _row_to_dict(row)
