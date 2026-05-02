from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import Optional
import asyncio
from .auth import User, get_current_user
from .schemas import (
    QueueResponse, QueueCounts, QueueItem,
    EscalateRequest, StatusChangeRequest, AssignRequest,
    AckAttentionRequest, PriorityRequest, PriorityLevelRequest, ETRRequest,
    RepWorkloadResponse, RepWorkloadItem,
)
from .org_middleware import require_org_context

router = APIRouter(prefix="/api/rep", tags=["rep"])

def require_rep(user: User):
    """Helper to enforce rep/admin role requirement"""
    if (user.role or "customer") not in ("rep", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rep/admin access required")

async def get_db_connection():
    from .db import get_connection
    return await get_connection()

@router.get("/queue", response_model=QueueResponse)
async def queue(
    request: Request,
    lane: str = Query("needs_attention", pattern="^(needs_attention|open|escalated|all|resolved_today)$"),
    q: Optional[str] = Query(None, max_length=100),
    mine: Optional[bool] = Query(False),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """Get tickets queue based on lane with optional filters"""
    org_id = require_org_context(request)
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        # Build WHERE clause based on lane (all conditions use table alias t.)
        where_conditions = ["t.organization_id = $1"]
        params = [org_id]

        if lane == "needs_attention":
            where_conditions.append("t.needs_attention = true AND t.status != 'closed'")
        elif lane == "open":
            where_conditions.append("t.status IN ('open', 'in_progress', 'resolved') AND t.needs_attention = false")
        elif lane == "escalated":
            where_conditions.append("t.status = 'escalated'")
        elif lane == "resolved_today":
            where_conditions.append("t.status = 'resolved' AND DATE(t.updated_at) = CURRENT_DATE")
        # 'all' lane has no specific condition

        # Add search filter
        if q:
            where_conditions.append(f"t.title ILIKE ${len(params) + 1}")
            params.append(f"%{q}%")

        # Add 'mine' filter
        if mine:
            where_conditions.append(f"t.assignee_id = ${len(params) + 1}")
            params.append(user.id)

        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""

        # Count query (no JOIN needed)
        count_query = f"""
            SELECT COUNT(*)
            FROM app.tickets t
            {where_clause}
        """

        # Items query — JOIN auth.users to resolve escalated_to name
        items_query = f"""
            SELECT t.id, t.title, t.status, t.priority, t.priority_level,
                   t.needs_attention, t.assignee_id,
                   t.message_count, t.last_message_at, t.created_at,
                   t.escalated_at, t.accepted_at,
                   t.expected_resolve_at, t.etr_set_at,
                   eu.email AS escalated_to_name
            FROM app.tickets t
            LEFT JOIN auth.users eu ON eu.id = t.escalated_to
            {where_clause}
            ORDER BY t.last_message_at DESC
            LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """

        # Execute count query
        total_result = await conn.fetchval(count_query, *params)

        # Execute items query
        query_params = params + [limit, offset]
        items_result = await conn.fetch(items_query, *query_params)

        # Convert to response format
        items = [
            QueueItem(
                id=str(row['id']),
                title=row['title'],
                status=row['status'],
                priority=row['priority'],
                priority_level=row['priority_level'],
                needs_attention=row['needs_attention'],
                assignee_id=str(row['assignee_id']) if row['assignee_id'] else None,
                message_count=row['message_count'],
                last_message_at=row['last_message_at'],
                created_at=row['created_at'],
                escalated_at=row['escalated_at'],
                escalated_to_name=row['escalated_to_name'],
                expected_resolve_at=row['expected_resolve_at'],
                etr_set_at=row['etr_set_at'],
                accepted_at=row['accepted_at'],
            )
            for row in items_result
        ]

        return QueueResponse(
            items=items,
            total=total_result,
            offset=offset,
            limit=limit
        )

    finally:
        await conn.close()

@router.get("/counts", response_model=QueueCounts)
async def counts(request: Request, user: User = Depends(get_current_user)):
    """Get counts for all queue lanes"""
    org_id = require_org_context(request)
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        # Get counts for each lane
        needs_attention_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id = $1 AND needs_attention = true AND status != 'closed'",
            org_id
        )
        
        open_active_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id = $1 AND status IN ('open', 'in_progress', 'resolved') AND needs_attention = false",
            org_id
        )
        
        escalated_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id = $1 AND status = 'escalated'",
            org_id
        )
        
        all_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id = $1",
            org_id
        )

        resolved_today_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id = $1 AND status = 'resolved' AND DATE(updated_at) = CURRENT_DATE",
            org_id
        )

        in_progress_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE organization_id = $1 AND status = 'in_progress'",
            org_id
        )

        return QueueCounts(
            needs_attention=needs_attention_count,
            open_active=open_active_count,
            in_progress=in_progress_count,
            escalated=escalated_count,
            all=all_count,
            resolved_today=resolved_today_count
        )
        
    finally:
        await conn.close()

