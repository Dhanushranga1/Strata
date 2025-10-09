"""
RAG retrieval module for Phase 4.
Handles embedding queries, FAISS search, context building, and advanced confidence scoring.
Enhanced with MMR re-ranking, semantic coherence analysis, and comprehensive metrics.
"""

import os
import re
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from .embeddings import embed_texts
from .store import search_vectors
from .redact import scrub

# Configuration from environment
TOP_K = int(os.getenv("RAG_TOP_K", "6"))
MIN_SCORE = float(os.getenv("RAG_MIN_SCORE", "0.25"))
MAX_CONTEXT_CHARS = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "12000"))
MMR_LAMBDA = float(os.getenv("MMR_LAMBDA", "0.7"))  # Balance relevance vs diversity
DIVERSITY_PENALTY = float(os.getenv("DIVERSITY_PENALTY", "0.3"))

def compute_semantic_coherence(chunks: List[Dict], query_embedding: List[float]) -> float:
    """
    Compute semantic coherence score between retrieved chunks and query.
    
    Args:
        chunks: Retrieved chunks with text
        query_embedding: Query embedding vector
        
    Returns:
        Coherence score between 0 and 1
    """
    if not chunks:
        return 0.0
    
    try:
        # Get embeddings for chunk texts
        chunk_texts = [chunk.get('text', '') for chunk in chunks]
        chunk_embeddings = embed_texts(chunk_texts)
        
        # Compute cosine similarities with query
        query_norm = np.linalg.norm(query_embedding)
        if query_norm == 0:
            return 0.0
        
        similarities = []
        for chunk_emb in chunk_embeddings:
            chunk_norm = np.linalg.norm(chunk_emb)
            if chunk_norm > 0:
                sim = np.dot(query_embedding, chunk_emb) / (query_norm * chunk_norm)
                similarities.append(sim)
        
        return float(np.mean(similarities)) if similarities else 0.0
        
    except Exception as e:
        print(f"Semantic coherence computation error: {e}")
        return 0.5  # Neutral score on error

def compute_diversity_score(chunks: List[Dict]) -> float:
    """
    Compute diversity score among retrieved chunks.
    
    Args:
        chunks: Retrieved chunks with text
        
    Returns:
        Diversity score between 0 and 1 (higher = more diverse)
    """
    if len(chunks) < 2:
        return 1.0  # Single chunk is perfectly "diverse"
    
    try:
        # Get embeddings for chunks
        chunk_texts = [chunk.get('text', '') for chunk in chunks]
        chunk_embeddings = embed_texts(chunk_texts)
        
        # Compute pairwise similarities
        similarities = []
        for i in range(len(chunk_embeddings)):
            for j in range(i + 1, len(chunk_embeddings)):
                emb1, emb2 = chunk_embeddings[i], chunk_embeddings[j]
                norm1, norm2 = np.linalg.norm(emb1), np.linalg.norm(emb2)
                
                if norm1 > 0 and norm2 > 0:
                    sim = np.dot(emb1, emb2) / (norm1 * norm2)
                    similarities.append(sim)
        
        # Diversity is inverse of average similarity
        avg_similarity = np.mean(similarities) if similarities else 0.0
        return max(0.0, 1.0 - avg_similarity)
        
    except Exception as e:
        print(f"Diversity computation error: {e}")
        return 0.5  # Neutral score on error

