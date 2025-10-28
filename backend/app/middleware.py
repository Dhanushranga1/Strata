"""
Request Logging Middleware

Automatically logs every API request with:
- Method, path, status code
- Request duration timing
- User and organization context
- Unique request ID for tracing
"""

import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from .logging_config import log_api_request


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs every API request and response.
    
    Attaches unique request_id to each request for distributed tracing.
    Measures request duration for performance monitoring.
    Captures user and organization context if available.
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        
        # Paths to skip logging (too noisy)
        self.skip_paths = {
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico"
        }
        
        # Paths to log only at DEBUG level
        self.debug_only_paths = {
            "/api/health",
            "/health",
            "/healthz"
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request:
        1. Generate unique request ID
        2. Record start time
        3. Process request
        4. Record end time and log
        """
        
        # Skip logging for certain paths
        if request.url.path in self.skip_paths:
            return await call_next(request)
        
        # Generate unique request ID for tracing
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Record start time
        start_time = time.time()
        
        # Process request (may raise exceptions - that's OK, we'll still log)
        try:
            response = await call_next(request)
        except Exception as exc:
            # Calculate duration even if request failed
            duration_ms = (time.time() - start_time) * 1000
            
            # Log the failed request
            log_api_request(
                method=request.method,
                path=request.url.path,
                status_code=500,  # Unknown error
                duration_ms=duration_ms,
                user_id=getattr(request.state, "user_id", None),
                org_id=getattr(request.state, "org_id", None),
                request_id=request_id,
                error=str(exc),
                query_params=dict(request.query_params)
            )
            
            # Re-raise exception to be handled by exception handlers
            raise
        
        # Calculate request duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Extract user and org context if available
        # (These are set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        org_id = getattr(request.state, "org_id", None)
        
        # Skip detailed logging for health checks unless they're slow or failing
        if request.url.path in self.debug_only_paths:
            if response.status_code < 400 and duration_ms < 1000:
                # Don't log successful, fast health checks
                return response
        
        # Log the request
        log_api_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            user_id=user_id,
            org_id=org_id,
            request_id=request_id,
            query_params=dict(request.query_params) if request.query_params else None
        )
        
        # Add request ID to response headers for debugging
        response.headers["X-Request-ID"] = request_id
        
        return response


def add_request_logging(app):
    """
    Add request logging middleware to FastAPI app.
    
    Call this in main.py after creating the app but before
    defining routes.
    
    Example:
        app = FastAPI()
        add_request_logging(app)
        
        @app.get("/")
        def root():
            return {"message": "Hello"}
    """
    app.add_middleware(RequestLoggingMiddleware)
