"""
Custom Exception Classes for TicketPilot API

This module provides a comprehensive error handling system with:
- Custom exception hierarchy
- User-friendly error messages
- Automatic logging
- Proper HTTP status codes
"""

import logging
from typing import Optional, Any, Dict
from datetime import datetime

# Configure logger for exceptions
logger = logging.getLogger(__name__)


class TicketPilotException(Exception):
    """
    Base exception class for all TicketPilot custom exceptions.
    
    All custom exceptions inherit from this class and include:
    - User-friendly message (safe to show to users)
    - HTTP status code
    - Technical details (for logging only)
    - Automatic logging on instantiation
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.timestamp = datetime.utcnow().isoformat()
        
        # Automatically log the exception when created
        self._log_exception()
        
        super().__init__(self.message)
    
    def _log_exception(self):
        """Log the exception with appropriate level based on status code"""
        log_data = {
            "exception_type": self.__class__.__name__,
            "message": self.message,
            "status_code": self.status_code,
            "details": self.details,
            "timestamp": self.timestamp
        }
        
        if self.status_code >= 500:
            logger.error(f"Server Error: {log_data}")
        elif self.status_code >= 400:
            logger.warning(f"Client Error: {log_data}")
        else:
            logger.info(f"Exception: {log_data}")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API response"""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "status_code": self.status_code,
            "timestamp": self.timestamp
        }


# === 400 Errors: Client sent invalid data ===

class ValidationError(TicketPilotException):
    """
    Raised when input validation fails.
    HTTP 400 - Bad Request
    
    Examples:
    - Field too long or too short
    - Invalid email format
    - Missing required field
    - Invalid enum value
    """
    
    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict] = None):
        details = details or {}
        if field:
            details["field"] = field
        
        super().__init__(
            message=message,
            status_code=400,
            details=details
        )


class InvalidInputError(ValidationError):
    """Raised when input format is invalid (subclass of ValidationError)"""
    pass


# === 401 Errors: Authentication failures ===

class UnauthorizedError(TicketPilotException):
    """
    Raised when authentication is required but not provided or invalid.
    HTTP 401 - Unauthorized
    
    Examples:
    - No JWT token provided
    - Invalid JWT token
    - Expired token
    - Malformed token
    """
    
    def __init__(self, message: str = "Authentication required", details: Optional[Dict] = None):
        super().__init__(
            message=message,
            status_code=401,
            details=details or {}
        )


class TokenExpiredError(UnauthorizedError):
    """Raised when JWT token has expired"""
    
    def __init__(self):
        super().__init__(
            message="Your session has expired. Please log in again.",
            details={"reason": "token_expired"}
        )


class InvalidTokenError(UnauthorizedError):
    """Raised when JWT token is malformed or invalid"""
    
    def __init__(self):
        super().__init__(
            message="Invalid authentication token. Please log in again.",
            details={"reason": "invalid_token"}
        )


# === 403 Errors: Authorization failures ===

class ForbiddenError(TicketPilotException):
    """
    Raised when user is authenticated but lacks permission.
    HTTP 403 - Forbidden
    
    Examples:
    - Rep trying to access admin features
    - Member trying to manage organization
    - User trying to access another org's data
    """
    
    def __init__(
        self, 
        message: str = "You don't have permission to perform this action",
        required_role: Optional[str] = None,
        details: Optional[Dict] = None
    ):
        details = details or {}
        if required_role:
            details["required_role"] = required_role
        
        super().__init__(
            message=message,
            status_code=403,
            details=details
        )


class InsufficientPermissionsError(ForbiddenError):
    """Raised when user's role is insufficient for action"""
    
    def __init__(self, required_role: str, current_role: str):
        super().__init__(
            message=f"This action requires '{required_role}' role. You are '{current_role}'.",
            required_role=required_role,
            details={"current_role": current_role}
        )


# === 404 Errors: Resource not found ===

class NotFoundError(TicketPilotException):
    """
    Raised when requested resource doesn't exist.
    HTTP 404 - Not Found
    
    Examples:
    - Ticket ID doesn't exist
    - Organization not found
    - User not found
    - Document not found
    
    Note: Also used for security - return 404 instead of 403 
    when user tries to access resource in different org
    """
    
    def __init__(
        self, 
        message: str = "Resource not found",
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict] = None
    ):
        details = details or {}
        if resource_type:
            details["resource_type"] = resource_type
        if resource_id:
            details["resource_id"] = resource_id
        
        super().__init__(
            message=message,
            status_code=404,
            details=details
        )


class TicketNotFoundError(NotFoundError):
    """Raised when ticket doesn't exist or user can't access it"""
    
    def __init__(self, ticket_id: str):
        super().__init__(
            message=f"Ticket not found",
            resource_type="ticket",
            resource_id=ticket_id
        )


class OrganizationNotFoundError(NotFoundError):
    """Raised when organization doesn't exist"""
    
    def __init__(self, org_id: str):
        super().__init__(
            message="Organization not found",
            resource_type="organization",
            resource_id=org_id
        )


class DocumentNotFoundError(NotFoundError):
    """Raised when knowledge base document doesn't exist"""
    
    def __init__(self, document_id: str):
        super().__init__(
            message="Document not found",
            resource_type="document",
            resource_id=document_id
        )


