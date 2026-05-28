"""
AssetLog — IT Asset & License Management.

Complete lifecycle: purchase → deploy → assign → repair → retire/dispose.
Software license seat tracking with auto-sync via DB trigger.
QR code generation per asset. CSV import/export. CASPER entity embedding.
CASPER proactive intelligence: insights API with 6 autonomous agents.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import math
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, field_validator

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets", tags=["assets"])

# ── Permission helpers ────────────────────────────────────────────────────────

def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"


def _require_rep(user: User):
    role = _get_role(user.id)
    if role not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin role required")
    return role


# ── Depreciation ──────────────────────────────────────────────────────────────

def _depreciation(purchase_price: Optional[float], purchase_date: Optional[date],
                  depreciation_years: int) -> Dict:
    if not purchase_price or not purchase_date:
        return {"current_value": None, "depreciation_pct": None, "fully_depreciated": False}
    years = (date.today() - purchase_date).days / 365.25
    rate  = min(1.0, years / max(depreciation_years, 1))
    val   = round(max(0.0, purchase_price * (1.0 - rate)), 2)
    return {
        "current_value":     val,
        "depreciation_pct":  round(rate * 100, 1),
        "fully_depreciated": val == 0.0,
    }


# ── Auto asset-tag generation ─────────────────────────────────────────────────

def _next_asset_tag(cursor, org_id: str) -> str:
    cursor.execute(
        "SELECT prefix, next_number FROM app.asset_tag_sequences WHERE organization_id = %s FOR UPDATE",
        (org_id,)
    )
    row = cursor.fetchone()
    if row is None:
        cursor.execute(
            "INSERT INTO app.asset_tag_sequences (organization_id) VALUES (%s) RETURNING prefix, next_number",
            (org_id,)
        )
        row = cursor.fetchone()
    cursor.execute(
        "UPDATE app.asset_tag_sequences SET next_number = next_number + 1 WHERE organization_id = %s",
        (org_id,)
    )
    return f"{row['prefix']}-{row['next_number']:04d}"


# ── History helper ────────────────────────────────────────────────────────────

def _log_history(cursor, asset_id: str, org_id: str, user_id: str,
                 event_type: str, field: str = None, old: str = None,
                 new: str = None, note: str = None):
    cursor.execute(
        "INSERT INTO app.asset_history "
        "(asset_id, organization_id, changed_by, event_type, field_changed, old_value, new_value, note) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (asset_id, org_id, user_id, event_type, field, old, new, note),
    )


# ── Pydantic models ───────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    asset_tag:          Optional[str]  = None   # auto-generated if omitted
    name:               str
    category:           str            = "other"
    status:             str            = "active"
    condition_rating:   str            = "good"
    assigned_to:        Optional[str]  = None
    department:         Optional[str]  = None
    location:           Optional[str]  = None
    specs:              Dict[str, Any] = {}
    purchase_date:      Optional[str]  = None
    purchase_price:     Optional[float]= None
    currency:           str            = "USD"
    vendor_name:        Optional[str]  = None
    po_number:          Optional[str]  = None
    invoice_number:     Optional[str]  = None
    warranty_expiry:    Optional[str]  = None
    warranty_type:      str            = "manufacturer"
    warranty_notes:     Optional[str]  = None
    depreciation_years: int            = 3
    notes:              Optional[str]  = None
    tags:               List[str]      = []
    custom_fields:      Dict[str, Any] = {}


class AssetUpdate(BaseModel):
    name:               Optional[str]  = None
    category:           Optional[str]  = None
    status:             Optional[str]  = None
    condition_rating:   Optional[str]  = None
    assigned_to:        Optional[str]  = None   # empty string = unassign
    department:         Optional[str]  = None
    location:           Optional[str]  = None
    specs:              Optional[Dict[str, Any]] = None
    purchase_date:      Optional[str]  = None
    purchase_price:     Optional[float]= None
    currency:           Optional[str]  = None
    vendor_name:        Optional[str]  = None
    po_number:          Optional[str]  = None
    invoice_number:     Optional[str]  = None
    warranty_expiry:    Optional[str]  = None
    warranty_type:      Optional[str]  = None
    warranty_notes:     Optional[str]  = None
    depreciation_years: Optional[int]  = None
    notes:              Optional[str]  = None
    tags:               Optional[List[str]] = None
    custom_fields:      Optional[Dict[str, Any]] = None


class StatusChange(BaseModel):
    status: str
    reason: Optional[str] = None
    disposal_method: Optional[str] = None
    disposal_notes:  Optional[str] = None


class AssignRequest(BaseModel):
    user_id:    str
    department: Optional[str] = None
    location:   Optional[str] = None
    note:       Optional[str] = None


class RepairCreate(BaseModel):
    sent_date:   str
    vendor_name: Optional[str]  = None
    description: Optional[str]  = None
    repair_cost: Optional[float]= None
    ticket_id:   Optional[str]  = None
    notes:       Optional[str]  = None


class RepairUpdate(BaseModel):
    returned_date: Optional[str]   = None
    repair_cost:   Optional[float] = None
    notes:         Optional[str]   = None
    status:        str


class LicenseCreate(BaseModel):
    product_name:  str
    vendor:        Optional[str]  = None
    version:       Optional[str]  = None
    license_type:  str            = "subscription"
    seat_count:    Optional[int]  = None   # None = unlimited
    license_key:   Optional[str]  = None
    purchase_date: Optional[str]  = None
    expiry_date:   Optional[str]  = None
    renewal_date:  Optional[str]  = None
    auto_renews:   bool           = False
    cost_per_year: Optional[float]= None
    currency:      str            = "USD"
    vendor_contact:Optional[str]  = None
    support_url:   Optional[str]  = None
    notes:         Optional[str]  = None


class LicenseUpdate(BaseModel):
    product_name:  Optional[str]  = None
    vendor:        Optional[str]  = None
    version:       Optional[str]  = None
    license_type:  Optional[str]  = None
    seat_count:    Optional[int]  = None
    license_key:   Optional[str]  = None
    purchase_date: Optional[str]  = None
    expiry_date:   Optional[str]  = None
    renewal_date:  Optional[str]  = None
    auto_renews:   Optional[bool] = None
    cost_per_year: Optional[float]= None
    currency:      Optional[str]  = None
    vendor_contact:Optional[str]  = None
    support_url:   Optional[str]  = None
    notes:         Optional[str]  = None


class LicenseAssign(BaseModel):
    assigned_to: Optional[str] = None   # user UUID
    asset_id:    Optional[str] = None   # asset UUID
    notes:       Optional[str] = None


class LinkTicket(BaseModel):
    ticket_id: str


class BulkAction(BaseModel):
    asset_ids: List[str]
    action:    str  # "status_change" | "assign" | "unassign" | "delete"
    # for status_change
    status:    Optional[str]  = None
    reason:    Optional[str]  = None
    # for assign
    user_id:   Optional[str]  = None
    department: Optional[str] = None


# ── Serialisers ───────────────────────────────────────────────────────────────

def _asset_row(row: Dict, with_depreciation: bool = True) -> Dict:
    d = dict(row)
    for k in ("purchase_date", "warranty_expiry", "retirement_date", "deployed_at",
              "last_audited_at", "created_at", "updated_at"):
        if k in d and d[k] is not None:
            d[k] = d[k].isoformat() if hasattr(d[k], "isoformat") else str(d[k])
    if with_depreciation:
        d["depreciation"] = _depreciation(
            float(d["purchase_price"]) if d.get("purchase_price") else None,
            date.fromisoformat(d["purchase_date"]) if d.get("purchase_date") else None,
            d.get("depreciation_years", 3),
        )
    return d


# ── Assets CRUD ───────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_asset(
    payload: AssetCreate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Auto-generate tag if not provided
        tag = payload.asset_tag or _next_asset_tag(cur, org_id)

        # Check uniqueness
        cur.execute("SELECT id FROM app.assets WHERE organization_id=%s AND asset_tag=%s", (org_id, tag))
        if cur.fetchone():
            raise HTTPException(409, f"Asset tag '{tag}' already exists in this organisation")

        cur.execute("""
            INSERT INTO app.assets
              (organization_id, asset_tag, name, category, status, condition_rating,
               assigned_to, department, location, specs,
               purchase_date, purchase_price, currency, vendor_name, po_number, invoice_number,
               warranty_expiry, warranty_type, warranty_notes,
               depreciation_years, notes, tags, custom_fields, created_by)
            VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s,%s,%s, %s,%s,%s, %s,%s,%s,%s,%s)
            RETURNING *
        """, (
            org_id, tag, payload.name, payload.category, payload.status, payload.condition_rating,
            payload.assigned_to or None, payload.department, payload.location,
            json.dumps(payload.specs),
            payload.purchase_date or None, payload.purchase_price, payload.currency,
            payload.vendor_name, payload.po_number, payload.invoice_number,
            payload.warranty_expiry or None, payload.warranty_type, payload.warranty_notes,
            payload.depreciation_years, payload.notes,
            payload.tags, json.dumps(payload.custom_fields), user.id,
        ))
        asset = cur.fetchone()
        asset_id = str(asset["id"])

        _log_history(cur, asset_id, org_id, user.id, "created",
                     note=f"Asset '{payload.name}' ({tag}) created")

        # If assigned at creation, log assignment too
        if payload.assigned_to:
            _log_history(cur, asset_id, org_id, user.id, "assigned",
                         new=payload.assigned_to, note="Assigned at creation")

        conn.commit()

    # Background CASPER embedding
    try:
        from .casper import casper_engine
        text = f"[asset] {payload.name} {payload.category} {json.dumps(payload.specs)}"
        casper_engine.embed_entity("asset", asset_id, text, org_id)
    except Exception:
        pass

    return _asset_row(dict(asset))


@router.get("")
def list_assets(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
    category:    Optional[str] = None,
    status:      Optional[str] = None,
    department:  Optional[str] = None,
    assigned_to: Optional[str] = None,
    search:      Optional[str] = Query(None, max_length=100),
    warranty_expiring_days: Optional[int] = None,
    page:  int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    org_id = require_org_context(request)
    offset = (page - 1) * limit

    conditions = ["a.organization_id = %s"]
    params: list = [org_id]

    if category:
        conditions.append("a.category = %s"); params.append(category)
    if status:
        conditions.append("a.status = %s"); params.append(status)
    if department:
        conditions.append("a.department ILIKE %s"); params.append(f"%{department}%")
    if assigned_to == "me":
        conditions.append("a.assigned_to = %s"); params.append(user.id)
    elif assigned_to == "unassigned":
        conditions.append("a.assigned_to IS NULL")
    elif assigned_to:
        conditions.append("a.assigned_to = %s"); params.append(assigned_to)
    if search:
        conditions.append(
            "(a.name ILIKE %s OR a.asset_tag ILIKE %s OR "
            "a.specs->>'serial_number' ILIKE %s OR a.specs->>'model' ILIKE %s)"
        )
        s = f"%{search}%"
        params += [s, s, s, s]
    if warranty_expiring_days is not None:
        conditions.append("a.warranty_expiry <= CURRENT_DATE + %s")
        conditions.append("a.warranty_expiry >= CURRENT_DATE")
        conditions.append("a.status NOT IN ('retired','disposed')")
        params.append(warranty_expiring_days)

    where = " AND ".join(conditions)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) AS total FROM app.assets a WHERE {where}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT a.*,
                   au.email   AS assigned_email,
                   au.raw_user_meta_data->>'full_name' AS assigned_name
            FROM app.assets a
            LEFT JOIN auth.users au ON au.id = a.assigned_to
            WHERE {where}
            ORDER BY a.updated_at DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = cur.fetchall()

    return {
        "assets": [_asset_row(dict(r), with_depreciation=False) for r in rows],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 1,
    }


@router.get("/dashboard")
def asset_dashboard(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()

        # By status
        cur.execute("""
            SELECT status, COUNT(*) AS count
            FROM app.assets WHERE organization_id = %s
            GROUP BY status
        """, (org_id,))
        by_status = {r["status"]: r["count"] for r in cur.fetchall()}

        # By category
        cur.execute("""
            SELECT category, COUNT(*) AS count
            FROM app.assets WHERE organization_id = %s
            GROUP BY category ORDER BY count DESC
        """, (org_id,))
        by_category = [{"category": r["category"], "count": r["count"]} for r in cur.fetchall()]

        # Total value & fully depreciated count
        cur.execute("""
            SELECT
                COUNT(*)                                               AS total_assets,
                COALESCE(SUM(purchase_price), 0)                      AS total_purchase_value,
                COUNT(*) FILTER (WHERE assigned_to IS NOT NULL
                                   AND status NOT IN ('retired','disposed')) AS assigned_count
            FROM app.assets WHERE organization_id = %s
        """, (org_id,))
        totals = dict(cur.fetchone())

        # Warranty expiring in next 90 days
        cur.execute("""
            SELECT id, name, asset_tag, warranty_expiry,
                   (warranty_expiry - CURRENT_DATE) AS days_until
            FROM app.assets
            WHERE organization_id = %s
              AND warranty_expiry IS NOT NULL
              AND warranty_expiry <= CURRENT_DATE + 90
              AND status NOT IN ('retired','disposed')
            ORDER BY warranty_expiry ASC
            LIMIT 10
        """, (org_id,))
        warranty_alerts = [dict(r) for r in cur.fetchall()]
        for w in warranty_alerts:
            if w.get("warranty_expiry"):
                w["warranty_expiry"] = w["warranty_expiry"].isoformat()

        # License alerts (expiring / over capacity)
        cur.execute("""
            SELECT id, product_name, seat_count, seats_used, expiry_date,
                   (expiry_date - CURRENT_DATE) AS days_until
            FROM app.software_licenses
            WHERE organization_id = %s AND (
                (expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 90)
                OR (seat_count IS NOT NULL AND seats_used::float / NULLIF(seat_count,0) >= 0.8)
            )
            ORDER BY expiry_date ASC NULLS LAST
            LIMIT 10
        """, (org_id,))
        license_alerts = []
        for r in cur.fetchall():
            d = dict(r)
            if d.get("expiry_date"):
                d["expiry_date"] = d["expiry_date"].isoformat()
            d["seat_utilization"] = (
                round(d["seats_used"] / d["seat_count"] * 100, 1)
                if d.get("seat_count") else None
            )
            license_alerts.append(d)

        # Recent activity
        cur.execute("""
            SELECT ah.event_type, ah.field_changed, ah.new_value, ah.note,
                   ah.created_at, a.name AS asset_name, a.asset_tag,
                   au.email AS actor_email
            FROM app.asset_history ah
            JOIN app.assets a ON a.id = ah.asset_id
            LEFT JOIN auth.users au ON au.id = ah.changed_by
            WHERE ah.organization_id = %s
            ORDER BY ah.created_at DESC
            LIMIT 15
        """, (org_id,))
        activity = []
        for r in cur.fetchall():
            d = dict(r)
            d["created_at"] = d["created_at"].isoformat()
            activity.append(d)

    return {
        "by_status":       by_status,
        "by_category":     by_category,
        "totals":          totals,
        "warranty_alerts": warranty_alerts,
        "license_alerts":  license_alerts,
        "activity":        activity,
    }


@router.get("/platform-stats")
def platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Mission Control card stats."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('retired','disposed')) AS active,
                COUNT(*) FILTER (
                    WHERE warranty_expiry IS NOT NULL
                      AND warranty_expiry <= CURRENT_DATE + 30
                      AND status NOT IN ('retired','disposed')
                ) AS warranty_expiring_soon
            FROM app.assets WHERE organization_id = %s
        """, (org_id,))
        row = dict(cur.fetchone())

        cur.execute("""
            SELECT COUNT(*) AS overdue_licenses
            FROM app.software_licenses
            WHERE organization_id = %s AND expiry_date < CURRENT_DATE
        """, (org_id,))
        lic = cur.fetchone()

    active   = row["active"]
    expiring = row["warranty_expiring_soon"]
    overdue  = lic["overdue_licenses"]
    health   = "critical" if overdue > 0 or expiring > 0 else "healthy"

    stats = [f"{active} assets"]
    if expiring:
        stats.append(f"{expiring} warranty expiring")
    if overdue:
        stats.append(f"{overdue} licenses expired")
    return {"stats": stats, "health": health}


