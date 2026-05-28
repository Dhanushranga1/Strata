"""
Public customer portal — unauthenticated ticket submission + status lookup.

Endpoints (no auth required):
  GET  /api/portal/{slug}                     → org branding info
  POST /api/portal/{slug}/tickets             → submit a ticket
  GET  /api/portal/{slug}/tickets/{ticket_id} → check ticket status (needs submitter_email)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime, timezone
import time
import threading

from .db_sync import get_db_connection

router = APIRouter(prefix="/api/portal", tags=["portal"])

# ─── Simple in-memory rate limiter (per IP, max 5 submissions/hour) ──────────

_rate_lock = threading.Lock()
_rate_store: dict[str, list[float]] = {}   # ip -> [timestamp, ...]
_RATE_WINDOW = 3600      # seconds
_RATE_MAX    = 5         # submissions per window


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    with _rate_lock:
        hits = _rate_store.get(ip, [])
        hits = [t for t in hits if now - t < _RATE_WINDOW]
        if len(hits) >= _RATE_MAX:
            raise HTTPException(
                status_code=429,
                detail="Too many submissions — please wait before trying again."
            )
        hits.append(now)
        _rate_store[ip] = hits


# ─── Schemas ─────────────────────────────────────────────────────────────────

class PortalTicketCreate(BaseModel):
    name:        str
    email:       EmailStr
    subject:     str
    description: str
    category:    Optional[str] = None
    priority:    Optional[int] = None

    @field_validator("subject")
    @classmethod
    def subject_len(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Subject must be at least 5 characters")
        if len(v) > 200:
            raise ValueError("Subject must be under 200 characters")
        return v

    @field_validator("description")
    @classmethod
    def description_len(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Please provide more detail (at least 20 characters)")
        if len(v) > 4000:
            raise ValueError("Description is too long (max 4000 characters)")
        return v

    @field_validator("name")
    @classmethod
    def name_len(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Name is required")
        return v


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_org_by_slug(slug: str) -> dict:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, name, slug, domain, settings, is_active
            FROM app.organizations
            WHERE slug = %s
            """,
            (slug,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Organisation not found")
    if not row["is_active"]:
        raise HTTPException(status_code=403, detail="This support portal is currently inactive")
    return dict(row)


def _get_org_owner_id(org_id: str) -> str:
    """Return the first owner/admin user ID for use as created_by on guest tickets."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT user_id FROM app.organization_members
            WHERE organization_id = %s
            AND role IN ('owner', 'admin')
            ORDER BY created_at ASC
            LIMIT 1
            """,
            (org_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="Organisation has no admin user")
    return str(row["user_id"])


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/{slug}")
def get_portal_info(slug: str):
    """Return public branding info for the org's customer portal."""
    org = _get_org_by_slug(slug)
    settings = org.get("settings") or {}
    return {
        "name": org["name"],
        "slug": org["slug"],
        "domain": org.get("domain") or "",
        "support_email": settings.get("support_email", ""),
        "portal_message": settings.get("portal_message", ""),
    }


@router.post("/{slug}/tickets", status_code=201)
def submit_portal_ticket(slug: str, payload: PortalTicketCreate, request: Request):
    """Submit a support ticket through the public customer portal (no auth required)."""
    client_ip = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.client.host  # type: ignore[union-attr]
        or "unknown"
    )
    _check_rate_limit(client_ip)

    org = _get_org_by_slug(slug)
    org_id = org["id"]
    owner_id = _get_org_owner_id(org_id)

    priority = payload.priority if payload.priority and 1 <= payload.priority <= 7 else 4
    tags = [payload.category] if payload.category else []

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO app.tickets
              (created_by, organization_id, title, description, status, priority,
               message_count, tags, submitter_email, submitter_name, source)
            VALUES (%s, %s, %s, %s, 'open', %s, 0, %s, %s, %s, 'portal')
            RETURNING id, title, status, priority, created_at
            """,
            (
                owner_id,
                org_id,
                payload.subject,
                payload.description,
                priority,
                tags,
                payload.email.lower(),
                payload.name,
            ),
        )
        ticket = dict(cur.fetchone())
        ticket_id = ticket["id"]

        # Initial message attributed to the customer
        cur.execute(
            """
            INSERT INTO app.messages
              (ticket_id, sender_id, sender_role, organization_id, body)
            VALUES (%s, %s, 'customer', %s, %s)
            """,
            (ticket_id, owner_id, org_id, payload.description),
        )

        cur.execute(
            """
            UPDATE app.tickets
            SET message_count = 1, last_message_at = now(), updated_at = now()
            WHERE id = %s
            """,
            (ticket_id,),
        )

    # Short reference for display (last 8 chars of UUID, uppercase)
    ref = str(ticket_id).replace("-", "").upper()[-8:]

    return {
        "ticket_id": str(ticket_id),
        "ref": f"TKT-{ref}",
        "status": "open",
        "message": f"Your request has been received. We'll reply to {payload.email}.",
    }


@router.get("/{slug}/tickets/{ticket_id}")
def get_portal_ticket_status(
    slug: str,
    ticket_id: str,
    email: str,
):
    """
    Look up a ticket by ID + submitter email.
    Returns only public information (no internal notes).
    """
    org = _get_org_by_slug(slug)
    org_id = org["id"]

    email_lower = email.strip().lower()

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Match by submitter_email or by the email of the account that created the ticket
        cur.execute(
            """
            SELECT
              t.id,
              t.title,
              t.status,
              t.priority,
              t.created_at,
              t.updated_at,
              t.last_message_at,
              t.submitter_name,
              t.submitter_email,
              u.email AS creator_email
            FROM app.tickets t
            LEFT JOIN auth.users u ON u.id = t.created_by
            WHERE t.id = %s
              AND t.organization_id = %s
              AND (
                lower(t.submitter_email) = %s
                OR lower(u.email) = %s
              )
            """,
            (ticket_id, org_id, email_lower, email_lower),
        )
        ticket = cur.fetchone()

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found or email does not match")

        # Fetch only public (non-internal) messages
        cur.execute(
            """
            SELECT
              m.body,
              m.sender_role,
              m.created_at,
              u.email AS sender_email
            FROM app.messages m
            LEFT JOIN auth.users u ON u.id = m.sender_id
            WHERE m.ticket_id = %s
              AND m.is_internal IS NOT TRUE
            ORDER BY m.created_at ASC
            """,
            (ticket_id,),
        )
        messages = [dict(r) for r in cur.fetchall()]

    ref = str(ticket["id"]).replace("-", "").upper()[-8:]

    return {
        "ticket_id":   str(ticket["id"]),
        "ref":         f"TKT-{ref}",
        "title":       ticket["title"],
        "status":      ticket["status"],
        "priority":    ticket["priority"],
        "created_at":  ticket["created_at"].isoformat() if ticket["created_at"] else None,
        "updated_at":  ticket["updated_at"].isoformat() if ticket["updated_at"] else None,
        "messages":    [
            {
                "body":        m["body"],
                "from_team":   m["sender_role"] in ("rep", "admin", "ai"),
                "created_at":  m["created_at"].isoformat() if m["created_at"] else None,
            }
            for m in messages
        ],
    }
