"""
Admin-only API endpoints for Phase 5A
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import Optional, List
from datetime import datetime
import logging

from .observability import get_rag_analytics
from .rag_scoring import profile_ticket, casper_route
from .schemas import (
    UserRoleItem, SetRoleRequest, RoleRequestCreate, RoleRequestItem,
    DecideRoleRequest, DiagnosticInfo, Role, AutoAssignResponse,
)
from .auth import get_current_user, User
from .roles import get_database_connection, set_user_role, normalize_role, invalidate_cache
from .org_middleware import require_org_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

def require_admin(user: User):
    """Ensure user has admin role"""
    logger.info(f"Admin check - User ID: {user.id}, Email: {user.email}, Role: {user.role}")
    
    # Normalize role comparison (handle None, empty strings, and case sensitivity)
    actual_role = (user.role or "customer").lower().strip()
    
    if actual_role != "admin":
        logger.warning(f"Admin access denied for user {user.id} with role '{actual_role}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Admin access required. Current role: {actual_role}"
        )
    
    logger.info(f"Admin access granted for user {user.id}")

@router.get("/users", response_model=List[UserRoleItem])
async def list_users(
    q: Optional[str] = Query(None, description="Search by email"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user)
):
    """List all users with their roles (admin only)"""
    require_admin(user)

    conn = await get_database_connection()
    try:
        if q:
            query = """
                SELECT user_id, email, role, role_updated_at
                FROM app.v_users_roles
                WHERE email ILIKE $1
                ORDER BY email
                LIMIT $2 OFFSET $3
            """
            rows = await conn.fetch(query, f"%{q}%", limit, offset)
        else:
            query = """
                SELECT user_id, email, role, role_updated_at
                FROM app.v_users_roles
                ORDER BY email
                LIMIT $1 OFFSET $2
            """
            rows = await conn.fetch(query, limit, offset)
        
        return [
            UserRoleItem(
                user_id=str(row["user_id"]),
                email=row["email"],
                role=row["role"],
                role_updated_at=row["role_updated_at"]
            )
            for row in rows
        ]
    finally:
        await conn.close()

@router.post("/users/{user_id}/role")
async def set_role(
    user_id: str,
    body: SetRoleRequest,
    user: User = Depends(get_current_user)
):
    """Set a user's role (admin only)"""
    require_admin(user)
    
    # Get database connection for admin safety checks
    conn = await get_database_connection()
    try:
        # Check if this is an admin demotion
        if body.role != "admin":
            # Count current admins
            admin_count = await conn.fetchval(
                "SELECT COUNT(*) FROM app.user_roles WHERE role = 'admin'"
            )
            
            # Check if user being changed is currently admin
            current_role = await conn.fetchval(
                "SELECT role FROM app.user_roles WHERE user_id = $1",
                user_id
            )
            
            # Prevent last admin from being demoted
            if current_role == "admin" and admin_count <= 1:
                raise HTTPException(
                    status_code=409, 
                    detail="Cannot remove the last admin user. Promote another user to admin first."
                )
            
            # Prevent admin from demoting themselves if they're the last admin
            if user_id == user.id and current_role == "admin" and admin_count <= 1:
                raise HTTPException(
                    status_code=409,
                    detail="Cannot demote yourself as the last admin. Promote another user to admin first."
                )
        
        await set_user_role(user_id, body.role)
        return {"ok": True}
    except HTTPException:
        raise  # Re-raise our explicit 409 errors
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to set role for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update role")
    finally:
        await conn.close()

@router.post("/role-requests", response_model=RoleRequestItem)
async def create_role_request(
    body: RoleRequestCreate,
    user: User = Depends(get_current_user)
):
    """Create a role request (any authenticated user can call this)"""
    conn = await get_database_connection()
    try:
        # Check if user already has a pending request
        existing = await conn.fetchval(
            "SELECT id FROM app.role_requests WHERE user_id = $1 AND status = 'pending'",
            user.id
        )
        if existing:
            raise HTTPException(
                status_code=409, 
                detail="You already have a pending role request"
            )
        
        # Get user email for response
        user_email = await conn.fetchval(
            "SELECT email FROM auth.users WHERE id = $1", 
            user.id
        )
        
        # Create new request
        async with conn.transaction():
            request_id = await conn.fetchval(
                """
                INSERT INTO app.role_requests (user_id, reason, status, created_at)
                VALUES ($1, $2, 'pending', now())
                RETURNING id
                """,
                user.id, body.reason
            )
        
        return RoleRequestItem(
            id=str(request_id),
            user_id=user.id,
            email=user_email,
            reason=body.reason,
            status="pending",
            created_at=datetime.utcnow(),
            decided_at=None
        )
    finally:
        await conn.close()