@router.get("/alerts")
def get_alerts(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """All active alerts: warranty expiry, license expiry, low seats."""
    org_id = require_org_context(request)
    alerts = []

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Warranty alerts
        cur.execute("""
            SELECT id, name, asset_tag, category, warranty_expiry,
                   (warranty_expiry - CURRENT_DATE) AS days_until
            FROM app.assets
            WHERE organization_id = %s
              AND warranty_expiry IS NOT NULL
              AND warranty_expiry <= CURRENT_DATE + 90
              AND status NOT IN ('retired','disposed')
            ORDER BY warranty_expiry ASC
        """, (org_id,))
        for r in cur.fetchall():
            d = dict(r)
            d["warranty_expiry"] = d["warranty_expiry"].isoformat()
            days = d["days_until"]
            d["alert_type"]  = "warranty"
            d["severity"]    = "expired" if days < 0 else "critical" if days <= 30 else "warning" if days <= 60 else "notice"
            d["alert_label"] = f"Warranty {'expired' if days < 0 else f'expiring in {days}d'}"
            alerts.append(d)

        # License expiry
        cur.execute("""
            SELECT id, product_name, expiry_date, seat_count, seats_used,
                   (expiry_date - CURRENT_DATE) AS days_until
            FROM app.software_licenses
            WHERE organization_id = %s
              AND expiry_date IS NOT NULL
              AND expiry_date <= CURRENT_DATE + 90
            ORDER BY expiry_date ASC
        """, (org_id,))
        for r in cur.fetchall():
            d = dict(r)
            d["expiry_date"] = d["expiry_date"].isoformat()
            days = d["days_until"]
            d["alert_type"]  = "license_expiry"
            d["severity"]    = "expired" if days < 0 else "critical" if days <= 30 else "warning" if days <= 60 else "notice"
            d["alert_label"] = f"License {'expired' if days < 0 else f'expiring in {days}d'}"
            alerts.append(d)

        # Low seats (>=80% used, not unlimited)
        cur.execute("""
            SELECT id, product_name, seat_count, seats_used
            FROM app.software_licenses
            WHERE organization_id = %s
              AND seat_count IS NOT NULL
              AND seat_count > 0
              AND (seats_used::float / seat_count) >= 0.8
        """, (org_id,))
        for r in cur.fetchall():
            d = dict(r)
            pct = round(d["seats_used"] / d["seat_count"] * 100)
            d["alert_type"]  = "license_seats"
            d["severity"]    = "critical" if pct >= 100 else "warning"
            d["alert_label"] = f"{pct}% seats used ({d['seats_used']}/{d['seat_count']})"
            alerts.append(d)

    return {"alerts": alerts, "total": len(alerts)}


@router.post("/bulk", status_code=200)
def bulk_asset_action(
    payload: BulkAction,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Bulk operations: status_change, assign, unassign, delete."""
    if not payload.asset_ids:
        raise HTTPException(400, "No assets specified")
    if len(payload.asset_ids) > 200:
        raise HTTPException(400, "Max 200 assets per bulk action")

    org_id = require_org_context(request)
    _require_rep(user)

    # Validate that all asset_ids belong to this org
    with get_db_connection() as conn:
        cur = conn.cursor()
        placeholders = ",".join(["%s"] * len(payload.asset_ids))
        cur.execute(
            f"SELECT id FROM app.assets WHERE id IN ({placeholders}) AND organization_id=%s",
            payload.asset_ids + [org_id],
        )
        found = {str(r["id"]) for r in cur.fetchall()}
        invalid = [aid for aid in payload.asset_ids if aid not in found]
        if invalid:
            raise HTTPException(404, f"Assets not found: {invalid[:5]}")

        affected = 0

        if payload.action == "status_change":
            if not payload.status:
                raise HTTPException(400, "status required")
            VALID_STATUSES = ("active","deployed","in_repair","in_storage","lost","retired","disposed")
            if payload.status not in VALID_STATUSES:
                raise HTTPException(400, f"Invalid status '{payload.status}'")
            for aid in payload.asset_ids:
                cur.execute("UPDATE app.assets SET status=%s WHERE id=%s AND organization_id=%s",
                            (payload.status, aid, org_id))
                _log_history(cur, aid, org_id, user.id, "bulk_status_change",
                             field="status", new=payload.status, note=payload.reason)
                affected += 1

        elif payload.action == "assign":
            if not payload.user_id:
                raise HTTPException(400, "user_id required for assign")
            for aid in payload.asset_ids:
                cur.execute("""
                    UPDATE app.assets
                    SET assigned_to=%s, department=COALESCE(%s, department), status='deployed'
                    WHERE id=%s AND organization_id=%s
                """, (payload.user_id, payload.department, aid, org_id))
                _log_history(cur, aid, org_id, user.id, "bulk_assign",
                             field="assigned_to", new=payload.user_id)
                affected += 1

        elif payload.action == "unassign":
            for aid in payload.asset_ids:
                cur.execute("""
                    UPDATE app.assets SET assigned_to=NULL
                    WHERE id=%s AND organization_id=%s
                """, (aid, org_id))
                _log_history(cur, aid, org_id, user.id, "bulk_unassign", field="assigned_to", new=None)
                affected += 1

        elif payload.action == "delete":
            role = _get_role(user.id)
            if role not in ("admin", "owner"):
                raise HTTPException(403, "Admin role required for bulk delete")
            cur.execute(
                f"DELETE FROM app.assets WHERE id IN ({placeholders}) AND organization_id=%s",
                payload.asset_ids + [org_id],
            )
            affected = cur.rowcount

        else:
            raise HTTPException(400, f"Unknown action '{payload.action}'")

        conn.commit()

    return {"affected": affected, "action": payload.action}


@router.get("/export")
def export_assets(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Download all assets as CSV."""
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT a.asset_tag, a.name, a.category, a.status, a.condition_rating,
                   au.email AS assigned_email,
                   a.department, a.location,
                   a.specs->>'serial_number' AS serial_number,
                   a.specs->>'model' AS model,
                   a.specs->>'manufacturer' AS manufacturer,
                   a.purchase_date, a.purchase_price, a.currency,
                   a.vendor_name, a.po_number,
                   a.warranty_expiry, a.warranty_type,
                   a.depreciation_years, a.notes,
                   a.created_at
            FROM app.assets a
            LEFT JOIN auth.users au ON au.id = a.assigned_to
            WHERE a.organization_id = %s
            ORDER BY a.asset_tag ASC
        """, (org_id,))
        rows = cur.fetchall()

    buf = io.StringIO()
    fields = [
        "asset_tag","name","category","status","condition_rating","assigned_email",
        "department","location","serial_number","model","manufacturer",
        "purchase_date","purchase_price","currency","vendor_name","po_number",
        "warranty_expiry","warranty_type","depreciation_years","notes","created_at",
    ]
    writer = csv.DictWriter(buf, fieldnames=fields)
    writer.writeheader()
    for r in rows:
        d = dict(r)
        for k in ("purchase_date","warranty_expiry","created_at"):
            if d.get(k) and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        writer.writerow({f: d.get(f, "") for f in fields})

    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=assets_export.csv"},
    )


@router.post("/import", status_code=201)
async def import_assets(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """
    Import assets from CSV.
    Required columns: name, category
    Optional columns: asset_tag, status, serial_number, model, manufacturer,
                      department, location, purchase_date, purchase_price,
                      currency, vendor_name, warranty_expiry, notes
    Returns row-level success/error report.
    """
    org_id = require_org_context(request)
    _require_rep(user)

    content = await file.read()
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    errors = []

    with get_db_connection() as conn:
        cur = conn.cursor()
        for i, row in enumerate(reader, start=2):  # row 1 = header
            name = (row.get("name") or "").strip()
            if not name:
                errors.append({"row": i, "error": "Missing required field: name"})
                continue

            category = (row.get("category") or "other").strip().lower()
            valid_cats = {
                "laptop","desktop","server","phone","tablet","monitor","network",
                "printer","peripheral","software","cloud","vehicle","furniture","other",
            }
            if category not in valid_cats:
                category = "other"

            tag = (row.get("asset_tag") or "").strip() or _next_asset_tag(cur, org_id)

            cur.execute("SELECT id FROM app.assets WHERE organization_id=%s AND asset_tag=%s", (org_id, tag))
            if cur.fetchone():
                errors.append({"row": i, "error": f"Asset tag '{tag}' already exists"})
                continue

            specs = {}
            for spec_field in ("serial_number", "model", "manufacturer"):
                v = (row.get(spec_field) or "").strip()
                if v:
                    specs[spec_field] = v

            try:
                cur.execute("""
                    INSERT INTO app.assets
                      (organization_id, asset_tag, name, category, status,
                       department, location, specs,
                       purchase_date, purchase_price, currency, vendor_name,
                       warranty_expiry, notes, created_by)
                    VALUES (%s,%s,%s,%s,%s, %s,%s,%s, %s,%s,%s,%s, %s,%s,%s)
                """, (
                    org_id, tag, name, category,
                    (row.get("status") or "active").strip(),
                    (row.get("department") or "").strip() or None,
                    (row.get("location") or "").strip() or None,
                    json.dumps(specs),
                    (row.get("purchase_date") or "").strip() or None,
                    float(row["purchase_price"]) if row.get("purchase_price") else None,
                    (row.get("currency") or "USD").strip(),
                    (row.get("vendor_name") or "").strip() or None,
                    (row.get("warranty_expiry") or "").strip() or None,
                    (row.get("notes") or "").strip() or None,
                    user.id,
                ))
                created += 1
            except Exception as exc:
                errors.append({"row": i, "error": str(exc)})

        conn.commit()

    return {
        "created": created,
        "errors":  errors,
        "total_rows": created + len(errors),
    }


# ── Single asset endpoints ────────────────────────────────────────────────────

@router.get("/{asset_id}")
def get_asset(
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT a.*,
                   au.email   AS assigned_email,
                   au.raw_user_meta_data->>'full_name' AS assigned_name,
                   cr.email   AS creator_email
            FROM app.assets a
            LEFT JOIN auth.users au ON au.id = a.assigned_to
            LEFT JOIN auth.users cr ON cr.id = a.created_by
            WHERE a.id = %s AND a.organization_id = %s
        """, (asset_id, org_id))
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(404, "Asset not found")

        # Repairs
        cur.execute("""
            SELECT ar.*, au.email AS creator_email
            FROM app.asset_repairs ar
            LEFT JOIN auth.users au ON au.id = ar.created_by
            WHERE ar.asset_id = %s ORDER BY ar.sent_date DESC
        """, (asset_id,))
        repairs = [dict(r) for r in cur.fetchall()]
        for r in repairs:
            for k in ("sent_date","returned_date","created_at"):
                if r.get(k) and hasattr(r[k], "isoformat"):
                    r[k] = r[k].isoformat()

        # Linked tickets (most recent 10)
        cur.execute("""
            SELECT t.id, t.title, t.status, t.priority_level, t.created_at,
                   at2.linked_at
            FROM app.asset_tickets at2
            JOIN app.tickets t ON t.id = at2.ticket_id
            WHERE at2.asset_id = %s
            ORDER BY at2.linked_at DESC
            LIMIT 10
        """, (asset_id,))
        tickets = []
        for r in cur.fetchall():
            d = dict(r)
            for k in ("created_at","linked_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            tickets.append(d)

        # License assignments for this asset
        cur.execute("""
            SELECT la.id, la.assigned_at, sl.product_name, sl.license_type, sl.expiry_date
            FROM app.license_assignments la
            JOIN app.software_licenses sl ON sl.id = la.license_id
            WHERE la.asset_id = %s AND la.unassigned_at IS NULL
        """, (asset_id,))
        licenses = []
        for r in cur.fetchall():
            d = dict(r)
            for k in ("assigned_at","expiry_date"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            licenses.append(d)

    result = _asset_row(dict(asset))
    result["repairs"]  = repairs
    result["tickets"]  = tickets
    result["licenses"] = licenses
    return result


@router.put("/{asset_id}")
def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM app.assets WHERE id=%s AND organization_id=%s", (asset_id, org_id))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(404, "Asset not found")

        updates = {}
        data = payload.model_dump(exclude_unset=True)

        # Handle explicit unassign (empty string)
        if "assigned_to" in data:
            if data["assigned_to"] == "" or data["assigned_to"] is None:
                data["assigned_to"] = None

        for field, val in data.items():
            if field == "specs":
                merged = dict(existing["specs"] or {})
                merged.update(val)
                updates["specs"] = json.dumps(merged)
            elif field == "custom_fields":
                merged = dict(existing["custom_fields"] or {})
                merged.update(val)
                updates["custom_fields"] = json.dumps(merged)
            else:
                updates[field] = val

        if not updates:
            return _asset_row(dict(existing))

        set_clause = ", ".join(f"{k} = %s" for k in updates)
        cur.execute(
            f"UPDATE app.assets SET {set_clause} WHERE id = %s AND organization_id = %s RETURNING *",
            list(updates.values()) + [asset_id, org_id],
        )
        updated = cur.fetchone()

        # Log each changed field
        for field, new_val in updates.items():
            old_val = existing.get(field)
            if str(old_val) != str(new_val):
                _log_history(cur, asset_id, org_id, user.id, "updated",
                             field=field, old=str(old_val), new=str(new_val))

        conn.commit()

    # Re-embed on significant changes
    try:
        from .casper import casper_engine
        name  = updated["name"]
        specs = json.dumps(updated.get("specs") or {})
        casper_engine.embed_entity("asset", asset_id, f"[asset] {name} {updated['category']} {specs}", org_id)
    except Exception:
        pass

    return _asset_row(dict(updated))


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Soft-delete: marks status as 'disposed'. Assets are never hard-deleted (audit trail)."""
    org_id = require_org_context(request)
    role = _require_rep(user)
    if role not in ("admin", "owner"):
        raise HTTPException(403, "Admin role required to delete assets")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM app.assets WHERE id=%s AND organization_id=%s", (asset_id, org_id))
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(404, "Asset not found")

        cur.execute(
            "UPDATE app.assets SET status='disposed', disposal_method='destroyed' WHERE id=%s",
            (asset_id,)
        )
        _log_history(cur, asset_id, org_id, user.id, "disposed",
                     old="active", new="disposed", note="Deleted via API")
        conn.commit()


# ── QR code ───────────────────────────────────────────────────────────────────

@router.get("/{asset_id}/qr.png")
def asset_qr_code(
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Return a QR code PNG. Encodes the asset URL for deep-link scanning."""
    org_id = require_org_context(request)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT asset_tag, name FROM app.assets WHERE id=%s AND organization_id=%s",
                    (asset_id, org_id))
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(404, "Asset not found")

    import qrcode as qrc
    # Encode a deep-link path — frontend resolves to /assets/{id}
    qr = qrc.QRCode(version=1, box_size=8, border=3,
                    error_correction=qrc.constants.ERROR_CORRECT_M)
    qr.add_data(f"/assets/{asset_id}")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="asset-{asset["asset_tag"]}.png"',
            "Cache-Control": "public, max-age=86400",
        },
    )


