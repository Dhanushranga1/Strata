"""Shared asyncpg connection pool for all async DB operations."""
import asyncpg
import os
import logging

logger = logging.getLogger(__name__)
_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.warning("[db] DATABASE_URL not set — asyncpg pool not started")
        return
    ssl_mode = 'disable' if ':6543/' in database_url else 'require'
    try:
        _pool = await asyncpg.create_pool(
            database_url,
            min_size=2,
            max_size=10,
            max_inactive_connection_lifetime=300.0,
            statement_cache_size=0,
            ssl=ssl_mode,
            server_settings={'application_name': 'ticketpilot'},
        )
        # Pay the first-query overhead at startup, not on the first real request
        async with _pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        logger.info("[db] asyncpg pool ready (min=2, max=10, ssl=%s)", ssl_mode)
    except Exception as exc:
        logger.error("[db] Pool init failed: %s — falling back to per-request connections", exc)
        _pool = None


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("[db] asyncpg pool closed")


async def get_connection() -> asyncpg.Connection:
    """
    Return a connection from the pool (or a direct connection as fallback).

    Callers MUST call `await conn.close()` when done. On a PoolConnectionProxy
    this releases the connection back to the pool rather than terminating it.
    """
    if _pool is not None:
        return await _pool.acquire()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not configured")
    ssl_mode = 'disable' if ':6543/' in database_url else 'require'
    return await asyncpg.connect(
        database_url,
        statement_cache_size=0,
        ssl=ssl_mode,
        server_settings={'application_name': 'ticketpilot'},
    )
