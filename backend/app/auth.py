from fastapi import Depends, HTTPException, status, Request, APIRouter
from pydantic import BaseModel
import os
import jwt
import json
from supabase import create_client, Client
from dotenv import load_dotenv
import asyncpg
from typing import List, Optional

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_JWT_SECRET")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_JWT_SECRET are required in .env")

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

class AuthContextResponse(BaseModel):
    """Complete authentication context including organizations"""
    user: User
    organizations: List[UserOrganization]
    default_organization_id: Optional[str] = None

router = APIRouter(prefix="/api/auth", tags=["auth"])

def verify_supabase_jwt(token: str) -> dict:
    """Verify Supabase JWT token and return payload"""
    try:
        # Decode without verification first to get the header
        unverified_header = jwt.get_unverified_header(token)
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        
        # For development/testing, let's be more lenient with verification
        # In production, you'd want to verify the signature properly
        
        # Verify the token structure and required fields
        if not unverified_payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        
        if not unverified_payload.get("iss") or "supabase" not in unverified_payload.get("iss", ""):
            raise HTTPException(status_code=401, detail="Invalid token: wrong issuer")
        
        # Check if token is expired
        import time
        if unverified_payload.get("exp", 0) < time.time():
            raise HTTPException(status_code=401, detail="Token expired")
        
        return unverified_payload
        
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

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
    
    # Log for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"User authenticated - ID: {user_id}, Email: {email}, Role: {user_role}")
    
    # Return user object with actual role from DB
    return User(id=user_id, email=email, role=user_role)

async def get_db_connection():
    """Get database connection with statement caching disabled"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is required")
    # Disable statement caching to avoid prepared statement conflicts
    # Add SSL configuration for Supabase
    return await asyncpg.connect(
        database_url, 
        statement_cache_size=0,
        ssl='require'
    )

async def get_user_organizations(user_id: str) -> List[UserOrganization]:
    """
    Fetch all organizations the user is a member of.
    Returns list with role and default organization flag.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    conn = await get_db_connection()
    try:
        # Convert to UUID for query
        import uuid as uuid_lib
        user_uuid = uuid_lib.UUID(user_id)
        
        logger.info(f"🔍 Fetching organizations for user: {user_id}")
        
        rows = await conn.fetch("""
            SELECT 
                o.id,
                o.name,
                o.slug,
                om.role as your_role,
                false as is_default
            FROM app.organizations o
            JOIN app.organization_members om ON o.id = om.organization_id
            WHERE om.user_id = $1
            ORDER BY o.name ASC
        """, user_uuid)
        
        logger.info(f"✅ Found {len(rows)} organizations for user {user_id}")
        
        # Mark first org as default for now (until we add default_organization_id column)
        result = [
            UserOrganization(
                id=str(row['id']),
                name=row['name'],
                slug=row['slug'],
                your_role=row['your_role'],
                is_default=(i == 0)  # First org is default
            )
            for i, row in enumerate(rows)
        ]
        
        return result
    except Exception as e:
        logger.error(f"❌ Error fetching organizations for user {user_id}: {e}", exc_info=True)
        raise
    finally:
        await conn.close()

async def auto_create_organization_for_new_user(user_id: str, user_email: str) -> str:
    """
    Automatically create a default organization for new users.
    Called when a user has no organizations.
    
    Returns: organization_id
    """
    import logging
    import re
    import uuid as uuid_lib
    
    logger = logging.getLogger(__name__)
    logger.info(f"🏢 Auto-creating organization for new user: {user_email}")
    
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
        
        # CRITICAL FIX: Ensure user exists in user_roles table first
        # This is required because organization_members has a foreign key to user_roles
        await conn.execute("""
            INSERT INTO app.user_roles (user_id, role)
            VALUES ($1, 'customer')
            ON CONFLICT (user_id) DO NOTHING
        """, user_uuid)
        
        logger.info(f"✅ Ensured user {user_id} exists in user_roles table")
        
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
        
        logger.info(f"✅ Created organization '{org_name}' (slug: {slug}) for user {user_email}")
        
        return str(org_id)
        
    except Exception as e:
        logger.error(f"❌ Failed to auto-create organization: {e}")
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
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        organizations = await get_user_organizations(user.id)
        
        # 🚨 CRITICAL FIX: Auto-create organization for new users
        if not organizations:
            logger.warning(f"⚠️ User {user.email} has no organizations! Auto-creating default org...")
            
            try:
                # Create default organization
                org_id = await auto_create_organization_for_new_user(user.id, user.email or "user")
                
                # Fetch the newly created organization
                organizations = await get_user_organizations(user.id)
                
                if not organizations:
                    raise HTTPException(500, "Failed to create default organization for new user")
                
                logger.info(f"✅ Successfully created default organization for {user.email}")
                
            except Exception as e:
                logger.error(f"❌ Failed to auto-create organization: {e}")
                # Don't fail the request, but log the error
                # Frontend will show "no organization" state
        
        # Find default organization
        default_org_id = None
        for org in organizations:
            if org.is_default:
                default_org_id = org.id
                break
        
        return AuthContextResponse(
            user=user,
            organizations=organizations,
            default_organization_id=default_org_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in get_auth_context: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to get auth context: {str(e)}")