"""
AI module — Groq LLM integration for RAG response generation.
Handles completion generation and prompt management via Groq's
OpenAI-compatible API using httpx (no extra dependency needed).
"""

import os
import re
import json
import time
import hashlib
import logging
import httpx
from typing import Tuple, Dict, Any, Optional
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
TEMPERATURE = float(os.getenv("GENAI_TEMPERATURE", "0.2"))
MAX_OUTPUT_TOKENS = int(os.getenv("GENAI_MAX_OUTPUT_TOKENS", "1024"))
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2.0


class GeminiCitation(BaseModel):
    index: int
    confidence: float
    relevance_score: float


class GeminiResponse(BaseModel):
    response: str
    citations_used: list[GeminiCitation]
    confidence_indicators: Dict[str, float]
    escalation_signals: Dict[str, Any]
    retrieval_quality: Dict[str, float]
    reasoning_trace: Optional[str] = None


SYSTEM_PROMPT = """You are TicketPilot AI, a friendly and expert customer support assistant.

PERSONALITY GUIDELINES:
- Start your response with a warm, helpful greeting when appropriate
- Use a conversational, empathetic tone while remaining professional
- Show genuine interest in helping resolve the customer's issue
- If the customer seems frustrated, acknowledge their feelings

CRITICAL RESPONSE FORMAT:
You MUST respond with valid JSON matching this exact schema:
{
  "response": "Your helpful answer with proper [N] citations",
  "citations_used": [
    {"index": 1, "confidence": 0.95, "relevance_score": 0.87}
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
- Include [N] citations for every factual claim
- Be concise but comprehensive
- If insufficient information, indicate clearly in escalation_signals
- Provide confidence scores between 0.0-1.0 for all metrics
- Set requires_human=true if answer requires human expertise"""


def _get_api_key() -> str:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is required in environment")
    return key


def _call_groq(prompt: str, json_mode: bool = True) -> str:
    api_key = _get_api_key()
    payload: Dict[str, Any] = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": TEMPERATURE,
        "max_tokens": MAX_OUTPUT_TOKENS,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def validate_gemini_response(response_text: str) -> Optional[GeminiResponse]:
    try:
        json_text = response_text.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]
        if json_text.endswith("```"):
            json_text = json_text[:-3]
        json_text = json_text.strip()
        parsed = json.loads(json_text)
        return GeminiResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as e:
        logger.warning(f"Failed to validate response: {e}")
        return None


def generate_structured_completion(context: str, question: str, sources: list[str]) -> Tuple[GeminiResponse, int]:
    prompt = f"""{SYSTEM_PROMPT}

CONTEXT:
{context}

SOURCES:
{chr(10).join(sources)}

USER QUESTION: {question}

RESPOND WITH VALID JSON ONLY:"""

    start_time = time.time()

    for attempt in range(MAX_RETRY_ATTEMPTS):
        try:
            text = _call_groq(prompt, json_mode=True)
            if not text:
                raise ValueError("Empty response from Groq")
            validated = validate_gemini_response(text)
            if validated:
                latency_ms = int((time.time() - start_time) * 1000)
                return validated, latency_ms
            logger.warning(f"Invalid JSON on attempt {attempt + 1}")
        except Exception as e:
            logger.error(f"Generation attempt {attempt + 1} failed: {e}")
            if attempt < MAX_RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY_SECONDS)

    logger.error("All structured attempts failed, falling back to basic response")
    return generate_fallback_response(context, question, sources, start_time)


def generate_fallback_response(context: str, question: str, sources: list[str], start_time: float) -> Tuple[GeminiResponse, int]:
    try:
        simple_prompt = f"""Answer this question using only the provided context:

CONTEXT: {context}

QUESTION: {question}

Answer concisely with [N] citations:"""

        text = _call_groq(simple_prompt, json_mode=False)

        fallback = GeminiResponse(
            response=text or "I apologize, but I'm unable to process your request right now.",
            citations_used=[],
            confidence_indicators={"source_quality": 0.5, "answer_completeness": 0.3, "semantic_coherence": 0.4, "citation_coverage": 0.2},
            escalation_signals={"requires_human": True, "uncertainty_level": "high", "complexity_score": 0.9, "missing_info": ["structured_response_failed"]},
            retrieval_quality={"context_relevance": 0.5, "source_diversity": 0.5, "information_density": 0.5},
            reasoning_trace="Fallback response due to structured generation failure",
        )
        latency_ms = int((time.time() - start_time) * 1000)
        return fallback, latency_ms

    except Exception as e:
        logger.error(f"Fallback generation also failed: {e}")
        error_response = GeminiResponse(
            response="I'm experiencing technical difficulties. Please contact support for assistance.",
            citations_used=[],
            confidence_indicators={"source_quality": 0.0, "answer_completeness": 0.0, "semantic_coherence": 0.0, "citation_coverage": 0.0},
            escalation_signals={"requires_human": True, "uncertainty_level": "critical", "complexity_score": 1.0, "missing_info": ["generation_system_failure"]},
            retrieval_quality={"context_relevance": 0.0, "source_diversity": 0.0, "information_density": 0.0},
            reasoning_trace="System failure - no generation possible",
        )
        latency_ms = int((time.time() - start_time) * 1000)
        return error_response, latency_ms


def select_model(context_size: int) -> str:
    return MODEL


def generate_completion(context: str, question: str, sources: list[str]) -> Tuple[str, int]:
    try:
        structured_response, latency_ms = generate_structured_completion(context, question, sources)
        return structured_response.response, latency_ms
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        return "I'm experiencing technical difficulties. Please contact support.", 0


def compute_prompt_hash(context: str, question: str) -> str:
    combined = f"{context}\n---\n{question}"
    return hashlib.sha256(combined.encode()).hexdigest()[:16]
