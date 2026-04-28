"""
Role management helpers with optional caching for Phase 5A
"""
import asyncpg
from typing import Optional
from datetime import datetime, timedelta
import logging
from .db import get_connection

logger = logging.getLogger(__name__)

# Simple in-memory cache (TTL 60 seconds)
_role_cache = {}
_cache_ttl = {}
CACHE_DURATION = 60  # seconds

def _is_cache_valid(user_id: str) -> bool:
    """Check if cached role is still valid"""
    if user_id not in _cache_ttl:
        return False
    return datetime.utcnow() < _cache_ttl[user_id]

def invalidate_cache(user_id: str):
    """Invalidate cached role for a user"""
    if user_id in _role_cache:
        del _role_cache[user_id]
    if user_id in _cache_ttl:
        del _cache_ttl[user_id]

async def get_user_role(user_id: str) -> str:
    """
    Get user role from database with optional caching.
    Returns 'customer' as default if no role found.
    """
    # Check cache first
    if _is_cache_valid(user_id) and user_id in _role_cache:
        cached_role = _role_cache[user_id]
        logger.info(f"Returning cached role for {user_id}: {cached_role}")
        return cached_role

    try:
        conn = await get_connection()
        try:
            role = await conn.fetchval(
                "SELECT coalesce(role, 'customer') FROM app.user_roles WHERE user_id = $1",
                user_id
            )
            if role is None:
                role = "customer"

            logger.info(f"Database query result for {user_id}: {role}")

            # Cache the result
            _role_cache[user_id] = role
            _cache_ttl[user_id] = datetime.utcnow() + timedelta(seconds=CACHE_DURATION)

            return role
        finally:
            await conn.close()
    except Exception as e:
        logger.error(f"Failed to get user role for {user_id}: {e}")
        # Serve stale cached value if available — DB blip should not downgrade an admin to customer.
        if user_id in _role_cache:
            stale = _role_cache[user_id]
            # Extend TTL so we don't hammer the DB on every request while it's down.
            _cache_ttl[user_id] = datetime.utcnow() + timedelta(seconds=CACHE_DURATION)
            logger.warning(f"Serving stale cached role '{stale}' for {user_id} due to DB error")
            return stale
        logger.warning(f"No cached role for {user_id} — defaulting to customer due to DB error")
        return "customer"

async def set_user_role(user_id: str, role: str):
    """
    Set user role in database. Normalizes role to lowercase and validates.
    """
    # Normalize and validate role
    role = role.lower().strip()
    if role not in ["customer", "rep", "admin"]:
        raise ValueError(f"Invalid role: {role}")
    
    try:
        conn = await get_connection()
        try:
            # Use transaction for consistency
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO app.user_roles (user_id, role, updated_at)
                    VALUES ($1, $2, now())
                    ON CONFLICT (user_id) 
                    DO UPDATE SET role = EXCLUDED.role, updated_at = now()
                    """,
                    user_id, role
                )
            
            # Invalidate cache
            invalidate_cache(user_id)
            
            logger.info(f"Set role for user {user_id} to {role}")
        finally:
            await conn.close()
    except Exception as e:
        logger.error(f"Failed to set user role for {user_id} to {role}: {e}")
        raise

async def get_database_connection():
    """Get a database connection for admin operations."""
    return await get_connection()

def normalize_role(role: str) -> str:
    """Normalize role string to lowercase and validate"""
    role = role.lower().strip()
    if role not in ["customer", "rep", "admin"]:
        raise ValueError(f"Invalid role: {role}")
    return role