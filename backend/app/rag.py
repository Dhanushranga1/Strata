"""
RAG retrieval module.
Handles embedding queries, FAISS search, context building, and advanced confidence scoring.
Enhanced with MMR re-ranking, semantic coherence analysis, and comprehensive metrics.
"""

import os
import re
import logging
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from .embeddings import embed_texts
from .store import search_vectors
from .redact import scrub

logger = logging.getLogger(__name__)

# Configuration from environment
TOP_K = int(os.getenv("RAG_TOP_K", "6"))
MIN_SCORE = float(os.getenv("RAG_MIN_SCORE", "0.25"))
MAX_CONTEXT_CHARS = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "12000"))
MMR_LAMBDA = float(os.getenv("MMR_LAMBDA", "0.7"))  # Balance relevance vs diversity
DIVERSITY_PENALTY = float(os.getenv("DIVERSITY_PENALTY", "0.3"))


def _ensure_embeddings(chunks: List[Dict]) -> List:
    """
    Return embeddings for chunks, computing missing ones in a single batch.
    Caches computed embeddings on the chunk dict under '_emb' to avoid re-computing
    across multiple callers (MMR, coherence, diversity) in the same retrieve() pass.
    """
    missing_indices = [i for i, c in enumerate(chunks) if '_emb' not in c]
    if missing_indices:
        texts = [chunks[i].get('text', '') for i in missing_indices]
        try:
            computed = embed_texts(texts)
            for i, emb in zip(missing_indices, computed):
                chunks[i]['_emb'] = emb
        except Exception as e:
            logger.warning("Batch chunk embedding failed: %s", e)
            for i in missing_indices:
                chunks[i]['_emb'] = np.zeros(len(chunks[0].get('_emb', [1])))
    return [c['_emb'] for c in chunks]


def compute_semantic_coherence(chunks: List[Dict], query_embedding: List[float]) -> float:
    """Compute semantic coherence between retrieved chunks and query."""
    if not chunks:
        return 0.0
    try:
        chunk_embeddings = _ensure_embeddings(chunks)
        query_norm = np.linalg.norm(query_embedding)
        if query_norm == 0:
            return 0.0
        similarities = []
        for chunk_emb in chunk_embeddings:
            chunk_norm = np.linalg.norm(chunk_emb)
            if chunk_norm > 0:
                sim = float(np.dot(query_embedding, chunk_emb) / (query_norm * chunk_norm))
                similarities.append(sim)
        return float(np.mean(similarities)) if similarities else 0.0
    except Exception as e:
        logger.warning("Semantic coherence error: %s", e)
        return 0.5


def compute_diversity_score(chunks: List[Dict]) -> float:
    """Compute diversity score among retrieved chunks (higher = more diverse)."""
    if len(chunks) < 2:
        return 1.0
    try:
        chunk_embeddings = _ensure_embeddings(chunks)
        similarities = []
        for i in range(len(chunk_embeddings)):
            for j in range(i + 1, len(chunk_embeddings)):
                emb1, emb2 = chunk_embeddings[i], chunk_embeddings[j]
                norm1, norm2 = np.linalg.norm(emb1), np.linalg.norm(emb2)
                if norm1 > 0 and norm2 > 0:
                    sim = float(np.dot(emb1, emb2) / (norm1 * norm2))
                    similarities.append(sim)
        avg_similarity = float(np.mean(similarities)) if similarities else 0.0
        return max(0.0, 1.0 - avg_similarity)
    except Exception as e:
        logger.warning("Diversity computation error: %s", e)
        return 0.5


def mmr_rerank(
    chunks: List[Dict],
    scores: List[float],
    query_embedding: List[float],
    lambda_param: float = MMR_LAMBDA,
) -> Tuple[List[Dict], List[float]]:
    """
    Re-rank chunks using Maximal Marginal Relevance to balance relevance and diversity.
    Uses _ensure_embeddings so chunk embeddings are computed at most once per retrieve() call.
    """
    if not chunks or len(chunks) <= 1:
        return chunks, scores
    try:
        chunk_embeddings = _ensure_embeddings(chunks)

        selected_indices = [0]
        remaining_indices = list(range(1, len(chunks)))

        while remaining_indices and len(selected_indices) < len(chunks):
            best_score = -float('inf')
            best_idx = None
            for idx in remaining_indices:
                relevance = scores[idx]
                max_sim = 0.0
                for sel_idx in selected_indices:
                    emb1, emb2 = chunk_embeddings[idx], chunk_embeddings[sel_idx]
                    norm1, norm2 = np.linalg.norm(emb1), np.linalg.norm(emb2)
                    if norm1 > 0 and norm2 > 0:
                        sim = float(np.dot(emb1, emb2) / (norm1 * norm2))
                        max_sim = max(max_sim, sim)
                mmr_score = lambda_param * relevance - (1 - lambda_param) * max_sim
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx
            if best_idx is not None:
                selected_indices.append(best_idx)
                remaining_indices.remove(best_idx)

        return [chunks[i] for i in selected_indices], [scores[i] for i in selected_indices]
    except Exception as e:
        logger.warning("MMR re-ranking error: %s", e)
        return chunks, scores