# ── Status change ─────────────────────────────────────────────────────────────

# Valid transitions
_VALID_TRANSITIONS: Dict[str, set] = {
    "pending":    {"active","disposed"},
    "active":     {"deployed","in_repair","in_storage","lost","retired","disposed"},
    "deployed":   {"active","in_repair","in_storage","lost","retired","disposed"},
    "in_repair":  {"active","deployed","disposed"},
    "in_storage": {"active","deployed","retired","disposed"},
    "lost":       {"active","disposed"},
    "retired":    {"disposed"},
    "disposed":   set(),
}


@router.post("/{asset_id}/status")
def change_status(
    asset_id: str,
    payload: StatusChange,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT status, name FROM app.assets WHERE id=%s AND organization_id=%s",
                    (asset_id, org_id))
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(404, "Asset not found")

        old_status = asset["status"]
        new_status = payload.status

        if new_status not in _VALID_TRANSITIONS.get(old_status, set()):
            raise HTTPException(400, f"Cannot transition from '{old_status}' to '{new_status}'")

        update_fields = {"status": new_status}
        if new_status == "disposed":
            if payload.disposal_method:
                update_fields["disposal_method"] = payload.disposal_method
            if payload.disposal_notes:
                update_fields["disposal_notes"] = payload.disposal_notes
        if new_status == "deployed":
            update_fields["deployed_at"] = datetime.utcnow().isoformat()

        set_clause = ", ".join(f"{k} = %s" for k in update_fields)
        cur.execute(
            f"UPDATE app.assets SET {set_clause} WHERE id = %s",
            list(update_fields.values()) + [asset_id],
        )
        _log_history(cur, asset_id, org_id, user.id, "status_changed",
                     field="status", old=old_status, new=new_status,
                     note=payload.reason)
        conn.commit()

    return {"status": new_status, "previous": old_status}


