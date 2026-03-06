"""
Role management helpers with optional caching for Phase 5A
"""
import asyncpg
import os
from typing import Optional
from datetime import datetime, timedelta
import logging

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

    # Query database
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.warning("DATABASE_URL not set, defaulting to customer role")
        return "customer"

    try:
        # Disable statement caching to avoid prepared statement conflicts with pgbouncer
        conn = await asyncpg.connect(
            database_url,
            statement_cache_size=0,
            ssl='require',
            server_settings={
                'application_name': 'ticketpilot_backend'
            }
        )
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
        logger.warning(f"Defaulting to customer role for {user_id} due to DB error")
        _role_cache[user_id] = "customer"
        _cache_ttl[user_id] = datetime.utcnow() + timedelta(seconds=CACHE_DURATION)
        return "customer"

async def set_user_role(user_id: str, role: str):
    """
    Set user role in database. Normalizes role to lowercase and validates.
    """
    # Normalize and validate role
    role = role.lower().strip()
    if role not in ["customer", "rep", "admin"]:
        raise ValueError(f"Invalid role: {role}")
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not configured")
    
    try:
        # Disable statement caching to avoid prepared statement conflicts with pgbouncer
        conn = await asyncpg.connect(
            database_url,
            statement_cache_size=0,
            ssl='require',
            server_settings={
                'application_name': 'ticketpilot_backend'
            }
        )
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
    """Get a database connection for admin operations"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not configured")
    
    # Use connection pooler with session pooling mode
    # CRITICAL FIX: Disable statement caching to avoid prepared statement conflicts with pgbouncer
    if ':6543/' in database_url:
        # Connection pooler mode - disable SSL for pooler
        return await asyncpg.connect(
            database_url,
            statement_cache_size=0,
            ssl='disable',
            server_settings={
                'application_name': 'ticketpilot_backend'
            }
        )
    else:
        # Direct connection mode - require SSL
        return await asyncpg.connect(
            database_url,
            statement_cache_size=0,
            ssl='require',
            server_settings={
                'application_name': 'ticketpilot_backend'
            }
        )

def normalize_role(role: str) -> str:
    """Normalize role string to lowercase and validate"""
    role = role.lower().strip()
    if role not in ["customer", "rep", "admin"]:
        raise ValueError(f"Invalid role: {role}")
    return role