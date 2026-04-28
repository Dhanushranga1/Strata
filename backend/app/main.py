from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
from dotenv import load_dotenv
from .auth import User, get_current_user
from .error_handlers import register_exception_handlers
from .logging_config import setup_logging, get_logger
from .middleware import add_request_logging
from .org_middleware import add_organization_context

# Import security features
try:
    from .security import (
        SecurityHeadersMiddleware,
        get_cors_config,
        limiter,
        rate_limit_exceeded_handler
    )
    from slowapi.errors import RateLimitExceeded
    SECURITY_ENABLED = True
except ImportError:
    # Fallback if slowapi not installed
    SECURITY_ENABLED = False
    print("⚠️  WARNING: slowapi not installed. Rate limiting disabled.")

load_dotenv()

API_VERSION = os.getenv("API_VERSION", "0.1.0")
WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Initialize logging system
setup_logging(
    app_name="ticketpilot",
    log_level=LOG_LEVEL,
    enable_console=True,  # Always enable console for now
    enable_file=ENVIRONMENT != "development"  # Only file logs in production
)

logger = get_logger(__name__)
logger.info("Starting TicketPilot API", extra={
    "environment": ENVIRONMENT,
    "version": API_VERSION,
    "security_enabled": SECURITY_ENABLED
})


def _check_faiss_indices():
    """
    Warn if the FAISS data directory is empty.

    FAISS indices live under data/faiss/<org_id>/ and are NOT committed to git.
    On ephemeral cloud deployments (Render, Railway, etc.) the filesystem is wiped
    on every deploy, so all indices are lost. When this warning fires, admins must
    re-upload KB documents to rebuild the indices before the AI assistant returns
    useful answers.
    """
    index_dir = os.getenv("VECTOR_INDEX_DIR", "./data/faiss")
    if not os.path.isdir(index_dir):
        logger.warning(
            "FAISS data directory '%s' does not exist — no KB indices loaded. "
            "AI responses will have low confidence until documents are re-uploaded. "
            "On ephemeral deployments KB documents must be re-uploaded after every deploy.",
            index_dir,
        )
        return

    org_dirs = [
        d for d in os.listdir(index_dir)
        if os.path.isdir(os.path.join(index_dir, d))
    ]
    if not org_dirs:
        logger.warning(
            "FAISS data directory '%s' exists but contains no org indices — "
            "AI responses will have low confidence until documents are re-uploaded.",
            index_dir,
        )
    else:
        logger.info(
            "FAISS: found indices for %d organisation(s): %s",
            len(org_dirs),
            org_dirs,
        )


_PRIORITY_DEFAULT_HOURS = {1: 168, 2: 72, 3: 48, 4: 24, 5: 12, 6: 6, 7: 7}