# ── Assignment ────────────────────────────────────────────────────────────────

@router.post("/{asset_id}/assign")
def assign_asset(
    asset_id: str,
    payload: AssignRequest,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, assigned_to, status FROM app.assets WHERE id=%s AND organization_id=%s",
                    (asset_id, org_id))
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(404, "Asset not found")
        if asset["status"] in ("retired", "disposed"):
            raise HTTPException(400, f"Cannot assign a {asset['status']} asset")

        # Verify target user is in org
        cur.execute("""
            SELECT au.email FROM app.organization_members om
            JOIN auth.users au ON au.id = om.user_id
            WHERE om.organization_id = %s AND om.user_id = %s
        """, (org_id, payload.user_id))
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, "User not found in this organisation")

        old_assignee = str(asset["assigned_to"]) if asset["assigned_to"] else None

        updates = ["assigned_to = %s"]
        vals = [payload.user_id]
        if payload.department:
            updates.append("department = %s"); vals.append(payload.department)
        if payload.location:
            updates.append("location = %s"); vals.append(payload.location)

        cur.execute(
            f"UPDATE app.assets SET {', '.join(updates)} WHERE id = %s",
            vals + [asset_id],
        )
        _log_history(cur, asset_id, org_id, user.id, "assigned",
                     old=old_assignee, new=payload.user_id,
                     note=payload.note or f"Assigned to {target['email']}")
        conn.commit()

    return {"assigned_to": payload.user_id, "email": target["email"]}


