"""
Auto-migration runner — applies unapplied SQL migrations on startup.

Design
------
Each migration file in backend/migrations/ is a plain SQL file.
A tracking table (app.schema_migrations) records which files have
been applied.  On every startup the runner:

1. Creates app.schema_migrations if it does not exist.
2. Reads all .sql files from the migrations directory, sorted by name.
3. Skips files already recorded in the tracking table.
4. Applies each unapplied file inside its own transaction.
5. Records success/failure in app.schema_migrations.

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

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


async def _ensure_tracking_table():
    """Create app.schema_migrations if it does not exist."""
    from .db import get_connection

    conn = await get_connection()
    try:
        await conn.execute("""
            CREATE SCHEMA IF NOT EXISTS app
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS app.schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                checksum TEXT NOT NULL DEFAULT '',
                duration_ms INT NOT NULL DEFAULT 0
            )
        """)
    finally:
        await conn.close()


async def _applied_filenames() -> set[str]:
    """Return the set of migration filenames already applied."""
    from .db import get_connection

    conn = await get_connection()
    try:
        rows = await conn.fetch("SELECT filename FROM app.schema_migrations")
        return {r["filename"] for r in rows}
    finally:
        await conn.close()


async def _record_migration(filename: str, checksum: str, duration_ms: int):
    """Record a successful migration."""
    from .db import get_connection

    conn = await get_connection()
    try:
        await conn.execute(
            """
            INSERT INTO app.schema_migrations (filename, checksum, duration_ms)
            VALUES ($1, $2, $3)
            ON CONFLICT (filename) DO NOTHING
            """,
            filename,
            checksum,
            duration_ms,
        )
    finally:
        await conn.close()


async def _apply_one(filepath: Path) -> bool:
    """Apply a single migration file. Returns True on success."""
    import hashlib
    import time

    sql = filepath.read_text(encoding="utf-8")
    if not sql.strip():
        logger.info("[migrate] %s — empty, skipped", filepath.name)
        return True

    checksum = hashlib.sha256(sql.encode()).hexdigest()[:16]
    start = time.monotonic()

    from .db import get_connection

    conn = await get_connection()
    try:
        async with conn.transaction():
            await conn.execute(sql)
        elapsed = int((time.monotonic() - start) * 1000)
        await _record_migration(filepath.name, checksum, elapsed)
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
    finally:
        await conn.close()


async def run_migrations():
    """
    Entry point — called from app.main:lifespan().

    Discovers unapplied .sql files in the migrations directory and
    applies them sequentially.
    """
    # Load .env file when running standalone (e.g. make migrate)
    from dotenv import load_dotenv

    load_dotenv()

    # ── Safety: refuse to run production migrations against a dev DB ───
    _env = os.getenv("ENVIRONMENT", "development")
    if _env == "production":
        try:
            from .db import get_connection

            conn = await get_connection()
            try:
                db_name = await conn.fetchval("SELECT current_database()")
                if db_name and "dev" in db_name.lower():
                    logger.critical(
                        "[migrate] ENVIRONMENT=production but connected to DB '%s' "
                        "(contains 'dev') — refusing to run. Check DATABASE_URL!",
                        db_name,
                    )
                    return
            finally:
                await conn.close()
        except Exception as exc:
            logger.warning("[migrate] Could not verify DB name: %s", exc)
    elif _env == "development":
        try:
            from .db import get_connection

            conn = await get_connection()
            try:
                db_name = await conn.fetchval("SELECT current_database()")
                if db_name and "prod" in db_name.lower():
                    logger.critical(
                        "[migrate] ENVIRONMENT=development but connected to DB '%s' "
                        "(contains 'prod') — refusing to run. Check DATABASE_URL!",
                        db_name,
                    )
                    return
            finally:
                await conn.close()
        except Exception as exc:
            logger.warning("[migrate] Could not verify DB name: %s", exc)

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

    try:
        await _ensure_tracking_table()
    except Exception as exc:
        logger.warning(
            "[migrate] Could not create tracking table: %s — skipping auto-migration",
            exc,
        )
        return

    applied = await _applied_filenames()
    pending = [f for f in files if f.name not in applied]

    if not pending:
        logger.info("[migrate] All %d migrations already applied", len(files))
        return

    logger.info(
        "[migrate] %d pending migration(s): %s", len(pending), [f.name for f in pending]
    )

    success = 0
    for f in pending:
        ok = await _apply_one(f)
        if ok:
            success += 1

    total = len(pending)
    logger.info(
        "[migrate] Done — %d/%d applied, %d failed",
        success,
        total,
        total - success,
    )
