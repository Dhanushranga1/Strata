import os
import time
import logging
import httpx
from typing import List

MODEL = os.getenv("EMBEDDING_MODEL", "jina-embeddings-v3")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))
MAX_TEXT_LENGTH = 8000
BATCH_SIZE = 20          # small batch — fewer tokens per call on free tier
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 5.0   # wait 5 s before retrying a failed batch
INTER_BATCH_DELAY = 3.0     # wait 3 s between successful batches
JINA_API_URL = "https://api.jina.ai/v1/embeddings"

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    pass


def _api_key() -> str:
    key = os.getenv("JINA_API_KEY")
    if not key:
        raise EmbeddingError("JINA_API_KEY is required but not set")
    return key


def _clean(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        raise EmbeddingError("Text must be a non-empty string")
    return text.strip()[:MAX_TEXT_LENGTH]


def _embed_batch(texts: List[str]) -> List[List[float]]:
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }
    payload = {"model": MODEL, "input": texts}

    for attempt in range(MAX_RETRY_ATTEMPTS):
        try:
            with httpx.Client(timeout=60) as client:
                response = client.post(JINA_API_URL, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                items = sorted(data["data"], key=lambda x: x["index"])
                return [item["embedding"] for item in items]
        except Exception as e:
            wait = RETRY_DELAY_SECONDS * (attempt + 1)
            logger.warning(f"Batch attempt {attempt + 1}/{MAX_RETRY_ATTEMPTS} failed: {e} — waiting {wait}s")
            if attempt + 1 < MAX_RETRY_ATTEMPTS:
                time.sleep(wait)
            else:
                raise EmbeddingError(f"All {MAX_RETRY_ATTEMPTS} attempts failed: {e}") from e


def embed_texts(texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
    """
    Embed texts via Jina AI in small batches with inter-batch delays to
    stay well within the free tier rate limit.
    """
    if not texts:
        raise EmbeddingError("Cannot embed empty list of texts")

    cleaned = [_clean(t) for t in texts]
    embeddings: List[List[float]] = []
    failed_count = 0
    total_batches = (len(cleaned) + BATCH_SIZE - 1) // BATCH_SIZE

    logger.info(f"Embedding {len(cleaned)} texts in {total_batches} batch(es) — {INTER_BATCH_DELAY}s between each")

    for i, batch_start in enumerate(range(0, len(cleaned), BATCH_SIZE)):
        batch = cleaned[batch_start: batch_start + BATCH_SIZE]
        try:
            batch_embeddings = _embed_batch(batch)
            embeddings.extend(batch_embeddings)
            logger.info(f"Batch {i + 1}/{total_batches} done ({len(batch)} texts)")
        except EmbeddingError as e:
            logger.error(f"Batch {i + 1} failed: {e}")
            failed_count += len(batch)
            fallback = [0.0] * (len(embeddings[0]) if embeddings else EMBEDDING_DIM)
            embeddings.extend([fallback] * len(batch))

        # Pause between batches — skip delay after the last batch
        if i < total_batches - 1:
            logger.info(f"Waiting {INTER_BATCH_DELAY}s before next batch...")
            time.sleep(INTER_BATCH_DELAY)

    failure_rate = failed_count / len(texts)
    logger.info(f"Embedding complete: {len(texts) - failed_count}/{len(texts)} successful")

    if failure_rate > 0.5:
        raise EmbeddingError(
            f"High embedding failure rate: {failure_rate:.1%} ({failed_count}/{len(texts)})"
        )

    return embeddings


def embed_single_text_with_retry(text: str, task_type: str = "retrieval_document") -> List[float]:
    """Single-text wrapper used by the RAG query path."""
    return embed_texts([text], task_type=task_type)[0]