@router.post("/{asset_id}/unassign")
def unassign_asset(
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT assigned_to FROM app.assets WHERE id=%s AND organization_id=%s",
                    (asset_id, org_id))
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(404, "Asset not found")

        old = str(asset["assigned_to"]) if asset["assigned_to"] else None
        cur.execute(
            "UPDATE app.assets SET assigned_to=NULL, status='in_storage' WHERE id=%s AND organization_id=%s",
            (asset_id, org_id)
        )
        _log_history(cur, asset_id, org_id, user.id, "unassigned",
                     old=old, note="Returned to storage")
        conn.commit()

    return {"assigned_to": None, "status": "in_storage"}


# ── Repairs ───────────────────────────────────────────────────────────────────

@router.post("/{asset_id}/repairs", status_code=201)
def start_repair(
    asset_id: str,
    payload: RepairCreate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, status FROM app.assets WHERE id=%s AND organization_id=%s",
                    (asset_id, org_id))
        asset = cur.fetchone()
        if not asset:
            raise HTTPException(404, "Asset not found")
        if asset["status"] in ("retired", "disposed"):
            raise HTTPException(400, "Cannot create repair for a retired/disposed asset")

        cur.execute("""
            INSERT INTO app.asset_repairs
              (asset_id, organization_id, sent_date, vendor_name, description,
               repair_cost, ticket_id, notes, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING *
        """, (asset_id, org_id, payload.sent_date, payload.vendor_name,
              payload.description, payload.repair_cost,
              payload.ticket_id or None, payload.notes, user.id))
        repair = cur.fetchone()

        # Update asset status
        cur.execute("UPDATE app.assets SET status='in_repair' WHERE id=%s", (asset_id,))
        _log_history(cur, asset_id, org_id, user.id, "repair_started",
                     new="in_repair", note=f"Sent for repair: {payload.description or 'N/A'}")
        conn.commit()

    d = dict(repair)
    for k in ("sent_date","created_at"):
        if d.get(k) and hasattr(d[k], "isoformat"):
            d[k] = d[k].isoformat()
    return d


