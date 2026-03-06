from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel
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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _check_faiss_indices()
    yield


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

@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return user