async def _overdue_scan():
    """
    Background scan (every 15 min) covering three concerns:
    1. Auto-flag needs_attention based on priority_level + org attention_thresholds
    2. Mark tickets overdue (respects ETR when set) and send first notification
    3. Send repeat overdue reminders + ETR 1-hour-before reminder
    """
    from .email import (
        send_overdue_email, send_overdue_reminder_email, send_etr_reminder_email
    )
    from .db import get_connection

    try:
        conn = await get_connection()
    except Exception as exc:
        logger.error("Overdue scan: DB connection failed: %s", exc)
        return
    try:
        orgs = await conn.fetch("SELECT id, settings FROM app.organizations WHERE is_active = true")
        for org in orgs:
            org_id = str(org['id'])
            settings = dict(org['settings']) if org['settings'] else {}
            threshold_h = float(settings.get('overdue_threshold_hours', 48))
            reminder_h = float(settings.get('overdue_reminder_hours', 24))

            # Build attention threshold map from org settings (falls back to defaults)
            raw_thresholds = settings.get('attention_thresholds', {})
            attention_thresholds = {
                lvl: float(raw_thresholds.get(str(lvl), default_h))
                for lvl, default_h in _PRIORITY_DEFAULT_HOURS.items()
            }

            # ── 1. Auto-flag needs_attention by priority_level ─────────────────
            for lvl, hours in attention_thresholds.items():
                await conn.execute("""
                    UPDATE app.tickets
                    SET needs_attention = true
                    WHERE organization_id = $1
                      AND priority_level = $2
                      AND needs_attention = false
                      AND status NOT IN ('resolved', 'closed')
                      AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > $3
                """, org_id, lvl, hours)

            # ── 2. Mark overdue (ETR-aware) ────────────────────────────────────
            # Tickets without ETR: use org-level threshold_h
            await conn.execute("""
                UPDATE app.tickets
                SET is_overdue = true
                WHERE organization_id = $1
                  AND is_overdue = false
                  AND expected_resolve_at IS NULL
                  AND status NOT IN ('resolved', 'closed')
                  AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > $2
            """, org_id, threshold_h)

            # Tickets WITH ETR: overdue only if past their ETR
            await conn.execute("""
                UPDATE app.tickets
                SET is_overdue = true
                WHERE organization_id = $1
                  AND is_overdue = false
                  AND expected_resolve_at IS NOT NULL
                  AND expected_resolve_at < NOW()
                  AND status NOT IN ('resolved', 'closed')
            """, org_id)

            # ── 3a. First-time overdue notification ────────────────────────────
            newly_overdue = await conn.fetch("""
                SELECT t.id, t.title, au.email AS assignee_email,
                       EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 AS hours_open
                FROM app.tickets t
                LEFT JOIN auth.users au ON au.id = t.assignee_id
                WHERE t.organization_id = $1
                  AND t.is_overdue = true
                  AND t.overdue_notified_at IS NULL
                  AND t.status NOT IN ('resolved', 'closed')
            """, org_id)

            for row in newly_overdue:
                tid = str(row['id'])
                if row['assignee_email']:
                    send_overdue_email(row['assignee_email'], tid, row['title'], int(row['hours_open']))
                await conn.execute(
                    "UPDATE app.tickets SET overdue_notified_at = NOW() WHERE id = $1", row['id']
                )

            # ── 3b. Repeat overdue reminders ───────────────────────────────────
            reminder_due = await conn.fetch("""
                SELECT t.id, t.title, au.email AS assignee_email,
                       EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 AS hours_open
                FROM app.tickets t
                LEFT JOIN auth.users au ON au.id = t.assignee_id
                WHERE t.organization_id = $1
                  AND t.is_overdue = true
                  AND t.overdue_notified_at IS NOT NULL
                  AND EXTRACT(EPOCH FROM (NOW() - t.overdue_notified_at)) / 3600 > $2
                  AND t.status NOT IN ('resolved', 'closed')
            """, org_id, reminder_h)

            for row in reminder_due:
                tid = str(row['id'])
                if row['assignee_email']:
                    send_overdue_reminder_email(row['assignee_email'], tid, row['title'], int(row['hours_open']))
                await conn.execute(
                    "UPDATE app.tickets SET overdue_notified_at = NOW() WHERE id = $1", row['id']
                )

            # ── 3c. ETR 1-hour-before reminders ───────────────────────────────
            etr_due = await conn.fetch("""
                SELECT t.id, t.title, t.expected_resolve_at, au.email AS assignee_email
                FROM app.tickets t
                LEFT JOIN auth.users au ON au.id = t.assignee_id
                WHERE t.organization_id = $1
                  AND t.expected_resolve_at IS NOT NULL
                  AND t.etr_reminder_sent = false
                  AND t.expected_resolve_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
                  AND t.status NOT IN ('resolved', 'closed')
            """, org_id)

            for row in etr_due:
                tid = str(row['id'])
                etr_str = row['expected_resolve_at'].strftime('%Y-%m-%d %H:%M UTC')
                if row['assignee_email']:
                    send_etr_reminder_email(row['assignee_email'], tid, row['title'], etr_str)
                await conn.execute(
                    "UPDATE app.tickets SET etr_reminder_sent = true WHERE id = $1", row['id']
                )
    finally:
        await conn.close()


async def _overdue_task():
    """Background loop: run overdue scan every 15 minutes."""
    while True:
        await asyncio.sleep(15 * 60)
        try:
            await _overdue_scan()
            logger.debug("Overdue scan complete")
        except Exception as exc:
            logger.error("Overdue background task error: %s", exc)


async def _pool_keepalive():
    """
    Ping the asyncpg pool every 4 minutes.

    Supabase's session pooler drops idle connections after ~10 minutes.
    Without this, the pool goes cold between overdue-scan cycles (15 min apart)
    and the next DB-backed request blocks for up to 45 s on three failing
    direct-connect retries before the stale-cache fallback fires.
    """
    from .db import get_connection
    while True:
        await asyncio.sleep(4 * 60)
        try:
            conn = await get_connection()
            try:
                await conn.fetchval("SELECT 1")
            finally:
                await conn.close()
            logger.debug("[keepalive] pool ping OK")
        except Exception as exc:
            logger.warning("[keepalive] pool ping failed: %s", type(exc).__name__)