@router.put("/{asset_id}/repairs/{repair_id}")
def update_repair(
    asset_id: str,
    repair_id: str,
    payload: RepairUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.asset_repairs WHERE id=%s AND asset_id=%s AND organization_id=%s",
                    (repair_id, asset_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Repair record not found")

        updates = {"status": payload.status}
        if payload.returned_date:
            updates["returned_date"] = payload.returned_date
        if payload.repair_cost is not None:
            updates["repair_cost"] = payload.repair_cost
        if payload.notes:
            updates["notes"] = payload.notes

        set_clause = ", ".join(f"{k}=%s" for k in updates)
        cur.execute(f"UPDATE app.asset_repairs SET {set_clause} WHERE id=%s",
                    list(updates.values()) + [repair_id])

        # If returned, bring asset back to active
        if payload.status == "returned":
            cur.execute("UPDATE app.assets SET status='active' WHERE id=%s AND organization_id=%s",
                        (asset_id, org_id))
            _log_history(cur, asset_id, org_id, user.id, "repair_returned",
                         new="active", note=f"Returned from repair. Cost: {payload.repair_cost or '?'}")
        elif payload.status == "cancelled":
            cur.execute("UPDATE app.assets SET status='active' WHERE id=%s AND organization_id=%s",
                        (asset_id, org_id))
            _log_history(cur, asset_id, org_id, user.id, "repair_cancelled",
                         new="active", note="Repair cancelled")

        conn.commit()

    return {"repair_id": repair_id, "status": payload.status}


# ── History ───────────────────────────────────────────────────────────────────

@router.get("/{asset_id}/history")
def asset_history(
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
    limit: int = Query(50, ge=1, le=200),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.assets WHERE id=%s AND organization_id=%s", (asset_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Asset not found")

        cur.execute("""
            SELECT ah.*, au.email AS actor_email
            FROM app.asset_history ah
            LEFT JOIN auth.users au ON au.id = ah.changed_by
            WHERE ah.asset_id = %s
            ORDER BY ah.created_at DESC
            LIMIT %s
        """, (asset_id, limit))
        rows = []
        for r in cur.fetchall():
            d = dict(r)
            d["created_at"] = d["created_at"].isoformat()
            rows.append(d)

    return {"history": rows}


# ── Ticket linking ────────────────────────────────────────────────────────────

@router.post("/{asset_id}/link-ticket", status_code=201)
def link_ticket(
    asset_id: str,
    payload: LinkTicket,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.assets WHERE id=%s AND organization_id=%s", (asset_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Asset not found")
        cur.execute("SELECT id FROM app.tickets WHERE id=%s AND organization_id=%s",
                    (payload.ticket_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Ticket not found")

        cur.execute(
            "INSERT INTO app.asset_tickets (asset_id, ticket_id, linked_by) "
            "VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
            (asset_id, payload.ticket_id, user.id)
        )
        conn.commit()

    return {"asset_id": asset_id, "ticket_id": payload.ticket_id}


# ── Software licenses ─────────────────────────────────────────────────────────

@router.get("/licenses")
def list_licenses(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
    search: Optional[str] = Query(None, max_length=100),
    expiring_days: Optional[int] = None,
    page:  int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    org_id = require_org_context(request)
    offset = (page - 1) * limit
    conditions = ["organization_id = %s"]
    params: list = [org_id]

    if search:
        conditions.append("(product_name ILIKE %s OR vendor ILIKE %s)")
        s = f"%{search}%"
        params += [s, s]
    if expiring_days is not None:
        conditions.append("expiry_date <= CURRENT_DATE + %s AND expiry_date >= CURRENT_DATE")
        params.append(expiring_days)

    where = " AND ".join(conditions)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) AS total FROM app.software_licenses WHERE {where}", params)
        total = cur.fetchone()["total"]
        cur.execute(f"""
            SELECT id, product_name, vendor, version, license_type,
                   seat_count, seats_used, purchase_date, expiry_date,
                   renewal_date, auto_renews, cost_per_year, currency,
                   vendor_contact, support_url, notes, created_at
            FROM app.software_licenses
            WHERE {where}
            ORDER BY product_name ASC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = []
        for r in cur.fetchall():
            d = dict(r)
            for k in ("purchase_date","expiry_date","renewal_date","created_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            d["seat_utilization"] = (
                round(d["seats_used"] / d["seat_count"] * 100, 1)
                if d.get("seat_count") else None
            )
            d["is_expired"] = bool(
                d.get("expiry_date") and
                date.fromisoformat(d["expiry_date"]) < date.today()
            )
            rows.append(d)

    return {"licenses": rows, "total": total, "page": page,
            "pages": math.ceil(total / limit) if total else 1}


@router.post("/licenses", status_code=201)
def create_license(
    payload: LicenseCreate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO app.software_licenses
              (organization_id, product_name, vendor, version, license_type,
               seat_count, license_key, purchase_date, expiry_date, renewal_date,
               auto_renews, cost_per_year, currency, vendor_contact, support_url,
               notes, created_by)
            VALUES (%s,%s,%s,%s,%s, %s,%s,%s,%s,%s, %s,%s,%s,%s,%s, %s,%s)
            RETURNING *
        """, (
            org_id, payload.product_name, payload.vendor, payload.version,
            payload.license_type, payload.seat_count,
            payload.license_key, payload.purchase_date or None,
            payload.expiry_date or None, payload.renewal_date or None,
            payload.auto_renews, payload.cost_per_year, payload.currency,
            payload.vendor_contact, payload.support_url, payload.notes, user.id,
        ))
        lic = dict(cur.fetchone())
        conn.commit()

    for k in ("purchase_date","expiry_date","renewal_date","created_at","updated_at"):
        if lic.get(k) and hasattr(lic[k], "isoformat"):
            lic[k] = lic[k].isoformat()
    lic.pop("license_key", None)  # never return key in response
    return lic


@router.get("/licenses/{license_id}")
def get_license(
    license_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    role = _get_role(user.id)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM app.software_licenses WHERE id=%s AND organization_id=%s",
            (license_id, org_id)
        )
        lic = cur.fetchone()
        if not lic:
            raise HTTPException(404, "License not found")
        lic = dict(lic)

        # License key only visible to admin/owner
        if role not in ("admin","owner"):
            lic.pop("license_key", None)

        # Active assignments
        cur.execute("""
            SELECT la.id, la.assigned_at, la.notes,
                   au.email AS user_email,
                   au.raw_user_meta_data->>'full_name' AS user_name,
                   a.name AS asset_name, a.asset_tag
            FROM app.license_assignments la
            LEFT JOIN auth.users au ON au.id = la.assigned_to
            LEFT JOIN app.assets a ON a.id = la.asset_id
            WHERE la.license_id = %s AND la.unassigned_at IS NULL
            ORDER BY la.assigned_at DESC
        """, (license_id,))
        assignments = []
        for r in cur.fetchall():
            d = dict(r)
            if d.get("assigned_at"):
                d["assigned_at"] = d["assigned_at"].isoformat()
            assignments.append(d)

    for k in ("purchase_date","expiry_date","renewal_date","created_at","updated_at"):
        if lic.get(k) and hasattr(lic[k], "isoformat"):
            lic[k] = lic[k].isoformat()

    lic["assignments"]      = assignments
    lic["seat_utilization"] = (
        round(lic["seats_used"] / lic["seat_count"] * 100, 1)
        if lic.get("seat_count") else None
    )
    lic["is_expired"] = bool(
        lic.get("expiry_date") and
        date.fromisoformat(lic["expiry_date"]) < date.today()
    )
    return lic


@router.put("/licenses/{license_id}")
def update_license(
    license_id: str,
    payload: LicenseUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    # Convert None-sentinel dates
    for date_field in ("purchase_date","expiry_date","renewal_date"):
        if date_field in updates and updates[date_field] == "":
            updates[date_field] = None

    if not updates:
        raise HTTPException(400, "No fields to update")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.software_licenses WHERE id=%s AND organization_id=%s",
                    (license_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "License not found")

        set_clause = ", ".join(f"{k}=%s" for k in updates)
        cur.execute(
            f"UPDATE app.software_licenses SET {set_clause} WHERE id=%s RETURNING *",
            list(updates.values()) + [license_id]
        )
        lic = dict(cur.fetchone())
        conn.commit()

    lic.pop("license_key", None)
    for k in ("purchase_date","expiry_date","renewal_date","created_at","updated_at"):
        if lic.get(k) and hasattr(lic[k], "isoformat"):
            lic[k] = lic[k].isoformat()
    return lic


@router.delete("/licenses/{license_id}", status_code=204)
def delete_license(
    license_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    role = _require_rep(user)
    if role not in ("admin","owner"):
        raise HTTPException(403, "Admin role required")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.software_licenses WHERE id=%s AND organization_id=%s",
                    (license_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "License not found")
        # Unassign all active seats first
        cur.execute(
            "UPDATE app.license_assignments SET unassigned_at=NOW() WHERE license_id=%s AND unassigned_at IS NULL",
            (license_id,)
        )
        cur.execute("DELETE FROM app.software_licenses WHERE id=%s", (license_id,))
        conn.commit()


@router.post("/licenses/{license_id}/assign", status_code=201)
def assign_license(
    license_id: str,
    payload: LicenseAssign,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    if not payload.assigned_to and not payload.asset_id:
        raise HTTPException(400, "Must specify assigned_to (user) or asset_id")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT seat_count, seats_used FROM app.software_licenses WHERE id=%s AND organization_id=%s",
            (license_id, org_id)
        )
        lic = cur.fetchone()
        if not lic:
            raise HTTPException(404, "License not found")

        # Check capacity (None = unlimited)
        if lic["seat_count"] is not None and lic["seats_used"] >= lic["seat_count"]:
            raise HTTPException(409, "No seats available on this license")

        # Prevent duplicate active assignment for same user
        if payload.assigned_to:
            cur.execute("""
                SELECT id FROM app.license_assignments
                WHERE license_id=%s AND assigned_to=%s AND unassigned_at IS NULL
            """, (license_id, payload.assigned_to))
            if cur.fetchone():
                raise HTTPException(409, "User already has an active seat on this license")

        cur.execute("""
            INSERT INTO app.license_assignments
              (license_id, organization_id, assigned_to, asset_id, assigned_by, notes)
            VALUES (%s,%s,%s,%s,%s,%s)
            RETURNING *
        """, (license_id, org_id, payload.assigned_to or None,
              payload.asset_id or None, user.id, payload.notes))
        assignment = dict(cur.fetchone())
        conn.commit()

    if assignment.get("assigned_at"):
        assignment["assigned_at"] = assignment["assigned_at"].isoformat()
    return assignment


@router.get("/platform-stats")
def asset_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Stats for the Strata Platform Hub card."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('retired','disposed'))      AS active_count,
                COUNT(*) FILTER (WHERE warranty_expiry <= CURRENT_DATE + 30
                                   AND warranty_expiry >= CURRENT_DATE
                                   AND status NOT IN ('retired','disposed'))      AS expiring_soon,
                COUNT(*) FILTER (WHERE warranty_expiry < CURRENT_DATE
                                   AND status NOT IN ('retired','disposed'))      AS expired_warranty,
                COUNT(*) FILTER (WHERE status = 'in_repair')                      AS in_repair
            FROM app.assets
            WHERE organization_id = %s
        """, (org_id,))
        row = dict(cur.fetchone())

        cur.execute("""
            SELECT COUNT(*) AS expiring_licenses
            FROM app.software_licenses
            WHERE organization_id = %s
              AND expiry_date IS NOT NULL
              AND expiry_date <= CURRENT_DATE + 30
              AND expiry_date >= CURRENT_DATE
        """, (org_id,))
        lic_row = dict(cur.fetchone())

    active         = row["active_count"] or 0
    exp_warranty   = row["expired_warranty"] or 0
    expiring_soon  = row["expiring_soon"] or 0
    in_repair      = row["in_repair"] or 0
    exp_licenses   = lic_row["expiring_licenses"] or 0

    stats: list[str] = [f"{active} asset{'s' if active != 1 else ''}"]
    if in_repair:     stats.append(f"{in_repair} in repair")
    if expiring_soon: stats.append(f"{expiring_soon} warranty expiring")
    if exp_licenses:  stats.append(f"{exp_licenses} license{'s' if exp_licenses != 1 else ''} expiring")

    health = (
        "critical" if exp_warranty > 0 or in_repair > 3
        else "warning" if expiring_soon > 0 or exp_licenses > 0
        else "healthy"
    )
    return {"stats": stats, "health": health}


@router.delete("/licenses/{license_id}/assignments/{assignment_id}", status_code=204)
def unassign_license(
    license_id: str,
    assignment_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT la.id FROM app.license_assignments la
            JOIN app.software_licenses sl ON sl.id = la.license_id
            WHERE la.id=%s AND la.license_id=%s AND sl.organization_id=%s
              AND la.unassigned_at IS NULL
        """, (assignment_id, license_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Active assignment not found")

        cur.execute(
            "UPDATE app.license_assignments SET unassigned_at=NOW() WHERE id=%s",
            (assignment_id,)
        )
        conn.commit()


# ── CASPER Proactive Intelligence — Insights API ──────────────────────────────

@router.get("/insights")
def get_insights(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Return active (non-dismissed) CASPER insights for this org."""
    org_id = require_org_context(request)

    with get_db_connection() as conn:
        cur = conn.cursor()

        conditions = ["organization_id = %s", "is_dismissed = false"]
        params: list = [org_id]

        if severity:
            conditions.append("severity = %s")
            params.append(severity)

        where = " AND ".join(conditions)
        cur.execute(f"""
            SELECT id, insight_type, severity, title, body,
                   action_type, action_payload, ref_type, ref_id, ref_label,
                   created_at, refreshed_at, expires_at
            FROM app.casper_insights
            WHERE {where}
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY
                CASE severity
                    WHEN 'critical' THEN 1
                    WHEN 'warning'  THEN 2
                    WHEN 'notice'   THEN 3
                    ELSE 4
                END,
                refreshed_at DESC
            LIMIT %s
        """, params + [limit])

        insights = []
        for r in cur.fetchall():
            d = dict(r)
            for k in ("created_at","refreshed_at","expires_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            d["id"] = str(d["id"])
            if d.get("ref_id"):
                d["ref_id"] = str(d["ref_id"])
            insights.append(d)

        # Last scan info
        from .casper.asset_intelligence import get_last_run_info
        last_run = get_last_run_info(cur, org_id)

        # Count by severity
        cur.execute("""
            SELECT severity, COUNT(*) AS cnt
            FROM app.casper_insights
            WHERE organization_id = %s AND is_dismissed = false
              AND (expires_at IS NULL OR expires_at > NOW())
            GROUP BY severity
        """, (org_id,))
        counts = {r["severity"]: r["cnt"] for r in cur.fetchall()}

    return {
        "insights":  insights,
        "total":     len(insights),
        "counts":    counts,
        "last_run":  last_run,
    }


@router.post("/insights/refresh", status_code=202)
def refresh_insights(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Trigger CASPER to immediately scan this org and refresh insights."""
    org_id = require_org_context(request)
    _require_rep(user)

    import threading
    from .casper.asset_intelligence import run_all_agents_for_org

    def _run():
        try:
            run_all_agents_for_org(org_id)
        except Exception as e:
            logger.exception("Insight refresh failed for org %s: %s", org_id, e)

    threading.Thread(target=_run, daemon=True).start()
    return {"status": "refresh_started", "org_id": org_id}


@router.post("/insights/{insight_id}/dismiss", status_code=200)
def dismiss_insight(
    insight_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """Dismiss an insight (hides it until CASPER refreshes it as new)."""
    org_id = require_org_context(request)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE app.casper_insights
            SET is_dismissed = true, dismissed_at = NOW(), dismissed_by = %s
            WHERE id = %s AND organization_id = %s
            RETURNING id
        """, (user.id, insight_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Insight not found")
        conn.commit()

    return {"dismissed": True, "insight_id": insight_id}


@router.post("/insights/{insight_id}/act")
def act_on_insight(
    insight_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("assets"),
):
    """
    Execute the action recommended by a CASPER insight.
    Actions supported:
      - create_ticket: opens a ticket linked to the asset/license
      - view_asset: returns asset_id for frontend routing
      - view_license: returns license_id for frontend routing
      - change_status: returns asset_id + suggested_status for frontend confirm
    """
    org_id = require_org_context(request)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT action_type, action_payload, ref_type, ref_id, title, body
            FROM app.casper_insights
            WHERE id = %s AND organization_id = %s AND is_dismissed = false
        """, (insight_id, org_id))
        insight = cur.fetchone()
        if not insight:
            raise HTTPException(404, "Insight not found or already dismissed")

        action  = insight["action_type"]
        payload = insight["action_payload"] or {}

        result: dict = {"action": action}

        if action == "create_ticket":
            # Create ticket linked to asset/license, auto-assign via CASPER
            asset_id_str  = payload.get("asset_id")
            ticket_title  = payload.get("title", insight["title"])
            ticket_body   = payload.get("body", insight["body"] or "")
            priority      = payload.get("priority", "medium")

            cur.execute("""
                INSERT INTO app.tickets
                    (organization_id, title, description, status, priority_level, created_by)
                VALUES (%s, %s, %s, 'open', %s, %s)
                RETURNING id
            """, (org_id, ticket_title, ticket_body, priority, user.id))
            ticket_id = str(cur.fetchone()["id"])

            # Link to asset if provided
            if asset_id_str:
                cur.execute(
                    "INSERT INTO app.asset_tickets (asset_id, ticket_id, linked_by) "
                    "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    (asset_id_str, ticket_id, user.id)
                )

            # Mark insight as actioned
            cur.execute("""
                UPDATE app.casper_insights
                SET auto_actioned = true, auto_actioned_at = NOW(), is_dismissed = true, dismissed_at = NOW()
                WHERE id = %s
            """, (insight_id,))

            conn.commit()
            result["ticket_id"] = ticket_id
            result["redirect"]  = f"/tickets/{ticket_id}"

        elif action in ("view_asset", "change_status"):
            result["asset_id"] = str(insight["ref_id"]) if insight["ref_id"] else payload.get("asset_id")
            if action == "change_status":
                result["suggested_status"] = payload.get("suggest_status", "retired")

        elif action == "view_license":
            result["license_id"] = str(insight["ref_id"]) if insight["ref_id"] else payload.get("license_id")

        elif action == "view_contract":
            result["contract_id"] = str(insight["ref_id"]) if insight["ref_id"] else payload.get("contract_id")

        else:
            result["payload"] = payload

    return result
