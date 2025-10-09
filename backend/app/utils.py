import re
import hashlib
from typing import Tuple
from pypdf import PdfReader
from docx import Document as DocxDocument


def normalize_text(text: str) -> str:
    """Normalize text by unifying whitespace and stripping control chars."""
    # unify whitespace + strip control chars
    text = re.sub(r'\r\n?', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def sha256(s: str) -> str:
    """Generate SHA256 hash of string."""
    return hashlib.sha256(s.encode('utf-8')).hexdigest()


def read_txt_bytes(b: bytes, encoding='utf-8') -> str:
    """Read plain text from bytes."""
    return b.decode(encoding, errors='ignore')


def read_md_bytes(b: bytes) -> str:
    """Read markdown as plain text for Phase 2."""
    return read_txt_bytes(b)


def read_pdf_bytes(b: bytes) -> str:
    """Extract text from PDF bytes."""
    from io import BytesIO
    reader = PdfReader(BytesIO(b))
    parts = [p.extract_text() or '' for p in reader.pages]
    return "\n".join(parts)


def read_docx_bytes(b: bytes) -> str:
    """Extract text from DOCX bytes."""
    from io import BytesIO
    doc = DocxDocument(BytesIO(b))
    parts = [p.text for p in doc.paragraphs]
    return "\n".join(parts)


def sniff_and_read(mime: str, filename: str, raw: bytes) -> Tuple[str, str]:
    """Detect file type and extract text content."""
    ext = (filename or '').lower()
    
    if mime == 'application/pdf' or ext.endswith('.pdf'):
        return 'application/pdf', read_pdf_bytes(raw)
    
    if mime in ('text/plain', 'text/markdown') or ext.endswith(('.txt', '.md', '.markdown')):
        detected_mime = 'text/markdown' if ext.endswith(('.md', '.markdown')) else 'text/plain'
        return detected_mime, read_txt_bytes(raw)
    
    if mime in ('application/vnd.openxmlformats-officedocument.wordprocessingml.document',) or ext.endswith('.docx'):
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', read_docx_bytes(raw)
    
    # fallback to plain text
    return mime or 'text/plain', read_txt_bytes(raw)