@router.get("/my-tickets")
async def my_tickets(
    request: Request,
    status_filter: str = Query("open", pattern="^(open|in_progress|escalated|resolved|closed|all)$"),
    q: Optional[str] = Query(None, max_length=100),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
):
    """
    Return all tickets assigned to the current rep across every organisation they belong to.
    Does NOT require an X-Organization-ID header — this is a cross-org view.
    """
    require_rep(user)
    conn = await get_db_connection()
    try:
        # All org IDs where this user is an active member with rep/admin/owner role
        org_rows = await conn.fetch(
            """
            SELECT om.organization_id::text, o.name AS org_name
            FROM app.organization_members om
            JOIN app.organizations o ON o.id = om.organization_id
            WHERE om.user_id = $1 AND om.role IN ('owner', 'admin', 'rep')
            """,
            user.id,
        )
        if not org_rows:
            return {"items": [], "total": 0, "offset": offset, "limit": limit}

        org_ids = [r["organization_id"] for r in org_rows]
        org_name_map = {r["organization_id"]: r["org_name"] for r in org_rows}

        where_conditions = [
            "t.assignee_id = $1",
            f"t.organization_id = ANY($2::uuid[])",
        ]
        params: list = [user.id, org_ids]

        if status_filter != "all":
            where_conditions.append(f"t.status = ${len(params) + 1}")
            params.append(status_filter)

        if q:
            where_conditions.append(f"t.title ILIKE ${len(params) + 1}")
            params.append(f"%{q}%")

        where_clause = "WHERE " + " AND ".join(where_conditions)

        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM app.tickets t {where_clause}", *params
        )

        rows = await conn.fetch(
            f"""
            SELECT t.id, t.title, t.status, t.priority, t.priority_level,
                   t.needs_attention, t.is_overdue, t.message_count,
                   t.last_message_at, t.created_at, t.organization_id::text,
                   cu.email AS customer_email
            FROM app.tickets t
            LEFT JOIN auth.users cu ON cu.id = t.created_by
            {where_clause}
            ORDER BY t.last_message_at DESC
            LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
            """,
            *params, limit, offset,
        )

        items = [
            {
                "id": str(r["id"]),
                "title": r["title"],
                "status": r["status"],
                "priority": r["priority"],
                "priority_level": r["priority_level"],
                "needs_attention": r["needs_attention"],
                "is_overdue": r["is_overdue"],
                "message_count": r["message_count"],
                "last_message_at": r["last_message_at"],
                "created_at": r["created_at"],
                "organization_id": r["organization_id"],
                "organization_name": org_name_map.get(r["organization_id"], "Unknown"),
                "customer_email": r["customer_email"],
            }
            for r in rows
        ]

        return {"items": items, "total": total, "offset": offset, "limit": limit}

    finally:
        await conn.close()


