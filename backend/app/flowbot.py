"""
FlowBot — IF/THEN Automation Rules Engine.

Rules are stored in app.automation_rules and evaluated synchronously
after ticket events. No external queue needed at SME scale.
"""
from __future__ import annotations

import logging
import json
from typing import Optional, List, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .auth import User, get_current_user
from .db_sync import get_db_connection
from .entitlements import requires_feature
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/automation", tags=["flowbot"])

TRIGGER_EVENTS = (
    "ticket_created", "ticket_updated", "ticket_status_changed",
    "ticket_assigned", "ticket_idle", "ticket_overdue",
    "ticket_priority_changed", "message_added",
)


def _get_role(user_id: str) -> str:
    try:
        from .roles import get_user_role
        return get_user_role(user_id)
    except Exception:
        return "customer"

def _require_admin(user: User):
    if _get_role(user.id) not in ("admin", "owner"):
        raise HTTPException(403, "Admin required")


def _row(r) -> dict:
    return {
        "id":            str(r["id"]),
        "name":          r["name"],
        "description":   r.get("description"),
        "trigger_event": r["trigger_event"],
        "conditions":    r["conditions"] if r.get("conditions") is not None else [],
        "actions":       r["actions"] if r.get("actions") is not None else [],
        "is_active":     bool(r.get("is_active", True)),
        "run_count":     int(r.get("run_count", 0)),
        "last_run_at":   r["last_run_at"].isoformat() if r.get("last_run_at") else None,
        "created_at":    r["created_at"].isoformat() if r.get("created_at") else None,
    }


# ── Rule evaluation engine ─────────────────────────────────────────────────────

def _evaluate_condition(ticket: dict, cond: dict) -> bool:
    field    = cond.get("field", "")
    operator = cond.get("operator", "equals")
    value    = cond.get("value", "")
    ticket_val = ticket.get(field, "") or ""

    try:
        if operator == "contains":    return str(value).lower() in str(ticket_val).lower()
        if operator == "not_contains":return str(value).lower() not in str(ticket_val).lower()
        if operator == "equals":      return str(ticket_val).lower() == str(value).lower()
        if operator == "not_equals":  return str(ticket_val).lower() != str(value).lower()
        if operator == "is_empty":    return not ticket_val
        if operator == "is_not_empty":return bool(ticket_val)
        if operator == "gt":          return float(ticket_val or 0) > float(value)
        if operator == "lt":          return float(ticket_val or 0) < float(value)
    except Exception:
        pass
    return False


def _matches_conditions(ticket: dict, conditions: list) -> bool:
    if not conditions:
        return True
    return all(_evaluate_condition(ticket, c) for c in conditions)


def _execute_action(ticket: dict, action: dict, org_id: str) -> None:
    atype  = action.get("type", "")
    params = action.get("params", {})
    ticket_id = ticket.get("id") or ticket.get("ticket_id")
    if not ticket_id:
        return

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if atype == "change_priority":
                cur.execute(
                    "UPDATE app.tickets SET priority=%s, updated_at=NOW() WHERE id=%s::uuid AND organization_id=%s",
                    (params.get("priority", "medium"), ticket_id, org_id),
                )

            elif atype == "change_status":
                cur.execute(
                    "UPDATE app.tickets SET status=%s, updated_at=NOW() WHERE id=%s::uuid AND organization_id=%s",
                    (params.get("status", "open"), ticket_id, org_id),
                )

            elif atype == "assign_to_user":
                cur.execute(
                    "UPDATE app.tickets SET assignee_id=%s::uuid, updated_at=NOW() WHERE id=%s::uuid AND organization_id=%s",
                    (params.get("user_id"), ticket_id, org_id),
                )

            elif atype == "assign_to_role":
                role = params.get("role", "rep")
                cur.execute(
                    """SELECT ur.user_id FROM app.user_roles ur
                       JOIN app.organization_members om ON om.user_id = ur.user_id AND om.organization_id=%s
                       WHERE ur.role=%s LIMIT 1""",
                    (org_id, role),
                )
                rep = cur.fetchone()
                if rep:
                    cur.execute(
                        "UPDATE app.tickets SET assignee_id=%s::uuid, updated_at=NOW() WHERE id=%s::uuid AND organization_id=%s",
                        (str(rep["user_id"]), ticket_id, org_id),
                    )

            elif atype == "add_tag":
                tag = params.get("tag", "")
                if tag:
                    cur.execute(
                        """UPDATE app.tickets
                           SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), %s), updated_at=NOW()
                           WHERE id=%s::uuid AND organization_id=%s AND NOT (%s = ANY(COALESCE(tags, ARRAY[]::text[])))""",
                        (tag, ticket_id, org_id, tag),
                    )

            elif atype == "add_note":
                note = params.get("note", "")
                if note:
                    cur.execute(
                        "INSERT INTO app.messages (ticket_id, sender_role, organization_id, body, meta) VALUES (%s::uuid, 'ai', %s, %s, '{\"flowbot\": true}'::jsonb)",
                        (ticket_id, org_id, f"[FlowBot] {note}"),
                    )
                    cur.execute(
                        "UPDATE app.tickets SET message_count=message_count+1, updated_at=NOW() WHERE id=%s::uuid",
                        (ticket_id,),
                    )

            conn.commit()
    except Exception as exc:
        logger.warning("[flowbot] action %s failed for ticket %s: %s", atype, ticket_id, exc)


