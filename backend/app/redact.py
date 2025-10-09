"""
PII scrubbing utilities for Phase 4 AI Chat.
Removes sensitive information before sending to LLM.
"""

import re

# Regex patterns for common PII
EMAIL_PATTERN = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
PHONE_PATTERN = re.compile(r'(?<!\d)(?:\+?\d{1,3}[-. ]?)?(?:\(?\d{3}\)?[-. ]?)?\d{3}[-. ]?\d{4}(?!\d)')
CARD_PATTERN = re.compile(r'\b(?:\d[ -]*?){13,19}\b')

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
    text = EMAIL_PATTERN.sub('[email]', text)
    
    # Replace phone numbers
    text = PHONE_PATTERN.sub('[phone]', text)
    
    # Replace credit card numbers
    text = CARD_PATTERN.sub('[card]', text)
    
    return text