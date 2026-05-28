"""
ContractVault — Vendor directory and contract lifecycle management.

Provides: vendor CRUD, contract CRUD with renewal tracking,
asset linking, audit history, CASPER entity embedding.
CASPER renewal agent plugs into asset_intelligence._AGENTS at startup.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contracts", tags=["contractvault"])

# ── Permission helpers ────────────────────────────────────────────────────────

def _require_rep(user: User) -> str:
    try:
        from .roles import get_user_role
        role = get_user_role(user.id)
    except Exception:
        role = "customer"
    if role not in ("rep", "admin", "owner"):
        raise HTTPException(403, "Rep or admin role required")
    return role


def _log_history(cursor, contract_id: str, org_id: str, user_id: str,
                 event_type: str, field: str = None, old: str = None,
                 new: str = None, note: str = None):
    cursor.execute(
        "INSERT INTO app.contract_history "
        "(contract_id, organization_id, changed_by, event_type, field_changed, old_value, new_value, note) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (contract_id, org_id, user_id, event_type, field, old, new, note),
    )


# ── Pydantic models ───────────────────────────────────────────────────────────

class VendorCreate(BaseModel):
    name:                  str
    category:              Optional[str]  = None
    website:               Optional[str]  = None
    support_email:         Optional[str]  = None
    support_phone:         Optional[str]  = None
    account_manager:       Optional[str]  = None
    account_manager_email: Optional[str]  = None
    address:               Optional[str]  = None
    notes:                 Optional[str]  = None
    is_preferred:          bool           = False


class VendorUpdate(BaseModel):
    name:                  Optional[str]  = None
    category:              Optional[str]  = None
    website:               Optional[str]  = None
    support_email:         Optional[str]  = None
    support_phone:         Optional[str]  = None
    account_manager:       Optional[str]  = None
    account_manager_email: Optional[str]  = None
    address:               Optional[str]  = None
    notes:                 Optional[str]  = None
    is_preferred:          Optional[bool] = None


class ContractCreate(BaseModel):
    title:               str
    vendor_id:           Optional[str]   = None
    contract_number:     Optional[str]   = None
    status:              str             = "active"
    contract_type:       Optional[str]   = None
    description:         Optional[str]   = None
    start_date:          Optional[str]   = None
    end_date:            Optional[str]   = None
    renewal_date:        Optional[str]   = None
    auto_renews:         bool            = False
    renewal_notice_days: int             = 30
    total_value:         Optional[float] = None
    currency:            str             = "USD"
    payment_schedule:    Optional[str]   = None
    payment_amount:      Optional[float] = None
    key_terms:           Dict[str, Any]  = {}
    document_url:        Optional[str]   = None
    owner_id:            Optional[str]   = None


class ContractUpdate(BaseModel):
    title:               Optional[str]   = None
    vendor_id:           Optional[str]   = None
    contract_number:     Optional[str]   = None
    status:              Optional[str]   = None
    contract_type:       Optional[str]   = None
    description:         Optional[str]   = None
    start_date:          Optional[str]   = None
    end_date:            Optional[str]   = None
    renewal_date:        Optional[str]   = None
    auto_renews:         Optional[bool]  = None
    renewal_notice_days: Optional[int]   = None
    total_value:         Optional[float] = None
    currency:            Optional[str]   = None
    payment_schedule:    Optional[str]   = None
    payment_amount:      Optional[float] = None
    key_terms:           Optional[Dict[str, Any]] = None
    document_url:        Optional[str]   = None
    owner_id:            Optional[str]   = None


class LinkAsset(BaseModel):
    asset_id: str


# ── Serialisers ───────────────────────────────────────────────────────────────

def _vendor_row(row: Dict) -> Dict:
    d = dict(row)
    for k in ("created_at","updated_at"):
        if d.get(k) and hasattr(d[k], "isoformat"):
            d[k] = d[k].isoformat()
    return d


def _contract_row(row: Dict) -> Dict:
    d = dict(row)
    for k in ("start_date","end_date","renewal_date","created_at","updated_at"):
        if d.get(k) and hasattr(d[k], "isoformat"):
            d[k] = d[k].isoformat()
    # Annotate expiry status
    if d.get("end_date"):
        end = date.fromisoformat(d["end_date"])
        days_left = (end - date.today()).days
        d["days_until_expiry"] = days_left
        d["is_expired"]        = days_left < 0
        d["expiry_status"] = (
            "expired"  if days_left < 0  else
            "critical" if days_left <= 30 else
            "warning"  if days_left <= 90 else
            "ok"
        )
    else:
        d["days_until_expiry"] = None
        d["is_expired"]        = False
        d["expiry_status"]     = "ok"
    return d


# ── Vendors CRUD ──────────────────────────────────────────────────────────────

@router.get("/vendors")
def list_vendors(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
    search:    Optional[str] = Query(None, max_length=100),
    category:  Optional[str] = None,
    preferred: Optional[bool] = None,
    page:  int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    org_id = require_org_context(request)
    offset = (page - 1) * limit
    conditions = ["organization_id = %s"]
    params: list = [org_id]

    if search:
        conditions.append("(name ILIKE %s OR support_email ILIKE %s OR account_manager ILIKE %s)")
        s = f"%{search}%"
        params += [s, s, s]
    if category:
        conditions.append("category = %s"); params.append(category)
    if preferred is not None:
        conditions.append("is_preferred = %s"); params.append(preferred)

    where = " AND ".join(conditions)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) AS total FROM app.vendors WHERE {where}", params)
        total = cur.fetchone()["total"]
        cur.execute(f"""
            SELECT v.*,
                   COUNT(c.id) FILTER (WHERE c.status = 'active') AS active_contracts,
                   COUNT(c.id) AS total_contracts
            FROM app.vendors v
            LEFT JOIN app.contracts c ON c.vendor_id = v.id
            WHERE {where}
            GROUP BY v.id
            ORDER BY v.is_preferred DESC, v.name ASC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = [_vendor_row(dict(r)) for r in cur.fetchall()]

    return {"vendors": rows, "total": total, "page": page,
            "pages": math.ceil(total / limit) if total else 1}