def retrieve(query: str, fetch_chunk_fn) -> Tuple[List[Dict], List[str], str, List[float], List[int], Dict[str, float]]:
    """
    Retrieve relevant chunks for a query using FAISS with MMR re-ranking.
    Chunk embeddings are computed exactly once per call and shared across
    MMR, semantic coherence, and diversity scoring.

    Returns:
        (chunks, sources, context, scores, faiss_ids, retrieval_metrics)
    """
    # 1) Embed the query
    try:
        query_vector = embed_texts([query])[0]
    except Exception as e:
        logger.error("Query embedding failed: %s", e)
        return [], [], "", [], [], {"error": 1.0}

    # 2) Search FAISS with higher K for re-ranking headroom
    search_k = min(TOP_K * 2, 20)
    try:
        scores, faiss_ids = search_vectors(query_vector, k=search_k)
    except Exception as e:
        logger.error("FAISS search failed: %s", e)
        return [], [], "", [], [], {"error": 1.0}

    # 3) Filter by minimum score and valid IDs
    valid_pairs = [
        (score, fid) for score, fid in zip(scores, faiss_ids)
        if score >= MIN_SCORE and fid >= 0
    ]
    if not valid_pairs:
        return [], [], "", [], [], {"no_results": 1.0}

    filtered_scores = [p[0] for p in valid_pairs]
    filtered_faiss_ids = [p[1] for p in valid_pairs]

    # 4) Fetch chunk details from database
    try:
        chunks = fetch_chunk_fn(filtered_faiss_ids)
    except Exception as e:
        logger.error("Database chunk fetch failed: %s", e)
        return [], [], "", [], [], {"db_error": 1.0}

    if not chunks:
        return [], [], "", [], [], {"no_chunks": 1.0}

    # 5) Compute chunk embeddings ONCE — reused by MMR, coherence, and diversity below
    _ensure_embeddings(chunks)

    # 6) Apply MMR re-ranking (uses cached embeddings)
    try:
        reranked_chunks, reranked_scores = mmr_rerank(chunks, filtered_scores, query_vector)
        final_chunks = reranked_chunks[:TOP_K]
        final_scores = reranked_scores[:TOP_K]
        final_faiss_ids = [c.get('faiss_id', -1) for c in final_chunks]
    except Exception as e:
        logger.warning("MMR re-ranking failed, using original order: %s", e)
        final_chunks = chunks[:TOP_K]
        final_scores = filtered_scores[:TOP_K]
        final_faiss_ids = filtered_faiss_ids[:TOP_K]

    # 7) Build context and sources with PII scrubbing
    context_parts = []
    sources = []
    for i, chunk in enumerate(final_chunks):
        clean_text = scrub(chunk.get('text', ''))
        context_parts.append(f"[{i+1}] {clean_text}")
        sources.append(f"[{i+1}] {chunk.get('title', 'Unknown Document')}")

    full_context = "\n\n".join(context_parts)
    if len(full_context) > MAX_CONTEXT_CHARS:
        full_context = full_context[:MAX_CONTEXT_CHARS] + "... [truncated]"

    # 8) Compute retrieval quality metrics (all reuse cached chunk embeddings)
    retrieval_metrics = {
        "context_relevance": compute_semantic_coherence(final_chunks, query_vector),
        "source_diversity": compute_diversity_score(final_chunks),
        "information_density": min(1.0, len(full_context) / MAX_CONTEXT_CHARS),
        "top_score": final_scores[0] if final_scores else 0.0,
        "score_variance": float(np.var(final_scores)) if len(final_scores) > 1 else 0.0,
        "chunks_returned": len(final_chunks),
    }

    # Clean up temporary embedding cache from chunk dicts before returning
    for c in chunks:
        c.pop('_emb', None)

    return final_chunks, sources, full_context, final_scores, final_faiss_ids, retrieval_metrics