def mmr_rerank(chunks: List[Dict], scores: List[float], query_embedding: List[float], 
               lambda_param: float = MMR_LAMBDA) -> Tuple[List[Dict], List[float]]:
    """
    Re-rank chunks using Maximal Marginal Relevance to balance relevance and diversity.
    
    Args:
        chunks: Original retrieved chunks
        scores: Original relevance scores
        query_embedding: Query embedding vector
        lambda_param: Balance parameter (0=diversity only, 1=relevance only)
        
    Returns:
        Tuple of (reranked_chunks, reranked_scores)
    """
    if not chunks or len(chunks) <= 1:
        return chunks, scores
    
    try:
        # Get embeddings for all chunks
        chunk_texts = [chunk.get('text', '') for chunk in chunks]
        chunk_embeddings = embed_texts(chunk_texts)
        
        # Initialize with highest scoring chunk
        selected_indices = [0]
        remaining_indices = list(range(1, len(chunks)))
        
        # Iteratively select chunks with MMR
        while remaining_indices and len(selected_indices) < len(chunks):
            best_score = -float('inf')
            best_idx = None
            
            for idx in remaining_indices:
                # Relevance score (normalized)
                relevance = scores[idx]
                
                # Compute maximum similarity to already selected chunks
                max_sim = 0.0
                for sel_idx in selected_indices:
                    emb1, emb2 = chunk_embeddings[idx], chunk_embeddings[sel_idx]
                    norm1, norm2 = np.linalg.norm(emb1), np.linalg.norm(emb2)
                    
                    if norm1 > 0 and norm2 > 0:
                        sim = np.dot(emb1, emb2) / (norm1 * norm2)
                        max_sim = max(max_sim, sim)
                
                # MMR score: λ * relevance - (1-λ) * max_similarity
                mmr_score = lambda_param * relevance - (1 - lambda_param) * max_sim
                
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx
            
            if best_idx is not None:
                selected_indices.append(best_idx)
                remaining_indices.remove(best_idx)
        
        # Reorder chunks and scores
        reranked_chunks = [chunks[i] for i in selected_indices]
        reranked_scores = [scores[i] for i in selected_indices]
        
        return reranked_chunks, reranked_scores
        
    except Exception as e:
        print(f"MMR reranking error: {e}")
        return chunks, scores  # Return original order on error