@router.post("/tickets/{ticket_id}/accept", status_code=status.HTTP_200_OK)
async def accept_ticket(
    ticket_id: str,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Accept an open ticket — sets status=in_progress, records accepted_at, assigns to caller."""
    org_id = require_org_context(request)
    require_rep(user)

    conn = await get_db_connection()
    try:
        async with conn.transaction():
            ticket = await conn.fetchrow(
                "SELECT id, status FROM app.tickets WHERE id = $1 AND organization_id = $2",
                ticket_id, org_id
            )
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            if ticket['status'] not in ('open', 'escalated'):
                raise HTTPException(status_code=409, detail="Only open or escalated tickets can be accepted")

            await conn.execute(
                """
                UPDATE app.tickets
                SET status = 'in_progress', accepted_at = NOW(),
                    assignee_id = $1, updated_at = NOW(), needs_attention = false
                WHERE id = $2
                """,
                user.id, ticket_id
            )
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                VALUES ($1, $2, 'system', $3, '[system] Ticket accepted — now in progress', NOW())
                """,
                ticket_id, user.id, org_id
            )
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
        from .admin import log_audit
        asyncio.create_task(log_audit(
            "ticket.accepted", user,
            resource_type="ticket", resource_id=ticket_id, org_id=org_id,
        ))
        return {"ok": True}
    finally:
        await conn.close()


@router.post("/tickets/{ticket_id}/escalate", status_code=status.HTTP_200_OK)
async def escalate(
    ticket_id: str,
    body: EscalateRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """
    Escalate a ticket to escalated status.
    Accessible by: Rep/Admin OR the ticket creator (customer self-escalation).
    """
    org_id = require_org_context(request)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists and get creator
            ticket = await conn.fetchrow(
                "SELECT id, status, created_by FROM app.tickets WHERE id = $1 AND organization_id = $2", 
                ticket_id, org_id
            )
            
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            # Permission check: Allow rep/admin OR ticket creator
            user_role = user.role or "customer"
            is_rep_or_admin = user_role in ("rep", "admin")
            is_ticket_creator = str(ticket['created_by']) == user.id
            
            if not (is_rep_or_admin or is_ticket_creator):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, 
                    detail="Only reps, admins, or the ticket creator can escalate this ticket"
                )
            
            if ticket['status'] == 'closed':
                raise HTTPException(status_code=409, detail="Cannot escalate closed ticket")
            
            # Update ticket status, flag, and escalation target
            await conn.execute(
                """
                UPDATE app.tickets
                SET status = 'escalated', needs_attention = true,
                    last_message_at = NOW(), updated_at = NOW(),
                    escalated_to = $2, escalated_at = NOW()
                WHERE id = $1
                """,
                ticket_id, body.escalated_to_user_id
            )
            
            # Create system message (differentiate customer vs rep escalation)
            if is_ticket_creator and not is_rep_or_admin:
                message_body = "[system] Customer requested human assistance"
                if body.reason:
                    message_body += f" • Reason: {body.reason}"
            else:
                message_body = "[system] Ticket escalated by support team"
                if body.reason:
                    message_body += f" • Reason: {body.reason}"
            
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                VALUES ($1, $2, 'system', $3, $4, NOW())
                """,
                ticket_id, user.id, org_id, message_body
            )
            
            # Update message count
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
            
        from .admin import log_audit
        asyncio.create_task(log_audit(
            "ticket.escalated", user,
            resource_type="ticket", resource_id=ticket_id, org_id=org_id,
            metadata={"reason": body.reason},
        ))
        return {"ok": True}

    finally:
        await conn.close()

@router.post("/tickets/{ticket_id}/status", status_code=status.HTTP_200_OK)
async def set_status(
    ticket_id: str,
    body: StatusChangeRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Change ticket status with transition validation"""
    org_id = require_org_context(request)
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists
            ticket = await conn.fetchrow(
                "SELECT id, status FROM app.tickets WHERE id = $1 AND organization_id = $2", 
                ticket_id, org_id
            )
            
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            current_status = ticket['status']
            new_status = body.status
            
            # Validate transition - closed can only go to open
            if current_status == 'closed' and new_status != 'open':
                raise HTTPException(
                    status_code=409, 
                    detail="Closed tickets can only be reopened (status=open)"
                )
            
            # Determine needs_attention flag
            needs_attention_update = ""
            if new_status in ('resolved', 'closed'):
                needs_attention_update = ", needs_attention = false"
            
            # Update ticket status
            await conn.execute(
                f"""
                UPDATE app.tickets
                SET status = $1, last_message_at = NOW(), updated_at = NOW(){needs_attention_update}
                WHERE id = $2
                """,
                new_status, ticket_id
            )
            
            # Create system message
            message_body = f"[system] Status changed to {new_status}"
            
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                VALUES ($1, $2, 'system', $3, $4, NOW())
                """,
                ticket_id, user.id, org_id, message_body
            )
            
            # Update message count
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )

        from .admin import log_audit
        asyncio.create_task(log_audit(
            f"ticket.status.{new_status}", user,
            resource_type="ticket", resource_id=ticket_id, org_id=org_id,
        ))
        return {"ok": True}

    finally:
        await conn.close()

@router.post("/tickets/{ticket_id}/assign", status_code=status.HTTP_200_OK)
async def assign(
    ticket_id: str,
    body: AssignRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Assign ticket to a rep"""
    org_id = require_org_context(request)
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists
            ticket = await conn.fetchrow(
                "SELECT id FROM app.tickets WHERE id = $1 AND organization_id = $2", 
                ticket_id, org_id
            )
            
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            # Determine assignee
            assignee_id = body.assignee_id or str(user.id)

            # Look up assignee email for a human-readable system message
            assignee_row = await conn.fetchrow(
                "SELECT email FROM auth.users WHERE id = $1", assignee_id
            )
            assignee_display = (assignee_row["email"] if assignee_row else assignee_id)

            # Update ticket assignee
            await conn.execute(
                """
                UPDATE app.tickets
                SET assignee_id = $1, updated_at = NOW()
                WHERE id = $2
                """,
                assignee_id, ticket_id
            )

            message_body = f"[system] Assigned to {assignee_display}"
            
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                VALUES ($1, $2, 'system', $3, $4, NOW())
                """,
                ticket_id, user.id, org_id, message_body
            )
            
            # Update message count
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
            
        return {"ok": True}
        
    finally:
        await conn.close()

@router.post("/tickets/{ticket_id}/acknowledge", status_code=status.HTTP_200_OK)
async def acknowledge_attention(
    ticket_id: str,
    body: AckAttentionRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Acknowledge attention flag on ticket"""
    org_id = require_org_context(request)
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists and needs attention
            ticket = await conn.fetchrow(
                "SELECT id, needs_attention FROM app.tickets WHERE id = $1 AND organization_id = $2", 
                ticket_id, org_id
            )
            
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            if ticket['needs_attention']:
                # Clear attention flag
                await conn.execute(
                    """
                    UPDATE app.tickets 
                    SET needs_attention = false, last_message_at = NOW()
                    WHERE id = $1
                    """,
                    ticket_id
                )
                
                # Create system message
                message_body = "[system] Attention acknowledged"
                if body.note:
                    message_body += f" • Note: {body.note}"
                
                await conn.execute(
                    """
                    INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                    VALUES ($1, $2, 'system', $3, $4, NOW())
                    """,
                    ticket_id, user.id, org_id, message_body
                )
                
                # Update message count
                await conn.execute(
                    "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                    ticket_id
                )
            
        return {"ok": True}
        
    finally:
        await conn.close()