def compute_confidence(
    scores: List[float],
    model_output: str,
    num_chunks: int,
    retrieval_metrics: Dict[str, float] = None,
) -> Tuple[float, Dict[str, float]]:
    """
    Compute comprehensive confidence score with detailed breakdown.
    Returns (overall_confidence, confidence_breakdown).
    """
    if not scores:
        return 0.0, {"error": "no_scores"}

    if retrieval_metrics is None:
        retrieval_metrics = {}

    # If retrieval itself failed, short-circuit to zero confidence
    if "error" in retrieval_metrics or "no_results" in retrieval_metrics or "no_chunks" in retrieval_metrics:
        breakdown = {"overall_confidence": 0.0, "retrieval_failed": True}
        return 0.0, breakdown

    # 1) Base retrieval confidence from similarity scores
    top_scores = sorted(scores, reverse=True)[:3]
    retrieval_confidence = max(0.0, min(1.0, sum(top_scores) / len(top_scores)))

    # 2) Citation coverage
    citations_found = set(re.findall(r'\[(\d+)\]', model_output))
    available_citations = set(str(i) for i in range(1, num_chunks + 1))
    citation_coverage = len(citations_found) / len(available_citations) if available_citations else 0.0
    citation_penalty = 0.0 if citations_found else 0.15

    # 3) Response completeness
    length_score = min(1.0, len(model_output.strip()) / 200)

    # 4) Uncertainty detection
    uncertainty_phrases = [
        "i don't have", "i'm not sure", "unclear", "uncertain",
        "may be", "might be", "possibly", "perhaps", "contact support"
    ]
    lower_output = model_output.lower()
    uncertainty_penalty = min(0.2, sum(0.05 for p in uncertainty_phrases if p in lower_output))

    # 5) Retrieval quality signals
    semantic_coherence = retrieval_metrics.get("context_relevance", 0.5)
    info_density = retrieval_metrics.get("information_density", 0.5)
    source_diversity = retrieval_metrics.get("source_diversity", 0.5)
    variance_bonus = min(0.1, retrieval_metrics.get("score_variance", 0.0) * 2)

    # 6) Weighted combination
    components = {
        "retrieval_quality": retrieval_confidence * 0.3,
        "citation_coverage": citation_coverage * 0.2,
        "semantic_coherence": semantic_coherence * 0.2,
        "response_completeness": length_score * 0.1,
        "information_density": info_density * 0.1,
        "source_diversity": source_diversity * 0.1,
        "variance_bonus": variance_bonus,
        "citation_penalty": -citation_penalty,
        "uncertainty_penalty": -uncertainty_penalty,
    }
    final_confidence = max(0.0, min(1.0, sum(components.values())))
    components["overall_confidence"] = final_confidence
    return final_confidence, components


def should_escalate(
    confidence: float,
    retrieval_metrics: Dict[str, float],
    model_output: str,
    conversation_length: int = 1,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Determine if a response should be escalated to a human.

    Escalation triggers:
    - Any single critical signal (no context, retrieval failure, explicit help request)
    - Two or more moderate signals combined
    """
    lower_output = model_output.lower()

    # Critical phrases that warrant immediate escalation regardless of other signals
    critical_phrases = ["contact support", "i don't have enough information"]
    critical_phrase_hit = any(p in lower_output for p in critical_phrases)

    # Individual signal evaluation
    signals = {
        "low_confidence": confidence < 0.55,
        "no_relevant_context": retrieval_metrics.get("context_relevance", 1.0) < 0.3,
        "retrieval_failed": "error" in retrieval_metrics or "no_results" in retrieval_metrics,
        "insufficient_chunks": retrieval_metrics.get("chunks_returned", 99) < 2,
        "high_uncertainty": "contact support" in lower_output,
        "long_conversation": conversation_length > 8,
    }

    # Critical single signals that escalate immediately (no 2+ requirement)
    critical_signals = {"no_relevant_context", "retrieval_failed", "insufficient_chunks"}
    triggered = [k for k, v in signals.items() if v]
    critical_triggered = [k for k in triggered if k in critical_signals]

    escalate = (
        critical_phrase_hit
        or bool(critical_triggered)       # Any single critical signal
        or len(triggered) >= 2             # Two or more moderate signals
    )

    reasons = list(triggered)
    if critical_phrase_hit:
        reasons.append("critical_phrase")

    return escalate, {
        "should_escalate": escalate,
        "triggered_signals": reasons,
        "signal_count": len(reasons),
        "confidence_threshold": 0.55,
        "reasoning": f"Escalation triggered by: {', '.join(reasons)}" if reasons else "No escalation signals",
    }
