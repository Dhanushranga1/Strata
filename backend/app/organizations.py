"""
Organizations API Router - Phase 2, Task 2.2
Provides REST API for organization management in multi-tenant architecture.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .db_sync import get_db_connection  # noqa: F401 — re-exported for invites.py
import logging
import json
import re

from .auth import User, get_current_user

logger = logging.getLogger(__name__)


# Simple validation functions (inline to avoid dependency on bleach)
SLUG_REGEX = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')

def validate_slug(value: str) -> str:
    """Validate organization slug format."""
    if not value:
        raise HTTPException(400, "Slug is required")
    
    value = value.strip().lower()
    
    if len(value) < 3 or len(value) > 50:
        raise HTTPException(400, "Slug must be 3-50 characters")
    
    if not SLUG_REGEX.match(value):
        raise HTTPException(400, "Slug can only contain lowercase letters, numbers, and hyphens")
    
    reserved = {"api", "admin", "auth", "login", "signup", "docs", "health"}
    if value in reserved:
        raise HTTPException(400, f"'{value}' is a reserved slug")
    
    return value


def generate_slug_from_name(name: str) -> str:
    """Generate URL-safe slug from name."""
    slug = name.strip().lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    slug = re.sub(r'-+', '-', slug)
    
    if len(slug) < 3:
        slug = slug + "-org"
    
    if len(slug) > 50:
        slug = slug[:50].rstrip('-')
    
    return slug

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: Optional[str] = None
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    domain: Optional[str]
    settings: Dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    member_count: Optional[int] = None
    your_role: Optional[str] = None
    plan_id: str = "community"


class OrganizationMemberAdd(BaseModel):
    user_id: str
    role: str = Field(pattern="^(owner|admin|rep|member)$")


class OrganizationMemberUpdate(BaseModel):
    role: str = Field(pattern="^(owner|admin|rep|member)$")


class OrganizationMemberResponse(BaseModel):
    organization_id: str
    user_id: str
    role: str
    joined_at: datetime
    invited_by: Optional[str]
    user_email: Optional[str]
    last_sign_in_at: Optional[datetime] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def get_user_role_in_org(user_id: str, org_id: str) -> Optional[str]:
    """Get user's role in an organization."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role FROM app.organization_members WHERE organization_id = %s AND user_id = %s",
            (org_id, user_id),
        )
        result = cursor.fetchone()
        return result["role"] if result else None


def verify_org_permission(user_id: str, org_id: str, required_roles: List[str]):
    """Verify user has required role in organization."""
    role = get_user_role_in_org(user_id, org_id)

    if role is None:
        raise HTTPException(
            status_code=404, detail="Organization not found or you are not a member"
        )

    if role not in required_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Required: {', '.join(required_roles)}",
        )


def check_slug_available(slug: str, exclude_org_id: Optional[str] = None) -> bool:
    """Check if slug is available."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check reserved slugs
        cursor.execute("SELECT 1 FROM app.reserved_slugs WHERE slug = %s", (slug,))
        if cursor.fetchone():
            return False

        # Check existing organizations
        if exclude_org_id:
            cursor.execute(
                "SELECT 1 FROM app.organizations WHERE slug = %s AND id != %s",
                (slug, exclude_org_id),
            )
        else:
            cursor.execute(
                "SELECT 1 FROM app.organizations WHERE slug = %s", (slug,)
            )

        return cursor.fetchone() is None


# ============================================================================
# API ENDPOINTS
# ============================================================================


@router.post("", response_model=OrganizationResponse, status_code=201)
def create_organization(
    org_data: OrganizationCreate, user: User = Depends(get_current_user)
):
    """Create a new organization."""
    # Generate slug if not provided
    slug = org_data.slug or generate_slug_from_name(org_data.name)
    slug = validate_slug(slug)

    # Check slug availability
    if not check_slug_available(slug):
        raise HTTPException(409, f"Slug '{slug}' is already taken or reserved")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Create organization
        cursor.execute(
            """
            INSERT INTO app.organizations (name, slug, domain, settings, is_active)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, slug, domain, settings, is_active, created_at, updated_at
            """,
            (
                org_data.name,
                slug,
                org_data.domain,
                json.dumps(org_data.settings),
                True,
            ),
        )
        org = cursor.fetchone()

        if not org:
            raise HTTPException(500, "Failed to create organization")

        # Add creator as owner
        cursor.execute(
            """
            INSERT INTO app.organization_members (organization_id, user_id, role)
            VALUES (%s, %s, %s)
            """,
            (org["id"], user.id, "owner"),
        )

        conn.commit()

        return OrganizationResponse(
            id=str(org["id"]),
            name=org["name"],
            slug=org["slug"],
            domain=org.get("domain"),
            settings=org.get("settings", {}) if isinstance(org.get("settings"), dict) else {},
            is_active=org["is_active"],
            created_at=org["created_at"],
            updated_at=org["updated_at"],
            member_count=1,
            your_role="owner",
            plan_id="community",
        )


@router.get("", response_model=List[OrganizationResponse])
def list_user_organizations(user: User = Depends(get_current_user)):
    """List all organizations the current user is a member of."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                o.id, o.name, o.slug, o.domain, o.settings, o.is_active,
                o.created_at, o.updated_at, o.plan_id,
                om.role as your_role,
                (SELECT COUNT(*) FROM app.organization_members WHERE organization_id = o.id) as member_count
            FROM app.organizations o
            JOIN app.organization_members om ON om.organization_id = o.id
            WHERE om.user_id = %s
            ORDER BY om.joined_at DESC
            """,
            (user.id,),
        )

        orgs = cursor.fetchall()

        return [
            OrganizationResponse(
                id=str(org["id"]),
                name=org["name"],
                slug=org["slug"],
                domain=org.get("domain"),
                settings=org.get("settings", {}) if isinstance(org.get("settings"), dict) else {},
                is_active=org["is_active"],
                created_at=org["created_at"],
                updated_at=org["updated_at"],
                member_count=org["member_count"],
                your_role=org["your_role"],
                plan_id=org.get("plan_id", "community") or "community",
            )
            for org in orgs
        ]


@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(org_id: str, user: User = Depends(get_current_user)):
    """Get detailed information about a specific organization."""
    # Verify user is a member and get role
    role = get_user_role_in_org(user.id, org_id)

    if role is None:
        raise HTTPException(404, "Organization not found or you are not a member")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 
                o.*,
                (SELECT COUNT(*) FROM app.organization_members WHERE organization_id = o.id) as member_count
            FROM app.organizations o
            WHERE o.id = %s
            """,
            (org_id,),
        )

        org = cursor.fetchone()

        if not org:
            raise HTTPException(404, "Organization not found")

        return OrganizationResponse(
            id=str(org["id"]),
            name=org["name"],
            slug=org["slug"],
            domain=org.get("domain"),
            settings=org.get("settings", {}) if isinstance(org.get("settings"), dict) else {},
            is_active=org["is_active"],
            created_at=org["created_at"],
            updated_at=org["updated_at"],
            member_count=org["member_count"],
            your_role=role,
            plan_id=org.get("plan_id", "community") or "community",
        )


