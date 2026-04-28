"""Shared asyncpg connection pool for all async DB operations."""
import asyncpg
import os
import logging

logger = logging.getLogger(__name__)
_pool: asyncpg.Pool | None = None


def _ssl_mode(database_url: str) -> str:
    return 'disable' if 'pooler.supabase.com' in database_url else 'require'


async def init_pool() -> None:
    global _pool
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.warning("[db] DATABASE_URL not set — asyncpg pool not started")
        return
    ssl = _ssl_mode(database_url)
    try:
        _pool = await asyncpg.create_pool(
            database_url,
            min_size=3,                        # pre-create 3 connections at startup
            max_size=10,
            max_inactive_connection_lifetime=600.0,  # keep connections alive 10 min
            command_timeout=30,
            statement_cache_size=0,
            ssl=ssl,
            timeout=30,
            server_settings={'application_name': 'ticketpilot'},
        )
        logger.info("[db] asyncpg pool ready (min=3, max=10, ssl=%s)", ssl)
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
        try:
            # Short acquire timeout: if all pool slots are busy creating new
            # connections that time out, fail fast here and use a direct connect.
            return await _pool.acquire(timeout=5)
        except Exception as exc:
            logger.warning("[db] Pool acquire failed (%s) — falling back to direct connect", type(exc).__name__)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not configured")
    return await asyncpg.connect(
        database_url,
        statement_cache_size=0,
        ssl=_ssl_mode(database_url),
        timeout=30,
        server_settings={'application_name': 'ticketpilot'},
    )
