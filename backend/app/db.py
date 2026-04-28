"""Shared asyncpg connection pool for all async DB operations."""
import asyncpg
import asyncio
import os
import logging

logger = logging.getLogger(__name__)
_pool: asyncpg.Pool | None = None

_CONNECT_TIMEOUT = 15   # seconds per individual attempt
_CONNECT_RETRIES = 3    # attempts before giving up


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
            min_size=3,
            max_size=10,
            max_inactive_connection_lifetime=600.0,
            command_timeout=30,
            statement_cache_size=0,
            ssl=ssl,
            timeout=_CONNECT_TIMEOUT,
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
            return await _pool.acquire(timeout=5)
        except Exception as exc:
            logger.warning("[db] Pool acquire failed (%s) — falling back to direct connect", type(exc).__name__)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not configured")

    ssl = _ssl_mode(database_url)
    last_exc: Exception | None = None
    for attempt in range(1, _CONNECT_RETRIES + 1):
        try:
            conn = await asyncpg.connect(
                database_url,
                statement_cache_size=0,
                ssl=ssl,
                timeout=_CONNECT_TIMEOUT,
                server_settings={'application_name': 'ticketpilot'},
            )
            if attempt > 1:
                logger.info("[db] Direct connect succeeded on attempt %d", attempt)
            return conn
        except Exception as exc:
            last_exc = exc
            logger.warning("[db] Direct connect attempt %d/%d failed: %s", attempt, _CONNECT_RETRIES, type(exc).__name__)
            if attempt < _CONNECT_RETRIES:
                await asyncio.sleep(2 ** (attempt - 1))  # 1s, 2s

    raise last_exc  # type: ignore[misc]