@router.get("/role-requests", response_model=List[RoleRequestItem])
async def list_role_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    user: User = Depends(get_current_user)
):
    """List role requests (admin only)"""
    require_admin(user)
    
    conn = await get_database_connection()
    try:
        if status:
            query = """
                SELECT rr.id, rr.user_id, u.email, rr.reason, rr.status, 
                       rr.created_at, rr.decided_at
                FROM app.role_requests rr
                LEFT JOIN auth.users u ON u.id = rr.user_id
                WHERE rr.status = $1
                ORDER BY rr.created_at DESC
            """
            rows = await conn.fetch(query, status)
        else:
            query = """
                SELECT rr.id, rr.user_id, u.email, rr.reason, rr.status, 
                       rr.created_at, rr.decided_at
                FROM app.role_requests rr
                LEFT JOIN auth.users u ON u.id = rr.user_id
                ORDER BY rr.created_at DESC
            """
            rows = await conn.fetch(query)
        
        return [
            RoleRequestItem(
                id=str(row["id"]),
                user_id=str(row["user_id"]),
                email=row["email"],
                reason=row["reason"],
                status=row["status"],
                created_at=row["created_at"],
                decided_at=row["decided_at"]
            )
            for row in rows
        ]
    finally:
        await conn.close()

@router.post("/role-requests/{request_id}/decide")
async def decide_role_request(
    request_id: str,
    body: DecideRoleRequest,
    user: User = Depends(get_current_user)
):
    """Approve or deny a role request (admin only)"""
    require_admin(user)
    
    conn = await get_database_connection()
    try:
        # Get the request details
        request_row = await conn.fetchrow(
            "SELECT user_id, status FROM app.role_requests WHERE id = $1",
            request_id
        )
        if not request_row:
            raise HTTPException(status_code=404, detail="Role request not found")
        
        if request_row["status"] != "pending":
            raise HTTPException(
                status_code=409, 
                detail="Role request has already been decided"
            )
        
        new_status = "approved" if body.decision == "approve" else "denied"
        
        async with conn.transaction():
            # Update the request
            await conn.execute(
                """
                UPDATE app.role_requests 
                SET status = $1, decided_at = now()
                WHERE id = $2
                """,
                new_status, request_id
            )
            
            # If approved, set the user role to 'rep'
            if body.decision == "approve":
                await set_user_role(str(request_row["user_id"]), "rep")
        
        return {"ok": True}
    finally:
        await conn.close()

@router.get("/diagnostics/db", response_model=DiagnosticInfo)
async def db_diagnostics(user: User = Depends(get_current_user)):
    """Database diagnostics (admin only)"""
    require_admin(user)
    
    conn = await get_database_connection()
    try:
        # Get database version
        db_version = await conn.fetchval("SELECT version()")
        
        # Get installed extensions
        extensions = await conn.fetch("SELECT extname FROM pg_extension ORDER BY extname")
        extension_names = [ext["extname"] for ext in extensions]
        
        # Get visible schemas
        schemas = await conn.fetch(
            "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name"
        )
        schema_names = [s["schema_name"] for s in schemas]
        
        # Get table counts for key tables
        table_counts = {}
        tables_to_check = [
            "auth.users",
            "app.user_roles", 
            "app.role_requests",
            "app.tickets",
            "app.messages",
            "app.documents",
            "app.chunks"
        ]
        
        for table in tables_to_check:
            try:
                count = await conn.fetchval(f"SELECT count(*) FROM {table}")
                table_counts[table] = count
            except Exception:
                table_counts[table] = "N/A"
        
        return DiagnosticInfo(
            timestamp=datetime.utcnow(),
            database_version=db_version,
            extensions=extension_names,
            schemas=schema_names,
            table_counts=table_counts
        )
    finally:
        await conn.close()

