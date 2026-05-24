"""Monthly report export — Sprint 5.

GET /api/admin/reports/monthly?year=2026&month=4&format=json|csv|pdf
GET /api/admin/reports/monthly/orgs   (platform admin — pick org from list)

Report sections
---------------
1. Executive Summary     — KPIs at a glance
2. Ticket Volume         — opened / resolved / carried-over + weekly breakdown
3. Status Breakdown      — distribution across statuses
4. Priority Breakdown    — distribution across priorities
5. Rep Performance       — per-rep metrics (assigned, resolved, response time, rating)
6. AI Performance        — AI resolution rate, escalation rate, avg confidence
7. SLA / ETR Compliance  — how many tickets met their expected-resolve-at deadline
8. Top Tags              — most-used ticket tags this month
"""

from __future__ import annotations

import csv
import io
import calendar
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from .auth import User, get_current_user
from .db import get_connection
from .org_middleware import require_org_context
from .entitlements import requires_feature

router = APIRouter(prefix="/api/admin/reports", tags=["reports"])


def require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")


# ── Data collection ────────────────────────────────────────────────────────────


async def _collect(org_id: str, year: int, month: int) -> dict[str, Any]:
    """Run all DB queries for the requested org + month and return a dict."""
    period_start = datetime(year, month, 1, tzinfo=timezone.utc)
    last_day = calendar.monthrange(year, month)[1]
    period_end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    # Previous month bounds for MoM delta
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1
    prev_start = datetime(prev_year, prev_month, 1, tzinfo=timezone.utc)
    prev_last = calendar.monthrange(prev_year, prev_month)[1]
    prev_end = datetime(prev_year, prev_month, prev_last, 23, 59, 59, tzinfo=timezone.utc)

    conn = await get_connection()
    try:
        # ── 1. Executive Summary ──────────────────────────────────────────────
        opened = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3",
            org_id, period_start, period_end,
        )
        resolved = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1"
            " AND status IN ('resolved','closed') AND updated_at BETWEEN $2 AND $3",
            org_id, period_start, period_end,
        )
        prev_opened = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3",
            org_id, prev_start, prev_end,
        ) or 0
        carried_in = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1"
            " AND created_at < $2 AND (status NOT IN ('resolved','closed') OR updated_at > $2)",
            org_id, period_start,
        ) or 0
        still_open = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1"
            " AND status NOT IN ('resolved','closed')",
            org_id,
        ) or 0
        overdue = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1 AND is_overdue=true"
            " AND status NOT IN ('resolved','closed')",
            org_id,
        ) or 0
        avg_rating = await conn.fetchval(
            "SELECT ROUND(AVG(customer_rating)::numeric, 2) FROM app.tickets"
            " WHERE organization_id=$1 AND customer_rating IS NOT NULL AND updated_at BETWEEN $2 AND $3",
            org_id, period_start, period_end,
        )
        avg_first_response = await conn.fetchval("""
            SELECT ROUND(AVG(
                EXTRACT(EPOCH FROM (
                    (SELECT MIN(m.created_at) FROM app.messages m
                     WHERE m.ticket_id=t.id AND m.sender_role IN ('rep','admin'))
                    - t.created_at
                )) / 3600
            )::numeric, 1)
            FROM app.tickets t
            WHERE t.organization_id=$1 AND t.created_at BETWEEN $2 AND $3
              AND EXISTS (
                  SELECT 1 FROM app.messages m2
                  WHERE m2.ticket_id=t.id AND m2.sender_role IN ('rep','admin')
              )
        """, org_id, period_start, period_end)
        avg_resolution_time = await conn.fetchval("""
            SELECT ROUND(AVG(
                EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600
            )::numeric, 1)
            FROM app.tickets t
            WHERE t.organization_id=$1
              AND t.status IN ('resolved','closed')
              AND t.updated_at BETWEEN $2 AND $3
        """, org_id, period_start, period_end)

        resolution_rate = round(resolved / opened * 100, 1) if opened else 0
        mom_change = round((opened - prev_opened) / prev_opened * 100, 1) if prev_opened else None

        summary = {
            "period": f"{calendar.month_name[month]} {year}",
            "opened": int(opened),
            "resolved": int(resolved),
            "carried_in": int(carried_in),
            "still_open": int(still_open),
            "overdue": int(overdue),
            "resolution_rate_pct": resolution_rate,
            "avg_first_response_hours": float(avg_first_response) if avg_first_response else None,
            "avg_resolution_hours": float(avg_resolution_time) if avg_resolution_time else None,
            "avg_customer_rating": float(avg_rating) if avg_rating else None,
            "mom_opened_change_pct": mom_change,
        }

        # ── 2. Weekly volume ──────────────────────────────────────────────────
        weekly_rows = await conn.fetch("""
            SELECT
                DATE_TRUNC('week', created_at)::date AS week_start,
                COUNT(*) AS opened,
                COUNT(CASE WHEN status IN ('resolved','closed') THEN 1 END) AS resolved
            FROM app.tickets
            WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3
            GROUP BY week_start ORDER BY week_start
        """, org_id, period_start, period_end)
        weekly = [
            {
                "week_start": str(r["week_start"]),
                "opened": int(r["opened"]),
                "resolved": int(r["resolved"]),
            }
            for r in weekly_rows
        ]

        # ── 3. Status breakdown ───────────────────────────────────────────────
        status_rows = await conn.fetch("""
            SELECT status, COUNT(*) AS count
            FROM app.tickets WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3
            GROUP BY status ORDER BY count DESC
        """, org_id, period_start, period_end)
        status_breakdown = [{"status": r["status"], "count": int(r["count"])} for r in status_rows]

        # ── 4. Priority breakdown ─────────────────────────────────────────────
        priority_rows = await conn.fetch("""
            SELECT priority, COUNT(*) AS total,
                   COUNT(CASE WHEN status IN ('resolved','closed') THEN 1 END) AS resolved
            FROM app.tickets WHERE organization_id=$1 AND created_at BETWEEN $2 AND $3
            GROUP BY priority
            ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
                                   WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END
        """, org_id, period_start, period_end)
        priority_breakdown = [
            {
                "priority": r["priority"],
                "total": int(r["total"]),
                "resolved": int(r["resolved"]),
                "resolution_rate_pct": round(r["resolved"] / r["total"] * 100, 1) if r["total"] else 0,
            }
            for r in priority_rows
        ]

        # ── 5. Rep performance ────────────────────────────────────────────────
        rep_rows = await conn.fetch("""
            SELECT
                u.email,
                COALESCE(au.raw_user_meta_data->>'display_name', split_part(u.email,'@',1)) AS name,
                COUNT(t.id) AS assigned,
                COUNT(CASE WHEN t.status IN ('resolved','closed') THEN 1 END) AS resolved,
                ROUND(AVG(CASE WHEN t.status IN ('resolved','closed') THEN
                    EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/3600 END)::numeric, 1
                ) AS avg_resolution_hours,
                ROUND(AVG(
                    EXTRACT(EPOCH FROM (
                        (SELECT MIN(m.created_at) FROM app.messages m
                         WHERE m.ticket_id=t.id AND m.sender_id=u.id)
                        - t.created_at
                    ))/3600
                )::numeric, 1) AS avg_first_response_hours,
                ROUND(AVG(t.customer_rating)::numeric, 2) AS avg_rating
            FROM auth.users u
            JOIN auth.users au ON au.id = u.id
            JOIN app.tickets t ON t.assignee_id=u.id
                AND t.organization_id=$1
                AND t.created_at BETWEEN $2 AND $3
            GROUP BY u.id, u.email, au.raw_user_meta_data
            ORDER BY assigned DESC
        """, org_id, period_start, period_end)
        rep_performance = [
            {
                "email": r["email"],
                "name": r["name"],
                "assigned": int(r["assigned"]),
                "resolved": int(r["resolved"]),
                "resolution_rate_pct": round(r["resolved"] / r["assigned"] * 100, 1) if r["assigned"] else 0,
                "avg_first_response_hours": float(r["avg_first_response_hours"]) if r["avg_first_response_hours"] else None,
                "avg_resolution_hours": float(r["avg_resolution_hours"]) if r["avg_resolution_hours"] else None,
                "avg_rating": float(r["avg_rating"]) if r["avg_rating"] else None,
            }
            for r in rep_rows
        ]

        # ── 6. AI performance ─────────────────────────────────────────────────
        ai_total = await conn.fetchval(
            "SELECT COUNT(*) FROM app.ai_runs WHERE created_at BETWEEN $1 AND $2",
            period_start, period_end,
        ) or 0
        ai_escalated = await conn.fetchval(
            "SELECT COUNT(*) FROM app.ai_runs WHERE suggest_escalation=true AND created_at BETWEEN $1 AND $2",
            period_start, period_end,
        ) or 0
        ai_avg_confidence = await conn.fetchval(
            "SELECT ROUND(AVG(confidence)::numeric, 3) FROM app.ai_runs WHERE created_at BETWEEN $1 AND $2",
            period_start, period_end,
        )
        ai_avg_latency = await conn.fetchval(
            "SELECT ROUND(AVG(latency_ms)::numeric, 0) FROM app.ai_runs WHERE created_at BETWEEN $1 AND $2",
            period_start, period_end,
        )
        ai_performance = {
            "total_ai_interactions": int(ai_total),
            "ai_escalated": int(ai_escalated),
            "ai_resolved_pct": round((ai_total - ai_escalated) / ai_total * 100, 1) if ai_total else 0,
            "escalation_rate_pct": round(ai_escalated / ai_total * 100, 1) if ai_total else 0,
            "avg_confidence": float(ai_avg_confidence) if ai_avg_confidence else None,
            "avg_latency_ms": float(ai_avg_latency) if ai_avg_latency else None,
        }

        # ── 7. SLA / ETR compliance ───────────────────────────────────────────
        etr_total = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1"
            " AND expected_resolve_at IS NOT NULL AND created_at BETWEEN $2 AND $3",
            org_id, period_start, period_end,
        ) or 0
        etr_met = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1"
            " AND expected_resolve_at IS NOT NULL AND created_at BETWEEN $2 AND $3"
            " AND status IN ('resolved','closed') AND updated_at <= expected_resolve_at",
            org_id, period_start, period_end,
        ) or 0
        etr_breached = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id=$1"
            " AND expected_resolve_at IS NOT NULL AND created_at BETWEEN $2 AND $3"
            " AND (status NOT IN ('resolved','closed') OR updated_at > expected_resolve_at)",
            org_id, period_start, period_end,
        ) or 0
        sla = {
            "tickets_with_etr": int(etr_total),
            "met_deadline": int(etr_met),
            "breached_deadline": int(etr_breached),
            "compliance_rate_pct": round(etr_met / etr_total * 100, 1) if etr_total else None,
        }

        # ── 8. Top tags ───────────────────────────────────────────────────────
        tag_rows = await conn.fetch("""
            SELECT tag, COUNT(*) AS count
            FROM app.tickets t, UNNEST(t.tags) AS tag
            WHERE t.organization_id=$1 AND t.created_at BETWEEN $2 AND $3
            GROUP BY tag ORDER BY count DESC LIMIT 10
        """, org_id, period_start, period_end)
        top_tags = [{"tag": r["tag"], "count": int(r["count"])} for r in tag_rows]

        # ── Org name ──────────────────────────────────────────────────────────
        org_name = await conn.fetchval("SELECT name FROM app.organizations WHERE id=$1", org_id) or org_id

    finally:
        await conn.close()

    return {
        "meta": {
            "org_id": org_id,
            "org_name": org_name,
            "year": year,
            "month": month,
            "period_label": f"{calendar.month_name[month]} {year}",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "summary": summary,
        "weekly_volume": weekly,
        "status_breakdown": status_breakdown,
        "priority_breakdown": priority_breakdown,
        "rep_performance": rep_performance,
        "ai_performance": ai_performance,
        "sla_compliance": sla,
        "top_tags": top_tags,
    }


# ── CSV builder ────────────────────────────────────────────────────────────────


def _build_csv(data: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    meta = data["meta"]

    def section(title: str):
        w.writerow([])
        w.writerow([f"=== {title} ==="])

    # Header
    w.writerow(["TicketPilot Monthly Report"])
    w.writerow([f"Organisation: {meta['org_name']}"])
    w.writerow([f"Period: {meta['period_label']}"])
    w.writerow([f"Generated: {meta['generated_at']}"])

    section("1. Executive Summary")
    s = data["summary"]
    rows = [
        ("Tickets Opened", s["opened"]),
        ("Tickets Resolved", s["resolved"]),
        ("Carried In (open from prior month)", s["carried_in"]),
        ("Still Open (end of period)", s["still_open"]),
        ("Currently Overdue", s["overdue"]),
        ("Resolution Rate", f"{s['resolution_rate_pct']}%"),
        ("Avg First Response Time", f"{s['avg_first_response_hours']}h" if s["avg_first_response_hours"] else "N/A"),
        ("Avg Resolution Time", f"{s['avg_resolution_hours']}h" if s["avg_resolution_hours"] else "N/A"),
        ("Avg Customer Rating", f"{s['avg_customer_rating']} / 5" if s["avg_customer_rating"] else "N/A"),
        ("MoM Volume Change", f"{s['mom_opened_change_pct']}%" if s["mom_opened_change_pct"] is not None else "N/A"),
    ]
    for label, val in rows:
        w.writerow([label, val])

    section("2. Weekly Volume")
    w.writerow(["Week Starting", "Opened", "Resolved"])
    for row in data["weekly_volume"]:
        w.writerow([row["week_start"], row["opened"], row["resolved"]])

    section("3. Status Breakdown")
    w.writerow(["Status", "Count"])
    for row in data["status_breakdown"]:
        w.writerow([row["status"], row["count"]])

    section("4. Priority Breakdown")
    w.writerow(["Priority", "Total", "Resolved", "Resolution Rate"])
    for row in data["priority_breakdown"]:
        w.writerow([row["priority"], row["total"], row["resolved"], f"{row['resolution_rate_pct']}%"])

    section("5. Rep Performance")
    w.writerow(["Rep", "Email", "Assigned", "Resolved", "Resolution Rate", "Avg 1st Response (h)", "Avg Resolution (h)", "Avg Rating"])
    for r in data["rep_performance"]:
        w.writerow([
            r["name"], r["email"], r["assigned"], r["resolved"],
            f"{r['resolution_rate_pct']}%",
            r["avg_first_response_hours"] or "N/A",
            r["avg_resolution_hours"] or "N/A",
            r["avg_rating"] or "N/A",
        ])

    section("6. AI Performance")
    ai = data["ai_performance"]
    for label, val in [
        ("Total AI Interactions", ai["total_ai_interactions"]),
        ("AI Self-Resolved (no escalation)", f"{ai['ai_resolved_pct']}%"),
        ("Escalated to Human", f"{ai['escalation_rate_pct']}%"),
        ("Avg Confidence Score", ai["avg_confidence"] or "N/A"),
        ("Avg Latency (ms)", ai["avg_latency_ms"] or "N/A"),
    ]:
        w.writerow([label, val])

    section("7. SLA / ETR Compliance")
    sla = data["sla_compliance"]
    for label, val in [
        ("Tickets with ETR Set", sla["tickets_with_etr"]),
        ("Met Deadline", sla["met_deadline"]),
        ("Breached Deadline", sla["breached_deadline"]),
        ("Compliance Rate", f"{sla['compliance_rate_pct']}%" if sla["compliance_rate_pct"] is not None else "N/A"),
    ]:
        w.writerow([label, val])

    section("8. Top Tags")
    w.writerow(["Tag", "Count"])
    for row in data["top_tags"]:
        w.writerow([row["tag"], row["count"]])

    return buf.getvalue()


# ── PDF builder ────────────────────────────────────────────────────────────────


def _build_pdf(data: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )

    meta = data["meta"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
        title=f"TicketPilot Report — {meta['period_label']}",
    )

    PURPLE   = colors.HexColor("#7c3aed")
    PURPLE_L = colors.HexColor("#ede9fe")
    SLATE    = colors.HexColor("#334155")
    MUTED    = colors.HexColor("#64748b")
    WHITE    = colors.white
    ROW_ALT  = colors.HexColor("#f8fafc")
    GREEN    = colors.HexColor("#16a34a")
    RED      = colors.HexColor("#dc2626")
    AMBER    = colors.HexColor("#d97706")

    styles = getSampleStyleSheet()
    title_style  = ParagraphStyle("tp_title",  parent=styles["Normal"], fontSize=22, textColor=PURPLE,  spaceAfter=4,  fontName="Helvetica-Bold")
    sub_style    = ParagraphStyle("tp_sub",    parent=styles["Normal"], fontSize=11, textColor=MUTED,   spaceAfter=12)
    h2_style     = ParagraphStyle("tp_h2",     parent=styles["Normal"], fontSize=13, textColor=PURPLE,  spaceAfter=6,  fontName="Helvetica-Bold", spaceBefore=14)
    body_style   = ParagraphStyle("tp_body",   parent=styles["Normal"], fontSize=9,  textColor=SLATE,   spaceAfter=4)
    label_style  = ParagraphStyle("tp_label",  parent=styles["Normal"], fontSize=8,  textColor=MUTED)

    W = A4[0] - 4*cm  # usable width

    def h2(text: str):
        return [HRFlowable(width=W, color=PURPLE_L, thickness=1), Paragraph(text, h2_style)]

    def tbl(headers: list[str], rows: list[list], col_widths=None):
        data_rows = [[Paragraph(str(h), ParagraphStyle("th", fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)) for h in headers]]
        for i, row in enumerate(rows):
            data_rows.append([Paragraph(str(c), ParagraphStyle("td", fontSize=8, textColor=SLATE)) for c in row])
        t = Table(data_rows, colWidths=col_widths or [W / len(headers)] * len(headers), repeatRows=1)
        style = [
            ("BACKGROUND", (0,0), (-1,0), PURPLE),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, ROW_ALT]),
            ("GRID", (0,0), (-1,-1), 0.25, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
        ]
        t.setStyle(TableStyle(style))
        return t

    def kpi_row(items: list[tuple[str, str, str]]):
        """items = [(label, value, sub), ...]"""
        cell_data = []
        for label, value, sub in items:
            cell = [
                Paragraph(label, label_style),
                Paragraph(value, ParagraphStyle("kv", fontSize=18, fontName="Helvetica-Bold", textColor=PURPLE)),
                Paragraph(sub, label_style),
            ]
            cell_data.append(cell)
        t = Table([cell_data], colWidths=[W / len(items)] * len(items))
        t.setStyle(TableStyle([
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ("INNERGRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ("BACKGROUND", (0,0), (-1,-1), ROW_ALT),
            ("TOPPADDING", (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LEFTPADDING", (0,0), (-1,-1), 10),
        ]))
        return t

    s = data["summary"]
    story = [
        Paragraph("TicketPilot", title_style),
        Paragraph(f"Monthly Support Report — {meta['period_label']}", sub_style),
        Paragraph(f"Organisation: <b>{meta['org_name']}</b>  |  Generated: {meta['generated_at'][:10]}", body_style),
        Spacer(1, 0.3*cm),

        # KPI row 1
        kpi_row([
            ("Tickets Opened", str(s["opened"]), f"{'↑' if (s['mom_opened_change_pct'] or 0) > 0 else '↓'} {abs(s['mom_opened_change_pct'] or 0)}% vs last month"),
            ("Tickets Resolved", str(s["resolved"]), f"Resolution rate: {s['resolution_rate_pct']}%"),
            ("Carried In", str(s["carried_in"]), "Open from prior month"),
            ("Still Open", str(s["still_open"]), f"{s['overdue']} overdue"),
        ]),
        Spacer(1, 0.2*cm),
        # KPI row 2
        kpi_row([
            ("Avg 1st Response", f"{s['avg_first_response_hours']}h" if s["avg_first_response_hours"] else "N/A", "Time to first rep reply"),
            ("Avg Resolution", f"{s['avg_resolution_hours']}h" if s["avg_resolution_hours"] else "N/A", "Open → resolved"),
            ("Customer Rating", f"{s['avg_customer_rating']} / 5" if s["avg_customer_rating"] else "N/A", "Avg CSAT score"),
            ("AI Self-Resolve", f"{data['ai_performance']['ai_resolved_pct']}%", "No human escalation needed"),
        ]),
        Spacer(1, 0.4*cm),
    ]

    # 2. Weekly volume
    story += h2("2. Weekly Volume")
    story.append(tbl(
        ["Week Starting", "Opened", "Resolved"],
        [[r["week_start"], r["opened"], r["resolved"]] for r in data["weekly_volume"]],
        col_widths=[W*0.5, W*0.25, W*0.25],
    ))

    # 3 + 4 side-by-side
    story += h2("3. Status & 4. Priority Breakdown")
    stat_rows = [[r["status"].title(), r["count"]] for r in data["status_breakdown"]]
    prio_rows = [[r["priority"].title(), r["total"], r["resolved"], f"{r['resolution_rate_pct']}%"] for r in data["priority_breakdown"]]

    def mini_tbl(headers, rows, w):
        d = [[Paragraph(h, ParagraphStyle("mth", fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)) for h in headers]]
        for row in rows:
            d.append([Paragraph(str(c), ParagraphStyle("mtd", fontSize=8, textColor=SLATE)) for c in row])
        t = Table(d, colWidths=[w / len(headers)] * len(headers), repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), PURPLE),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, ROW_ALT]),
            ("GRID", (0,0), (-1,-1), 0.25, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
        ]))
        return t

    side_by_side = Table(
        [[mini_tbl(["Status", "Count"], stat_rows, W*0.42),
          Spacer(W*0.08, 1),
          mini_tbl(["Priority", "Total", "Resolved", "Rate"], prio_rows, W*0.48)]],
        colWidths=[W*0.44, W*0.08, W*0.48],
    )
    story.append(side_by_side)

    # 5. Rep performance
    story += h2("5. Rep Performance")
    if data["rep_performance"]:
        story.append(tbl(
            ["Name", "Assigned", "Resolved", "Res. Rate", "Avg 1st Resp (h)", "Avg Res. (h)", "Rating"],
            [[r["name"], r["assigned"], r["resolved"], f"{r['resolution_rate_pct']}%",
              r["avg_first_response_hours"] or "—", r["avg_resolution_hours"] or "—",
              f"{r['avg_rating']}/5" if r["avg_rating"] else "—"]
             for r in data["rep_performance"]],
            col_widths=[W*0.22, W*0.10, W*0.10, W*0.10, W*0.14, W*0.14, W*0.10],
        ))
    else:
        story.append(Paragraph("No assigned tickets this period.", body_style))

    # 6. AI performance
    ai = data["ai_performance"]
    story += h2("6. AI Performance")
    story.append(tbl(
        ["Metric", "Value"],
        [
            ["Total AI Interactions", ai["total_ai_interactions"]],
            ["AI Self-Resolved (no escalation)", f"{ai['ai_resolved_pct']}%"],
            ["Escalated to Human", f"{ai['escalation_rate_pct']}%"],
            ["Avg Confidence Score", ai["avg_confidence"] or "N/A"],
            ["Avg Latency (ms)", ai["avg_latency_ms"] or "N/A"],
        ],
        col_widths=[W*0.6, W*0.4],
    ))

    # 7. SLA compliance
    sla = data["sla_compliance"]
    story += h2("7. SLA / ETR Compliance")
    story.append(tbl(
        ["Metric", "Value"],
        [
            ["Tickets with ETR Set", sla["tickets_with_etr"]],
            ["Met Deadline", sla["met_deadline"]],
            ["Breached Deadline", sla["breached_deadline"]],
            ["Compliance Rate", f"{sla['compliance_rate_pct']}%" if sla["compliance_rate_pct"] is not None else "N/A (no ETR set)"],
        ],
        col_widths=[W*0.6, W*0.4],
    ))

    # 8. Top tags
    story += h2("8. Top Tags")
    if data["top_tags"]:
        story.append(tbl(
            ["Tag", "Ticket Count"],
            [[r["tag"], r["count"]] for r in data["top_tags"]],
            col_widths=[W*0.7, W*0.3],
        ))
    else:
        story.append(Paragraph("No tagged tickets this period.", body_style))

    doc.build(story)
    return buf.getvalue()


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.get("/monthly")
async def monthly_report(
    request: Request,
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    fmt: str = Query("json", alias="format", pattern="^(json|csv|pdf)$"),
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("monthly_reports"),
):
    """
    Export a monthly support report for the current org.
    format: json | csv | pdf
    """
    require_admin(user)
    org_id = require_org_context(request)

    data = await _collect(org_id, year, month)
    label = f"{calendar.month_abbr[month]}{year}_{data['meta']['org_name'].replace(' ','_')}"

    if fmt == "csv":
        content = _build_csv(data)
        return StreamingResponse(
            iter([content]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="report_{label}.csv"'},
        )

    if fmt == "pdf":
        pdf_bytes = _build_pdf(data)
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="report_{label}.pdf"'},
        )

    return data  # json default
