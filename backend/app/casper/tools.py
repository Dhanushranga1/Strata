"""
CASPER Tool Registry — Execution Layer.

The AI can call these tools to change system state, not just generate text.
New modules register tools here; CASPER dispatches them after each AI response.

Tool call lifecycle:
  LLM generates JSON → CASPERResponse.tool_calls parsed →
  ToolRegistry.execute() → RBAC check → handler() → ToolResult → logged to DB
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Role hierarchy — must meet or exceed tool.required_role to execute
_ROLE_RANK: Dict[str, int] = {
    "customer": 0,
    "rep":      1,
    "admin":    2,
    "owner":    3,
}


@dataclass
class ExecutionContext:
    org_id:    str
    user_id:   str
    user_role: str
    ticket_id: Optional[str] = None
    db_cursor: Optional[Any] = None


@dataclass
class ToolResult:
    success:      bool
    action_taken: str
    message:      str
    data:         Dict[str, Any] = field(default_factory=dict)


@dataclass
class Tool:
    name:          str
    description:   str
    parameters:    Dict[str, Any]          # JSON Schema for LLM prompt inclusion
    handler:       Callable[[Dict, ExecutionContext], ToolResult]
    required_role: str = "rep"


class ToolRegistry:
    """
    Central registry for CASPER-executable tools.

    Modules register tools at startup. CASPER's LLM prompt includes all tool
    schemas so the model knows what actions are available. Post-generation,
    CASPER extracts tool_calls from the response JSON and dispatches them here.
    """

    def __init__(self) -> None:
        self._tools: Dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool
        logger.info("CASPER tool registered: %s (requires: %s)", tool.name, tool.required_role)

    def tool_schemas(self) -> List[Dict]:
        """Return JSON schemas for all registered tools — injected into LLM prompt."""
        return [
            {
                "name":        t.name,
                "description": t.description,
                "parameters":  t.parameters,
            }
            for t in self._tools.values()
        ]

    def execute(self, name: str, params: Dict, context: ExecutionContext) -> ToolResult:
        tool = self._tools.get(name)
        if not tool:
            return ToolResult(
                success=False,
                action_taken="unknown_tool",
                message=f"No tool registered with name '{name}'",
            )

        caller_rank = _ROLE_RANK.get(context.user_role, 0)
        required_rank = _ROLE_RANK.get(tool.required_role, 1)
        if caller_rank < required_rank:
            return ToolResult(
                success=False,
                action_taken="permission_denied",
                message=f"Tool '{name}' requires role '{tool.required_role}' (caller: '{context.user_role}')",
            )

        try:
            result = tool.handler(params, context)
            logger.info("Tool executed: %s → %s", name, result.action_taken)
            return result
        except Exception as exc:
            logger.error("Tool '%s' raised: %s", name, exc)
            return ToolResult(
                success=False,
                action_taken="handler_error",
                message=str(exc),
            )

    def execute_all(
        self,
        calls: List[Dict],
        context: ExecutionContext,
    ) -> List[ToolResult]:
        """Execute a list of tool_call dicts from CASPER's LLM response."""
        results = []
        for call in calls:
            name   = call.get("tool", "")
            params = call.get("params", {})
            if name:
                results.append(self.execute(name, params, context))
        return results


# ── Built-in tools ─────────────────────────────────────────────────────────────


