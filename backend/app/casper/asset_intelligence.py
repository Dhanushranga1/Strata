"""
CASPER Asset Intelligence — Proactive autonomous agents for AssetLog.

Five agents run on schedule and generate typed insights stored in
app.casper_insights. Insights survive restarts; UPSERT on (org, type, ref_id)
so we refresh rather than duplicate.

Agents:
  1. WarrantyAgent      — expiring/expired warranties → alert + auto-ticket option
  2. LicenseWasteAgent  — low seat utilisation → cost savings recommendation
  3. DepreciationAgent  — fully-depreciated active assets → refresh/retirement suggestion
  4. RepairROIAgent     — expensive repairs vs remaining asset value → replace recommendation
  5. IdleAssetAgent     — assigned assets not deployed/updated for 60+ days → reallocation flag
  6. LicenseExpiryAgent — licenses expiring soon → renewal reminder
  7. ContractRenewalAgent (pluggable) — ContractVault hooks in here when built

Each agent is a function: run_<name>(cursor, org_id) → list[InsightPayload]
The scheduler calls all agents per org and upserts results.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Payload type ──────────────────────────────────────────────────────────────

@dataclass
class InsightPayload:
    insight_type:   str
    severity:       str   # critical | warning | notice | info
    title:          str
    body:           str
    action_type:    Optional[str]          = None
    action_payload: Dict[str, Any]         = field(default_factory=dict)
    ref_type:       Optional[str]          = None
    ref_id:         Optional[str]          = None
    ref_label:      Optional[str]          = None
    expires_days:   int                    = 30   # auto-expire after N days


# ── Individual agents ─────────────────────────────────────────────────────────

def run_warranty_agent(cursor, org_id: str) -> List[InsightPayload]:
    """Flag assets with warranty expiring ≤90 days or already expired."""
    cursor.execute("""
        SELECT id, asset_tag, name, category, warranty_expiry,
               (warranty_expiry - CURRENT_DATE) AS days_until
        FROM app.assets
        WHERE organization_id = %s
          AND warranty_expiry IS NOT NULL
          AND status NOT IN ('retired','disposed')
          AND warranty_expiry <= CURRENT_DATE + INTERVAL '90 days'
        ORDER BY warranty_expiry ASC
    """, (org_id,))
    rows = cursor.fetchall()
    insights: List[InsightPayload] = []

    for r in rows:
        days = r["days_until"]
        tag  = r["asset_tag"]
        name = r["name"]
        exp  = r["warranty_expiry"].isoformat() if r["warranty_expiry"] else ""

        if days < 0:
            severity = "critical"
            title    = f"Warranty expired: {name} ({tag})"
            body     = (f"Warranty expired {abs(days)} days ago ({exp}). "
                        f"This {r['category']} is operating without manufacturer coverage. "
                        f"CASPER recommends opening a renewal or replacement ticket immediately.")
        elif days <= 14:
            severity = "critical"
            title    = f"Warranty expiring in {days} days: {tag}"
            body     = (f"{name} warranty expires {exp}. "
                        f"Less than 2 weeks remaining. CASPER recommends scheduling renewal.")
        elif days <= 30:
            severity = "warning"
            title    = f"Warranty expiring in {days} days: {tag}"
            body     = (f"{name} ({r['category']}) warranty expires {exp}. "
                        f"Contact vendor or budget for replacement.")
        else:
            severity = "notice"
            title    = f"Warranty expiring in {days} days: {tag}"
            body     = f"{name} ({r['category']}) warranty expires {exp}. Review renewal options."

        insights.append(InsightPayload(
            insight_type   = "warranty_expiry",
            severity       = severity,
            title          = title,
            body           = body,
            action_type    = "create_ticket",
            action_payload = {
                "title":    f"[AssetLog] Warranty action required: {name} ({tag})",
                "body":     body,
                "asset_id": str(r["id"]),
                "priority": "urgent" if days < 0 else "high" if days <= 14 else "medium",
            },
            ref_type   = "asset",
            ref_id     = str(r["id"]),
            ref_label  = f"{tag} · {name}",
            expires_days = 7,
        ))
    return insights


def run_license_waste_agent(cursor, org_id: str) -> List[InsightPayload]:
    """Flag licenses with <60% seat utilization for cost optimisation."""
    cursor.execute("""
        SELECT id, product_name, vendor, seat_count, seats_used,
               cost_per_year, currency,
               ROUND(seats_used::numeric / NULLIF(seat_count,0) * 100, 1) AS utilization_pct,
               created_at
        FROM app.software_licenses
        WHERE organization_id = %s
          AND seat_count IS NOT NULL
          AND seat_count > 5
          AND seats_used::float / seat_count < 0.60
          AND created_at < NOW() - INTERVAL '30 days'
        ORDER BY (seat_count - seats_used) * COALESCE(cost_per_year / NULLIF(seat_count,0), 0) DESC
    """, (org_id,))

    insights: List[InsightPayload] = []
    for r in cursor.fetchall():
        unused   = r["seat_count"] - r["seats_used"]
        pct      = float(r["utilization_pct"] or 0)
        annual   = float(r["cost_per_year"] or 0)
        currency = r["currency"] or "USD"
        waste    = round(annual * (unused / r["seat_count"]), 2) if annual else None

        body = (f"{r['product_name']} ({r['vendor'] or 'unknown vendor'}): "
                f"{r['seats_used']}/{r['seat_count']} seats used ({pct:.0f}%). "
                f"{unused} seats are idle.")
        if waste:
            body += f" Estimated annual waste: {currency} {waste:,.0f}."
        body += " CASPER recommends reducing the seat count or reassigning unused licenses."

        insights.append(InsightPayload(
            insight_type   = "license_waste",
            severity       = "warning" if pct < 40 else "notice",
            title          = f"License underutilised: {r['product_name']} ({pct:.0f}% used)",
            body           = body,
            action_type    = "view_license",
            action_payload = {
                "license_id":  str(r["id"]),
                "idle_seats":  unused,
                "annual_waste": waste,
                "currency":    currency,
            },
            ref_type   = "license",
            ref_id     = str(r["id"]),
            ref_label  = r["product_name"],
            expires_days = 30,
        ))
    return insights


def run_depreciation_agent(cursor, org_id: str) -> List[InsightPayload]:
    """Flag fully-depreciated assets still in active use."""
    cursor.execute("""
        SELECT id, asset_tag, name, category, purchase_date, purchase_price,
               currency, depreciation_years,
               (CURRENT_DATE - purchase_date) / 365.25 AS years_owned
        FROM app.assets
        WHERE organization_id = %s
          AND status IN ('active','deployed')
          AND purchase_date IS NOT NULL
          AND purchase_price IS NOT NULL
          AND purchase_price > 0
          AND (CURRENT_DATE - purchase_date) / 365.25 >= depreciation_years
        ORDER BY purchase_date ASC
        LIMIT 20
    """, (org_id,))

    insights: List[InsightPayload] = []
    for r in cursor.fetchall():
        years   = float(r["years_owned"])
        age_str = f"{years:.1f} years old"
        price   = float(r["purchase_price"])
        currency= r["currency"] or "USD"

        body = (f"{r['name']} ({r['asset_tag']}) is {age_str} — original cost {currency} {price:,.0f}. "
                f"It has exceeded its {r['depreciation_years']}-year depreciation period and carries "
                f"no book value. CASPER recommends reviewing for refresh, retirement, or disposal.")

        insights.append(InsightPayload(
            insight_type   = "fully_depreciated",
            severity       = "notice",
            title          = f"Fully depreciated: {r['asset_tag']} ({r['name']})",
            body           = body,
            action_type    = "change_status",
            action_payload = {
                "asset_id":    str(r["id"]),
                "suggest_status": "retired",
            },
            ref_type   = "asset",
            ref_id     = str(r["id"]),
            ref_label  = f"{r['asset_tag']} · {r['name']}",
            expires_days = 60,
        ))
    return insights


def run_repair_roi_agent(cursor, org_id: str) -> List[InsightPayload]:
    """Flag repairs where cost exceeds 60% of remaining asset value."""
    cursor.execute("""
        SELECT
            a.id AS asset_id, a.asset_tag, a.name, a.category,
            a.purchase_price, a.purchase_date, a.depreciation_years, a.currency,
            ar.id AS repair_id, ar.repair_cost, ar.vendor_name,
            ar.sent_date, ar.description
        FROM app.asset_repairs ar
        JOIN app.assets a ON a.id = ar.asset_id
        WHERE a.organization_id = %s
          AND ar.status = 'in_progress'
          AND ar.repair_cost IS NOT NULL
          AND ar.repair_cost > 0
          AND a.purchase_price IS NOT NULL
          AND a.purchase_date IS NOT NULL
        ORDER BY ar.sent_date DESC
    """, (org_id,))

    insights: List[InsightPayload] = []
    for r in cursor.fetchall():
        years    = (date.today() - r["purchase_date"]).days / 365.25
        rate     = min(1.0, years / max(r["depreciation_years"], 1))
        cur_val  = max(0.0, float(r["purchase_price"]) * (1.0 - rate))
        repair   = float(r["repair_cost"])
        currency = r["currency"] or "USD"

        if cur_val <= 0:
            ratio_pct = 100.0
        else:
            ratio_pct = (repair / cur_val) * 100

        if ratio_pct < 60:
            continue

        severity = "critical" if ratio_pct >= 100 else "warning"
        body = (
            f"Repair cost ({currency} {repair:,.0f}) is {ratio_pct:.0f}% of {r['name']} "
            f"({r['asset_tag']}) remaining value ({currency} {cur_val:,.2f}). "
        )
        if ratio_pct >= 100:
            body += "Repair exceeds replacement value — CASPER recommends replacing rather than repairing."
        else:
            body += "CASPER recommends evaluating whether repair or replacement is more cost-effective."

        insights.append(InsightPayload(
            insight_type   = "repair_roi",
            severity       = severity,
            title          = f"Repair cost alert: {r['asset_tag']} ({ratio_pct:.0f}% of value)",
            body           = body,
            action_type    = "create_ticket",
            action_payload = {
                "title":     f"[AssetLog] Repair vs replace decision: {r['name']} ({r['asset_tag']})",
                "body":      body,
                "asset_id":  str(r["asset_id"]),
                "priority":  "high",
            },
            ref_type   = "asset",
            ref_id     = str(r["asset_id"]),
            ref_label  = f"{r['asset_tag']} · {r['name']}",
            expires_days = 14,
        ))
    return insights


def run_idle_asset_agent(cursor, org_id: str) -> List[InsightPayload]:
    """Flag assets that are assigned but never deployed (or stagnant) for 60+ days."""
    cursor.execute("""
        SELECT
            a.id, a.asset_tag, a.name, a.category, a.status,
            a.assigned_to, au.email AS assigned_email,
            a.updated_at,
            (CURRENT_TIMESTAMP - a.updated_at) AS age
        FROM app.assets a
        LEFT JOIN auth.users au ON au.id = a.assigned_to
        WHERE a.organization_id = %s
          AND a.status IN ('active','in_storage')
          AND a.updated_at < NOW() - INTERVAL '60 days'
        ORDER BY a.updated_at ASC
        LIMIT 20
    """, (org_id,))

    insights: List[InsightPayload] = []
    for r in cursor.fetchall():
        days_idle = int(r["age"].total_seconds() / 86400) if r["age"] else 0
        tag  = r["asset_tag"]
        name = r["name"]

        if r["assigned_to"]:
            body = (f"{name} ({tag}) is assigned to {r['assigned_email'] or 'user'} "
                    f"but has had no activity for {days_idle} days. "
                    f"Verify the asset is still in use or reassign/redeploy it.")
        else:
            body = (f"{name} ({tag}) has been sitting as '{r['status']}' for {days_idle} days "
                    f"with no recorded activity. "
                    f"CASPER recommends deploying it to a user or marking it for storage review.")

        insights.append(InsightPayload(
            insight_type   = "idle_asset",
            severity       = "notice",
            title          = f"Idle asset: {tag} ({days_idle} days no activity)",
            body           = body,
            action_type    = "view_asset",
            action_payload = {"asset_id": str(r["id"])},
            ref_type   = "asset",
            ref_id     = str(r["id"]),
            ref_label  = f"{tag} · {name}",
            expires_days = 30,
        ))
    return insights


def run_license_expiry_agent(cursor, org_id: str) -> List[InsightPayload]:
    """Flag licenses expiring within 30 days."""
    cursor.execute("""
        SELECT id, product_name, vendor, expiry_date,
               (expiry_date - CURRENT_DATE) AS days_until,
               seat_count, seats_used, cost_per_year, currency
        FROM app.software_licenses
        WHERE organization_id = %s
          AND expiry_date IS NOT NULL
          AND expiry_date BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE + INTERVAL '30 days'
        ORDER BY expiry_date ASC
    """, (org_id,))

    insights: List[InsightPayload] = []
    for r in cursor.fetchall():
        days     = r["days_until"]
        name     = r["product_name"]
        currency = r["currency"] or "USD"
        annual   = float(r["cost_per_year"] or 0)
        exp_str  = r["expiry_date"].isoformat()

        if days < 0:
            severity = "critical"
            title    = f"License expired: {name}"
            body     = (f"{name} ({r['vendor'] or 'vendor'}) expired {exp_str}. "
                        f"{r['seats_used']} users may lose access. Renew immediately.")
        else:
            severity = "critical" if days <= 7 else "warning"
            title    = f"License expiring in {days} days: {name}"
            body     = (f"{name} ({r['vendor'] or 'vendor'}) expires {exp_str}. "
                        f"{r['seats_used']} active seat{'s' if r['seats_used'] != 1 else ''} will be revoked. ")
            if annual:
                body += f"Annual cost: {currency} {annual:,.0f}. "
            body += "CASPER recommends scheduling renewal before expiry."

        insights.append(InsightPayload(
            insight_type   = "license_expiry",
            severity       = severity,
            title          = title,
            body           = body,
            action_type    = "view_license",
            action_payload = {"license_id": str(r["id"])},
            ref_type   = "license",
            ref_id     = str(r["id"]),
            ref_label  = name,
            expires_days = 7,
        ))
    return insights


def run_contract_renewal_agent(cursor, org_id: str) -> List[InsightPayload]:
    """Flag contracts expiring within 90 days or requiring notice-period action."""
    cursor.execute("""
        SELECT c.id, c.title, c.end_date, c.renewal_date,
               c.renewal_notice_days, c.auto_renews, c.status,
               c.total_value, c.currency, c.payment_schedule,
               v.name AS vendor_name,
               (c.end_date - CURRENT_DATE) AS days_until_end,
               (c.renewal_date - CURRENT_DATE) AS days_until_renewal
        FROM app.contracts c
        LEFT JOIN app.vendors v ON v.id = c.vendor_id
        WHERE c.organization_id = %s
          AND c.status IN ('active', 'draft')
          AND c.end_date IS NOT NULL
          AND c.end_date <= CURRENT_DATE + INTERVAL '90 days'
        ORDER BY c.end_date ASC
    """, (org_id,))

    insights: List[InsightPayload] = []
    for r in cursor.fetchall():
        days     = int(r["days_until_end"] or 0)
        title    = r["title"]
        vendor   = r["vendor_name"] or "vendor"
        currency = r["currency"] or "USD"
        value    = float(r["total_value"] or 0)
        notice   = int(r["renewal_notice_days"] or 30)
        exp_str  = r["end_date"].isoformat()
        auto_r   = r["auto_renews"]

        if days < 0:
            severity = "critical"
            heading  = f"Contract expired: {title}"
            detail   = (f"Your contract with {vendor} ('{title}') expired {exp_str}. "
                        f"Services may be at risk. Review and renew or terminate immediately.")
        elif days <= notice:
            severity = "critical" if days <= 7 else "warning"
            heading  = f"Contract renewal deadline: {title} ({days}d)"
            detail   = (f"'{title}' with {vendor} expires {exp_str} — "
                        f"within your {notice}-day notice window. ")
            if auto_r:
                detail += "Auto-renews unless cancelled. Review terms before deadline."
            else:
                detail += "Manual renewal required. CASPER recommends acting now."
            if value:
                detail += f" Contract value: {currency} {value:,.0f}."
        else:
            severity = "notice"
            heading  = f"Contract expiring in {days} days: {title}"
            detail   = (f"'{title}' with {vendor} expires {exp_str}. "
                        f"Notice period: {notice} days. ")
            if auto_r:
                detail += "Set to auto-renew — verify terms are still favourable."
            else:
                detail += "Plan renewal or replacement before the notice deadline."

        insights.append(InsightPayload(
            insight_type   = "contract_renewal",
            severity       = severity,
            title          = heading,
            body           = detail,
            action_type    = "view_contract",
            action_payload = {"contract_id": str(r["id"])},
            ref_type   = "contract",
            ref_id     = str(r["id"]),
            ref_label  = title,
            expires_days = 7,
        ))
    return insights


# ── Agent registry ─────────────────────────────────────────────────────────────

_AGENTS = [
    ("warranty",          run_warranty_agent),
    ("license_waste",     run_license_waste_agent),
    ("depreciation",      run_depreciation_agent),
    ("repair_roi",        run_repair_roi_agent),
    ("idle_asset",        run_idle_asset_agent),
    ("license_expiry",    run_license_expiry_agent),
    ("contract_renewal",  run_contract_renewal_agent),
]


# ── Scheduler (called from main.py lifespan) ──────────────────────────────────

def run_all_agents_for_org(org_id: str) -> Dict[str, int]:
    """Run all registered agents for a single org. Returns {agent: insights_upserted}."""
    from ..db_sync import get_db_connection

    results: Dict[str, int] = {}
    start_all = time.monotonic()

    with get_db_connection() as conn:
        cur = conn.cursor()

        for agent_name, agent_fn in _AGENTS:
            start = time.monotonic()
            created = 0
            updated = 0
            error_msg = None

            try:
                payloads = agent_fn(cur, org_id)

                for p in payloads:
                    # UPSERT — update title/body/severity/payload if insight already exists
                    cur.execute("""
                        INSERT INTO app.casper_insights
                            (organization_id, insight_type, severity, title, body,
                             action_type, action_payload, ref_type, ref_id, ref_label,
                             expires_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                NOW() + (%s || ' days')::interval)
                        ON CONFLICT (organization_id, insight_type, ref_id)
                        DO UPDATE SET
                            severity       = EXCLUDED.severity,
                            title          = EXCLUDED.title,
                            body           = EXCLUDED.body,
                            action_type    = EXCLUDED.action_type,
                            action_payload = EXCLUDED.action_payload,
                            ref_label      = EXCLUDED.ref_label,
                            is_dismissed   = false,
                            refreshed_at   = NOW(),
                            expires_at     = EXCLUDED.expires_at
                        RETURNING (xmax = 0) AS was_inserted
                    """, (
                        org_id, p.insight_type, p.severity, p.title, p.body,
                        p.action_type, p.action_payload, p.ref_type, p.ref_id, p.ref_label,
                        str(p.expires_days),
                    ))
                    row = cur.fetchone()
                    if row and row["was_inserted"]:
                        created += 1
                    else:
                        updated += 1

                # Auto-expire resolved insights (e.g. warranty renewed, idle asset deployed)
                _expire_resolved(cur, org_id, agent_name)

            except Exception as exc:
                error_msg = str(exc)
                logger.exception("Agent %s failed for org %s: %s", agent_name, org_id, exc)

            finally:
                duration_ms = int((time.monotonic() - start) * 1000)
                cur.execute("""
                    INSERT INTO app.casper_agent_runs
                        (organization_id, agent_name, last_run_at, insights_created,
                         insights_updated, run_duration_ms, error_message)
                    VALUES (%s, %s, NOW(), %s, %s, %s, %s)
                    ON CONFLICT (organization_id, agent_name)
                    DO UPDATE SET
                        last_run_at      = NOW(),
                        insights_created = EXCLUDED.insights_created,
                        insights_updated = EXCLUDED.insights_updated,
                        run_duration_ms  = EXCLUDED.run_duration_ms,
                        error_message    = EXCLUDED.error_message
                """, (org_id, agent_name, created, updated, duration_ms, error_msg))

            results[agent_name] = created + updated

        conn.commit()

    total_ms = int((time.monotonic() - start_all) * 1000)
    logger.info("CASPER agents ran for org %s in %dms: %s", org_id, total_ms, results)
    return results


def _expire_resolved(cursor, org_id: str, agent_name: str):
    """Auto-dismiss insights whose underlying condition has resolved."""
    if agent_name == "warranty":
        # Warranty insight resolved if asset retired/disposed or warranty renewed (>90 days away)
        cursor.execute("""
            UPDATE app.casper_insights ci
            SET is_dismissed = true, dismissed_at = NOW()
            FROM app.assets a
            WHERE ci.organization_id = %s
              AND ci.insight_type = 'warranty_expiry'
              AND ci.ref_id = a.id
              AND ci.is_dismissed = false
              AND (
                  a.status IN ('retired','disposed')
                  OR a.warranty_expiry IS NULL
                  OR a.warranty_expiry > CURRENT_DATE + INTERVAL '90 days'
              )
        """, (org_id,))

    elif agent_name == "license_waste":
        # License waste resolved if utilisation rose above 70%
        cursor.execute("""
            UPDATE app.casper_insights ci
            SET is_dismissed = true, dismissed_at = NOW()
            FROM app.software_licenses sl
            WHERE ci.organization_id = %s
              AND ci.insight_type = 'license_waste'
              AND ci.ref_id = sl.id
              AND ci.is_dismissed = false
              AND (sl.seat_count IS NULL OR sl.seats_used::float / sl.seat_count >= 0.70)
        """, (org_id,))

    elif agent_name == "repair_roi":
        # Resolved when repair closes (status != 'in_progress')
        cursor.execute("""
            UPDATE app.casper_insights ci
            SET is_dismissed = true, dismissed_at = NOW()
            FROM app.assets a
            WHERE ci.organization_id = %s
              AND ci.insight_type = 'repair_roi'
              AND ci.ref_id = a.id
              AND ci.is_dismissed = false
              AND a.status NOT IN ('in_repair')
        """, (org_id,))

    elif agent_name == "idle_asset":
        # Resolved when asset status changes or updated_at refreshed
        cursor.execute("""
            UPDATE app.casper_insights ci
            SET is_dismissed = true, dismissed_at = NOW()
            FROM app.assets a
            WHERE ci.organization_id = %s
              AND ci.insight_type = 'idle_asset'
              AND ci.ref_id = a.id
              AND ci.is_dismissed = false
              AND (a.status IN ('retired','disposed') OR a.updated_at > NOW() - INTERVAL '60 days')
        """, (org_id,))

    elif agent_name == "license_expiry":
        # Resolved when expiry date pushed out or license deleted
        cursor.execute("""
            UPDATE app.casper_insights ci
            SET is_dismissed = true, dismissed_at = NOW()
            FROM app.software_licenses sl
            WHERE ci.organization_id = %s
              AND ci.insight_type = 'license_expiry'
              AND ci.ref_id = sl.id
              AND ci.is_dismissed = false
              AND (sl.expiry_date IS NULL OR sl.expiry_date > CURRENT_DATE + INTERVAL '30 days')
        """, (org_id,))

    elif agent_name == "contract_renewal":
        # Resolved when contract renewed (end_date > 90 days out), terminated, or expired status
        cursor.execute("""
            UPDATE app.casper_insights ci
            SET is_dismissed = true, dismissed_at = NOW()
            FROM app.contracts c
            WHERE ci.organization_id = %s
              AND ci.insight_type = 'contract_renewal'
              AND ci.ref_id = c.id
              AND ci.is_dismissed = false
              AND (
                  c.status IN ('terminated','renewed')
                  OR c.end_date IS NULL
                  OR c.end_date > CURRENT_DATE + INTERVAL '90 days'
              )
        """, (org_id,))


def get_last_run_info(cursor, org_id: str) -> Optional[Dict]:
    """Return the most recent agent run time for display in the UI."""
    cursor.execute("""
        SELECT MIN(last_run_at) AS oldest_run
        FROM app.casper_agent_runs
        WHERE organization_id = %s
    """, (org_id,))
    row = cursor.fetchone()
    if row and row["oldest_run"]:
        return {"last_run_at": row["oldest_run"].isoformat()}
    return None
