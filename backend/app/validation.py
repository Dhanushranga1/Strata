"""
Input Validation Utilities

Comprehensive validation and sanitization for all user inputs:
- String validation (length, format, dangerous characters)
- Email validation
- Slug validation
- HTML sanitization
- Enum validation
- UUID validation
"""

import re
import html
import bleach
from typing import Optional, List, Set
from pydantic import validator, Field
from .exceptions import ValidationError, InvalidInputError


# === String Validation ===

def validate_string(
    value: str,
    field_name: str,
    min_length: int = 1,
    max_length: int = 1000,
    allow_empty: bool = False,
    strip: bool = True,
    allowed_chars: Optional[str] = None
) -> str:
    """
    Validate and sanitize a string field.
    
    Args:
        value: String to validate
        field_name: Name of field (for error messages)
        min_length: Minimum length after stripping
        max_length: Maximum length
        allow_empty: Whether empty string is valid
        strip: Whether to strip whitespace
        allowed_chars: Regex pattern for allowed characters
    
    Returns:
        Validated and sanitized string
    
    Raises:
        ValidationError if validation fails
    """
    if value is None:
        if allow_empty:
            return ""
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    # Strip whitespace
    if strip:
        value = value.strip()
    
    # Check if empty
    if not value:
        if allow_empty:
            return ""
        raise ValidationError(f"{field_name} cannot be empty", field=field_name)
    
    # Check length
    if len(value) < min_length:
        raise ValidationError(
            f"{field_name} must be at least {min_length} characters long",
            field=field_name,
            details={"current_length": len(value), "min_length": min_length}
        )
    
    if len(value) > max_length:
        raise ValidationError(
            f"{field_name} must be at most {max_length} characters long",
            field=field_name,
            details={"current_length": len(value), "max_length": max_length}
        )
    
    # Check allowed characters
    if allowed_chars and not re.match(allowed_chars, value):
        raise ValidationError(
            f"{field_name} contains invalid characters",
            field=field_name
        )
    
    return value


def validate_title(value: str) -> str:
    """Validate ticket/document title (3-200 chars, no HTML)"""
    value = validate_string(value, "title", min_length=3, max_length=200)
    
    # Remove any HTML tags (titles should be plain text)
    value = bleach.clean(value, tags=[], strip=True)
    
    return value


def validate_description(value: str, max_length: int = 10000) -> str:
    """
    Validate description/content field.
    Allows some safe HTML but sanitizes dangerous content.
    """
    value = validate_string(value, "description", min_length=10, max_length=max_length)
    
    # Sanitize HTML (allow safe tags, remove scripts/events)
    value = sanitize_html(value)
    
    return value


# === Email Validation ===

EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
)

def validate_email(value: str) -> str:
    """
    Validate and normalize email address.
    
    Args:
        value: Email address to validate
    
    Returns:
        Normalized email (lowercase, stripped)
    
    Raises:
        ValidationError if email format invalid
    """
    if not value:
        raise ValidationError("Email is required", field="email")
    
    # Strip and lowercase
    value = value.strip().lower()
    
    # Check format
    if not EMAIL_REGEX.match(value):
        raise ValidationError(
            "Invalid email format. Please enter a valid email address.",
            field="email"
        )
    
    # Check for common typos
    common_typos = {
        "@gmial.com": "@gmail.com",
        "@gmai.com": "@gmail.com",
        "@yahooo.com": "@yahoo.com",
        "@hotmial.com": "@hotmail.com"
    }
    
    for typo, correction in common_typos.items():
        if value.endswith(typo):
            raise ValidationError(
                f"Did you mean {value.replace(typo, correction)}?",
                field="email",
                details={"suggestion": value.replace(typo, correction)}
            )
    
    return value


# === Slug Validation ===

SLUG_REGEX = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')

def validate_slug(value: str, field_name: str = "slug") -> str:
    """
    Validate organization/resource slug.
    
    Rules:
    - Lowercase only
    - Alphanumeric and hyphens
    - Cannot start or end with hyphen
    - 3-50 characters
    
    Args:
        value: Slug to validate
        field_name: Name of field (for error messages)
    
    Returns:
        Validated slug
    
    Raises:
        ValidationError if slug format invalid
    """
    if not value:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    value = value.strip().lower()
    
    # Check length
    if len(value) < 3:
        raise ValidationError(
            f"{field_name} must be at least 3 characters long",
            field=field_name
        )
    
    if len(value) > 50:
        raise ValidationError(
            f"{field_name} must be at most 50 characters long",
            field=field_name
        )
    
    # Check format
    if not SLUG_REGEX.match(value):
        raise ValidationError(
            f"{field_name} can only contain lowercase letters, numbers, and hyphens",
            field=field_name,
            details={
                "hint": "No spaces, special characters, or uppercase letters allowed"
            }
        )
    
    # Check for reserved slugs (can't use these as org slugs)
    reserved = {"api", "admin", "auth", "login", "signup", "docs", "health"}
    if value in reserved:
        raise ValidationError(
            f"'{value}' is a reserved slug and cannot be used",
            field=field_name
        )
    
    return value


def generate_slug_from_name(name: str) -> str:
    """
    Generate a URL-safe slug from a name.
    
    Example:
        "My Company!" -> "my-company"
        "Tech Co. (2024)" -> "tech-co-2024"
    
    Args:
        name: Organization name or title
    
    Returns:
        Generated slug
    """
    # Lowercase and remove leading/trailing whitespace
    slug = name.strip().lower()
    
    # Replace spaces and special chars with hyphens
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    
    # Collapse multiple hyphens
    slug = re.sub(r'-+', '-', slug)
    
    # Ensure minimum length
    if len(slug) < 3:
        slug = slug + "-org"
    
    # Truncate to max length
    if len(slug) > 50:
        slug = slug[:50].rstrip('-')
    
    return slug