@router.post("/vendors", status_code=201)
def create_vendor(
    payload: VendorCreate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO app.vendors
              (organization_id, name, category, website, support_email, support_phone,
               account_manager, account_manager_email, address, notes, is_preferred, created_by)
            VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s,%s)
            RETURNING *
        """, (
            org_id, payload.name, payload.category, payload.website,
            payload.support_email, payload.support_phone,
            payload.account_manager, payload.account_manager_email,
            payload.address, payload.notes, payload.is_preferred, user.id,
        ))
        vendor = cur.fetchone()
        conn.commit()

    return _vendor_row(dict(vendor))


@router.get("/vendors/{vendor_id}")
def get_vendor(
    vendor_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM app.vendors WHERE id=%s AND organization_id=%s", (vendor_id, org_id))
        v = cur.fetchone()
        if not v:
            raise HTTPException(404, "Vendor not found")

        cur.execute("""
            SELECT c.id, c.title, c.status, c.contract_type, c.end_date,
                   c.total_value, c.currency, c.renewal_date, c.auto_renews, c.created_at
            FROM app.contracts c
            WHERE c.vendor_id = %s AND c.organization_id = %s
            ORDER BY c.created_at DESC
        """, (vendor_id, org_id))
        contracts = [_contract_row(dict(r)) for r in cur.fetchall()]

    result = _vendor_row(dict(v))
    result["contracts"] = contracts
    return result


@router.put("/vendors/{vendor_id}")
def update_vendor(
    vendor_id: str,
    payload: VendorUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.vendors WHERE id=%s AND organization_id=%s", (vendor_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Vendor not found")

        set_clause = ", ".join(f"{k}=%s" for k in updates)
        cur.execute(f"UPDATE app.vendors SET {set_clause} WHERE id=%s RETURNING *",
                    list(updates.values()) + [vendor_id])
        vendor = cur.fetchone()
        conn.commit()

    return _vendor_row(dict(vendor))


@router.delete("/vendors/{vendor_id}", status_code=204)
def delete_vendor(
    vendor_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    role = _require_rep(user)
    if role not in ("admin","owner"):
        raise HTTPException(403, "Admin role required")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.vendors WHERE id=%s AND organization_id=%s", (vendor_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Vendor not found")
        cur.execute("DELETE FROM app.vendors WHERE id=%s", (vendor_id,))
        conn.commit()


# ── Contracts CRUD ─────────────────────────────────────────────────────────────

@router.get("")
def list_contracts(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
    search:     Optional[str] = Query(None, max_length=100),
    status:     Optional[str] = None,
    vendor_id:  Optional[str] = None,
    asset_id:   Optional[str] = None,
    expiring:   Optional[int] = None,   # days
    page:  int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    org_id = require_org_context(request)
    offset = (page - 1) * limit
    conditions = ["c.organization_id = %s"]
    params: list = [org_id]

    if search:
        conditions.append("(c.title ILIKE %s OR c.contract_number ILIKE %s OR v.name ILIKE %s)")
        s = f"%{search}%"
        params += [s, s, s]
    if status:
        conditions.append("c.status = %s"); params.append(status)
    if vendor_id:
        conditions.append("c.vendor_id = %s"); params.append(vendor_id)
    if asset_id:
        conditions.append(
            "c.id IN (SELECT contract_id FROM app.contract_assets WHERE asset_id = %s)"
        )
        params.append(asset_id)
    if expiring is not None:
        conditions.append("c.end_date <= CURRENT_DATE + %s AND c.end_date >= CURRENT_DATE")
        params.append(expiring)

    where = " AND ".join(conditions)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT COUNT(*) AS total
            FROM app.contracts c
            LEFT JOIN app.vendors v ON v.id = c.vendor_id
            WHERE {where}
        """, params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT c.*,
                   v.name AS vendor_name, v.category AS vendor_category,
                   ou.email AS owner_email
            FROM app.contracts c
            LEFT JOIN app.vendors v ON v.id = c.vendor_id
            LEFT JOIN auth.users ou ON ou.id = c.owner_id
            WHERE {where}
            ORDER BY
                CASE c.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
                c.end_date ASC NULLS LAST,
                c.created_at DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = [_contract_row(dict(r)) for r in cur.fetchall()]

    return {"contracts": rows, "total": total, "page": page,
            "pages": math.ceil(total / limit) if total else 1}