@router.post("/tickets/{ticket_id}/priority-level", status_code=status.HTTP_200_OK)
async def set_priority_level(
    ticket_id: str,
    body: PriorityLevelRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Set the numeric priority level (1–7) on a ticket."""
    org_id = require_org_context(request)
    require_rep(user)

    conn = await get_db_connection()
    try:
        async with conn.transaction():
            ticket = await conn.fetchrow(
                "SELECT id FROM app.tickets WHERE id = $1 AND organization_id = $2",
                ticket_id, org_id
            )
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")

            await conn.execute(
                """
                UPDATE app.tickets
                SET priority_level = $1, updated_at = NOW()
                WHERE id = $2
                """,
                body.priority_level, ticket_id
            )
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                VALUES ($1, $2, 'system', $3, $4, NOW())
                """,
                ticket_id, user.id, org_id, f"[system] Priority level set to {body.priority_level}"
            )
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
        return {"ok": True}
    finally:
        await conn.close()


@router.post("/tickets/{ticket_id}/etr", status_code=status.HTTP_200_OK)
async def set_etr(
    ticket_id: str,
    body: ETRRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Set or update the Expected Time to Resolve (ETR) for a ticket."""
    org_id = require_org_context(request)
    require_rep(user)

    conn = await get_db_connection()
    try:
        async with conn.transaction():
            ticket = await conn.fetchrow(
                "SELECT id, status FROM app.tickets WHERE id = $1 AND organization_id = $2",
                ticket_id, org_id
            )
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            if ticket['status'] in ('resolved', 'closed'):
                raise HTTPException(status_code=409, detail="Cannot set ETR on resolved/closed ticket")

            await conn.execute(
                """
                UPDATE app.tickets
                SET expected_resolve_at = $1,
                    etr_set_by = $2,
                    etr_set_at = NOW(),
                    etr_reminder_sent = false,
                    is_overdue = false,
                    updated_at = NOW()
                WHERE id = $3
                """,
                body.expected_resolve_at, user.id, ticket_id
            )
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                VALUES ($1, $2, 'system', $3, $4, NOW())
                """,
                ticket_id, user.id, org_id,
                f"[system] Expected resolution set to {body.expected_resolve_at.strftime('%Y-%m-%d %H:%M UTC')}"
            )
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
        return {"ok": True}
    finally:
        await conn.close()


