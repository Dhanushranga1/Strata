"""
CostLens — IT Cost Intelligence & Optimisation.

No new schema — all insights are computed from:
  app.assets, app.software_licenses, app.contracts, app.purchase_requests
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Request

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/costlens", tags=["costlens"])


# ── Platform-stats endpoint (used by Strata hub) ──────────────────────────────

@router.get("/platform-stats")
def costlens_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("cost_lens"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Total annual software spend
        cur.execute(
            "SELECT COALESCE(SUM(cost_per_year), 0) FROM app.software_licenses WHERE organization_id = %s",
            (org_id,),
        )
        annual_sw = float(cur.fetchone()[0] or 0)

        # Unused license count
        cur.execute(
            """SELECT COUNT(*) FROM app.software_licenses
               WHERE organization_id = %s AND seat_count > 0
               AND CAST(seats_used AS float) / seat_count < 0.6""",
            (org_id,),
        )
        unused_count = cur.fetchone()[0] or 0

        # Contracts expiring in 90 days
        cur.execute(
            """SELECT COUNT(*) FROM app.contracts
               WHERE organization_id = %s AND status = 'active'
               AND end_date BETWEEN %s AND %s""",
            (org_id, date.today(), date.today() + timedelta(days=90)),
        )
        expiring_soon = cur.fetchone()[0] or 0

    health = "critical" if unused_count > 5 else "warning" if unused_count > 0 or expiring_soon > 0 else "healthy"
    stats = [f"${annual_sw:,.0f}/yr SW spend"]
    if unused_count:
        stats.append(f"{unused_count} unused licenses")
    if expiring_soon:
        stats.append(f"{expiring_soon} renewing soon")

    return {"stats": stats, "health": health}


# ── Main summary endpoint ─────────────────────────────────────────────────────

@router.get("/summary")
def costlens_summary(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("cost_lens"),
):
    """Full cost intelligence summary — all insight categories."""
    org_id = require_org_context(request)
    today  = date.today()

    with get_db_connection() as conn:
        cur = conn.cursor()

        # ── 1. Unused software licenses ───────────────────────────────────────
        cur.execute(
            """SELECT id, product_name, vendor, seat_count, seats_used,
                      cost_per_year, expiry_date
               FROM app.software_licenses
               WHERE organization_id = %s AND seat_count > 0
               AND CAST(seats_used AS float) / seat_count < 0.6
               ORDER BY cost_per_year DESC NULLS LAST
               LIMIT 10""",
            (org_id,),
        )
        unused_licenses = []
        for r in cur.fetchall():
            utilisation = round((r["seats_used"] or 0) / r["seat_count"] * 100, 1)
            wasted_seats = r["seat_count"] - (r["seats_used"] or 0)
            annual = float(r["cost_per_year"] or 0)
            saving  = round(annual * (1 - utilisation / 100), 2) if annual else None
            unused_licenses.append({
                "id":           str(r["id"]),
                "product":      r["product_name"],
                "vendor":       r["vendor"],
                "seat_count":   r["seat_count"],
                "seats_used":   r["seats_used"] or 0,
                "utilisation":  utilisation,
                "wasted_seats": wasted_seats,
                "cost_per_year":annual,
                "potential_saving": saving,
                "expiry_date":  str(r["expiry_date"]) if r.get("expiry_date") else None,
            })

        # ── 2. Idle assets (no tickets linked in 90+ days, still assigned) ───
        cur.execute(
            """SELECT a.id, a.name, a.asset_tag, a.category,
                      a.purchase_price, a.purchase_date, a.department,
                      au.email AS assigned_email
               FROM app.assets a
               LEFT JOIN auth.users au ON au.id = a.assigned_to
               WHERE a.organization_id = %s AND a.status = 'active'
               AND a.assigned_to IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM app.asset_tickets at2
                 JOIN app.tickets t ON t.id = at2.ticket_id
                 WHERE at2.asset_id = a.id
                 AND t.created_at > %s
               )
               ORDER BY a.purchase_price DESC NULLS LAST
               LIMIT 10""",
            (org_id, today - timedelta(days=90)),
        )
        idle_assets = [
            {
                "id":             str(r["id"]),
                "name":           r["name"],
                "asset_tag":      r["asset_tag"],
                "category":       r["category"],
                "purchase_price": float(r["purchase_price"]) if r.get("purchase_price") else None,
                "department":     r["department"],
                "assigned_to":    r["assigned_email"],
            }
            for r in cur.fetchall()
        ]

        # ── 3. Upcoming renewals (next 90 days) ───────────────────────────────
        cur.execute(
            """SELECT c.id, c.title, c.value, c.end_date, c.auto_renews,
                      c.notice_period_days, v.name AS vendor_name
               FROM app.contracts c
               LEFT JOIN app.vendors v ON v.id = c.vendor_id
               WHERE c.organization_id = %s AND c.status = 'active'
               AND c.end_date BETWEEN %s AND %s
               ORDER BY c.end_date ASC""",
            (org_id, today, today + timedelta(days=90)),
        )
        upcoming_renewals = [
            {
                "id":                  str(r["id"]),
                "title":               r["title"],
                "vendor":              r["vendor_name"],
                "end_date":            str(r["end_date"]),
                "days_until_expiry":   (r["end_date"] - today).days,
                "value":               float(r["value"]) if r.get("value") else None,
                "auto_renews":         r["auto_renews"],
                "notice_period_days":  r["notice_period_days"],
            }
            for r in cur.fetchall()
        ]

        # ── 4. Department spend (assets) ──────────────────────────────────────
        cur.execute(
            """SELECT COALESCE(department, 'Unassigned') AS department,
                      COUNT(*) AS asset_count,
                      COALESCE(SUM(purchase_price), 0) AS total_spend
               FROM app.assets
               WHERE organization_id = %s AND status != 'disposed'
               GROUP BY department
               ORDER BY total_spend DESC""",
            (org_id,),
        )
        dept_spend = [
            {
                "department":  r["department"],
                "asset_count": r["asset_count"],
                "total_spend": float(r["total_spend"]),
            }
            for r in cur.fetchall()
        ]

        # ── 5. Total software spend by vendor ─────────────────────────────────
        cur.execute(
            """SELECT COALESCE(vendor, 'Unknown') AS vendor,
                      COUNT(*) AS license_count,
                      COALESCE(SUM(cost_per_year), 0) AS annual_spend
               FROM app.software_licenses
               WHERE organization_id = %s
               GROUP BY vendor
               ORDER BY annual_spend DESC
               LIMIT 10""",
            (org_id,),
        )
        vendor_spend = [
            {
                "vendor":        r["vendor"],
                "license_count": r["license_count"],
                "annual_spend":  float(r["annual_spend"]),
            }
            for r in cur.fetchall()
        ]

        # ── Summary totals ────────────────────────────────────────────────────
        cur.execute(
            "SELECT COALESCE(SUM(cost_per_year), 0) FROM app.software_licenses WHERE organization_id = %s",
            (org_id,),
        )
        total_sw_spend = float(cur.fetchone()[0] or 0)

        cur.execute(
            "SELECT COALESCE(SUM(value), 0) FROM app.contracts WHERE organization_id = %s AND status = 'active'",
            (org_id,),
        )
        total_contract_value = float(cur.fetchone()[0] or 0)

        cur.execute(
            "SELECT COALESCE(SUM(purchase_price), 0) FROM app.assets WHERE organization_id = %s AND status != 'disposed'",
            (org_id,),
        )
        total_asset_value = float(cur.fetchone()[0] or 0)

    potential_savings = sum(
        lic["potential_saving"] or 0 for lic in unused_licenses if lic.get("potential_saving")
    )

    return {
        "totals": {
            "software_spend_annual": total_sw_spend,
            "contract_value_active": total_contract_value,
            "asset_book_value":      total_asset_value,
            "potential_savings":     round(potential_savings, 2),
        },
        "unused_licenses":    unused_licenses,
        "idle_assets":        idle_assets,
        "upcoming_renewals":  upcoming_renewals,
        "department_spend":   dept_spend,
        "vendor_spend":       vendor_spend,
    }