@router.post("", status_code=201)
def create_contract(
    payload: ContractCreate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Validate vendor belongs to this org
        if payload.vendor_id:
            cur.execute("SELECT id FROM app.vendors WHERE id=%s AND organization_id=%s",
                        (payload.vendor_id, org_id))
            if not cur.fetchone():
                raise HTTPException(404, "Vendor not found")

        cur.execute("""
            INSERT INTO app.contracts
              (organization_id, vendor_id, contract_number, title, status, contract_type,
               description, start_date, end_date, renewal_date, auto_renews, renewal_notice_days,
               total_value, currency, payment_schedule, payment_amount,
               key_terms, document_url, owner_id, created_by)
            VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s)
            RETURNING *
        """, (
            org_id, payload.vendor_id or None, payload.contract_number, payload.title,
            payload.status, payload.contract_type, payload.description,
            payload.start_date or None, payload.end_date or None, payload.renewal_date or None,
            payload.auto_renews, payload.renewal_notice_days,
            payload.total_value, payload.currency, payload.payment_schedule, payload.payment_amount,
            json.dumps(payload.key_terms), payload.document_url,
            payload.owner_id or None, user.id,
        ))
        contract = cur.fetchone()
        contract_id = str(contract["id"])

        _log_history(cur, contract_id, org_id, user.id, "created",
                     note=f"Contract '{payload.title}' created")
        conn.commit()

    # Background CASPER embedding
    try:
        from .casper import casper_engine
        text = f"[contract] {payload.title} {payload.contract_type or ''} {payload.description or ''}"
        casper_engine.embed_entity("contract", contract_id, text, org_id)
    except Exception:
        pass

    return _contract_row(dict(contract))


@router.get("/dashboard")
def contracts_dashboard(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    """Summary stats for the contracts dashboard."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'active')      AS active_count,
                COUNT(*) FILTER (WHERE status = 'draft')       AS draft_count,
                COUNT(*) FILTER (WHERE status = 'expired')     AS expired_count,
                COUNT(*) FILTER (WHERE end_date < CURRENT_DATE AND status = 'active') AS auto_expired,
                COALESCE(SUM(total_value) FILTER (WHERE status = 'active'), 0) AS total_active_value,
                COUNT(*) FILTER (
                    WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
                    AND status = 'active'
                ) AS expiring_90d
            FROM app.contracts WHERE organization_id = %s
        """, (org_id,))
        counts = dict(cur.fetchone())

        cur.execute("""
            SELECT c.id, c.title, c.status, c.end_date, c.total_value, c.currency,
                   v.name AS vendor_name,
                   (c.end_date - CURRENT_DATE) AS days_until
            FROM app.contracts c
            LEFT JOIN app.vendors v ON v.id = c.vendor_id
            WHERE c.organization_id = %s
              AND c.end_date IS NOT NULL
              AND c.end_date <= CURRENT_DATE + 90
              AND c.status = 'active'
            ORDER BY c.end_date ASC
            LIMIT 10
        """, (org_id,))
        expiring = []
        for r in cur.fetchall():
            d = dict(r)
            if d.get("end_date"): d["end_date"] = d["end_date"].isoformat()
            expiring.append(d)

        cur.execute("SELECT COUNT(*) AS cnt FROM app.vendors WHERE organization_id=%s", (org_id,))
        vendor_count = cur.fetchone()["cnt"]

    for k in ("total_active_value",):
        counts[k] = float(counts[k])

    return {**counts, "expiring_soon": expiring, "vendor_count": vendor_count}


@router.get("/platform-stats")
def contracts_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    """Stats for the Strata Platform Hub card."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'active')                          AS active,
                COUNT(*) FILTER (WHERE end_date <= CURRENT_DATE + 30 AND status = 'active') AS expiring_30d,
                COUNT(*) FILTER (WHERE end_date < CURRENT_DATE AND status = 'active')       AS overdue
            FROM app.contracts WHERE organization_id = %s
        """, (org_id,))
        row = dict(cur.fetchone())
        cur.execute("SELECT COUNT(*) AS cnt FROM app.vendors WHERE organization_id=%s", (org_id,))
        vendors = cur.fetchone()["cnt"]

    active    = row["active"] or 0
    exp30     = row["expiring_30d"] or 0
    overdue   = row["overdue"] or 0

    stats = [f"{vendors} vendor{'s' if vendors != 1 else ''}",
             f"{active} active contract{'s' if active != 1 else ''}"]
    if exp30:   stats.append(f"{exp30} renewing soon")
    if overdue: stats.append(f"{overdue} expired")

    health = "critical" if overdue > 0 else "warning" if exp30 > 0 else "healthy"
    return {"stats": stats, "health": health}