def retrieve(query: str, fetch_chunk_fn) -> Tuple[List[Dict], List[str], str, List[float], List[int], Dict[str, float]]:
    """
    Retrieve relevant chunks for a query using FAISS with MMR re-ranking.
    
    Args:
        query: User's question
        fetch_chunk_fn: Function to fetch chunk details by faiss_ids
        
    Returns:
        Tuple of (chunks, sources, context, scores, faiss_ids, retrieval_metrics)
    """
    # 1) Embed the query
    try:
        query_vector = embed_texts([query])[0]
    except Exception as e:
        print(f"Embedding error: {e}")
        return [], [], "", [], [], {"error": 1.0}
    
    # 2) Search FAISS index with higher K for re-ranking
    search_k = min(TOP_K * 2, 20)  # Search more for better re-ranking
    try:
        scores, faiss_ids = search_vectors(query_vector, k=search_k)
    except Exception as e:
        print(f"FAISS search error: {e}")
        return [], [], "", [], [], {"error": 1.0}
    
    # 3) Filter by minimum score and valid IDs
    valid_pairs = []
    for score, faiss_id in zip(scores, faiss_ids):
        if score >= MIN_SCORE and faiss_id >= 0:
            valid_pairs.append((score, faiss_id))
    
    if not valid_pairs:
        return [], [], "", [], [], {"no_results": 1.0}
    
    # Extract filtered scores and IDs
    filtered_scores = [pair[0] for pair in valid_pairs]
    filtered_faiss_ids = [pair[1] for pair in valid_pairs]
    
    # 4) Fetch chunk details from database
    try:
        chunks = fetch_chunk_fn(filtered_faiss_ids)
    except Exception as e:
        print(f"Database fetch error: {e}")
        return [], [], "", [], [], {"db_error": 1.0}
    
    if not chunks:
        return [], [], "", [], [], {"no_chunks": 1.0}
    
    # 5) Apply MMR re-ranking for diversity
    try:
        reranked_chunks, reranked_scores = mmr_rerank(chunks, filtered_scores, query_vector)
        
        # Limit to TOP_K after re-ranking
        final_chunks = reranked_chunks[:TOP_K]
        final_scores = reranked_scores[:TOP_K]
        final_faiss_ids = [chunk.get('faiss_id', -1) for chunk in final_chunks]
        
    except Exception as e:
        print(f"MMR re-ranking error: {e}")
        # Fallback to original order
        final_chunks = chunks[:TOP_K]
        final_scores = filtered_scores[:TOP_K]
        final_faiss_ids = filtered_faiss_ids[:TOP_K]
    
    # 6) Build context and sources with PII scrubbing
    context_parts = []
    sources = []
    
    for i, chunk in enumerate(final_chunks):
        # PII scrub the chunk text
        clean_text = scrub(chunk.get('text', ''))
        
        # Add to context
        context_parts.append(f"[{i+1}] {clean_text}")
        
        # Create source label
        title = chunk.get('title', 'Unknown Document')
        source_label = f"[{i+1}] {title}"
        sources.append(source_label)
    
    # 7) Combine context with character limit
    full_context = "\n\n".join(context_parts)
    if len(full_context) > MAX_CONTEXT_CHARS:
        # Truncate while preserving structure
        full_context = full_context[:MAX_CONTEXT_CHARS] + "... [truncated]"
    
    # 8) Compute retrieval quality metrics
    retrieval_metrics = {
        "context_relevance": compute_semantic_coherence(final_chunks, query_vector),
        "source_diversity": compute_diversity_score(final_chunks),
        "information_density": min(1.0, len(full_context) / MAX_CONTEXT_CHARS),
        "top_score": final_scores[0] if final_scores else 0.0,
        "score_variance": float(np.var(final_scores)) if len(final_scores) > 1 else 0.0,
        "chunks_returned": len(final_chunks)
    }
    
    return final_chunks, sources, full_context, final_scores, final_faiss_ids, retrieval_metrics
    
    # Extract filtered scores and IDs
    filtered_scores = [pair[0] for pair in valid_pairs]
    filtered_faiss_ids = [pair[1] for pair in valid_pairs]
    
    # 4) Fetch chunk details from database
    try:
        chunks = fetch_chunk_fn(filtered_faiss_ids)
    except Exception as e:
        print(f"Database fetch error: {e}")
        return [], [], "", [], []
    
    if not chunks:
        return [], [], "", [], []
    
    # 5) Build context and sources with PII scrubbing
    context_parts = []
    sources = []
    
    for i, chunk in enumerate(chunks):
        # PII scrub the chunk text
        clean_text = scrub(chunk.get('text', ''))
        
        # Add to context
        context_parts.append(f"[{i+1}] {clean_text}")
        
        # Create source label
        title = chunk.get('title', 'Unknown Document')
        source_label = f"[{i+1}] {title}"
        sources.append(source_label)
    
    # 6) Combine context with character limit
    full_context = "\n\n".join(context_parts)
    if len(full_context) > MAX_CONTEXT_CHARS:
        # Truncate while preserving structure
        full_context = full_context[:MAX_CONTEXT_CHARS] + "... [truncated]"
    
    return chunks, sources, full_context, filtered_scores, filtered_faiss_ids

