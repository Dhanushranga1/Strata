"""
Structured Logging System for TicketPilot

Provides comprehensive logging with:
- JSON format for easy parsing
- Separate log files for different concerns
- Log rotation to prevent disk fill
- Performance tracking
- Security event logging
"""

import logging
import logging.handlers
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any


# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent.parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)


class JSONFormatter(logging.Formatter):
    """
    Custom formatter that outputs logs in JSON format.
    
    This makes logs easy to parse, search, and analyze with tools
    like ELK stack, Datadog, or simple grep/jq commands.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Convert log record to JSON string"""
        
        # Base log data
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        # These are added via extra={} parameter in logging calls
        for key, value in record.__dict__.items():
            if key not in [
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "message", "pathname", "process", "processName",
                "relativeCreated", "thread", "threadName", "exc_info",
                "exc_text", "stack_info"
            ]:
                log_data[key] = value
        
        return json.dumps(log_data)


class ReadableFormatter(logging.Formatter):
    """
    Human-readable formatter for console output in development.
    
    Formats logs in a clean, colored format for easy reading during development.
    """
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
        'RESET': '\033[0m'      # Reset
    }
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record in human-readable colored format"""
        
        # Get color for log level
        color = self.COLORS.get(record.levelname, '')
        reset = self.COLORS['RESET']
        
        # Build readable log line
        timestamp = datetime.fromtimestamp(record.created).strftime('%Y-%m-%d %H:%M:%S')
        
        log_line = (
            f"{color}{record.levelname:8}{reset} "
            f"| {timestamp} "
            f"| {record.module:15} "
            f"| {record.getMessage()}"
        )
        
        # Add exception if present
        if record.exc_info:
            log_line += "\n" + self.formatException(record.exc_info)
        
        return log_line


def setup_logging(
    app_name: str = "ticketpilot",
    log_level: str = "INFO",
    enable_console: bool = True,
    enable_file: bool = True
):
    """
    Configure application-wide logging.
    
    Args:
        app_name: Name of the application (used in log files)
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        enable_console: Whether to output logs to console
        enable_file: Whether to output logs to files
    
    Creates three log files:
    - app.log: All application logs
    - api.log: API request/response logs (populated by middleware)
    - error.log: Only ERROR and CRITICAL logs
    """
    
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers to avoid duplicates
    root_logger.handlers = []
    
    # === Console Handler (for development) ===
    if enable_console:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(ReadableFormatter())
        root_logger.addHandler(console_handler)
    
    # === File Handlers (for production) ===
    if enable_file:
        
        # 1. Main application log (all logs)
        app_handler = logging.handlers.RotatingFileHandler(
            filename=LOGS_DIR / f"{app_name}.log",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=7,  # Keep 7 days of logs
            encoding="utf-8"
        )
        app_handler.setLevel(logging.DEBUG)
        app_handler.setFormatter(JSONFormatter())
        root_logger.addHandler(app_handler)
        
        # 2. API request log (populated by middleware)
        api_handler = logging.handlers.RotatingFileHandler(
            filename=LOGS_DIR / f"{app_name}_api.log",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=7,
            encoding="utf-8"
        )
        api_handler.setLevel(logging.INFO)
        api_handler.setFormatter(JSONFormatter())
        
        # Create separate logger for API requests
        api_logger = logging.getLogger("api_requests")
        api_logger.setLevel(logging.INFO)
        api_logger.propagate = False  # Don't send to root logger
        api_logger.addHandler(api_handler)
        
        # 3. Error log (only errors and critical)
        error_handler = logging.handlers.RotatingFileHandler(
            filename=LOGS_DIR / f"{app_name}_error.log",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=30,  # Keep 30 days of error logs
            encoding="utf-8"
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(JSONFormatter())
        root_logger.addHandler(error_handler)
    
    # Log that logging is configured
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configured",
        extra={
            "app_name": app_name,
            "log_level": log_level,
            "logs_directory": str(LOGS_DIR),
            "console_enabled": enable_console,
            "file_enabled": enable_file
        }
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger for a specific module.
    
    Usage:
        logger = get_logger(__name__)
        logger.info("Something happened", extra={"user_id": user.id})
    
    Args:
        name: Usually __name__ to get logger for current module
    
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


# === Specialized logging functions ===

def log_api_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    request_id: Optional[str] = None,
    **kwargs
):
    """
    Log an API request with standardized format.
    
    This is called by the request logging middleware.
    
    Args:
        method: HTTP method (GET, POST, etc.)
        path: Request path
        status_code: HTTP response status code
        duration_ms: Request duration in milliseconds
        user_id: Authenticated user ID (if any)
        org_id: Organization context (if any)
        request_id: Unique request ID for tracing
        **kwargs: Additional fields to log
    """
    api_logger = logging.getLogger("api_requests")
    
    log_data = {
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
        "user_id": user_id,
        "org_id": org_id,
        "request_id": request_id,
        **kwargs
    }
    
    # Use different log levels based on status code
    if status_code >= 500:
        api_logger.error(f"{method} {path} {status_code} ({duration_ms}ms)", extra=log_data)
    elif status_code >= 400:
        api_logger.warning(f"{method} {path} {status_code} ({duration_ms}ms)", extra=log_data)
    elif duration_ms > 2000:  # Slow request
        api_logger.warning(f"SLOW: {method} {path} {status_code} ({duration_ms}ms)", extra=log_data)
    else:
        api_logger.info(f"{method} {path} {status_code} ({duration_ms}ms)", extra=log_data)


def log_authentication_event(
    event: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    success: bool = True,
    reason: Optional[str] = None,
    **kwargs
):
    """
    Log authentication-related events.
    
    Examples: login, logout, token refresh, failed login attempts
    
    Args:
        event: Type of event (login, logout, token_refresh, etc.)
        user_id: User ID if authenticated
        email: User email
        success: Whether operation succeeded
        reason: Reason for failure (if applicable)
        **kwargs: Additional context
    """
    logger = logging.getLogger("auth")
    
    log_data = {
        "event": event,
        "user_id": user_id,
        "email": email,
        "success": success,
        "reason": reason,
        **kwargs
    }
    
    if success:
        logger.info(f"Auth: {event}", extra=log_data)
    else:
        logger.warning(f"Auth Failed: {event} - {reason}", extra=log_data)


def log_data_mutation(
    action: str,
    resource_type: str,
    resource_id: str,
    user_id: str,
    org_id: str,
    changes: Optional[Dict[str, Any]] = None,
    **kwargs
):
    """
    Log data modification events.
    
    Examples: ticket created, status changed, member added, etc.
    
    Args:
        action: Action performed (created, updated, deleted)
        resource_type: Type of resource (ticket, organization, user, etc.)
        resource_id: ID of affected resource
        user_id: User who performed action
        org_id: Organization context
        changes: Dictionary of changed fields (for updates)
        **kwargs: Additional context
    """
    logger = logging.getLogger("data")
    
    log_data = {
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "user_id": user_id,
        "org_id": org_id,
        "changes": changes,
        **kwargs
    }
    
    logger.info(f"{action.upper()} {resource_type}: {resource_id}", extra=log_data)


def log_security_event(
    event: str,
    severity: str,
    user_id: Optional[str] = None,
    reason: Optional[str] = None,
    **kwargs
):
    """
    Log security-related events.
    
    Examples: permission denied, rate limit hit, suspicious activity
    
    Args:
        event: Type of security event
        severity: low, medium, high, critical
        user_id: User involved (if known)
        reason: Description of event
        **kwargs: Additional context
    """
    logger = logging.getLogger("security")
    
    log_data = {
        "event": event,
        "severity": severity,
        "user_id": user_id,
        "reason": reason,
        **kwargs
    }
    
    if severity in ["high", "critical"]:
        logger.error(f"SECURITY: {event}", extra=log_data)
    else:
        logger.warning(f"Security: {event}", extra=log_data)


def log_performance(
    operation: str,
    duration_ms: float,
    threshold_ms: float = 1000,
    **kwargs
):
    """
    Log performance metrics for operations.
    
    Logs at WARNING level if operation exceeds threshold.
    
    Args:
        operation: Name of operation
        duration_ms: How long it took
        threshold_ms: Warning threshold
        **kwargs: Additional context
    """
    logger = logging.getLogger("performance")
    
    log_data = {
        "operation": operation,
        "duration_ms": round(duration_ms, 2),
        "threshold_ms": threshold_ms,
        **kwargs
    }
    
    if duration_ms > threshold_ms:
        logger.warning(f"SLOW: {operation} ({duration_ms}ms)", extra=log_data)
    else:
        logger.debug(f"{operation} ({duration_ms}ms)", extra=log_data)