@router.get("/calendar")
def contracts_calendar(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
    months: int = Query(6, ge=1, le=24),
):
    """Return contracts grouped by expiry month for the calendar view."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT c.id, c.title, c.status, c.end_date, c.renewal_date,
                   c.total_value, c.currency, c.auto_renews,
                   c.renewal_notice_days,
                   v.name AS vendor_name,
                   (c.end_date - CURRENT_DATE) AS days_until_end
            FROM app.contracts c
            LEFT JOIN app.vendors v ON v.id = c.vendor_id
            WHERE c.organization_id = %s
              AND c.status IN ('active','draft')
              AND c.end_date IS NOT NULL
              AND c.end_date >= CURRENT_DATE - INTERVAL '7 days'
              AND c.end_date <= CURRENT_DATE + (%s || ' months')::interval
            ORDER BY c.end_date ASC
        """, (org_id, str(months)))
        rows = cur.fetchall()

    # Group by YYYY-MM
    from collections import defaultdict
    by_month: Dict[str, List] = defaultdict(list)
    for r in rows:
        d = dict(r)
        key = d["end_date"].strftime("%Y-%m")
        d["end_date"] = d["end_date"].isoformat()
        if d.get("renewal_date"):
            d["renewal_date"] = d["renewal_date"].isoformat()
        days = int(d["days_until_end"] or 0)
        d["days_until_end"] = days
        d["expiry_status"] = (
            "expired"  if days < 0   else
            "critical" if days <= 30 else
            "warning"  if days <= 90 else
            "ok"
        )
        by_month[key].append(d)

    return {"calendar": dict(by_month), "months": months}


