"""
Organization Context Middleware - Phase 2, Task 2.3
Extracts and validates organization context from requests.

Features:
- Extracts organization_id from X-Organization-ID header or query param
- Verifies user is a member of the organization
- Retrieves user's role in the organization
- Stores org_id and user_role_in_org in request.state
- Skips for public routes (health, auth, org creation)
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional, Set
from datetime import datetime, timedelta
import logging

from .exceptions import ForbiddenError, NotFoundError

logger = logging.getLogger(__name__)

# Cache org membership to avoid a DB hit on every request (60 s TTL).
_org_cache: dict[str, tuple[str | None, datetime]] = {}
_ORG_CACHE_TTL = 60  # seconds


class OrganizationContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to extract and validate organization context from requests.
    
    Sets request.state with:
    - org_id: Organization UUID (if provided and valid)
    - user_role_in_org: User's role in that organization
    """
    
    # Routes that don't require organization context
    SKIP_ROUTES: Set[str] = {
        "/api/health",
        "/api/docs",
        "/openapi.json",
        "/api/me",
        # Auth routes
        "/api/auth/login",
        "/api/auth/signup",
        "/api/auth/refresh",
        "/api/auth/context",  # Get user's organizations
        # Organization routes (handle org context internally)
        "/api/organizations",  # List/create orgs
    }
    
    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger(__name__)
    
    async def dispatch(self, request: Request, call_next):
        """
        Process the request and add organization context to request.state.
        """
        # Initialize request.state attributes
        request.state.org_id = None
        request.state.user_role_in_org = None
        
        # Check if route should skip org context
        if self._should_skip_route(request.url.path):
            return await call_next(request)
        
        # Try to extract organization ID
        org_id = self._extract_org_id(request)
        
        # If no org_id provided, continue without org context
        # (Some endpoints may work without org context, e.g., listing user's orgs)
        if not org_id:
            return await call_next(request)
        
        # Extract user_id from JWT token (since middleware runs before get_current_user dependency)
        user_id = self._extract_user_id_from_token(request)
        
        if user_id:
            try:
                # Verify user is member of organization and get role
                role = await self._get_user_role_in_org(user_id, org_id)
                
                if role is None:
                    self.logger.warning(
                        f"User {user_id} attempted to access org {org_id} without membership",
                        extra={
                            "user_id": user_id,
                            "org_id": org_id,
                            "path": request.url.path,
                        }
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You are not a member of this organization"
                    )
                
                # Store in request state
                request.state.org_id = org_id
                request.state.user_role_in_org = role
                
                self.logger.debug(
                    f"Organization context set",
                    extra={
                        "user_id": user_id,
                        "org_id": org_id,
                        "role": role,
                        "path": request.url.path,
                    }
                )
                
            except HTTPException:
                raise
            except Exception as e:
                self.logger.error(
                    f"Failed to validate organization context: {str(e)}",
                    extra={
                        "user_id": user_id,
                        "org_id": org_id,
                        "path": request.url.path,
                        "error": str(e),
                    }
                )
                # Continue without raising - let endpoint handle missing org context
        
        return await call_next(request)
    
    def _should_skip_route(self, path: str) -> bool:
        """
        Check if route should skip organization context validation.
        
        Args:
            path: Request path
            
        Returns:
            True if should skip, False otherwise
        """
        # Exact match
        if path in self.SKIP_ROUTES:
            return True
        
        # Prefix match for certain patterns
        skip_prefixes = [
            "/docs",
            "/redoc",
            "/api/health",
            "/api/auth/",
        ]
        
        for prefix in skip_prefixes:
            if path.startswith(prefix):
                return True
        
        return False
    
    def _extract_user_id_from_token(self, request: Request) -> Optional[str]:
        """
        Extract user_id from JWT token in Authorization header.
        
        Args:
            request: FastAPI request object
            
        Returns:
            User ID or None
        """
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ", 1)[1]
        
        try:
            # Import here to avoid circular dependency
            import jwt
            
            # Decode without verification (just to extract user_id)
            # The actual auth verification happens in get_current_user()
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload.get("sub")  # Supabase uses 'sub' for user_id
        except Exception:
            return None
    
    def _extract_org_id(self, request: Request) -> Optional[str]:
        """
        Extract organization ID from request.
        
        Priority:
        1. X-Organization-ID header
        2. org_id query parameter
        3. organization_id in path (for specific organization endpoints)
        
        Args:
            request: FastAPI request object
            
        Returns:
            Organization ID or None
        """
        # Check header first (primary method)
        org_id = request.headers.get("X-Organization-ID")
        if org_id:
            return org_id
        
        # Check query parameter (fallback)
        org_id = request.query_params.get("org_id")
        if org_id:
            return org_id
        
        # Check if org_id is in path parameters
        # This will be set by FastAPI for routes like /api/organizations/{org_id}
        if hasattr(request, "path_params"):
            org_id = request.path_params.get("org_id")
            if org_id:
                return org_id
        
        return None
    
    async def _get_user_role_in_org(
        self, user_id: str, org_id: str
    ) -> Optional[str]:
        """Return user's role in the org, with a 60 s in-memory cache."""
        import uuid as uuid_lib
        cache_key = f"{user_id}:{org_id}"
        cached = _org_cache.get(cache_key)
        if cached:
            role, expires = cached
            if datetime.utcnow() < expires:
                return role

        try:
            from .db import get_connection
            conn = await get_connection()
            try:
                row = await conn.fetchrow(
                    "SELECT role FROM app.organization_members"
                    " WHERE organization_id = $1 AND user_id = $2",
                    uuid_lib.UUID(org_id), uuid_lib.UUID(user_id),
                )
                role = row["role"] if row else None
            finally:
                await conn.close()
        except Exception as e:
            self.logger.error("Failed to get user role in org: %s", type(e).__name__)
            # Serve stale cached value — a DB blip must not evict the user mid-session.
            if cache_key in _org_cache:
                stale_role, _ = _org_cache[cache_key]
                _org_cache[cache_key] = (stale_role, datetime.utcnow() + timedelta(seconds=_ORG_CACHE_TTL))
                self.logger.warning("Serving stale org role '%s' for %s due to DB error", stale_role, user_id)
                return stale_role
            # No stale cache and DB is unreachable — re-raise so the middleware's
            # outer except-all continues the request without org context (→ 400/503)
            # rather than treating "can't verify" the same as "definitely not a member" (→ 403).
            raise

        _org_cache[cache_key] = (role, datetime.utcnow() + timedelta(seconds=_ORG_CACHE_TTL))
        return role


