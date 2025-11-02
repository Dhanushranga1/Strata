"""
TicketPilot Security Middleware
Rate limiting and security headers for production
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
import os
from typing import Callable

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Rate limit configurations
RATE_LIMITS = {
    # Authentication endpoints (stricter)
    "auth": "10/minute",
    
    # Ticket creation (prevent spam)
    "create_ticket": "20/minute",
    
    # AI chat endpoints (most expensive)
    "ai_chat": "10/minute",
    
    # General API calls
    "general": "100/minute",
    
    # Read-only endpoints (more lenient)
    "read": "200/minute"
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses
    Protects against common web vulnerabilities
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Content Security Policy
        # Adjust 'self' and sources based on your needs
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https://nvgmgvplfpukckfkjuso.supabase.co;"
        )
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # XSS Protection (legacy browsers)
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Prevent MIME type sniffing
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Force HTTPS (if in production)
        if os.getenv("NODE_ENV") == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        
        # Permissions Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        
        return response


def get_rate_limit_for_endpoint(path: str, method: str) -> str:
    """
    Determine appropriate rate limit based on endpoint
    
    Args:
        path: Request path
        method: HTTP method
    
    Returns:
        Rate limit string (e.g., "10/minute")
    """
    # AI chat endpoints (most expensive)
    if "/chat" in path or "/ai" in path:
        return RATE_LIMITS["ai_chat"]
    
    # Authentication endpoints
    if "/auth" in path:
        return RATE_LIMITS["auth"]
    
    # Ticket creation
    if "/tickets" in path and method == "POST":
        return RATE_LIMITS["create_ticket"]
    
    # Read operations
    if method == "GET":
        return RATE_LIMITS["read"]
    
    # Everything else
    return RATE_LIMITS["general"]


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """
    Custom handler for rate limit exceeded
    Returns JSON response with retry information
    """
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "detail": "Too many requests. Please slow down.",
            "retry_after": exc.retry_after if hasattr(exc, 'retry_after') else 60
        }
    )


# Production CORS configuration
PRODUCTION_CORS_CONFIG = {
    "allow_origins": [
        os.getenv("WEB_ORIGIN", "http://localhost:3000")
    ],
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
    "allow_headers": [
        "Content-Type",
        "Authorization",
        "X-Organization-ID",
        "Accept",
        "Accept-Language",
        "X-Requested-With"
    ],
    "expose_headers": ["X-Total-Count"],
    "max_age": 3600  # Cache preflight requests for 1 hour
}


# Development CORS configuration
DEVELOPMENT_CORS_CONFIG = {
    "allow_origins": [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002"
    ],
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"]
}


def get_cors_config() -> dict:
    """
    Get appropriate CORS configuration based on environment
    
    Returns:
        CORS configuration dictionary
    """
    env = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development"))
    is_production = env == "production"
    return PRODUCTION_CORS_CONFIG if is_production else DEVELOPMENT_CORS_CONFIG
