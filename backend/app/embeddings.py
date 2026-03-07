import os
import time
import logging
import google.generativeai as genai
from typing import List, Optional

MODEL = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1.0
MAX_TEXT_LENGTH = 20000  # Google's text-embedding-004 limit

# Configure logging
logger = logging.getLogger(__name__)

class EmbeddingError(Exception):
    """Custom exception for embedding-related errors"""
    pass

def init_provider():
    """Initialize Google AI provider with API key and comprehensive error handling."""
    try:
        key = os.getenv("GOOGLE_API_KEY")
        if not key:
            raise EmbeddingError("GOOGLE_API_KEY is required but not found in environment")
        
        genai.configure(api_key=key)
        logger.info("Google AI provider initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize Google AI provider: {e}")
        raise EmbeddingError(f"Provider initialization failed: {e}") from e

def validate_text_input(text: str) -> str:
    """
    Validate and clean text input for embedding.
    
    Args:
        text: Input text to validate
        
    Returns:
        Cleaned text ready for embedding
        
    Raises:
        EmbeddingError: If text is invalid or too long
    """
    if not isinstance(text, str):
        raise EmbeddingError(f"Text must be string, got {type(text)}")
    
    if not text.strip():
        raise EmbeddingError("Text cannot be empty or whitespace only")
    
    if len(text) > MAX_TEXT_LENGTH:
        logger.warning(f"Text length {len(text)} exceeds limit {MAX_TEXT_LENGTH}, truncating")
        text = text[:MAX_TEXT_LENGTH]
    
    return text.strip()

def embed_single_text_with_retry(text: str) -> List[float]:
    """
    Generate embedding for single text with retry logic.
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector
        
    Raises:
        EmbeddingError: If all retry attempts fail
    """
    validated_text = validate_text_input(text)
    
    for attempt in range(MAX_RETRY_ATTEMPTS):
        try:
            response = genai.embed_content(
                model=MODEL,
                content=validated_text,
                task_type="retrieval_document",
            )
            
            if not response or "embedding" not in response:
                raise EmbeddingError("Invalid response format from Google API")
            
            embedding = response["embedding"]
            if not isinstance(embedding, list) or not embedding:
                raise EmbeddingError("Invalid embedding format received")
            
            logger.debug(f"Successfully embedded text of length {len(validated_text)}")
            return embedding
            
        except Exception as e:
            attempt_num = attempt + 1
            logger.warning(f"Embedding attempt {attempt_num}/{MAX_RETRY_ATTEMPTS} failed: {e}")
            
            if attempt_num < MAX_RETRY_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS * attempt_num)  # Exponential backoff
            else:
                raise EmbeddingError(f"All {MAX_RETRY_ATTEMPTS} embedding attempts failed. Last error: {e}") from e

def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a list of texts with comprehensive error handling.
    
    Args:
        texts: List of texts to embed
        
    Returns:
        List of embedding vectors
        
    Raises:
        EmbeddingError: If critical errors occur
    """
    if not texts:
        raise EmbeddingError("Cannot embed empty list of texts")
    
    if not isinstance(texts, list):
        raise EmbeddingError(f"texts must be a list, got {type(texts)}")
    
    # Initialize provider
    init_provider()
    
    embeddings = []
    failed_indices = []
    
    logger.info(f"Starting embedding generation for {len(texts)} texts")
    
    for i, text in enumerate(texts):
        try:
            embedding = embed_single_text_with_retry(text)
            embeddings.append(embedding)
            
        except EmbeddingError as e:
            logger.error(f"Failed to embed text {i}: {e}")
            failed_indices.append(i)
            
            # For critical failures, use zero vector as fallback
            if embeddings:
                # Use same dimension as successful embeddings
                fallback_embedding = [0.0] * len(embeddings[0])
            else:
                # Use standard dimension for gemini-embedding-001
                fallback_embedding = [0.0] * int(os.getenv("EMBEDDING_DIM", "3072"))
            
            embeddings.append(fallback_embedding)
            logger.warning(f"Using zero vector fallback for text {i}")
    
    # Log summary
    success_count = len(texts) - len(failed_indices)
    logger.info(f"Embedding complete: {success_count}/{len(texts)} successful")
    
    if failed_indices:
        logger.warning(f"Failed to embed texts at indices: {failed_indices}")
    
    # If too many failures, raise error
    failure_rate = len(failed_indices) / len(texts)
    if failure_rate > 0.5:  # More than 50% failure
        raise EmbeddingError(f"High embedding failure rate: {failure_rate:.1%} ({len(failed_indices)}/{len(texts)})")
    
    return embeddings