def compute_confidence(scores: List[float], model_output: str, num_chunks: int, 
                      retrieval_metrics: Dict[str, float] = None) -> Tuple[float, Dict[str, float]]:
    """
    Compute comprehensive confidence score with detailed breakdown.
    
    Args:
        scores: FAISS similarity scores
        model_output: Generated text from LLM
        num_chunks: Number of retrieved chunks
        retrieval_metrics: Retrieval quality metrics from retrieve()
        
    Returns:
        Tuple of (overall_confidence, confidence_breakdown)
    """
    if not scores:
        return 0.0, {"error": "no_scores"}
    
    # Initialize retrieval metrics if not provided
    if retrieval_metrics is None:
        retrieval_metrics = {}
    
    # 1) Base retrieval confidence from similarity scores
    top_scores = sorted(scores, reverse=True)[:3]
    retrieval_confidence = sum(top_scores) / len(top_scores)
    retrieval_confidence = max(0.0, min(1.0, retrieval_confidence))
    
    # 2) Citation coverage analysis
    citation_pattern = r'\[(\d+)\]'
    citations_found = set(re.findall(citation_pattern, model_output))
    available_citations = set(str(i) for i in range(1, num_chunks + 1))
    
    if available_citations:
        citation_coverage = len(citations_found) / len(available_citations)
    else:
        citation_coverage = 0.0
    
    # Penalty for no citations
    citation_penalty = 0.0 if citations_found else 0.15
    
    # 3) Response completeness heuristics
    response_length = len(model_output.strip())
    length_score = min(1.0, response_length / 200)  # Normalize around 200 chars
    
    # Check for uncertainty indicators
    uncertainty_phrases = [
        "i don't have", "i'm not sure", "unclear", "uncertain",
        "may be", "might be", "possibly", "perhaps", "contact support"
    ]
    uncertainty_penalty = 0.0
    lower_output = model_output.lower()
    for phrase in uncertainty_phrases:
        if phrase in lower_output:
            uncertainty_penalty += 0.05
    uncertainty_penalty = min(0.2, uncertainty_penalty)
    
    # 4) Semantic coherence with retrieval
    semantic_coherence = retrieval_metrics.get("context_relevance", 0.5)
    
    # 5) Information density and diversity
    info_density = retrieval_metrics.get("information_density", 0.5)
    source_diversity = retrieval_metrics.get("source_diversity", 0.5)
    
    # 6) Score variance penalty (low variance = all similar scores = less confident)
    score_variance = retrieval_metrics.get("score_variance", 0.0)
    variance_bonus = min(0.1, score_variance * 2)  # Small bonus for score diversity
    
    # 7) Weighted combination of factors
    confidence_components = {
        "retrieval_quality": retrieval_confidence * 0.3,
        "citation_coverage": citation_coverage * 0.2,
        "semantic_coherence": semantic_coherence * 0.2,
        "response_completeness": length_score * 0.1,
        "information_density": info_density * 0.1,
        "source_diversity": source_diversity * 0.1,
        "variance_bonus": variance_bonus,
        "citation_penalty": -citation_penalty,
        "uncertainty_penalty": -uncertainty_penalty
    }
    
    # Calculate final confidence
    final_confidence = sum(confidence_components.values())
    final_confidence = max(0.0, min(1.0, final_confidence))
    
    # Add overall score to breakdown
    confidence_components["overall_confidence"] = final_confidence
    
    return final_confidence, confidence_components

def should_escalate(confidence: float, retrieval_metrics: Dict[str, float], 
                   model_output: str, conversation_length: int = 1) -> Tuple[bool, Dict[str, Any]]:
    """
    Determine if response should be escalated to human with reasoning.
    
    Args:
        confidence: Overall confidence score
        retrieval_metrics: Retrieval quality metrics
        model_output: Generated response text
        conversation_length: Number of messages in conversation
        
    Returns:
        Tuple of (should_escalate, escalation_reasoning)
    """
    escalation_signals = {
        "low_confidence": confidence < 0.55,
        "no_relevant_context": retrieval_metrics.get("context_relevance", 0.0) < 0.3,
        "insufficient_chunks": retrieval_metrics.get("chunks_returned", 0) < 2,
        "high_uncertainty": "contact support" in model_output.lower(),
        "long_conversation": conversation_length > 8,
        "complex_query": len(model_output.split()) > 150
    }
    
    # Determine escalation with reasoning
    reasons = [key for key, triggered in escalation_signals.items() if triggered]
    should_escalate = len(reasons) >= 2  # Escalate if multiple signals
    
    # Override: always escalate for critical uncertainty phrases
    critical_phrases = ["contact support", "i don't have enough information"]
    if any(phrase in model_output.lower() for phrase in critical_phrases):
        should_escalate = True
        reasons.append("critical_uncertainty_phrase")
    
    escalation_info = {
        "should_escalate": should_escalate,
        "triggered_signals": reasons,
        "signal_count": len(reasons),
        "confidence_threshold": 0.55,
        "reasoning": f"Escalation triggered by: {', '.join(reasons)}" if reasons else "No escalation signals"
    }
    
    return should_escalate, escalation_info