# === HTML Sanitization ===

# Allowed HTML tags and attributes for user content
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'
]

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title'],
    'img': ['src', 'alt', 'title'],
}

def sanitize_html(content: str) -> str:
    """
    Sanitize HTML content to prevent XSS attacks.
    
    Removes:
    - <script> tags
    - javascript: URLs
    - Event handlers (onclick, onload, etc.)
    - Dangerous tags (iframe, object, embed, etc.)
    
    Allows:
    - Safe formatting tags (p, strong, em, etc.)
    - Links (with href validation)
    
    Args:
        content: HTML content to sanitize
    
    Returns:
        Sanitized HTML (safe to render)
    """
    if not content:
        return ""
    
    # Use bleach library to sanitize
    cleaned = bleach.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True,  # Remove tags, don't escape them
        protocols=['http', 'https', 'mailto']  # Only allow these URL protocols
    )
    
    return cleaned


def strip_html(content: str) -> str:
    """
    Remove all HTML tags from content.
    
    Use this for plain text fields that shouldn't contain any HTML.
    
    Args:
        content: Content that may contain HTML
    
    Returns:
        Plain text with all HTML removed
    """
    if not content:
        return ""
    
    # Remove all tags
    cleaned = bleach.clean(content, tags=[], strip=True)
    
    # Unescape HTML entities
    cleaned = html.unescape(cleaned)
    
    return cleaned


# === Enum Validation ===

def validate_enum(
    value: str,
    allowed_values: List[str],
    field_name: str,
    case_sensitive: bool = False
) -> str:
    """
    Validate that value is one of allowed enum values.
    
    Args:
        value: Value to validate
        allowed_values: List of valid values
        field_name: Name of field (for error messages)
        case_sensitive: Whether comparison is case-sensitive
    
    Returns:
        Validated value (normalized to lowercase if not case-sensitive)
    
    Raises:
        ValidationError if value not in allowed list
    """
    if not value:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    # Normalize case
    if not case_sensitive:
        value = value.lower()
        allowed_values = [v.lower() for v in allowed_values]
    
    if value not in allowed_values:
        raise ValidationError(
            f"Invalid {field_name}. Must be one of: {', '.join(allowed_values)}",
            field=field_name,
            details={"allowed_values": allowed_values}
        )
    
    return value


# === UUID Validation ===

UUID_REGEX = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE
)

def validate_uuid(value: str, field_name: str = "id") -> str:
    """
    Validate UUID format.
    
    Args:
        value: UUID string to validate
        field_name: Name of field (for error messages)
    
    Returns:
        Validated UUID (lowercase)
    
    Raises:
        ValidationError if UUID format invalid
    """
    if not value:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    value = value.strip().lower()
    
    if not UUID_REGEX.match(value):
        raise ValidationError(
            f"Invalid {field_name} format",
            field=field_name
        )
    
    return value


# === File Validation ===

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_FILE_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'txt', 'md',
    'jpg', 'jpeg', 'png', 'gif',
    'csv', 'xls', 'xlsx'
}

def validate_file(
    filename: str,
    file_size: int,
    max_size: int = MAX_FILE_SIZE,
    allowed_extensions: Set[str] = ALLOWED_FILE_EXTENSIONS
) -> str:
    """
    Validate uploaded file.
    
    Args:
        filename: Original filename
        file_size: Size in bytes
        max_size: Maximum allowed size in bytes
        allowed_extensions: Set of allowed file extensions
    
    Returns:
        Validated filename
    
    Raises:
        ValidationError if file invalid
    """
    if not filename:
        raise ValidationError("Filename is required", field="file")
    
    # Check file size
    if file_size > max_size:
        raise ValidationError(
            f"File too large. Maximum size is {max_size / (1024*1024):.0f}MB",
            field="file",
            details={"file_size_mb": file_size / (1024*1024), "max_size_mb": max_size / (1024*1024)}
        )
    
    # Check file extension
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    
    if not ext:
        raise ValidationError(
            "File must have an extension",
            field="file"
        )
    
    if ext not in allowed_extensions:
        raise ValidationError(
            f"File type '.{ext}' not allowed. Allowed types: {', '.join(sorted(allowed_extensions))}",
            field="file",
            details={"allowed_extensions": list(allowed_extensions)}
        )
    
    return filename


# === Password Validation ===

def validate_password(password: str, min_length: int = 8) -> str:
    """
    Validate password strength.
    
    Requirements:
    - Minimum length (default 8)
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    
    Args:
        password: Password to validate
        min_length: Minimum required length
    
    Returns:
        Validated password
    
    Raises:
        ValidationError if password too weak
    """
    if not password:
        raise ValidationError("Password is required", field="password")
    
    if len(password) < min_length:
        raise ValidationError(
            f"Password must be at least {min_length} characters long",
            field="password"
        )
    
    if not re.search(r'[A-Z]', password):
        raise ValidationError(
            "Password must contain at least one uppercase letter",
            field="password"
        )
    
    if not re.search(r'[a-z]', password):
        raise ValidationError(
            "Password must contain at least one lowercase letter",
            field="password"
        )
    
    if not re.search(r'[0-9]', password):
        raise ValidationError(
            "Password must contain at least one number",
            field="password"
        )
    
    return password
