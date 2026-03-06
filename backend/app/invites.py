"""
Organization Invite System
--------------------------
Allows admins/owners to invite reps by email.

Flow:
  1. Admin  → POST /api/organizations/{org_id}/invites  (email + role)
  2. System → Creates DB record, returns invite_url in response.
             If SUPABASE_SERVICE_ROLE_KEY is set it also emails the invitee
             a magic link that lands on /invite/{token}.
  3. Invitee clicks the link, arrives at /invite/{token}.
             If not logged in they are redirected to /login and sent back.
  4. Invitee → POST /api/invites/{token}/accept  (must be authenticated)
  5. System → Adds user to organization_members + user_roles, marks invite accepted.

Local dev  : invite_url is returned in the POST body — admin copies it manually.
Deployed   : invite_url is emailed via Supabase admin magic-link if the service
             role key is present in the environment.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import os
import psycopg
from psycopg.rows import dict_row
import logging

from .auth import User, get_current_user
from .organizations import get_db_connection, get_user_role_in_org, verify_org_permission

logger = logging.getLogger(__name__)

router = APIRouter(tags=["invites"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = Field(default="rep", pattern="^(admin|rep|member)$")


class InviteResponse(BaseModel):
    id: str
    organization_id: str
    organization_name: str
    email: str
    role: str
    token: str
    invite_url: str
    expires_at: str
    email_sent: bool
    """email_sent=True means Supabase was reached; False means local-dev mode."""


class InviteInfo(BaseModel):
    """Public metadata returned to the accept page before the user clicks Accept."""
    organization_id: str
    organization_name: str
    email: str
    role: str
    expires_at: str
    status: str


class AcceptResponse(BaseModel):
    message: str
    organization_id: str
    role: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _send_invite_email(email: str, invite_url: str, org_name: str, role: str) -> bool:
    """
    Send an invite magic-link via Supabase Admin API.

    Returns True on success, False when the service role key is absent
    (local-dev mode) or the call fails (non-fatal).
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.info(
            "SUPABASE_SERVICE_ROLE_KEY not set — skipping email for %s. "
            "Share the invite_url manually in local-dev mode.",
            email,
        )
        return False

    try:
        import httpx

        # Supabase admin "invite user by email" — sends a sign-up/magic-link
        # email and attaches invite metadata.  If the user already exists,
        # Supabase silently re-sends the magic link.
        resp = httpx.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "invite": True,
                "data": {"invite_url": invite_url},
                "redirect_to": invite_url,
            },
            timeout=10,
        )

        if resp.status_code in (200, 201, 422):
            # 422 = user already exists (Supabase still sends them an email)
            logger.info("Invite email sent to %s via Supabase", email)
            return True
        else:
            logger.warning(
                "Supabase invite returned %s: %s", resp.status_code, resp.text
            )
            return False

    except Exception as exc:
        logger.warning("Failed to send invite email to %s: %s", email, exc)
        return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/api/organizations/{org_id}/invites",
    response_model=InviteResponse,
    status_code=201,
)
def create_invite(
    org_id: str,
    invite_data: InviteCreate,
    user: User = Depends(get_current_user),
):
    """
    Create an invite for a new rep/admin and (optionally) email them a link.
    Only owners and admins of the organization may invite.
    """
    verify_org_permission(user.id, org_id, ["owner", "admin"])

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # --- Fetch org name for display ---------------------------------
        cursor.execute(
            "SELECT name FROM app.organizations WHERE id = %s", (org_id,)
        )
        org_row = cursor.fetchone()
        if not org_row:
            raise HTTPException(404, "Organization not found")
        org_name = org_row["name"]

        # --- Prevent duplicate pending invite for same email+org --------
        cursor.execute(
            """
            SELECT id FROM app.invites
            WHERE organization_id = %s
              AND email = %s
              AND status = 'pending'
              AND expires_at > now()
            """,
            (org_id, invite_data.email),
        )
        if cursor.fetchone():
            raise HTTPException(
                409,
                "A pending invite for this email already exists in this organization. "
                "It will expire in 7 days.",
            )

        # --- Create invite record ----------------------------------------
        cursor.execute(
            """
            INSERT INTO app.invites
              (organization_id, email, role, invited_by)
            VALUES (%s, %s, %s, %s)
            RETURNING id, token, expires_at
            """,
            (org_id, invite_data.email, invite_data.role, user.id),
        )
        invite = cursor.fetchone()
        conn.commit()

    token = invite["token"]
    invite_url = f"{WEB_ORIGIN}/invite/{token}"

    # --- Attempt email (non-fatal) --------------------------------------
    email_sent = _send_invite_email(
        invite_data.email, invite_url, org_name, invite_data.role
    )

    return InviteResponse(
        id=str(invite["id"]),
        organization_id=org_id,
        organization_name=org_name,
        email=invite_data.email,
        role=invite_data.role,
        token=token,
        invite_url=invite_url,
        expires_at=invite["expires_at"].isoformat(),
        email_sent=email_sent,
    )


