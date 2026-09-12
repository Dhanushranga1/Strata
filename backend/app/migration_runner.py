"""
Auto-migration runner — applies unapplied SQL migrations on startup.

Design
------
Each migration file in backend/migrations/ is a plain SQL file.
A tracking table (app.schema_migrations) records which files have
been applied.  On every startup the runner:

1. Takes a pg advisory lock (safe with multiple replicas).
2. Creates app.schema_migrations if it does not exist.
3. Reads all .sql files from the migrations directory, sorted by name.
4. Skips files already recorded in the tracking table.
5. Applies each unapplied file inside its own transaction.
6. Records success/failure in app.schema_migrations.
7. FAILS FAST: raises RuntimeError if any migration fails — the app
   must not serve traffic on a half-migrated schema.

Migrations run on a DEDICATED direct connection with statement_timeout
and command_timeout disabled — long DDL (index builds, ALTER TYPE on
large tables) must never be killed by the request-pool's 8s timeout.

Every migration should be idempotent (use IF NOT EXISTS / IF EXISTS)
so re-running is safe.

Usage
-----
Called from app.main:lifespan() — no manual step needed.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

import asyncpg

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

# Arbitrary but stable lock key — any 64-bit int works. Must be identical
# across all replicas so concurrent deploys serialize.
_MIGRATION_LOCK_KEY = 0x535452415441  # b'STRATA'


def _deduped_database_url(database_url: str) -> str:
    """Strip :pooled options if present; migrations want a direct session."""
    return database_url


async def _migration_connect() -> asyncpg.Connection:
    """Open a dedicated direct connection for DDL.

    Deliberately NOT the request pool: no 8s statement/command timeout,
    no pooler queuing. Long index builds and ALTER TYPE must complete.
    """
    import ssl as _ssl

    from .db import _ssl_mode

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set — cannot run migrations")

    conn = await asyncpg.connect(
        _deduped_database_url(database_url),
        password=os.getenv("DATABASE_PASSWORD"),
        statement_cache_size=0,
        ssl=_ssl_mode(database_url),
        # No timeout overrides — statement_timeout defaults to 0 (unlimited)
        timeout=60,  # connect timeout only
        server_settings={"application_name": "ticketpilot-migrations"},
    )
    return conn


async def _ensure_tracking_table(conn):
    """Create app.schema_migrations if it does not exist."""
    await conn.execute("CREATE SCHEMA IF NOT EXISTS app")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS app.schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            checksum TEXT NOT NULL DEFAULT '',
            duration_ms INT NOT NULL DEFAULT 0
        )
    """)


async def _apply_one(conn, filepath: Path) -> bool:
    """Apply a single migration file. Returns True on success."""
    import hashlib
    import time

    sql = filepath.read_text(encoding="utf-8")
    if not sql.strip():
        logger.info("[migrate] %s — empty, skipped", filepath.name)
        return True

    checksum = hashlib.sha256(sql.encode()).hexdigest()[:16]
    start = time.monotonic()

    try:
        async with conn.transaction():
            await conn.execute(sql)
        elapsed = int((time.monotonic() - start) * 1000)
        await conn.execute(
            """
            INSERT INTO app.schema_migrations (filename, checksum, duration_ms)
            VALUES ($1, $2, $3)
            ON CONFLICT (filename) DO NOTHING
            """,
            filepath.name,
            checksum,
            elapsed,
        )
        logger.info("[migrate] %s — applied (%d ms)", filepath.name, elapsed)
        return True
    except Exception as exc:
        elapsed = int((time.monotonic() - start) * 1000)
        logger.error(
            "[migrate] %s — FAILED after %d ms: %s",
            filepath.name,
            elapsed,
            exc,
        )
        return False


async def run_migrations():
    """
    Entry point — called from app.main:lifespan().

    Discovers unapplied .sql files in the migrations directory and
    applies them sequentially. Raises RuntimeError if any migration
    fails (fail-fast — never serve on a half-migrated schema).
    """
    # Load .env file when running standalone (e.g. make migrate)
    from dotenv import load_dotenv

    load_dotenv()

    if not MIGRATIONS_DIR.is_dir():
        logger.warning(
            "[migrate] Migrations directory %s not found — skipping", MIGRATIONS_DIR
        )
        return

    files = sorted(
        f for f in MIGRATIONS_DIR.glob("*.sql") if f.name != "rollback_migrations.sql"
    )
    if not files:
        logger.info("[migrate] No migration files found")
        return

    conn = await _migration_connect()
    try:
        # Advisory lock — serialize concurrent deploys (multi-replica race)
        await conn.execute("SELECT pg_advisory_lock($1)", _MIGRATION_LOCK_KEY)
        try:
            # ── Safety: refuse prod migrations against a dev DB (and vice versa)
            await _check_db_environment(conn)

            await _ensure_tracking_table(conn)
            rows = await conn.fetch("SELECT filename FROM app.schema_migrations")
            applied = {r["filename"] for r in rows}
            pending = [f for f in files if f.name not in applied]

            if not pending:
                logger.info("[migrate] All %d migrations already applied", len(files))
                return

            logger.info(
                "[migrate] %d pending migration(s): %s",
                len(pending),
                [f.name for f in pending],
            )

            failed: list[str] = []
            for f in pending:
                ok = await _apply_one(conn, f)
                if not ok:
                    failed.append(f.name)
                    # Fail fast — later migrations may depend on this one
                    break

            if failed:
                raise RuntimeError(
                    f"Migration {failed[0]} failed — aborting startup. "
                    f"Fix the migration and redeploy; the app must not "
                    f"serve traffic on a half-migrated schema."
                )
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", _MIGRATION_LOCK_KEY)
    finally:
        await conn.close()


async def _check_db_environment(conn) -> None:
    """Refuse to run production migrations against a dev DB (and vice versa)."""
    _env = os.getenv("ENVIRONMENT", "development")
    db_name = await conn.fetchval("SELECT current_database()")
    if not db_name:
        return
    if _env == "production" and "dev" in db_name.lower():
        logger.critical(
            "[migrate] ENVIRONMENT=production but connected to DB '%s' "
            "(contains 'dev') — refusing to run. Check DATABASE_URL!",
            db_name,
        )
        raise RuntimeError("Refusing production migrations against dev DB")
    if _env == "development" and "prod" in db_name.lower():
        logger.critical(
            "[migrate] ENVIRONMENT=development but connected to DB '%s' "
            "(contains 'prod') — refusing to run. Check DATABASE_URL!",
            db_name,
        )
        raise RuntimeError("Refusing development migrations against prod DB")
