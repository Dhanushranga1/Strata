from typing import List


def make_chunks(text: str, size_chars: int, overlap_chars: int) -> List[str]:
    """Create windowed chunks with overlap from text."""
    if size_chars <= 0:
        raise ValueError("size_chars must be > 0")
    if overlap_chars < 0 or overlap_chars >= size_chars:
        raise ValueError("invalid overlap")

    parts = []
    i = 0
    n = len(text)

    while i < n:
        j = min(i + size_chars, n)
        parts.append(text[i:j])

        if j == n:
            break

        i = j - overlap_chars

    return parts