def _handle_escalate(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Flag ticket for immediate human attention."""
    if not ctx.db_cursor or not ctx.ticket_id:
        return ToolResult(success=False, action_taken="escalate_skipped", message="No DB cursor or ticket_id")

    reason   = params.get("reason", "AI-triggered escalation")
    priority = params.get("priority")

    ctx.db_cursor.execute(
        "UPDATE app.tickets SET needs_attention = TRUE, updated_at = NOW() WHERE id = %s AND organization_id = %s",
        (ctx.ticket_id, ctx.org_id),
    )
    ctx.db_cursor.execute(
        "INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body) "
        "VALUES (%s, %s, 'system', %s, %s)",
        (ctx.ticket_id, ctx.user_id, ctx.org_id, f"[system] CASPER escalation: {reason}"),
    )
    if priority:
        ctx.db_cursor.execute(
            "UPDATE app.tickets SET priority_level = %s WHERE id = %s AND organization_id = %s",
            (priority, ctx.ticket_id, ctx.org_id),
        )
    return ToolResult(
        success=True,
        action_taken="ticket_escalated",
        message=f"Ticket flagged for human attention: {reason}",
        data={"reason": reason, "priority": priority},
    )


def _handle_link_kb_article(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Attach a KnowBase article reference to the ticket metadata."""
    if not ctx.db_cursor or not ctx.ticket_id:
        return ToolResult(success=False, action_taken="link_kb_skipped", message="No DB cursor or ticket_id")

    article_id = params.get("article_id", "")
    if not article_id:
        return ToolResult(success=False, action_taken="link_kb_skipped", message="Missing article_id")

    # Verify article exists and belongs to org
    ctx.db_cursor.execute(
        "SELECT id, title FROM app.knowledge_articles WHERE id = %s AND organization_id = %s AND is_published = TRUE",
        (article_id, ctx.org_id),
    )
    row = ctx.db_cursor.fetchone()
    if not row:
        return ToolResult(success=False, action_taken="link_kb_skipped", message="Article not found or not published")

    # Store in ticket meta
    ctx.db_cursor.execute(
        """UPDATE app.tickets
           SET meta = COALESCE(meta, '{}') || jsonb_build_object('linked_kb_article', %s::text)
           WHERE id = %s AND organization_id = %s""",
        (article_id, ctx.ticket_id, ctx.org_id),
    )
    return ToolResult(
        success=True,
        action_taken="kb_article_linked",
        message=f"Linked KB article: {row['title']}",
        data={"article_id": article_id, "article_title": row["title"]},
    )


def _handle_suggest_resolution(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Post a system note that CASPER has high confidence in its resolution."""
    if not ctx.db_cursor or not ctx.ticket_id:
        return ToolResult(success=False, action_taken="suggest_resolution_skipped", message="No DB cursor")

    confidence = params.get("confidence", 0.0)
    note = (
        f"[system] CASPER confidence: {confidence:.2f} — resolution drafted. "
        "Review AI response above and close ticket if resolved."
    )
    ctx.db_cursor.execute(
        "INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body) "
        "VALUES (%s, %s, 'system', %s, %s)",
        (ctx.ticket_id, ctx.user_id, ctx.org_id, note),
    )
    ctx.db_cursor.execute(
        "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = %s",
        (ctx.ticket_id,),
    )
    return ToolResult(
        success=True,
        action_taken="resolution_suggested",
        message="Resolution note posted",
        data={"confidence": confidence},
    )


def _handle_create_followup_ticket(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Create a linked follow-up ticket for a related sub-issue CASPER detected."""
    if not ctx.db_cursor or not ctx.ticket_id:
        return ToolResult(success=False, action_taken="followup_skipped", message="No DB cursor")

    title       = params.get("title", "Follow-up issue detected by CASPER")
    description = params.get("description", "Auto-created by CASPER — review required")

    ctx.db_cursor.execute(
        """INSERT INTO app.tickets (created_by, organization_id, title, description, status, message_count, tags)
           VALUES (%s, %s, %s, %s, 'open', 0, ARRAY['casper-generated'])
           RETURNING id""",
        (ctx.user_id, ctx.org_id, title, description),
    )
    new_id = str(ctx.db_cursor.fetchone()["id"])
    note = f"[system] CASPER auto-created follow-up ticket #{new_id[:8]} for related issue: {title}"
    ctx.db_cursor.execute(
        "INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body) "
        "VALUES (%s, %s, 'system', %s, %s)",
        (ctx.ticket_id, ctx.user_id, ctx.org_id, note),
    )
    return ToolResult(
        success=True,
        action_taken="followup_ticket_created",
        message=f"Follow-up ticket created: {new_id}",
        data={"new_ticket_id": new_id, "title": title},
    )


def _handle_lookup_asset(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Search AssetLog for assets matching a query string."""
    query = params.get("query", "").strip()
    if not query:
        return ToolResult(success=False, action_taken="lookup_asset_skipped", message="Missing query")

    try:
        from ..db_sync import get_db_connection
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT id, asset_tag, name, category, status, warranty_expiry,
                          assigned_to, department, purchase_date, purchase_price
                   FROM app.assets
                   WHERE organization_id = %s
                   AND (name ILIKE %s OR asset_tag ILIKE %s
                        OR specs::text ILIKE %s OR department ILIKE %s)
                   ORDER BY updated_at DESC LIMIT 5""",
                (ctx.org_id, f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%"),
            )
            rows = cur.fetchall()
    except Exception as exc:
        return ToolResult(success=False, action_taken="lookup_asset_error", message=str(exc))

    if not rows:
        return ToolResult(
            success=True,
            action_taken="lookup_asset_empty",
            message=f"No assets found matching '{query}'",
            data={"assets": []},
        )
    assets = [
        {
            "id":              str(r["id"]),
            "asset_tag":       r["asset_tag"],
            "name":            r["name"],
            "category":        r["category"],
            "status":          r["status"],
            "warranty_expiry": str(r["warranty_expiry"]) if r.get("warranty_expiry") else None,
        }
        for r in rows
    ]
    return ToolResult(
        success=True,
        action_taken="lookup_asset_found",
        message=f"Found {len(assets)} asset(s) matching '{query}'",
        data={"assets": assets},
    )


def _handle_get_contract_status(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Look up active contracts for a vendor by name."""
    vendor_name = params.get("vendor_name", "").strip()
    if not vendor_name:
        return ToolResult(success=False, action_taken="get_contract_status_skipped", message="Missing vendor_name")

    try:
        from ..db_sync import get_db_connection
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT c.id, c.title, c.status, c.end_date,
                          c.value, c.auto_renews, c.notice_period_days,
                          v.name AS vendor_name
                   FROM app.contracts c
                   JOIN app.vendors v ON v.id = c.vendor_id
                   WHERE c.organization_id = %s
                   AND v.name ILIKE %s
                   AND c.status = 'active'
                   ORDER BY c.end_date ASC NULLS LAST LIMIT 5""",
                (ctx.org_id, f"%{vendor_name}%"),
            )
            rows = cur.fetchall()
    except Exception as exc:
        return ToolResult(success=False, action_taken="get_contract_status_error", message=str(exc))

    if not rows:
        return ToolResult(
            success=True,
            action_taken="get_contract_status_empty",
            message=f"No active contracts found for vendor '{vendor_name}'",
            data={"contracts": []},
        )
    contracts = [
        {
            "id":                  str(r["id"]),
            "title":               r["title"],
            "vendor":              r["vendor_name"],
            "end_date":            str(r["end_date"]) if r.get("end_date") else None,
            "value":               float(r["value"]) if r.get("value") else None,
            "auto_renews":         r["auto_renews"],
            "notice_period_days":  r["notice_period_days"],
        }
        for r in rows
    ]
    return ToolResult(
        success=True,
        action_taken="get_contract_status_found",
        message=f"Found {len(contracts)} active contract(s) for '{vendor_name}'",
        data={"contracts": contracts},
    )


def _handle_find_similar_resolved_tickets(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Find resolved tickets with similar titles using trigram search."""
    query = params.get("query", "").strip()
    if not query:
        return ToolResult(success=False, action_taken="find_similar_skipped", message="Missing query")

    try:
        from ..db_sync import get_db_connection
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT id, title, description, resolution, status, created_at
                   FROM app.tickets
                   WHERE organization_id = %s
                   AND status IN ('resolved', 'closed')
                   AND title ILIKE %s
                   ORDER BY created_at DESC LIMIT 5""",
                (ctx.org_id, f"%{query}%"),
            )
            rows = cur.fetchall()
    except Exception as exc:
        return ToolResult(success=False, action_taken="find_similar_error", message=str(exc))

    if not rows:
        return ToolResult(
            success=True,
            action_taken="find_similar_empty",
            message=f"No resolved tickets found similar to '{query}'",
            data={"tickets": []},
        )
    tickets = [
        {
            "id":         str(r["id"]),
            "title":      r["title"],
            "resolution": (r.get("resolution") or "")[:300],
        }
        for r in rows
    ]
    return ToolResult(
        success=True,
        action_taken="find_similar_found",
        message=f"Found {len(tickets)} resolved ticket(s) similar to '{query}'",
        data={"tickets": tickets},
    )


def _handle_create_asset_ticket(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Create a new ticket pre-linked to a specific asset."""
    if not ctx.db_cursor:
        return ToolResult(success=False, action_taken="create_asset_ticket_skipped", message="No DB cursor")

    asset_id = params.get("asset_id", "").strip()
    title    = params.get("title", "Asset issue detected by CASPER").strip()
    desc     = params.get("description", "").strip()

    if not asset_id:
        return ToolResult(success=False, action_taken="create_asset_ticket_skipped", message="Missing asset_id")

    ctx.db_cursor.execute(
        """INSERT INTO app.tickets
               (created_by, organization_id, title, description, status, message_count, tags)
           VALUES (%s, %s, %s, %s, 'open', 0, ARRAY['asset-linked','casper-generated'])
           RETURNING id""",
        (ctx.user_id, ctx.org_id, title, desc or f"Asset issue linked to {asset_id}"),
    )
    new_ticket_id = str(ctx.db_cursor.fetchone()["id"])
    ctx.db_cursor.execute(
        "INSERT INTO app.asset_tickets (asset_id, ticket_id) VALUES (%s::uuid, %s::uuid) ON CONFLICT DO NOTHING",
        (asset_id, new_ticket_id),
    )
    return ToolResult(
        success=True,
        action_taken="asset_ticket_created",
        message=f"Created ticket {new_ticket_id} linked to asset {asset_id}",
        data={"new_ticket_id": new_ticket_id, "asset_id": asset_id},
    )


def _handle_flag_contract_renewal(params: Dict, ctx: ExecutionContext) -> ToolResult:
    """Create a renewal notification for a contract nearing expiry."""
    if not ctx.db_cursor:
        return ToolResult(success=False, action_taken="flag_renewal_skipped", message="No DB cursor")

    contract_id = params.get("contract_id", "").strip()
    if not contract_id:
        return ToolResult(success=False, action_taken="flag_renewal_skipped", message="Missing contract_id")

    ctx.db_cursor.execute(
        "SELECT title, end_date FROM app.contracts WHERE id = %s::uuid AND organization_id = %s",
        (contract_id, ctx.org_id),
    )
    row = ctx.db_cursor.fetchone()
    if not row:
        return ToolResult(success=False, action_taken="flag_renewal_skipped", message="Contract not found")

    note = (
        f"[system] CASPER flagged contract '{row['title']}' for renewal review. "
        f"Expiry: {row['end_date']}."
    )
    if ctx.ticket_id:
        ctx.db_cursor.execute(
            "INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body) "
            "VALUES (%s, %s, 'system', %s, %s)",
            (ctx.ticket_id, ctx.user_id, ctx.org_id, note),
        )
    return ToolResult(
        success=True,
        action_taken="contract_renewal_flagged",
        message=f"Flagged contract '{row['title']}' for renewal (expires {row['end_date']})",
        data={"contract_id": contract_id, "end_date": str(row["end_date"])},
    )


def build_default_registry() -> ToolRegistry:
    """Build and return the default tool registry with all built-in tools."""
    registry = ToolRegistry()

    registry.register(Tool(
        name="escalate_ticket",
        description=(
            "Escalate this ticket to a senior rep immediately. Use when the issue is complex, "
            "involves security/data loss, or confidence is below threshold."
        ),
        parameters={
            "type": "object",
            "properties": {
                "reason":   {"type": "string", "description": "Why escalation is needed"},
                "priority": {"type": "string", "enum": ["P1", "P2", "P3", "P4"], "description": "Suggested priority override"},
            },
            "required": ["reason"],
        },
        handler=_handle_escalate,
        required_role="rep",
    ))

    registry.register(Tool(
        name="link_knowbase_article",
        description=(
            "Attach a relevant KnowBase article to this ticket as a reference. "
            "Use when the KB article directly addresses the ticket issue."
        ),
        parameters={
            "type": "object",
            "properties": {
                "article_id": {"type": "string", "description": "UUID of the KnowBase article to link"},
            },
            "required": ["article_id"],
        },
        handler=_handle_link_kb_article,
        required_role="rep",
    ))

    registry.register(Tool(
        name="suggest_resolution",
        description=(
            "Post a system note indicating high-confidence resolution. "
            "Use only when confidence is above 0.80 and the answer fully addresses the question."
        ),
        parameters={
            "type": "object",
            "properties": {
                "confidence": {"type": "number", "description": "CASPER confidence score (0.0–1.0)"},
            },
            "required": ["confidence"],
        },
        handler=_handle_suggest_resolution,
        required_role="rep",
    ))

    registry.register(Tool(
        name="create_followup_ticket",
        description=(
            "Create a linked follow-up ticket for a distinct sub-issue detected in the conversation. "
            "Use sparingly — only for genuinely separate actionable issues."
        ),
        parameters={
            "type": "object",
            "properties": {
                "title":       {"type": "string", "description": "Title for the follow-up ticket"},
                "description": {"type": "string", "description": "Description of the sub-issue"},
            },
            "required": ["title"],
        },
        handler=_handle_create_followup_ticket,
        required_role="rep",
    ))

    # ── Strata module tools ────────────────────────────────────────────────────

    registry.register(Tool(
        name="lookup_asset",
        description=(
            "Search AssetLog for hardware/software assets by name, asset tag, serial, or department. "
            "Use when the ticket mentions a specific device, machine, or equipment."
        ),
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Asset name, tag, serial number, or department to search"},
            },
            "required": ["query"],
        },
        handler=_handle_lookup_asset,
        required_role="rep",
    ))

    registry.register(Tool(
        name="get_contract_status",
        description=(
            "Look up active contracts for a specific vendor in ContractVault. "
            "Use when the ticket involves a vendor product or service."
        ),
        parameters={
            "type": "object",
            "properties": {
                "vendor_name": {"type": "string", "description": "Vendor name to look up (partial match OK)"},
            },
            "required": ["vendor_name"],
        },
        handler=_handle_get_contract_status,
        required_role="rep",
    ))

    registry.register(Tool(
        name="find_similar_resolved_tickets",
        description=(
            "Find past resolved tickets with a similar issue. "
            "Use to surface proven resolutions before answering a new ticket."
        ),
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keywords from the current ticket title/issue"},
            },
            "required": ["query"],
        },
        handler=_handle_find_similar_resolved_tickets,
        required_role="rep",
    ))

    registry.register(Tool(
        name="create_asset_ticket",
        description=(
            "Create a new support ticket pre-linked to a specific asset. "
            "Use when a hardware issue is detected and no ticket exists for the asset yet."
        ),
        parameters={
            "type": "object",
            "properties": {
                "asset_id":    {"type": "string", "description": "UUID of the asset to link"},
                "title":       {"type": "string", "description": "Ticket title"},
                "description": {"type": "string", "description": "Ticket description"},
            },
            "required": ["asset_id", "title"],
        },
        handler=_handle_create_asset_ticket,
        required_role="rep",
    ))

    registry.register(Tool(
        name="flag_contract_renewal",
        description=(
            "Flag a contract in ContractVault for renewal review. "
            "Use when the ticket involves a vendor whose contract is expiring soon."
        ),
        parameters={
            "type": "object",
            "properties": {
                "contract_id": {"type": "string", "description": "UUID of the contract to flag"},
            },
            "required": ["contract_id"],
        },
        handler=_handle_flag_contract_renewal,
        required_role="rep",
    ))

    return registry