@router.get("/vendors/{vendor_id}/analytics")
def vendor_analytics(
    vendor_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    """Detailed spend, contract health, and risk profile for a vendor."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM app.vendors WHERE id=%s AND organization_id=%s", (vendor_id, org_id))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(404, "Vendor not found")

        cur.execute("""
            SELECT
                COUNT(*)                                         AS total_contracts,
                COUNT(*) FILTER (WHERE status='active')         AS active_contracts,
                COUNT(*) FILTER (WHERE status='expired')        AS expired_contracts,
                COUNT(*) FILTER (WHERE status IN ('terminated','renewed')) AS closed_contracts,
                COALESCE(SUM(total_value) FILTER (WHERE status='active'), 0)  AS active_value,
                COALESCE(SUM(total_value), 0)                   AS total_value,
                MAX(end_date) FILTER (WHERE status='active')    AS latest_expiry,
                MIN(end_date) FILTER (WHERE status='active')    AS soonest_expiry,
                COUNT(*) FILTER (WHERE end_date<=CURRENT_DATE+30 AND status='active') AS critical_expiring,
                AVG(total_value) FILTER (WHERE total_value IS NOT NULL) AS avg_contract_value
            FROM app.contracts
            WHERE vendor_id=%s AND organization_id=%s
        """, (vendor_id, org_id))
        stats = dict(cur.fetchone())
        for k in ("active_value","total_value","avg_contract_value"):
            stats[k] = float(stats[k] or 0)
        for k in ("latest_expiry","soonest_expiry"):
            if stats.get(k) and hasattr(stats[k], "isoformat"):
                stats[k] = stats[k].isoformat()

        # Days until soonest expiry
        if stats.get("soonest_expiry"):
            days = (date.fromisoformat(stats["soonest_expiry"]) - date.today()).days
            stats["days_until_soonest_expiry"] = days
        else:
            stats["days_until_soonest_expiry"] = None

        # Risk score: 0-100 (higher = more risk)
        risk = 0
        if stats["critical_expiring"] > 0:        risk += 40
        if stats["expired_contracts"] > stats.get("active_contracts", 0): risk += 20
        if stats["active_contracts"] == 0:        risk += 30
        if stats.get("days_until_soonest_expiry") is not None and 0 < stats["days_until_soonest_expiry"] <= 30: risk += 10
        stats["risk_score"] = min(100, risk)
        stats["risk_level"] = "critical" if risk >= 60 else "warning" if risk >= 30 else "healthy"

        # Linked assets count
        cur.execute("""
            SELECT COUNT(ca.asset_id) AS asset_count
            FROM app.contract_assets ca
            JOIN app.contracts c ON c.id = ca.contract_id
            WHERE c.vendor_id=%s AND c.organization_id=%s
        """, (vendor_id, org_id))
        stats["covered_assets"] = cur.fetchone()["asset_count"]

    return {**_vendor_row(dict(vendor)), "analytics": stats}


@router.post("/{contract_id}/renew", status_code=201)
def renew_contract(
    contract_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    """Create a renewal contract linked to the original, mark original as 'renewed'."""
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM app.contracts WHERE id=%s AND organization_id=%s", (contract_id, org_id))
        orig = cur.fetchone()
        if not orig:
            raise HTTPException(404, "Contract not found")
        if orig["status"] not in ("active", "expired"):
            raise HTTPException(400, f"Cannot renew a contract with status '{orig['status']}'")

        # Compute new dates: start = day after original end (or today)
        from datetime import date as date_cls
        orig_end  = orig["end_date"]
        new_start = (orig_end + timedelta(days=1)) if orig_end else date_cls.today()
        duration = None
        if orig_end and orig["start_date"]:
            duration = (orig_end - orig["start_date"]).days
            new_end = new_start + timedelta(days=duration)
        elif orig_end:
            new_end = new_start + timedelta(days=365)
        else:
            new_end = None

        new_renewal = (new_end - timedelta(days=orig["renewal_notice_days"])) if new_end and orig["renewal_notice_days"] else None

        cur.execute("""
            INSERT INTO app.contracts
              (organization_id, vendor_id, contract_number, title, status, contract_type,
               description, start_date, end_date, renewal_date, auto_renews, renewal_notice_days,
               total_value, currency, payment_schedule, payment_amount,
               key_terms, document_url, owner_id, created_by)
            VALUES (%s,%s,%s,%s,'draft',%s, %s,%s,%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s)
            RETURNING *
        """, (
            org_id, orig["vendor_id"], orig["contract_number"],
            orig["title"] + " (Renewal)",
            orig["contract_type"], orig["description"],
            new_start.isoformat() if new_start else None,
            new_end.isoformat() if new_end else None,
            new_renewal.isoformat() if new_renewal else None,
            orig["auto_renews"], orig["renewal_notice_days"],
            orig["total_value"], orig["currency"] or "USD",
            orig["payment_schedule"], orig["payment_amount"],
            json.dumps(dict(orig["key_terms"] or {})),
            orig["document_url"], orig["owner_id"], user.id,
        ))
        new_contract = cur.fetchone()
        new_id = str(new_contract["id"])

        # Mark original as renewed
        cur.execute("UPDATE app.contracts SET status='renewed',updated_by=%s WHERE id=%s",
                    (user.id, contract_id))
        _log_history(cur, contract_id, org_id, user.id, "renewed",
                     note=f"Renewed → contract {new_id}")
        _log_history(cur, new_id, org_id, user.id, "created",
                     note=f"Renewal of contract {contract_id}")
        conn.commit()

    return {"renewed_id": contract_id, "new_contract": _contract_row(dict(new_contract))}


@router.post("/{contract_id}/status")
def change_contract_status(
    contract_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
    status: str = Query(...),
    note: Optional[str] = Query(None),
):
    """Quick status transition for a contract."""
    VALID = ("draft","active","expired","terminated","renewed")
    if status not in VALID:
        raise HTTPException(400, f"Invalid status '{status}'")
    org_id = require_org_context(request)
    _require_rep(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, status FROM app.contracts WHERE id=%s AND organization_id=%s", (contract_id, org_id))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(404, "Contract not found")
        old_status = existing["status"]
        cur.execute("UPDATE app.contracts SET status=%s, updated_by=%s WHERE id=%s",
                    (status, user.id, contract_id))
        _log_history(cur, contract_id, org_id, user.id, "status_changed",
                     field="status", old=old_status, new=status, note=note)
        conn.commit()
    return {"id": contract_id, "status": status}


@router.get("/{contract_id}")
def get_contract(
    contract_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT c.*,
                   v.name AS vendor_name, v.support_email AS vendor_support_email,
                   v.support_phone AS vendor_support_phone, v.account_manager,
                   ou.email AS owner_email,
                   cr.email AS creator_email
            FROM app.contracts c
            LEFT JOIN app.vendors v ON v.id = c.vendor_id
            LEFT JOIN auth.users ou ON ou.id = c.owner_id
            LEFT JOIN auth.users cr ON cr.id = c.created_by
            WHERE c.id = %s AND c.organization_id = %s
        """, (contract_id, org_id))
        contract = cur.fetchone()
        if not contract:
            raise HTTPException(404, "Contract not found")

        # Linked assets
        cur.execute("""
            SELECT a.id, a.asset_tag, a.name, a.category, a.status, ca.linked_at
            FROM app.contract_assets ca
            JOIN app.assets a ON a.id = ca.asset_id
            WHERE ca.contract_id = %s
            ORDER BY ca.linked_at DESC
        """, (contract_id,))
        assets = []
        for r in cur.fetchall():
            d = dict(r)
            if d.get("linked_at"): d["linked_at"] = d["linked_at"].isoformat()
            assets.append(d)

        # History (most recent 20)
        cur.execute("""
            SELECT ch.*, au.email AS actor_email
            FROM app.contract_history ch
            LEFT JOIN auth.users au ON au.id = ch.changed_by
            WHERE ch.contract_id = %s
            ORDER BY ch.created_at DESC LIMIT 20
        """, (contract_id,))
        history = []
        for r in cur.fetchall():
            d = dict(r)
            if d.get("created_at"): d["created_at"] = d["created_at"].isoformat()
            history.append(d)

    result = _contract_row(dict(contract))
    result["linked_assets"] = assets
    result["history"]       = history
    return result


