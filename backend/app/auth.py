from fastapi import Depends, HTTPException, status, Request, APIRouter
from pydantic import BaseModel
import os
import json
import logging
import jwt
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Optional

logger = logging.getLogger(__name__)

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

class User(BaseModel):
    id: str
    email: str | None = None
    role: str | None = "customer"

class UserOrganization(BaseModel):
    """Organization info for user context"""
    id: str
    name: str
    slug: str
    your_role: str
    is_default: bool = False
    settings: dict = {}

class AuthContextResponse(BaseModel):
    """Complete authentication context including organizations"""
    user: User
    organizations: List[UserOrganization]
    default_organization_id: Optional[str] = None

router = APIRouter(prefix="/api/auth", tags=["auth"])

def verify_supabase_jwt(token: str) -> dict:
    """Verify Supabase JWT token signature and return payload."""
    # Strip surrounding quotes that some platforms (Render) include in env var values
    jwt_secret = (os.getenv("SUPABASE_JWT_SECRET") or "").strip().strip('"').strip("'")

    if not jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: SUPABASE_JWT_SECRET not set",
        )

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase 'aud' varies by project
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token: missing subject")

    if "supabase" not in payload.get("iss", ""):
        raise HTTPException(status_code=401, detail="Invalid token: wrong issuer")

    return payload

async def get_current_user(request: Request) -> User:
    """Extract and verify user from JWT token, read role from database"""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    
    token = auth.split(" ", 1)[1]
    payload = verify_supabase_jwt(token)
    
    user_id = payload.get("sub")
    email = payload.get("email")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # Read role from database using roles helper
    from .roles import get_user_role
    user_role = await get_user_role(user_id)
    
    return User(id=user_id, email=email, role=user_role)

async def get_db_connection():
    from .db import get_connection
    return await get_connection()

async def get_user_organizations(user_id: str) -> List[UserOrganization]:
    """
    Fetch all organizations the user is a member of.
    Returns list with role and default organization flag.
    """
    conn = await get_db_connection()
    try:
        import uuid as uuid_lib
        user_uuid = uuid_lib.UUID(user_id)

        rows = await conn.fetch("""
            SELECT
                o.id,
                o.name,
                o.slug,
                o.settings,
                om.role as your_role,
                false as is_default
            FROM app.organizations o
            JOIN app.organization_members om ON o.id = om.organization_id
            WHERE om.user_id = $1
            ORDER BY o.name ASC
        """, user_uuid)

        return [
            UserOrganization(
                id=str(row['id']),
                name=row['name'],
                slug=row['slug'],
                your_role=row['your_role'],
                is_default=(i == 0),
                settings=json.loads(row['settings']) if isinstance(row['settings'], str) else (row['settings'] or {}),
            )
            for i, row in enumerate(rows)
        ]
    except Exception as e:
        logger.error("Error fetching organizations for user %s: %s", user_id, e, exc_info=True)
        raise
    finally:
        await conn.close()

async def auto_create_organization_for_new_user(user_id: str, user_email: str) -> str:
    """
    Automatically create a default organization for new users.
    Called when a user has no organizations.
    
    Returns: organization_id
    """
    import re
    import uuid as uuid_lib

    logger.info("Auto-creating organization for new user: %s", user_email)
    
    # Generate organization name and slug from email
    org_name = f"{user_email}'s Organization"
    
    # Generate slug from email (take username part before @)
    username = user_email.split('@')[0]
    slug = username.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    slug = re.sub(r'-+', '-', slug)
    
    if len(slug) < 3:
        slug = slug + "-org"
    if len(slug) > 50:
        slug = slug[:50].rstrip('-')
    
    # Ensure slug is unique by appending timestamp if needed
    import time
    base_slug = slug
    attempt = 0
    
    conn = await get_db_connection()
    try:
        user_uuid = uuid_lib.UUID(user_id)
        
        # Ensure user exists in user_roles. Self-signing-up users become org owners,
        # so elevate them to 'admin'. If they were already set to something higher
        # (e.g. accepted an invite earlier) DO NOT downgrade them.
        await conn.execute("""
            INSERT INTO app.user_roles (user_id, role)
            VALUES ($1, 'admin')
            ON CONFLICT (user_id) DO UPDATE
              SET role = 'admin'
              WHERE app.user_roles.role = 'customer'
        """, user_uuid)
        
        logger.debug("Ensured user %s exists in user_roles as admin", user_id)
        
        # Check if slug exists, if so add suffix
        while attempt < 10:
            check_slug = f"{base_slug}-{int(time.time())}" if attempt > 0 else slug
            
            existing = await conn.fetchval(
                "SELECT 1 FROM app.organizations WHERE slug = $1",
                check_slug
            )
            
            if not existing:
                slug = check_slug
                break
            
            attempt += 1
        
        # Create organization
        org_id = await conn.fetchval("""
            INSERT INTO app.organizations (name, slug, is_active, settings)
            VALUES ($1, $2, true, '{}')
            RETURNING id
        """, org_name, slug)
        
        if not org_id:
            raise HTTPException(500, "Failed to create default organization")
        
        # Add user as owner
        await conn.execute("""
            INSERT INTO app.organization_members (organization_id, user_id, role)
            VALUES ($1, $2, $3)
        """, org_id, user_uuid, "owner")
        
        logger.info("Created organisation '%s' for user %s", org_name, user_email)

        return str(org_id)

    except Exception as e:
        logger.error("Failed to auto-create organisation: %s", e)
        raise HTTPException(500, f"Failed to create default organization: {str(e)}")
    finally:
        await conn.close()


@router.get("/context", response_model=AuthContextResponse)
async def get_auth_context(user: User = Depends(get_current_user)):
    """
    Get complete authentication context including user's organizations.
    Called by frontend after login to populate organization selector.
    
    If user has no organizations, automatically creates a default one.
    """
    try:
        organizations = await get_user_organizations(user.id)
        
        if not organizations:
            logger.warning("User %s has no organisations — auto-creating default org", user.email)

            try:
                await auto_create_organization_for_new_user(user.id, user.email or "user")

                organizations = await get_user_organizations(user.id)

                if not organizations:
                    raise HTTPException(500, "Failed to create default organization for new user")
                
                logger.info("Created default organisation for %s", user.email)

            except Exception as e:
                logger.error("Failed to auto-create organisation: %s", e)
                # Frontend will show "no organisation" state — don't blow up the request

        default_org_id = next((org.id for org in organizations if org.is_default), None)

        return AuthContextResponse(
            user=user,
            organizations=organizations,
            default_organization_id=default_org_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in get_auth_context: %s", e, exc_info=True)
        raise HTTPException(500, f"Failed to get auth context: {str(e)}")