# === 409 Errors: Conflicts ===

class ConflictError(TicketPilotException):
    """
    Raised when operation conflicts with current state.
    HTTP 409 - Conflict
    
    Examples:
    - Duplicate slug
    - User already member of organization
    - Cannot delete last owner
    - Email already exists
    """
    
    def __init__(
        self, 
        message: str,
        conflict_type: Optional[str] = None,
        details: Optional[Dict] = None
    ):
        details = details or {}
        if conflict_type:
            details["conflict_type"] = conflict_type
        
        super().__init__(
            message=message,
            status_code=409,
            details=details
        )


class DuplicateError(ConflictError):
    """Raised when trying to create duplicate resource"""
    
    def __init__(self, resource_type: str, field: str, value: str):
        super().__init__(
            message=f"{resource_type} with {field} '{value}' already exists",
            conflict_type="duplicate",
            details={"resource_type": resource_type, "field": field, "value": value}
        )


class LastOwnerError(ConflictError):
    """Raised when trying to remove or demote last owner"""
    
    def __init__(self):
        super().__init__(
            message="Cannot remove or demote the last owner. Organization must have at least one owner.",
            conflict_type="last_owner"
        )


# === 422 Errors: Business logic violations ===

class BusinessLogicError(TicketPilotException):
    """
    Raised when operation violates business rules.
    HTTP 422 - Unprocessable Entity
    
    Examples:
    - Assigning ticket to rep not in same org
    - Creating ticket in org user isn't member of
    - File too large
    """
    
    def __init__(self, message: str, rule: Optional[str] = None, details: Optional[Dict] = None):
        details = details or {}
        if rule:
            details["business_rule"] = rule
        
        super().__init__(
            message=message,
            status_code=422,
            details=details
        )


class OrganizationMembershipError(BusinessLogicError):
    """Raised when user isn't member of required organization"""
    
    def __init__(self, org_name: Optional[str] = None):
        message = "You are not a member of this organization"
        if org_name:
            message = f"You are not a member of '{org_name}'"
        
        super().__init__(
            message=message,
            rule="organization_membership_required"
        )


class InvalidAssignmentError(BusinessLogicError):
    """Raised when trying to assign ticket to invalid rep"""
    
    def __init__(self, reason: str):
        super().__init__(
            message=f"Cannot assign ticket: {reason}",
            rule="valid_ticket_assignment"
        )


# === 429 Errors: Rate limiting ===

class RateLimitError(TicketPilotException):
    """
    Raised when user exceeds rate limit.
    HTTP 429 - Too Many Requests
    """
    
    def __init__(self, retry_after: Optional[int] = None):
        details = {}
        if retry_after:
            details["retry_after_seconds"] = retry_after
        
        super().__init__(
            message="Too many requests. Please slow down and try again later.",
            status_code=429,
            details=details
        )


# === 500 Errors: Server errors ===

class InternalServerError(TicketPilotException):
    """
    Raised for unexpected server errors.
    HTTP 500 - Internal Server Error
    
    Note: This should be caught by global exception handler.
    Use for wrapping unexpected exceptions.
    """
    
    def __init__(self, message: str = "An unexpected error occurred", details: Optional[Dict] = None):
        super().__init__(
            message=message,
            status_code=500,
            details=details or {}
        )


class DatabaseError(InternalServerError):
    """Raised when database operation fails"""
    
    def __init__(self, operation: str, details: Optional[Dict] = None):
        super().__init__(
            message="Database operation failed. Please try again later.",
            details={"operation": operation, **(details or {})}
        )


class ExternalServiceError(InternalServerError):
    """Raised when external service (AI, email, etc.) fails"""
    
    def __init__(self, service: str, details: Optional[Dict] = None):
        super().__init__(
            message=f"{service} service is temporarily unavailable. Please try again later.",
            details={"service": service, **(details or {})}
        )


# === Convenience functions ===

def require_role(current_role: str, required_role: str):
    """
    Check if user has required role, raise exception if not.
    
    Args:
        current_role: User's current role
        required_role: Role required for this action
    
    Raises:
        InsufficientPermissionsError if role check fails
    """
    role_hierarchy = ["member", "rep", "admin", "owner"]
    
    if current_role not in role_hierarchy or required_role not in role_hierarchy:
        raise ValidationError(f"Invalid role: {current_role} or {required_role}")
    
    current_level = role_hierarchy.index(current_role)
    required_level = role_hierarchy.index(required_role)
    
    if current_level < required_level:
        raise InsufficientPermissionsError(required_role, current_role)


def require_resource_ownership(
    resource_org_id: str, 
    user_org_id: str, 
    resource_type: str,
    resource_id: str
):
    """
    Check if resource belongs to user's current organization.
    Returns 404 instead of 403 for security (don't reveal resource exists).
    
    Args:
        resource_org_id: Organization ID of the resource
        user_org_id: User's current organization ID
        resource_type: Type of resource (for error message)
        resource_id: ID of resource (for error message)
    
    Raises:
        NotFoundError if org mismatch (security - don't reveal it exists)
    """
    if resource_org_id != user_org_id:
        raise NotFoundError(
            message=f"{resource_type.capitalize()} not found",
            resource_type=resource_type,
            resource_id=resource_id
        )