# Analytics Endpoints
@router.get("/analytics/summary")
async def get_analytics_summary(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(get_current_user)
):
    """Get summary analytics for admin dashboard"""
    org_id = require_org_context(request)
    require_admin(user)

    conn = await get_database_connection()
    try:
        total_tickets = await conn.fetchval(
            "SELECT count(*) FROM app.tickets WHERE organization_id = $1"
            " AND created_at >= NOW() - ($2 || ' days')::interval",
            org_id, str(days)
        )

        resolved_count = await conn.fetchval(
            "SELECT count(*) FROM app.tickets WHERE organization_id = $1"
            " AND status IN ('resolved','closed')"
            " AND created_at >= NOW() - ($2 || ' days')::interval",
            org_id, str(days)
        )
        resolution_rate = (resolved_count / total_tickets * 100) if total_tickets > 0 else 0

        avg_response_hours = await conn.fetchval("""
            SELECT AVG(
                EXTRACT(EPOCH FROM (
                    (SELECT MIN(created_at) FROM app.messages
                     WHERE ticket_id = t.id AND sender_role IN ('rep','admin')
                       AND organization_id = $1)
                    - t.created_at
                )) / 3600
            )
            FROM app.tickets t
            WHERE t.organization_id = $1
              AND t.created_at >= NOW() - ($2 || ' days')::interval
              AND EXISTS (
                SELECT 1 FROM app.messages m
                WHERE m.ticket_id = t.id AND m.sender_role IN ('rep','admin')
                  AND m.organization_id = $1
              )
        """, org_id, str(days)) or 0

        avg_rating = await conn.fetchval(
            "SELECT AVG(customer_rating) FROM app.tickets"
            " WHERE organization_id = $1 AND customer_rating IS NOT NULL"
            " AND created_at >= NOW() - ($2 || ' days')::interval",
            org_id, str(days)
        )

        return {
            "total_tickets": int(total_tickets),
            "resolution_rate": round(resolution_rate, 1),
            "avg_response_hours": round(float(avg_response_hours), 1),
            "avg_customer_rating": round(float(avg_rating), 2) if avg_rating else None,
        }
    finally:
        await conn.close()