@router.patch("/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: str,
    org_update: OrganizationUpdate,
    user: User = Depends(get_current_user),
):
    """Update organization details (owners and admins)."""
    verify_org_permission(user.id, org_id, ["owner", "admin"])

    # Build update query dynamically
    updates = []
    params = []

    if org_update.name is not None:
        updates.append("name = %s")
        params.append(org_update.name)
    if org_update.domain is not None:
        updates.append("domain = %s")
        params.append(org_update.domain)
    if org_update.settings is not None:
        # Merge into existing settings rather than overwrite, so partial updates
        # (e.g. { onboarding_completed: true }) don't wipe other keys.
        updates.append("settings = settings || %s::jsonb")
        params.append(json.dumps(org_update.settings))
    if org_update.is_active is not None:
        updates.append("is_active = %s")
        params.append(org_update.is_active)

    if not updates:
        raise HTTPException(400, "No fields provided for update")

    params.append(org_id)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            f"""
            UPDATE app.organizations
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = %s
            RETURNING id, name, slug, domain, settings, is_active, created_at, updated_at, plan_id
            """,
            tuple(params),
        )

        org = cursor.fetchone()

        if not org:
            raise HTTPException(404, "Organization not found")

        conn.commit()

        # Get member count
        cursor.execute(
            "SELECT COUNT(*) as count FROM app.organization_members WHERE organization_id = %s",
            (org_id,),
        )
        count_result = cursor.fetchone()

        caller_role = get_user_role_in_org(user.id, org_id)
        return OrganizationResponse(
            id=str(org["id"]),
            name=org["name"],
            slug=org["slug"],
            domain=org.get("domain"),
            settings=org.get("settings", {}) if isinstance(org.get("settings"), dict) else {},
            is_active=org["is_active"],
            created_at=org["created_at"],
            updated_at=org["updated_at"],
            member_count=count_result["count"] if count_result else 0,
            your_role=caller_role,
            plan_id=org.get("plan_id", "community") or "community",
        )


@router.get("/{org_id}/members", response_model=List[OrganizationMemberResponse])
def list_organization_members(
    org_id: str,
    q: Optional[str] = None,
    user: User = Depends(get_current_user),
):
    """List all members of an organization. Supports ?q= search by email."""
    role = get_user_role_in_org(user.id, org_id)
    if role is None:
        raise HTTPException(404, "Organization not found or you are not a member")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        search_filter = ""
        params: list = [org_id]
        if q:
            search_filter = "AND u.email ILIKE %s"
            params.append(f"%{q.lstrip('@')}%")

        cursor.execute(
            f"""
            SELECT
                om.organization_id,
                om.user_id,
                om.role,
                om.joined_at,
                om.invited_by,
                u.email        AS user_email,
                u.last_sign_in_at
            FROM app.organization_members om
            LEFT JOIN auth.users u ON u.id = om.user_id
            WHERE om.organization_id = %s {search_filter}
            ORDER BY om.joined_at
            """,
            tuple(params),
        )

        members = cursor.fetchall()

        return [
            OrganizationMemberResponse(
                organization_id=str(member["organization_id"]),
                user_id=str(member["user_id"]),
                role=member["role"],
                joined_at=member["joined_at"],
                invited_by=str(member.get("invited_by")) if member.get("invited_by") else None,
                user_email=member.get("user_email"),
                last_sign_in_at=member.get("last_sign_in_at"),
            )
            for member in members
        ]


