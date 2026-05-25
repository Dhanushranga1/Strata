"""
PII scrubbing utilities for Phase 4 AI Chat.
Removes sensitive information before sending to LLM.
"""

import re

# Regex patterns for common PII
EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?\d{1,3}[-. ]?)?(?:\(?\d{3}\)?[-. ]?)?\d{3}[-. ]?\d{4}(?!\d)"
)


def _luhn_checksum(digits: str) -> bool:
    """Validate a number using the Luhn algorithm (ISO/IEC 7812)."""
    total = 0
    alt = False
    for d in reversed(digits):
        n = ord(d) - 48
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    return total % 10 == 0


def _is_card_number(s: str) -> bool:
    """Check if a digit string is likely a credit card number (13-19 digits, passes Luhn)."""
    digits_only = re.sub(r"[\s-]+", "", s)
    if not 13 <= len(digits_only) <= 19:
        return False
    return _luhn_checksum(digits_only)


def scrub(text: str) -> str:
    """
    Remove PII from text before sending to LLM.

    Args:
        text: Input text that may contain PII

    Returns:
        Text with PII replaced by placeholders
    """
    if not text:
        return text

    # Replace email addresses
    text = EMAIL_PATTERN.sub("[email]", text)

    # Replace phone numbers
    text = PHONE_PATTERN.sub("[phone]", text)

    # Replace credit card numbers — match digit groups of 13-19 chars, then validate Luhn
    # to avoid false positives on order IDs, timestamps, tracking numbers, etc.
    text = re.sub(
        r"\b(\d[\d -]{11,17}\d)\b",
        lambda m: "[card]" if _is_card_number(m.group(1)) else m.group(1),
        text,
    )

    return text
