from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(title="TicketPilot API", version=API_VERSION)

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

app.include_router(auth_router)
app.include_router(kb_router)
app.include_router(tickets_router)
app.include_router(rep_router)
app.include_router(admin_router)
app.include_router(feedback_router)
app.include_router(organizations_router)

@app.get("/api/health")
def health():
    return {"ok": True, "api": "ticketpilot", "version": API_VERSION}

@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return user