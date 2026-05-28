import os
import time
import logging
import httpx
from typing import List

MODEL = os.getenv("EMBEDDING_MODEL", "jina-embeddings-v5-text-small")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2.0
INTER_BATCH_DELAY = 3.0   # seconds between batches (free tier rate limit)
BATCH_SIZE = 20
MAX_TEXT_LENGTH = 20000
JINA_API_URL = "https://api.jina.ai/v1/embeddings"

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    pass


def _get_api_key() -> str:
    key = os.getenv("JINA_API_KEY")
    if not key:
        raise EmbeddingError("JINA_API_KEY is required but not set")
    return key


def _clean(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        raise EmbeddingError("Text must be a non-empty string")
    return text.strip()[:MAX_TEXT_LENGTH]


def _call_jina(texts: List[str], api_key: str) -> List[List[float]]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict = {
        "model": MODEL,
        "input": texts,
    }
    # Matryoshka truncation — only sent when EMBEDDING_DIM is explicitly set
    # in .env to a value below the model's native dimension (3072 for jina-v3,
    # varies for v5). Activating this requires re-embedding all stored chunks.
    if EMBEDDING_DIM < 3072:
        payload["dimensions"] = EMBEDDING_DIM

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(JINA_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    items = sorted(data["data"], key=lambda x: x["index"])
    return [item["embedding"] for item in items]


def embed_single_text_with_retry(text: str, task_type: str = "retrieval_document") -> List[float]:
    api_key = _get_api_key()
    validated = _clean(text)
    for attempt in range(MAX_RETRY_ATTEMPTS):
        try:
            return _call_jina([validated], api_key)[0]
        except Exception as e:
            logger.warning(f"Embedding attempt {attempt + 1}/{MAX_RETRY_ATTEMPTS} failed: {e}")
            if attempt + 1 < MAX_RETRY_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
            else:
                raise EmbeddingError(f"All {MAX_RETRY_ATTEMPTS} attempts failed: {e}") from e


def embed_texts(texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
    """
    Embed texts in small batches with inter-batch delays to avoid
    hitting the Jina free-tier rate limit.
    """
    if not texts:
        raise EmbeddingError("Cannot embed empty list of texts")

    api_key = _get_api_key()
    cleaned = [_clean(t) for t in texts]
    embeddings: List[List[float]] = []
    failed_count = 0
    total_batches = (len(cleaned) + BATCH_SIZE - 1) // BATCH_SIZE

    logger.info(f"Embedding {len(cleaned)} texts in {total_batches} batch(es) via Jina AI")

    for i, batch_start in enumerate(range(0, len(cleaned), BATCH_SIZE)):
        batch = cleaned[batch_start: batch_start + BATCH_SIZE]

        for attempt in range(MAX_RETRY_ATTEMPTS):
            try:
                batch_embeddings = _call_jina(batch, api_key)
                embeddings.extend(batch_embeddings)
                break
            except Exception as e:
                logger.warning(f"Batch {i + 1} attempt {attempt + 1}/{MAX_RETRY_ATTEMPTS} failed: {e}")
                if attempt + 1 < MAX_RETRY_ATTEMPTS:
                    time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                else:
                    logger.error(f"Batch {i + 1} failed after all retries: {e}")
                    failed_count += len(batch)
                    fallback = [0.0] * (len(embeddings[0]) if embeddings else EMBEDDING_DIM)
                    embeddings.extend([fallback] * len(batch))

        logger.info(f"Batch {i + 1}/{total_batches} done")
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