@router.get("/api/invites/{token}", response_model=InviteInfo)
def get_invite_info(token: str):
    """
    Public endpoint — no auth required.
    Returns invite metadata so the accept page can show org name / role.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                i.organization_id,
                o.name AS organization_name,
                i.email,
                i.role,
                i.status,
                i.expires_at
            FROM app.invites i
            JOIN app.organizations o ON o.id = i.organization_id
            WHERE i.token = %s
            """,
            (token,),
        )
        row = cursor.fetchone()

    if not row:
        raise HTTPException(404, "Invite not found or already used")

    if row["status"] == "accepted":
        raise HTTPException(410, "This invite has already been accepted")

    if row["status"] == "expired":
        raise HTTPException(410, "This invite has expired")

    # Check wall-clock expiry even if status is still 'pending'
    from datetime import datetime, timezone
    if row["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(410, "This invite has expired")

    return InviteInfo(
        organization_id=str(row["organization_id"]),
        organization_name=row["organization_name"],
        email=row["email"],
        role=row["role"],
        expires_at=row["expires_at"].isoformat(),
        status=row["status"],
    )


@router.post("/api/invites/{token}/accept", response_model=AcceptResponse)
def accept_invite(token: str, user: User = Depends(get_current_user)):
    """
    Accept an invite.  The authenticated user must be logged in.
    Their account email does not need to match the invite email (to support
    cases where a user signs up with a different alias), but they must
    be authenticated.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Fetch and lock invite row
        cursor.execute(
            """
            SELECT
                i.id,
                i.organization_id,
                i.email,
                i.role,
                i.status,
                i.expires_at,
                o.name AS organization_name
            FROM app.invites i
            JOIN app.organizations o ON o.id = i.organization_id
            WHERE i.token = %s
            FOR UPDATE
            """,
            (token,),
        )
        invite = cursor.fetchone()

        if not invite:
            raise HTTPException(404, "Invite not found")

        if invite["status"] != "pending":
            raise HTTPException(
                410,
                "This invite has already been used or has expired",
            )

        from datetime import datetime, timezone
        if invite["expires_at"] < datetime.now(timezone.utc):
            cursor.execute(
                "UPDATE app.invites SET status = 'expired' WHERE id = %s",
                (invite["id"],),
            )
            conn.commit()
            raise HTTPException(410, "This invite has expired")

        org_id = str(invite["organization_id"])
        role = invite["role"]

        # --- Guard: already a member? ------------------------------------
        cursor.execute(
            """
            SELECT 1 FROM app.organization_members
            WHERE organization_id = %s AND user_id = %s
            """,
            (org_id, user.id),
        )
        if cursor.fetchone():
            # Mark invite consumed and return success so the UI still works
            cursor.execute(
                "UPDATE app.invites SET status = 'accepted' WHERE id = %s",
                (invite["id"],),
            )
            conn.commit()
            return AcceptResponse(
                message="You are already a member of this organization",
                organization_id=org_id,
                role=role,
            )

        # --- Add user to organization_members ----------------------------
        cursor.execute(
            """
            INSERT INTO app.organization_members
              (organization_id, user_id, role, invited_by)
            VALUES (
              %s, %s, %s,
              (SELECT invited_by FROM app.invites WHERE id = %s)
            )
            """,
            (org_id, user.id, role, invite["id"]),
        )

        # --- Upsert global user_roles (rep / admin / customer) ----------
        # Map org role → global role: admin→admin, rep→rep, member→customer
        global_role_map = {"admin": "admin", "rep": "rep", "member": "customer"}
        global_role = global_role_map.get(role, "customer")

        cursor.execute(
            """
            INSERT INTO app.user_roles (user_id, role)
            VALUES (%s, %s)
            ON CONFLICT (user_id) DO UPDATE
              SET role = EXCLUDED.role
              WHERE app.user_roles.role = 'customer'
            """,
            (user.id, global_role),
        )

        # --- Mark invite accepted ----------------------------------------
        cursor.execute(
            "UPDATE app.invites SET status = 'accepted' WHERE id = %s",
            (invite["id"],),
        )

        conn.commit()

    logger.info(
        "User %s accepted invite to org %s as %s", user.id, org_id, role
    )

    return AcceptResponse(
        message=f"Welcome to {invite['organization_name']}! You have joined as {role}.",
        organization_id=org_id,
        role=role,
    )


@router.get("/api/organizations/{org_id}/invites")
def list_invites(org_id: str, user: User = Depends(get_current_user)):
    """
    List pending invites for the organization (owners/admins only).
    Useful for the admin to see who has been invited and resend if needed.
    """
    verify_org_permission(user.id, org_id, ["owner", "admin"])

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                i.id,
                i.email,
                i.role,
                i.status,
                i.expires_at,
                i.created_at,
                u.email AS invited_by_email
            FROM app.invites i
            LEFT JOIN auth.users u ON u.id = i.invited_by
            WHERE i.organization_id = %s
            ORDER BY i.created_at DESC
            LIMIT 100
            """,
            (org_id,),
        )
        rows = cursor.fetchall()

    return [
        {
            "id": str(r["id"]),
            "email": r["email"],
            "role": r["role"],
            "status": r["status"],
            "expires_at": r["expires_at"].isoformat(),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "invited_by_email": r.get("invited_by_email"),
        }
        for r in rows
    ]
