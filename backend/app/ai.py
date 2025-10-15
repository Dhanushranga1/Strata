"""
AI module for Google Gemini integration in Phase 4.
Handles model selection, completion generation, and prompt management.
Enhanced with structured JSON schema validation and comprehensive error handling.
"""

import os
import json
import re
import google.generativeai as genai
import hashlib
import time
import json
import re
import os
from typing import Tuple, Dict, Any, Optional
from pydantic import BaseModel, ValidationError
from dotenv import load_dotenv
import logging

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Configuration from environment
PRIMARY_MODEL = os.getenv("GENAI_MODEL", "gemini-1.5-pro")
FLASH_MODEL = "gemini-1.5-flash"
PRO_MODEL = "gemini-1.5-pro"
FALLBACK_MODEL = "gemini-1.5-flash"
TEMPERATURE = float(os.getenv("GENAI_TEMPERATURE", "0.2"))
MAX_OUTPUT_TOKENS = int(os.getenv("GENAI_MAX_OUTPUT_TOKENS", "1024"))
CONTEXT_SIZE_THRESHOLD = 15000
FLASH_THRESHOLD_CHARS = 8000  # Use flash for smaller contexts for speed
PRO_THRESHOLD_CHARS = 20000   # Use pro for larger contexts for quality
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2.0

# JSON Schema for structured Gemini responses
class GeminiCitation(BaseModel):
    """Schema for individual citations in Gemini response"""
    index: int
    confidence: float
    relevance_score: float

class GeminiResponse(BaseModel):
    """Schema for structured Gemini response with comprehensive metadata"""
    response: str
    citations_used: list[GeminiCitation]
    confidence_indicators: Dict[str, float]
    escalation_signals: Dict[str, Any]
    retrieval_quality: Dict[str, float]
    reasoning_trace: Optional[str] = None

# Enhanced prompt templates with structured output requirements
SYSTEM_PROMPT = """You are TicketPilot AI, a friendly and expert customer support assistant.

PERSONALITY GUIDELINES:
- Start your response with a warm, helpful greeting when appropriate
- Use a conversational, empathetic tone while remaining professional
- Show genuine interest in helping resolve the customer's issue
- If the customer seems frustrated, acknowledge their feelings
- Celebrate small wins ("Great question!" "I'm happy to help with that!")

CRITICAL RESPONSE FORMAT:
You MUST respond with valid JSON matching this exact schema:
{
  "response": "Your helpful answer with proper [N] citations",
  "citations_used": [
    {"index": 1, "confidence": 0.95, "relevance_score": 0.87},
    {"index": 2, "confidence": 0.82, "relevance_score": 0.93}
  ],
  "confidence_indicators": {
    "source_quality": 0.85,
    "answer_completeness": 0.92,
    "semantic_coherence": 0.88,
    "citation_coverage": 0.95
  },
  "escalation_signals": {
    "requires_human": false,
    "uncertainty_level": "low",
    "complexity_score": 0.3,
    "missing_info": []
  },
  "retrieval_quality": {
    "context_relevance": 0.87,
    "source_diversity": 0.73,
    "information_density": 0.91
  },
  "reasoning_trace": "Brief explanation of reasoning process"
}

ANSWER GUIDELINES:
- Use ONLY provided context sources
- Include [N] citations for every factual claim (these will be styled in bold blue)
- Be concise but comprehensive
- If insufficient information, indicate clearly in escalation_signals
- Provide confidence scores between 0.0-1.0 for all metrics
- Set requires_human=true if answer requires human expertise"""

def init_genai():
    """Initialize Google Generative AI with API key."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is required in environment")
    genai.configure(api_key=api_key)

def validate_gemini_response(response_text: str) -> Optional[GeminiResponse]:
    """
    Validate and parse structured JSON response from Gemini.
    
    Args:
        response_text: Raw response text from Gemini
        
    Returns:
        Validated GeminiResponse object or None if invalid
    """
    try:
        # Extract JSON from response (handle markdown code blocks)
        json_text = response_text.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]
        if json_text.endswith("```"):
            json_text = json_text[:-3]
        json_text = json_text.strip()
        
        # Parse JSON
        parsed = json.loads(json_text)
        
        # Validate with Pydantic schema
        return GeminiResponse.model_validate(parsed)
        
    except (json.JSONDecodeError, ValidationError) as e:
        logger.warning(f"Failed to validate Gemini response: {e}")
        return None

def generate_structured_completion(context: str, question: str, sources: list[str]) -> Tuple[GeminiResponse, int]:
    """
    Generate structured completion from Gemini with comprehensive validation.
    
    Args:
        context: RAG context with numbered sources
        question: User's question
        sources: List of source labels for citations
        
    Returns:
        Tuple of (validated_response, latency_ms)
    """
    init_genai()
    
    # Build comprehensive prompt
    prompt = f"""{SYSTEM_PROMPT}

CONTEXT:
{context}

SOURCES:
{chr(10).join(sources)}

USER QUESTION: {question}

