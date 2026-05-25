"""
Global Exception Handlers for FastAPI

This module provides centralized exception handling:
- Catches all exceptions at app level
- Returns user-friendly error responses
- Logs technical details for debugging
- Never exposes sensitive information to users
"""

import logging
import traceback
from typing import Union

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .exceptions import TicketPilotException

# Configure logger
logger = logging.getLogger(__name__)


async def ticketpilot_exception_handler(
    request: Request, exc: TicketPilotException
) -> JSONResponse:
    """
    Handle all custom TicketPilot exceptions.

    These exceptions already have user-friendly messages and are already logged,
    so we just need to return them as JSON responses.
    """

    # Add request context to log (already logged in exception, but add more detail here)
    logger.info(
        f"TicketPilot Exception: {exc.__class__.__name__}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status_code": exc.status_code,
            "message": exc.message,
            "user_id": getattr(request.state, "user_id", None),
            "org_id": getattr(request.state, "org_id", None),
        },
    )

    return JSONResponse(status_code=exc.status_code, content=exc.to_dict())


async def validation_exception_handler(
    request: Request, exc: Union[RequestValidationError, PydanticValidationError]
) -> JSONResponse:
    """
    Handle FastAPI/Pydantic validation errors.

    These occur when request body, query params, or path params
    don't match the expected schema.
    """

    # Extract field-specific errors (strip input values to avoid logging passwords/secrets)
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        message = error["msg"]
        error_type = error["type"]

        safe_error = {k: v for k, v in error.items() if k != "input"}
        errors.append(
            {
                "field": field,
                "message": message,
                "type": error_type,
            }
        )

    # Log validation error (input values stripped to avoid leaking secrets)
    logger.warning(
        "Validation Error",
        extra={
            "path": request.url.path,
            "method": request.method,
            "errors": errors,
            "user_id": getattr(request.state, "user_id", None),
        },
    )

    # Return user-friendly response
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Invalid input data. Please check your request and try again.",
            "details": errors,
            "status_code": 422,
        },
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """
    Handle standard HTTP exceptions from FastAPI/Starlette.

    These are raised by FastAPI for standard HTTP errors like 404, 405, etc.
    """

    logger.warning(
        f"HTTP Exception: {exc.status_code}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status_code": exc.status_code,
            "detail": exc.detail,
            "user_id": getattr(request.state, "user_id", None),
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "message": exc.detail,
            "status_code": exc.status_code,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler for unexpected exceptions.

    This is the last line of defense. Any exception not caught by other
    handlers ends up here. We log the full stack trace but only show
    a generic message to the user.

    CRITICAL: Never expose technical details to users!
    """

    # Get stack trace
    tb = traceback.format_exc()

    # Log full error details
    logger.error(
        "Unexpected Exception",
        extra={
            "path": request.url.path,
            "method": request.method,
            "exception_type": exc.__class__.__name__,
            "exception_message": str(exc),
            "traceback": tb,
            "user_id": getattr(request.state, "user_id", None),
            "org_id": getattr(request.state, "org_id", None),
        },
        exc_info=True,  # This includes full stack trace in logs
    )

    # Return generic error to user (NEVER expose stack traces!)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred. Our team has been notified and will investigate.",
            "status_code": 500,
            # In development, optionally include more details
            # "dev_info": str(exc) if os.getenv("ENVIRONMENT") == "development" else None
        },
    )


def register_exception_handlers(app):
    """
    Register all exception handlers with the FastAPI app.

    Call this function in main.py after creating the FastAPI app.

    Handler priority (first match wins):
    1. TicketPilot custom exceptions (most specific)
    2. Pydantic/FastAPI validation errors
    3. Standard HTTP exceptions
    4. Generic catch-all (for anything unexpected)
    """

    # Custom TicketPilot exceptions
    app.add_exception_handler(TicketPilotException, ticketpilot_exception_handler)

    # Validation errors
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(PydanticValidationError, validation_exception_handler)

    # Standard HTTP exceptions
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # Catch-all for unexpected errors
    app.add_exception_handler(Exception, generic_exception_handler)

    logger.info("Exception handlers registered successfully")