def evaluate_rules(event: str, ticket: dict, org_id: str) -> int:
    """
    Evaluate all active rules for an org on a ticket event.
    Returns the number of rules that fired.
    Called synchronously from ticket endpoints — fast at SME scale (≤50 rules).
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT * FROM app.automation_rules
                   WHERE organization_id=%s AND trigger_event=%s AND is_active=true
                   ORDER BY created_at""",
                (org_id, event),
            )
            rules = cur.fetchall()
    except Exception as exc:
        logger.warning("[flowbot] rule fetch failed: %s", exc)
        return 0

    fired = 0
    for rule in rules:
        conditions = rule["conditions"] if rule.get("conditions") is not None else []
        actions    = rule["actions"]    if rule.get("actions")    is not None else []
        if _matches_conditions(ticket, conditions):
            for action in actions:
                _execute_action(ticket, action, org_id)
            fired += 1
            try:
                with get_db_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "UPDATE app.automation_rules SET run_count=run_count+1, last_run_at=NOW() WHERE id=%s",
                        (rule["id"],),
                    )
                    conn.commit()
            except Exception:
                pass

    if fired:
        logger.info("[flowbot] %d rule(s) fired for event=%s ticket=%s", fired, event, ticket.get("id"))
    return fired


# ── CRUD ───────────────────────────────────────────────────────────────────────

class RuleIn(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_event: str
    conditions: List[dict] = []
    actions: List[dict] = []
    is_active: bool = True


@router.get("/platform-stats")
def flowbot_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("flowbot"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*), SUM(run_count) FROM app.automation_rules WHERE organization_id=%s AND is_active=true",
            (org_id,),
        )
        row = cur.fetchone()
    active = int(row[0] or 0)
    runs   = int(row[1] or 0)
    stats  = [f"{active} active rule{'s' if active != 1 else ''}"]
    if runs:
        stats.append(f"{runs} actions fired")
    return {"stats": stats, "health": "healthy"}


@router.get("/rules")
def list_rules(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("flowbot"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM app.automation_rules WHERE organization_id=%s ORDER BY created_at DESC",
            (org_id,),
        )
        rows = cur.fetchall()
    return {"rules": [_row(r) for r in rows]}


@router.post("/rules", status_code=201)
def create_rule(
    body: RuleIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("flowbot"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    if body.trigger_event not in TRIGGER_EVENTS:
        raise HTTPException(400, f"trigger_event must be one of: {', '.join(TRIGGER_EVENTS)}")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO app.automation_rules
               (organization_id, name, description, trigger_event, conditions, actions, is_active, created_by)
               VALUES (%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s::uuid) RETURNING *""",
            (org_id, body.name.strip(), body.description, body.trigger_event,
             json.dumps(body.conditions), json.dumps(body.actions), body.is_active, user.id),
        )
        row = cur.fetchone()
        conn.commit()
    return _row(row)


@router.patch("/rules/{rule_id}")
def update_rule(
    rule_id: str,
    body: RuleIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("flowbot"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    if body.trigger_event not in TRIGGER_EVENTS:
        raise HTTPException(400, f"trigger_event must be one of: {', '.join(TRIGGER_EVENTS)}")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE app.automation_rules
               SET name=%s, description=%s, trigger_event=%s, conditions=%s::jsonb,
                   actions=%s::jsonb, is_active=%s, updated_at=NOW()
               WHERE id=%s::uuid AND organization_id=%s RETURNING *""",
            (body.name.strip(), body.description, body.trigger_event,
             json.dumps(body.conditions), json.dumps(body.actions), body.is_active,
             rule_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Rule not found")
        conn.commit()
    return _row(row)


@router.post("/rules/{rule_id}/toggle")
def toggle_rule(
    rule_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("flowbot"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE app.automation_rules SET is_active=NOT is_active, updated_at=NOW() WHERE id=%s::uuid AND organization_id=%s RETURNING is_active",
            (rule_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Rule not found")
        conn.commit()
    return {"is_active": bool(row["is_active"])}


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("flowbot"),
):
    org_id = require_org_context(request)
    _require_admin(user)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM app.automation_rules WHERE id=%s::uuid AND organization_id=%s",
            (rule_id, org_id),
        )
        conn.commit()