@router.put("/{contract_id}")
def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM app.contracts WHERE id=%s AND organization_id=%s",
                    (contract_id, org_id))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(404, "Contract not found")

        data = payload.model_dump(exclude_unset=True)
        updates: dict = {}
        for field, val in data.items():
            if field == "key_terms":
                merged = dict(existing["key_terms"] or {})
                merged.update(val)
                updates["key_terms"] = json.dumps(merged)
            elif val is not None:
                updates[field] = val

        if not updates:
            return _contract_row(dict(existing))

        updates["updated_by"] = user.id
        set_clause = ", ".join(f"{k}=%s" for k in updates)
        cur.execute(
            f"UPDATE app.contracts SET {set_clause} WHERE id=%s AND organization_id=%s RETURNING *",
            list(updates.values()) + [contract_id, org_id],
        )
        updated = cur.fetchone()

        for field, new_val in updates.items():
            old_val = existing.get(field)
            if str(old_val) != str(new_val):
                _log_history(cur, contract_id, org_id, user.id, "updated",
                             field=field, old=str(old_val), new=str(new_val))
        conn.commit()

    # Re-embed
    try:
        from .casper import casper_engine
        title = updated["title"]
        casper_engine.embed_entity("contract", contract_id, f"[contract] {title}", org_id)
    except Exception:
        pass

    return _contract_row(dict(updated))


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    role = _require_rep(user)
    if role not in ("admin","owner"):
        raise HTTPException(403, "Admin role required")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.contracts WHERE id=%s AND organization_id=%s", (contract_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Contract not found")
        cur.execute("DELETE FROM app.contracts WHERE id=%s", (contract_id,))
        conn.commit()


# ── Asset linking ─────────────────────────────────────────────────────────────

@router.post("/{contract_id}/link-asset", status_code=201)
def link_asset(
    contract_id: str,
    payload: LinkAsset,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.contracts WHERE id=%s AND organization_id=%s", (contract_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Contract not found")
        cur.execute("SELECT id FROM app.assets WHERE id=%s AND organization_id=%s", (payload.asset_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Asset not found")

        cur.execute(
            "INSERT INTO app.contract_assets (contract_id, asset_id, linked_by) "
            "VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
            (contract_id, payload.asset_id, user.id)
        )
        conn.commit()

    return {"contract_id": contract_id, "asset_id": payload.asset_id}


@router.delete("/{contract_id}/link-asset/{asset_id}", status_code=204)
def unlink_asset(
    contract_id: str,
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("contracts"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.contracts WHERE id=%s AND organization_id=%s", (contract_id, org_id))
        if not cur.fetchone():
            raise HTTPException(404, "Contract not found")
        cur.execute("DELETE FROM app.contract_assets WHERE contract_id=%s AND asset_id=%s",
                    (contract_id, asset_id))
        conn.commit()