@router.get("/activity")
async def get_activity_feed(
    request: Request,
    limit: int = Query(default=25, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """Get recent activity feed for the organization"""
    org_id = require_org_context(request)
    require_admin(user)

    conn = await get_database_connection()
    try:
        ticket_rows = await conn.fetch("""
            SELECT t.id::text AS ref_id, 'ticket_created' AS event_type,
                   u.email AS actor, t.title AS detail, t.created_at AS occurred_at
            FROM app.tickets t
            JOIN auth.users u ON u.id = t.created_by
            WHERE t.organization_id = $1
            ORDER BY t.created_at DESC LIMIT $2
        """, org_id, limit)

        message_rows = await conn.fetch("""
            SELECT m.ticket_id::text AS ref_id, 'message_sent' AS event_type,
                   u.email AS actor, t.title AS detail, m.created_at AS occurred_at
            FROM app.messages m
            JOIN auth.users u ON u.id = m.sender_id
            JOIN app.tickets t ON t.id = m.ticket_id
            WHERE m.organization_id = $1 AND m.sender_role IN ('rep','admin')
            ORDER BY m.created_at DESC LIMIT $2
        """, org_id, limit)

        resolved_rows = await conn.fetch("""
            SELECT t.id::text AS ref_id, 'ticket_resolved' AS event_type,
                   COALESCE(u.email, 'system') AS actor,
                   t.title AS detail, t.updated_at AS occurred_at
            FROM app.tickets t
            LEFT JOIN auth.users u ON u.id = t.assignee_id
            WHERE t.organization_id = $1 AND t.status IN ('resolved','closed')
            ORDER BY t.updated_at DESC LIMIT $2
        """, org_id, limit)

        all_events = [dict(r) for r in ticket_rows] + \
                     [dict(r) for r in message_rows] + \
                     [dict(r) for r in resolved_rows]
        all_events.sort(key=lambda x: x["occurred_at"], reverse=True)

        return [
            {
                "id": f"{e['event_type']}_{e['ref_id']}_{e['occurred_at'].isoformat()}",
                "type": e["event_type"],
                "ticket_id": e["ref_id"],
                "user": e["actor"],
                "detail": (e["detail"] or "")[:80],
                "ts": e["occurred_at"].isoformat(),
            }
            for e in all_events[:limit]
        ]
    finally:
        await conn.close()

@router.get("/analytics/by-category")
async def get_analytics_by_category(request: Request, user: User = Depends(get_current_user)):
    """Get ticket analytics by category/status"""
    org_id = require_org_context(request)
    require_admin(user)
    
    conn = await get_database_connection()
    try:
        # Get ticket counts by status
        status_query = """
            SELECT status, count(*) as count
            FROM app.tickets
            WHERE organization_id = $1
            GROUP BY status
            ORDER BY count DESC
        """
        status_counts = await conn.fetch(status_query, org_id)
        
        # Get ticket counts by priority
        priority_query = """
            SELECT priority, count(*) as count
            FROM app.tickets
            WHERE organization_id = $1
            GROUP BY priority
            ORDER BY 
                CASE priority 
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5
                END
        """
        priority_counts = await conn.fetch(priority_query, org_id)
        
        return {
            "status_counts": [{"status": row["status"], "count": row["count"]} for row in status_counts],
            "priority_counts": [{"priority": row["priority"], "count": row["count"]} for row in priority_counts]
        }
    finally:
        await conn.close()

@router.get("/analytics/rep-performance")
async def get_rep_performance(request: Request, user: User = Depends(get_current_user)):
    """Get support representative performance metrics"""
    org_id = require_org_context(request)
    require_admin(user)
    
    conn = await get_database_connection()
    try:
        # Get rep performance based on ticket assignment and resolution
        perf_query = """
            SELECT 
                u.email,
                COUNT(t.id) as tickets_handled,
                COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as tickets_resolved,
                COALESCE(
                    AVG(
                        EXTRACT(EPOCH FROM (
                            (SELECT MIN(created_at) FROM app.messages 
                             WHERE ticket_id = t.id AND sender_id = u.user_id AND organization_id = $1)
                            - t.created_at
                        )) / 3600
                    ), 0
                ) as avg_response_hours
            FROM auth.users u
            JOIN app.user_roles ur ON u.id = ur.user_id
            LEFT JOIN app.tickets t ON t.assignee_id = u.id AND t.organization_id = $1
            WHERE ur.role IN ('rep', 'admin')
            GROUP BY u.id, u.email
            HAVING COUNT(t.id) > 0
            ORDER BY tickets_handled DESC
            LIMIT 10
        """
        rep_stats = await conn.fetch(perf_query, org_id)
        
        performance_data = []
        for row in rep_stats:
            resolution_rate = (
                (row["tickets_resolved"] / row["tickets_handled"] * 100) 
                if row["tickets_handled"] > 0 else 0
            )
            performance_data.append({
                "name": row["email"].split("@")[0].title(),  # Use email username as name
                "tickets_handled": row["tickets_handled"],
                "tickets_resolved": row["tickets_resolved"],
                "resolution_rate": round(resolution_rate, 1),
                "avg_response_hours": round(row["avg_response_hours"], 1)
            })
            
        return {"representatives": performance_data}
    finally:
        await conn.close()

@router.get("/analytics/rag")
def get_rag_system_analytics(
    hours: int = Query(default=24, ge=1, le=168),  # 1 hour to 1 week
    user: User = Depends(get_current_user)
):
    """Get comprehensive RAG system analytics for admin monitoring."""
    require_admin(user)
    
    try:
        analytics = get_rag_analytics(hours)
        
        # Add summary interpretation
        analytics["summary"] = {
            "health_status": "good" if analytics.get("avg_confidence", 0) > 0.6 else "attention_needed",
            "performance_status": "good" if analytics.get("avg_latency_ms", 0) < 2000 else "slow",
            "escalation_status": "normal" if analytics.get("escalation_rate", 0) < 0.3 else "high",
            "recommendations": []
        }
        
        # Add recommendations based on metrics
        if analytics.get("avg_confidence", 0) < 0.5:
            analytics["summary"]["recommendations"].append("Consider improving knowledge base content quality")
        
        if analytics.get("escalation_rate", 0) > 0.4:
            analytics["summary"]["recommendations"].append("High escalation rate - review confidence thresholds")
        
        if analytics.get("avg_latency_ms", 0) > 3000:
            analytics["summary"]["recommendations"].append("Performance optimization needed - check model selection")
        
        return analytics
        
    except Exception as e:
        logger.error(f"Failed to get RAG analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Analytics retrieval failed: {str(e)}")

# ── Auto-assignment ───────────────────────────────────────────────────────────

async def _get_db():
    from .db import get_connection
    return await get_connection()


@router.post("/auto-assign", response_model=AutoAssignResponse)
async def auto_assign_tickets(request: Request, user: User = Depends(get_current_user)):
    """
    Assign every unassigned open/in-progress ticket in the org using CASPER routing.
    Each ticket is profiled for intent, complexity, and urgency; complex/urgent tickets
    are routed to senior reps (admin/owner), others to the lowest-load rep.
    """
    require_admin(user)
    org_id = require_org_context(request)

    conn = await _get_db()
    try:
        import uuid as uuid_lib
        org_uuid = uuid_lib.UUID(org_id)

        # 1) Get all reps/admins in org with their role (needed for CASPER senior routing)
        rep_rows = await conn.fetch("""
            SELECT om.user_id::text, au.email, ur.role,
                   COUNT(t.id) FILTER (
                       WHERE t.assignee_id = om.user_id
                         AND t.status IN ('open','in_progress','escalated')
                   ) AS load
            FROM app.organization_members om
            JOIN auth.users au ON au.id = om.user_id
            JOIN app.user_roles ur ON ur.user_id = om.user_id
            LEFT JOIN app.tickets t ON t.organization_id = $1
            WHERE om.organization_id = $1
              AND ur.role IN ('rep', 'admin', 'owner')
            GROUP BY om.user_id, au.email, ur.role
            ORDER BY load ASC, au.email ASC
        """, org_uuid)

        if not rep_rows:
            raise HTTPException(400, "No reps/admins found in this organisation")

        # 2) Get all unassigned open tickets (include description for CASPER profiling)
        unassigned = await conn.fetch("""
            SELECT id::text, title, description FROM app.tickets
            WHERE organization_id = $1
              AND status IN ('open','in_progress','escalated')
              AND assignee_id IS NULL
            ORDER BY
              CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
                            WHEN 'normal' THEN 3 ELSE 4 END ASC,
              created_at ASC
        """, org_uuid)

        if not unassigned:
            return AutoAssignResponse(assigned=0, skipped=0, details=[])

        # 3) CASPER routing — profile each ticket and route to the best rep
        # Build a mutable rep list (dicts) so casper_route can sort it
        reps_list = [
            {"user_id": r["user_id"], "email": r["email"],
             "role": r.get("role", "rep"), "load": r["load"]}
            for r in rep_rows
        ]
        details = []

        async with conn.transaction():
            for ticket in unassigned:
                casper_profile = profile_ticket(
                    ticket["title"], ticket.get("description") or ""
                )
                best = casper_route(casper_profile, reps_list)
                if not best:
                    continue

                await conn.execute("""
                    UPDATE app.tickets
                    SET assignee_id = $1, priority_level = COALESCE(priority_level, $3),
                        updated_at = NOW()
                    WHERE id = $2
                """, best["user_id"], ticket["id"],
                    casper_profile.suggested_priority_level)

                routing_note = (
                    f"[system] CASPER assigned to {best['email']} "
                    f"({casper_profile.routing_reason})"
                )
                await conn.execute("""
                    INSERT INTO app.messages
                      (ticket_id, sender_id, sender_role, organization_id, body, created_at)
                    VALUES ($1, $2, 'system', $3, $4, NOW())
                """, ticket["id"], user.id, org_id, routing_note)

                await conn.execute(
                    "UPDATE app.tickets SET message_count = message_count + 1 WHERE id = $1",
                    ticket["id"]
                )

                # Increment load in reps_list so subsequent tickets see the updated workload
                best["load"] += 1
                details.append({
                    "ticket_id": ticket["id"],
                    "ticket_title": ticket["title"],
                    "assigned_to": best["email"],
                })

        result = AutoAssignResponse(assigned=len(details), skipped=0, details=details)
        logger.info("auto_assign returning: assigned=%d", result.assigned)
        return result

    except Exception as exc:
        logger.error("auto_assign internal error: %s", exc, exc_info=True)
        raise
    finally:
        await conn.close()
