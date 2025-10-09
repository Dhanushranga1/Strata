from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
import asyncpg
import os
from datetime import datetime
from .auth import User, get_current_user
from .schemas import (
    QueueResponse, QueueCounts, QueueItem,
    EscalateRequest, StatusChangeRequest, AssignRequest, 
    AckAttentionRequest, PriorityRequest
)

router = APIRouter(prefix="/api/rep", tags=["rep"])

def require_rep(user: User):
    """Helper to enforce rep/admin role requirement"""
    if (user.role or "customer") not in ("rep", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rep/admin access required")

async def get_db_connection():
    """Get database connection"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is required")
    return await asyncpg.connect(database_url)

@router.get("/queue", response_model=QueueResponse)
async def queue(
    lane: str = Query("needs_attention", pattern="^(needs_attention|open|escalated|all)$"),
    q: Optional[str] = Query(None, max_length=100),
    mine: Optional[bool] = Query(False),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """Get tickets queue based on lane with optional filters"""
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        # Build WHERE clause based on lane
        where_conditions = []
        params = []
        
        if lane == "needs_attention":
            where_conditions.append("needs_attention = true AND status != 'closed'")
        elif lane == "open":
            where_conditions.append("status IN ('open', 'in_progress', 'resolved') AND needs_attention = false")
        elif lane == "escalated":
            where_conditions.append("status = 'escalated'")
        # 'all' lane has no specific condition
        
        # Add search filter
        if q:
            where_conditions.append(f"title ILIKE ${len(params) + 1}")
            params.append(f"%{q}%")
        
        # Add 'mine' filter
        if mine:
            where_conditions.append(f"assignee_id = ${len(params) + 1}")
            params.append(user.id)
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        # Build query
        count_query = f"""
            SELECT COUNT(*) 
            FROM app.tickets 
            {where_clause}
        """
        
        items_query = f"""
            SELECT id, title, status, priority, needs_attention, assignee_id,
                   message_count, last_message_at, created_at
            FROM app.tickets 
            {where_clause}
            ORDER BY last_message_at DESC 
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
                needs_attention=row['needs_attention'],
                assignee_id=str(row['assignee_id']) if row['assignee_id'] else None,
                message_count=row['message_count'],
                last_message_at=row['last_message_at'],
                created_at=row['created_at']
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
async def counts(user: User = Depends(get_current_user)):
    """Get counts for all queue lanes"""
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        # Get counts for each lane
        needs_attention_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE needs_attention = true AND status != 'closed'"
        )
        
        open_active_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE status IN ('open', 'in_progress', 'resolved') AND needs_attention = false"
        )
        
        escalated_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets WHERE status = 'escalated'"
        )
        
        all_count = await conn.fetchval(
            "SELECT COUNT(*) FROM app.tickets"
        )
        
        return QueueCounts(
            needs_attention=needs_attention_count,
            open_active=open_active_count,
            escalated=escalated_count,
            all=all_count
        )
        
    finally:
        await conn.close()

@router.post("/tickets/{ticket_id}/escalate", status_code=status.HTTP_200_OK)
async def escalate(
    ticket_id: str, 
    body: EscalateRequest, 
    user: User = Depends(get_current_user)
):
    """Escalate a ticket to escalated status"""
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists and is not closed
            ticket = await conn.fetchrow(
                "SELECT id, status FROM app.tickets WHERE id = $1", ticket_id
            )
            
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            if ticket['status'] == 'closed':
                raise HTTPException(status_code=409, detail="Cannot escalate closed ticket")
            
            # Update ticket status and flag
            await conn.execute(
                """
                UPDATE app.tickets 
                SET status = 'escalated', needs_attention = true, last_message_at = NOW()
                WHERE id = $1
                """,
                ticket_id
            )
            
            # Create system message
            message_body = "[system] Ticket escalated"
            if body.reason:
                message_body += f" • Reason: {body.reason}"
            
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, body, created_at)
                VALUES ($1, $2, 'system', $3, NOW())
                """,
                ticket_id, user.id, message_body
            )
            
            # Update message count
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
            
        return {"ok": True}
        
    finally:
        await conn.close()

@router.post("/tickets/{ticket_id}/status", status_code=status.HTTP_200_OK)
async def set_status(
    ticket_id: str, 
    body: StatusChangeRequest, 
    user: User = Depends(get_current_user)
):
    """Change ticket status with transition validation"""
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists
            ticket = await conn.fetchrow(
                "SELECT id, status FROM app.tickets WHERE id = $1", ticket_id
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
                SET status = $1, last_message_at = NOW(){needs_attention_update}
                WHERE id = $2
                """,
                new_status, ticket_id
            )
            
            # Create system message
            message_body = f"[system] Status changed to {new_status}"
            
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, body, created_at)
                VALUES ($1, $2, 'system', $3, NOW())
                """,
                ticket_id, user.id, message_body
            )
            
            # Update message count
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
            
        return {"ok": True}
        
    finally:
        await conn.close()

@router.post("/tickets/{ticket_id}/assign", status_code=status.HTTP_200_OK)
async def assign(
    ticket_id: str, 
    body: AssignRequest, 
    user: User = Depends(get_current_user)
):
    """Assign ticket to a rep"""
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists
            ticket = await conn.fetchrow(
                "SELECT id FROM app.tickets WHERE id = $1", ticket_id
            )
            
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            # Determine assignee
            assignee_id = body.assignee_id or user.id
            
            # Update ticket assignee
            await conn.execute(
                """
                UPDATE app.tickets 
                SET assignee_id = $1, last_message_at = NOW()
                WHERE id = $2
                """,
                assignee_id, ticket_id
            )
            
            # Create system message
            assignee_display = user.email if assignee_id == user.id else assignee_id
            message_body = f"[system] Assigned to {assignee_display}"
            
            await conn.execute(
                """
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, body, created_at)
                VALUES ($1, $2, 'system', $3, NOW())
                """,
                ticket_id, user.id, message_body
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
    user: User = Depends(get_current_user)
):
    """Acknowledge attention flag on ticket"""
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists and needs attention
            ticket = await conn.fetchrow(
                "SELECT id, needs_attention FROM app.tickets WHERE id = $1", ticket_id
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
                    INSERT INTO app.messages (ticket_id, sender_id, sender_role, body, created_at)
                    VALUES ($1, $2, 'system', $3, NOW())
                    """,
                    ticket_id, user.id, message_body
                )
                
                # Update message count
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
    user: User = Depends(get_current_user)
):
    """Set ticket priority"""
    require_rep(user)
    
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            # Check if ticket exists
            ticket = await conn.fetchrow(
                "SELECT id FROM app.tickets WHERE id = $1", ticket_id
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
                INSERT INTO app.messages (ticket_id, sender_id, sender_role, body, created_at)
                VALUES ($1, $2, 'system', $3, NOW())
                """,
                ticket_id, user.id, message_body
            )
            
            # Update message count
            await conn.execute(
                "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                ticket_id
            )
            
        return {"ok": True}
        
    finally:
        await conn.close()