@router.post(
    "/{org_id}/members", response_model=OrganizationMemberResponse, status_code=201
)
def add_organization_member(
    org_id: str,
    member_data: OrganizationMemberAdd,
    user: User = Depends(get_current_user),
):
    """Add a new member to an organization (owners/admins only)."""
    verify_org_permission(user.id, org_id, ["owner", "admin"])

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check if user exists
        cursor.execute(
            "SELECT 1 FROM app.user_roles WHERE user_id = %s", (member_data.user_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(404, f"User {member_data.user_id} not found")

        # Check if already a member
        cursor.execute(
            "SELECT 1 FROM app.organization_members WHERE organization_id = %s AND user_id = %s",
            (org_id, member_data.user_id),
        )
        if cursor.fetchone():
            raise HTTPException(409, "User is already a member of this organization")

        # Add member
        cursor.execute(
            """
            INSERT INTO app.organization_members (organization_id, user_id, role, invited_by)
            VALUES (%s, %s, %s, %s)
            RETURNING organization_id, user_id, role, joined_at, invited_by
            """,
            (org_id, member_data.user_id, member_data.role, user.id),
        )

        member = cursor.fetchone()
        conn.commit()

        # Get user email
        cursor.execute(
            "SELECT email FROM auth.users WHERE id = %s", (member_data.user_id,)
        )
        email_result = cursor.fetchone()

        return OrganizationMemberResponse(
            organization_id=str(member["organization_id"]),
            user_id=str(member["user_id"]),
            role=member["role"],
            joined_at=member["joined_at"],
            invited_by=str(member.get("invited_by")) if member.get("invited_by") else None,
            user_email=email_result["email"] if email_result else None,
        )


@router.patch(
    "/{org_id}/members/{member_user_id}", response_model=OrganizationMemberResponse
)
def update_member_role(
    org_id: str,
    member_user_id: str,
    role_update: OrganizationMemberUpdate,
    user: User = Depends(get_current_user),
):
    """Update a member's role (owners/admins only)."""
    verify_org_permission(user.id, org_id, ["owner", "admin"])

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check if trying to demote yourself
        if member_user_id == user.id:
            current_role = get_user_role_in_org(user.id, org_id)

            # If demoting from owner, check if last owner
            if current_role == "owner" and role_update.role != "owner":
                cursor.execute(
                    "SELECT COUNT(*) as count FROM app.organization_members WHERE organization_id = %s AND role = 'owner'",
                    (org_id,),
                )
                count_result = cursor.fetchone()

                if count_result["count"] <= 1:
                    raise HTTPException(
                        403,
                        "Cannot demote yourself - organization must have at least one owner",
                    )

        # Update role
        cursor.execute(
            """
            UPDATE app.organization_members
            SET role = %s
            WHERE organization_id = %s AND user_id = %s
            RETURNING organization_id, user_id, role, joined_at, invited_by
            """,
            (role_update.role, org_id, member_user_id),
        )

        member = cursor.fetchone()

        if not member:
            raise HTTPException(404, "Member not found")

        conn.commit()

        # Get user email
        cursor.execute("SELECT email FROM auth.users WHERE id = %s", (member_user_id,))
        email_result = cursor.fetchone()

        return OrganizationMemberResponse(
            organization_id=str(member["organization_id"]),
            user_id=str(member["user_id"]),
            role=member["role"],
            joined_at=member["joined_at"],
            invited_by=str(member.get("invited_by")) if member.get("invited_by") else None,
            user_email=email_result["email"] if email_result else None,
        )


@router.delete("/{org_id}/members/{member_user_id}", status_code=204)
def remove_organization_member(
    org_id: str, member_user_id: str, user: User = Depends(get_current_user)
):
    """Remove a member from an organization (owners/admins only)."""
    verify_org_permission(user.id, org_id, ["owner", "admin"])

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get member's current role
        member_role = get_user_role_in_org(member_user_id, org_id)

        if member_role is None:
            raise HTTPException(404, "Member not found")

        # If removing an owner, check if last owner
        if member_role == "owner":
            cursor.execute(
                "SELECT COUNT(*) as count FROM app.organization_members WHERE organization_id = %s AND role = 'owner'",
                (org_id,),
            )
            count_result = cursor.fetchone()

            if count_result["count"] <= 1:
                raise HTTPException(
                    403,
                    "Cannot remove last owner - organization must have at least one owner",
                )

        # Remove member
        cursor.execute(
            "DELETE FROM app.organization_members WHERE organization_id = %s AND user_id = %s",
            (org_id, member_user_id),
        )

        conn.commit()

        return None  # 204 No Content
