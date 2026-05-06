import os
import time
import logging
import google.generativeai as genai
from typing import List

MODEL = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "3072"))
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2.0
INTER_BATCH_DELAY = 1.0   # seconds between batches to avoid rate limits
BATCH_SIZE = 20           # embed in small batches
MAX_TEXT_LENGTH = 20000

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    pass


def _init():
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        raise EmbeddingError("GOOGLE_API_KEY is required but not set")
    genai.configure(api_key=key)


def _clean(text: str) -> str:
    if not isinstance(text, str) or not text.strip():
        raise EmbeddingError("Text must be a non-empty string")
    return text.strip()[:MAX_TEXT_LENGTH]


def embed_single_text_with_retry(text: str, task_type: str = "retrieval_document") -> List[float]:
    _init()
    validated = _clean(text)
    for attempt in range(MAX_RETRY_ATTEMPTS):
        try:
            response = genai.embed_content(
                model=MODEL,
                content=validated,
                task_type=task_type,
            )
            return response["embedding"]
        except Exception as e:
            logger.warning(f"Embedding attempt {attempt + 1}/{MAX_RETRY_ATTEMPTS} failed: {e}")
            if attempt + 1 < MAX_RETRY_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
            else:
                raise EmbeddingError(f"All {MAX_RETRY_ATTEMPTS} attempts failed: {e}") from e


def embed_texts(texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
    """
    Embed texts in small batches with inter-batch delays to avoid
    hitting the Gemini free-tier rate limit.
    """
    if not texts:
        raise EmbeddingError("Cannot embed empty list of texts")

    _init()
    cleaned = [_clean(t) for t in texts]
    embeddings: List[List[float]] = []
    failed_count = 0
    total_batches = (len(cleaned) + BATCH_SIZE - 1) // BATCH_SIZE

    logger.info(f"Embedding {len(cleaned)} texts in {total_batches} batch(es)")

    for i, batch_start in enumerate(range(0, len(cleaned), BATCH_SIZE)):
        batch = cleaned[batch_start: batch_start + BATCH_SIZE]

        for j, text in enumerate(batch):
            try:
                response = genai.embed_content(
                    model=MODEL,
                    content=text,
                    task_type=task_type,
                )
                embeddings.append(response["embedding"])
            except Exception as e:
                logger.error(f"Failed text {batch_start + j}: {e}")
                failed_count += 1
                fallback = [0.0] * (len(embeddings[0]) if embeddings else EMBEDDING_DIM)
                embeddings.append(fallback)

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