def add_organization_context(app):
    """
    Add organization context middleware to FastAPI app.
    
    Usage:
        from .org_middleware import add_organization_context
        add_organization_context(app)
    
    Args:
        app: FastAPI application instance
    """
    app.add_middleware(OrganizationContextMiddleware)
    logger.info("Organization context middleware added")


# ============================================================================
# HELPER FUNCTIONS FOR ENDPOINTS
# ============================================================================


def get_org_from_request(request: Request) -> Optional[str]:
    """
    Get organization ID from request state.
    
    Use this in endpoints that require organization context.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Organization ID or None
        
    Example:
        @router.get("/api/tickets")
        async def list_tickets(request: Request):
            org_id = get_org_from_request(request)
            if not org_id:
                raise HTTPException(status_code=400, detail="Organization ID required")
            # ... filter tickets by org_id
    """
    return getattr(request.state, "org_id", None)


def get_user_role_from_request(request: Request) -> Optional[str]:
    """
    Get user's role in the organization from request state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Role string (owner/admin/rep/member) or None
    """
    return getattr(request.state, "user_role_in_org", None)


def require_org_context(request: Request) -> str:
    """
    Require organization context in request.
    
    Raises HTTPException if org_id not present.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Organization ID
        
    Raises:
        HTTPException: If org_id not in request state
        
    Example:
        @router.get("/api/tickets")
        async def list_tickets(request: Request):
            org_id = require_org_context(request)
            # org_id is guaranteed to be present
    """
    org_id = get_org_from_request(request)
    
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization ID required. Provide X-Organization-ID header or org_id query parameter."
        )
    
    return org_id


def require_org_role(request: Request, allowed_roles: Set[str]) -> str:
    """
    Require user to have one of the specified roles in the organization.
    
    Args:
        request: FastAPI request object
        allowed_roles: Set of allowed roles (e.g., {"owner", "admin"})
        
    Returns:
        User's role in the organization
        
    Raises:
        HTTPException: If user doesn't have required role
        
    Example:
        @router.delete("/api/tickets/{ticket_id}")
        async def delete_ticket(ticket_id: str, request: Request):
            role = require_org_role(request, {"owner", "admin"})
            # User is guaranteed to be owner or admin
    """
    org_id = require_org_context(request)
    role = get_user_role_from_request(request)
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )
    
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required roles: {', '.join(allowed_roles)}"
        )
    
    return role


def check_org_permission(role: Optional[str], required_roles: Set[str]) -> bool:
    """
    Check if role has required permissions.
    
    Args:
        role: User's role in organization
        required_roles: Set of allowed roles
        
    Returns:
        True if role is in required_roles, False otherwise
    """
    if not role:
        return False
    
    return role in required_roles