@router.post("/tickets/{ticket_id}/priority", status_code=status.HTTP_200_OK)
async def set_priority(
    ticket_id: str,
    body: PriorityRequest,
    request: Request,
    user: User = Depends(get_current_user)
):
    """Set ticket priority"""
    org_id = require_org_context(request)
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists
            ticket = await conn.fetchrow(
                "SELECT id FROM app.tickets WHERE id = $1 AND organization_id = $2", 
                ticket_id, org_id
            )
            
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            # Update ticket priority
            await conn.execute(
                """
                UPDATE app.tickets 
                SET priority = $1, last_message_at = NOW()
                WHERE id = $2
                """,
                body.priority, ticket_id
            )
            
            # Create system message
            message_body = f"[system] Priority set to {body.priority}"
            
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                VALUES ($1, $2, 'system', $3, $4, NOW())
                """,
                ticket_id, user.id, org_id, message_body
            )
            
            # Update message count
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
            
        return {"ok": True}
        
    finally:
        await conn.close()

# ── Workload ──────────────────────────────────────────────────────────────────

@router.get("/workload", response_model=RepWorkloadResponse)
async def get_workload(request: Request, user: User = Depends(get_current_user)):
    """Return all reps/admins in the org with their open ticket counts."""
    org_id = require_org_context(request)
    require_rep(user)

    conn = await get_db_connection()
    try:
        import uuid as uuid_lib
        org_uuid = uuid_lib.UUID(org_id)

        rows = await conn.fetch("""
            SELECT
                om.user_id::text,
                au.email,
                ur.role,
                COUNT(t.id) FILTER (
                    WHERE t.assignee_id = om.user_id
                      AND t.status IN ('open','in_progress','escalated')
                ) AS open_tickets
            FROM app.organization_members om
            JOIN auth.users au ON au.id = om.user_id
            JOIN app.user_roles ur ON ur.user_id = om.user_id
            LEFT JOIN app.tickets t ON t.organization_id = $1
            WHERE om.organization_id = $1
              AND ur.role IN ('rep', 'admin')
            GROUP BY om.user_id, au.email, ur.role
            ORDER BY open_tickets ASC, au.email ASC
        """, org_uuid)

        unassigned = await conn.fetchval("""
            SELECT COUNT(*) FROM app.tickets
            WHERE organization_id = $1
              AND status IN ('open','in_progress','escalated')
              AND assignee_id IS NULL
        """, org_uuid)

        return RepWorkloadResponse(
            reps=[
                RepWorkloadItem(
                    user_id=r["user_id"],
                    email=r["email"],
                    role=r["role"],
                    open_tickets=r["open_tickets"],
                )
                for r in rows
            ],
            total_unassigned=unassigned or 0,
        )
    finally:
        await conn.close()