RESPOND WITH VALID JSON ONLY:"""
    
    start_time = time.time()
    
    # Try with retries for structured response
    for attempt in range(MAX_RETRY_ATTEMPTS):
        try:
            # Select model based on context size
            total_chars = len(prompt)
            model_name = select_model(total_chars)
            model = genai.GenerativeModel(model_name)
            
            # Generate response
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=2048,
                    response_mime_type="application/json"
                )
            )
            
            if not response.text:
                raise ValueError("Empty response from Gemini")
            
            # Validate structured response
            validated = validate_gemini_response(response.text)
            if validated:
                latency_ms = int((time.time() - start_time) * 1000)
                return validated, latency_ms
            
            logger.warning(f"Invalid JSON response on attempt {attempt + 1}")
            
        except Exception as e:
            logger.error(f"Generation attempt {attempt + 1} failed: {e}")
            if attempt < MAX_RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY_SECONDS)
    
    # Fallback to basic response if structured fails
    logger.error("All structured attempts failed, falling back to basic response")
    return generate_fallback_response(context, question, sources, start_time)

def generate_fallback_response(context: str, question: str, sources: list[str], start_time: float) -> Tuple[GeminiResponse, int]:
    """
    Generate fallback response when structured generation fails.
    
    Args:
        context: RAG context
        question: User question  
        sources: Source labels
        start_time: Original start time for latency calculation
        
    Returns:
        Tuple of (fallback_response, latency_ms)
    """
    try:
        # Use simple prompt for fallback
        simple_prompt = f"""Answer this question using only the provided context:

CONTEXT: {context}

QUESTION: {question}

Answer concisely with [N] citations:"""
        
        model = genai.GenerativeModel(FLASH_MODEL)
        response = model.generate_content(simple_prompt)
        
        # Create minimal structured response
        fallback = GeminiResponse(
            response=response.text or "I apologize, but I'm unable to process your request right now.",
            citations_used=[],
            confidence_indicators={
                "source_quality": 0.5,
                "answer_completeness": 0.3,
                "semantic_coherence": 0.4,
                "citation_coverage": 0.2
            },
            escalation_signals={
                "requires_human": True,
                "uncertainty_level": "high",
                "complexity_score": 0.9,
                "missing_info": ["structured_response_failed"]
            },
            retrieval_quality={
                "context_relevance": 0.5,
                "source_diversity": 0.5,
                "information_density": 0.5
            },
            reasoning_trace="Fallback response due to structured generation failure"
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        return fallback, latency_ms
        
    except Exception as e:
        logger.error(f"Fallback generation also failed: {e}")
        
        # Ultimate fallback
        error_response = GeminiResponse(
            response="I'm experiencing technical difficulties. Please contact support for assistance.",
            citations_used=[],
            confidence_indicators={
                "source_quality": 0.0,
                "answer_completeness": 0.0,
                "semantic_coherence": 0.0,
                "citation_coverage": 0.0
            },
            escalation_signals={
                "requires_human": True,
                "uncertainty_level": "critical",
                "complexity_score": 1.0,
                "missing_info": ["generation_system_failure"]
            },
            retrieval_quality={
                "context_relevance": 0.0,
                "source_diversity": 0.0,
                "information_density": 0.0
            },
            reasoning_trace="System failure - no generation possible"
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        return error_response, latency_ms

def select_model(context_size: int) -> str:
    """
    Select the appropriate Gemini model based on context size.
    
    Args:
        context_size: Total character count of the input context
        
    Returns:
        str: The selected model name
    """
    if context_size <= FLASH_THRESHOLD_CHARS:
        logger.debug(f"Using flash model for context size: {context_size}")
        return FALLBACK_MODEL
    else:
        logger.debug(f"Using pro model for context size: {context_size}")
        return PRIMARY_MODEL

def generate_completion(context: str, question: str, sources: list[str]) -> Tuple[str, int]:
    """
    Generate AI completion using structured Gemini response (backward compatible).
    
    Args:
        context: Retrieved context from knowledge base
        question: User's question
        sources: List of source labels for citations
        
    Returns:
        Tuple of (generated_text, latency_ms)
    """
    try:
        # Use new structured generation
        structured_response, latency_ms = generate_structured_completion(context, question, sources)
        return structured_response.response, latency_ms
    except Exception as e:
        logger.error(f"Structured generation failed, using fallback: {e}")
        
        # Fallback to original simple generation
        init_genai()
        start_time = time.time()
        
        # Build simple prompt
        sources_text = "\n".join(f"[{i+1}] {source}" for i, source in enumerate(sources))
        
        simple_prompt = f"""Answer this question using only the provided context:

CONTEXT:
{context}

SOURCES:
{sources_text}

QUESTION: {question}

Answer concisely with [N] citations:"""
        
        try:
            model = genai.GenerativeModel(FLASH_MODEL)
            response = model.generate_content(simple_prompt)
            
            latency_ms = int((time.time() - start_time) * 1000)
            return response.text or "I'm unable to process your request.", latency_ms
            
        except Exception as fallback_error:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Even fallback generation failed: {fallback_error}")
            return "I'm experiencing technical difficulties. Please contact support.", latency_ms

def compute_prompt_hash(context: str, question: str) -> str:
    """Compute hash of prompt for observability."""
    combined = f"{context}\n---\n{question}"
    return hashlib.sha256(combined.encode()).hexdigest()[:16]