async def _rebuild_one_org(org_id: str, load_snapshot_fn, rebuild_fn) -> None:
    """Try snapshot load first; fall back to full per-vector rebuild for one org."""
    try:
        count = await load_snapshot_fn(org_id)
        if count is not None:
            logger.info("[startup] org %s loaded from snapshot (%d vectors)", org_id, count)
            return
        count = await rebuild_fn(org_id)
        if count:
            logger.info("[startup] org %s rebuilt from embeddings (%d vectors)", org_id, count)
        else:
            logger.info("[startup] org %s has no embeddings yet", org_id)
    except Exception as exc:
        logger.warning("[startup] org %s rebuild failed: %s", org_id, exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from .db import init_pool, close_pool
    await init_pool()

    # Rebuild per-org FAISS indexes on cold start (Render free-tier spin-up / redeploy).
    # Strategy: discover every org that has stored embeddings, try snapshot first,
    # fall back to full rebuild from individual vectors.
    _check_faiss_indices()
    try:
        from .store import load_org_snapshot, rebuild_org_from_db
        from .db import get_connection

        conn = await get_connection()
        try:
            org_rows = await conn.fetch(
                "SELECT DISTINCT organization_id FROM app.chunks WHERE embedding IS NOT NULL"
            )
        finally:
            await conn.close()

        org_ids = [str(r["organization_id"]) for r in org_rows if r["organization_id"]]
        if org_ids:
            logger.info("[startup] Rebuilding FAISS for %d org(s): %s", len(org_ids), org_ids)
            rebuild_tasks = [_rebuild_one_org(org_id, load_org_snapshot, rebuild_org_from_db) for org_id in org_ids]
            await asyncio.gather(*rebuild_tasks)
        else:
            logger.info("[startup] No stored embeddings in DB yet — FAISS indexes will be built on first ingest")
    except Exception as exc:
        logger.error("[startup] Per-org FAISS rebuild failed: %s", exc)

    task = asyncio.create_task(_overdue_task())
    keepalive = asyncio.create_task(_pool_keepalive())
    yield
    task.cancel()
    keepalive.cancel()
    for t in (task, keepalive):
        try:
            await t
        except asyncio.CancelledError:
            pass
    await close_pool()


app = FastAPI(
    title="TicketPilot API",
    version=API_VERSION,
    lifespan=lifespan,
)

# Add rate limiter state if security is enabled
if SECURITY_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Register global exception handlers
register_exception_handlers(app)

# Add request logging middleware (must be before CORS)
add_request_logging(app)

# Add organization context middleware (after request logging, before CORS)
add_organization_context(app)

# Add security headers middleware if enabled
if SECURITY_ENABLED:
    app.add_middleware(SecurityHeadersMiddleware)

# Get appropriate CORS configuration
cors_config = get_cors_config() if SECURITY_ENABLED else {
    "allow_origins": [
        WEB_ORIGIN, 
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001", 
        "http://127.0.0.1:3002"
    ],
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

app.add_middleware(CORSMiddleware, **cors_config)

# Import and mount routers
from .auth import router as auth_router
from .kb import router as kb_router
from .tickets import router as tickets_router
from .rep import router as rep_router
from .admin import router as admin_router
from .feedback import router as feedback_router
from .organizations import router as organizations_router
from .invites import router as invites_router

app.include_router(auth_router)
app.include_router(kb_router)
app.include_router(tickets_router)
app.include_router(rep_router)
app.include_router(admin_router)
app.include_router(feedback_router)
app.include_router(organizations_router)
app.include_router(invites_router)


@app.get("/api/health")
def health():
    return {"ok": True, "api": "ticketpilot", "version": API_VERSION}


@app.get("/api/health/db")
async def health_db():
    """Diagnose DB connectivity without exposing credentials."""
    import time
    import asyncpg
    from urllib.parse import urlparse

    raw_url = os.getenv("DATABASE_URL", "")
    if not raw_url:
        return {"ok": False, "error": "DATABASE_URL not set"}

    parsed = urlparse(raw_url)
    host = parsed.hostname or "unknown"
    port = parsed.port or 5432
    ssl_mode = "disable" if "pooler.supabase.com" in raw_url else "require"

    result = {
        "host": host,
        "port": port,
        "ssl_mode": ssl_mode,
        "ok": False,
        "latency_ms": None,
        "error": None,
    }

    t0 = time.monotonic()
    try:
        conn = await asyncpg.connect(
            raw_url,
            timeout=10,
            ssl=ssl_mode,
            statement_cache_size=0,
            server_settings={"application_name": "ticketpilot-healthcheck"},
        )
        try:
            await conn.fetchval("SELECT 1")
        finally:
            await conn.close()
        result["ok"] = True
        result["latency_ms"] = round((time.monotonic() - t0) * 1000)
    except Exception as exc:
        result["latency_ms"] = round((time.monotonic() - t0) * 1000)
        result["error"] = type(exc).__name__ + (f": {exc}" if str(exc) else "")

    return result

@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return user