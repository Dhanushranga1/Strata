"""
AI generation — provider-agnostic. Provider auto-detected from model name prefix.
Settings resolved from DB (via ai_settings.py) first, env vars as fallback.
"""

import hashlib
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pydantic import BaseModel, ValidationError

from .ai_settings import gen_api_base, gen_api_key, gen_model, max_tokens, temperature

logger = logging.getLogger(__name__)

MAX_RETRY_ATTEMPTS = 2
RETRY_DELAY_SECONDS = 2.0
RETRY_DELAY_429_SECONDS = 8.0
LLM_RETRY_ATTEMPTS = 3
# HTTP statuses worth retrying — identical semantics across providers
# (Google, OpenAI-compat, Groq, Anthropic all speak HTTP status codes)
RETRYABLE_STATUS = {429, 500, 502, 503, 529}
# Total wall-clock budget for structured + fallback generation. A provider
# outage must not hold a worker thread for minutes — chat runs on a
# bounded threadpool, so slow LLM ladders serialize all traffic.
AI_GENERATION_DEADLINE_SECONDS = float(
    os.getenv("AI_GENERATION_DEADLINE_SECONDS", "45")
)


class Citation(BaseModel):
    index: int
    confidence: float
    relevance_score: float


class GeminiResponse(BaseModel):
    response: str
    citations_used: list[Citation]
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


# ── Provider detection ──────────────────────────────────────


def _detect_provider(model: str) -> str:
    if model.startswith("gemini-"):
        return "google"
    if model.startswith("claude-"):
        return "anthropic"
    return "openai_compat"


def _call_llm(prompt: str, json_mode: bool = True, timeout_s: float = 30.0) -> str:
    """Single LLM call — no retries. Use _call_llm_with_retry for 429/5xx."""
    model = gen_model()
    provider = _detect_provider(model)
    temp = temperature()
    max_tok = max_tokens()

    if provider == "google":
        key = gen_api_key()
        # Key goes in the x-goog-api-key header, NOT the URL — httpx logs
        # request URLs at INFO level, so query-param keys leak into logs
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        payload = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temp, "maxOutputTokens": max_tok},
        }
        if model.startswith(("gemini-3", "gemini-2.5")):
            # Thinking models spend maxOutputTokens on hidden reasoning —
            # with the default budget the JSON gets truncated mid-object
            payload["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 0}
        if json_mode:
            payload["generationConfig"]["response_mime_type"] = "application/json"
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": key,
                },
                json=payload,
            )
            resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]

    if provider == "anthropic":
        key = gen_api_key()
        payload = {
            "model": model,
            "max_tokens": max_tok,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}],
        }
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
        return resp.json()["content"][0]["text"]

    # OpenAI-compatible (Groq, Together, OpenAI, etc.)
    key = gen_api_key()
    base_url = (gen_api_base() or "https://api.groq.com/openai/v1").rstrip("/")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": temp,
        "max_tokens": max_tok,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    with httpx.Client(timeout=timeout_s) as client:
        resp = client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


# ── Response parsing ────────────────────────────────────────


def _call_llm_with_retry(
    prompt: str,
    json_mode: bool = True,
    timeout_s: float = 30.0,
    attempts: int = LLM_RETRY_ATTEMPTS,
    deadline: Optional[float] = None,
) -> str:
    """LLM call with 3 attempts on transient provider errors.

    Retries 429 (rate limit) and 5xx (capacity — e.g. Google's 503s)
    with exponential backoff (1s/2s/4s), honoring a Retry-After header
    when the provider sends one. Provider-agnostic: every supported
    provider signals these conditions via HTTP status codes. Raises
    the last error when attempts are exhausted.
    """
    last_exc: Exception = RuntimeError("LLM call never attempted")
    for attempt in range(attempts):
        if deadline is not None and time.time() > deadline - 5:
            logger.warning("LLM retry budget exhausted before attempt %d", attempt + 1)
            break
        try:
            return _call_llm(prompt, json_mode=json_mode, timeout_s=timeout_s)
        except httpx.HTTPStatusError as e:
            status = e.response.status_code if e.response is not None else 0
            if status not in RETRYABLE_STATUS:
                raise  # 400/401/403/404 — config or auth problem, don't retry
            last_exc = e
            logger.warning(
                "LLM %s on attempt %d/%d (status %d)",
                type(e).__name__,
                attempt + 1,
                attempts,
                status,
            )
        except (httpx.TimeoutException, httpx.TransportError) as e:
            last_exc = e
            logger.warning(
                "LLM %s on attempt %d/%d", type(e).__name__, attempt + 1, attempts
            )

        if attempt < attempts - 1:
            backoff = float(2**attempt)
            retry_after = None
            resp = getattr(last_exc, "response", None)
            if resp is not None:
                retry_after = resp.headers.get("retry-after")
            if retry_after and retry_after.replace(".", "").isdigit():
                backoff = min(backoff, float(retry_after))
            if deadline is not None:
                backoff = min(backoff, max(0.0, deadline - time.time()))
            time.sleep(backoff)
    raise last_exc


def validate_response(text: str) -> Optional[GeminiResponse]:
    try:
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return GeminiResponse.model_validate(json.loads(cleaned.strip()))
    except (json.JSONDecodeError, ValidationError) as e:
        logger.warning(f"Response validation failed: {e}")
        return None


# ── Generation ──────────────────────────────────────────────


def generate_structured_completion(
    context: str,
    question: str,
    sources: list[str],
    ticket_context: str = "",
    conversation_history: str = "",
) -> Tuple[GeminiResponse, int]:
    extra_sections = ""
    if ticket_context:
        extra_sections += f"\nTICKET:\n{ticket_context}\n"
    if conversation_history:
        extra_sections += (
            f"\nCONVERSATION SO FAR (oldest first; the USER QUESTION below "
            f"is the latest turn):\n{conversation_history}\n"
        )
    prompt = f"""{SYSTEM_PROMPT}
{extra_sections}
CONTEXT:
{context}

SOURCES:
{chr(10).join(sources)}

USER QUESTION: {question}

RESPOND WITH VALID JSON ONLY:"""
    start = time.time()
    deadline = start + AI_GENERATION_DEADLINE_SECONDS
    for attempt in range(MAX_RETRY_ATTEMPTS):
        if time.time() > deadline - 10:
            logger.warning("Generation deadline hit before attempt %d", attempt + 1)
            break
        try:
            text = _call_llm_with_retry(prompt, json_mode=True, deadline=deadline)
            validated = validate_response(text) if text else None
            if validated:
                return validated, int((time.time() - start) * 1000)
            logger.warning(f"Invalid response on attempt {attempt + 1}")
        except Exception as e:
            is_429 = (
                hasattr(e, "response") and getattr(e.response, "status_code", 0) == 429
            )
            logger.error(f"Generation attempt {attempt + 1} failed: {e}")
            if attempt < MAX_RETRY_ATTEMPTS - 1:
                time.sleep(
                    min(
                        15.0 if is_429 else RETRY_DELAY_SECONDS,
                        max(0.0, deadline - time.time()),
                    )
                )
    logger.error("All structured attempts failed")
    return generate_fallback_response(
        context, question, sources, deadline, ticket_context, conversation_history
    )


def generate_fallback_response(
    context: str,
    question: str,
    sources: list[str],
    deadline: float,
    ticket_context: str = "",
    conversation_history: str = "",
) -> Tuple[GeminiResponse, int]:
    # No LLM call when the generation budget is exhausted — return the
    # canned response so the request fails fast instead of hanging.
    if time.time() > deadline - 10:
        return (
            _canned_fallback(
                "Unable to process your request right now.",
                "Generation deadline exhausted",
            ),
            0,
        )
    try:
        extra = ""
        if ticket_context:
            extra += f"\nTICKET:\n{ticket_context}\n"
        if conversation_history:
            extra += f"\nCONVERSATION SO FAR:\n{conversation_history}\n"
        text = _call_llm_with_retry(
            f"Answer concisely with [N] citations using this context:\n{extra}\n\n{context}\n\nQuestion: {question}",
            json_mode=False,
            deadline=deadline,
        )
        fb = GeminiResponse(
            response=text or "Unable to process your request.",
            citations_used=[],
            confidence_indicators={
                "source_quality": 0.5,
                "answer_completeness": 0.3,
                "semantic_coherence": 0.4,
                "citation_coverage": 0.2,
            },
            escalation_signals={
                "requires_human": True,
                "uncertainty_level": "high",
                "complexity_score": 0.9,
                "missing_info": ["structured_response_failed"],
            },
            retrieval_quality={
                "context_relevance": 0.5,
                "source_diversity": 0.5,
                "information_density": 0.5,
            },
            reasoning_trace="Fallback due to structured generation failure",
        )
        return fb, int(
            (time.time() - (deadline - AI_GENERATION_DEADLINE_SECONDS)) * 1000
        )
    except Exception as e:
        logger.error(f"Fallback failed: {e}")
        return (
            _canned_fallback(
                "Technical difficulties. Please contact support.",
                "System failure",
            ),
            0,
        )


def _canned_fallback(response_text: str, reasoning: str) -> GeminiResponse:
    """Zero-cost degraded response when the LLM ladder is exhausted."""
    return GeminiResponse(
        response=response_text,
        citations_used=[],
        confidence_indicators=dict.fromkeys(
            (
                "source_quality",
                "answer_completeness",
                "semantic_coherence",
                "citation_coverage",
            ),
            0.0,
        ),
        escalation_signals={
            "requires_human": True,
            "uncertainty_level": "critical",
            "complexity_score": 1.0,
            "missing_info": ["generation_system_failure"],
        },
        retrieval_quality=dict.fromkeys(
            ("context_relevance", "source_diversity", "information_density"), 0.0
        ),
        reasoning_trace=reasoning,
    )


def generate_completion(
    context: str,
    question: str,
    sources: list[str],
    ticket_context: str = "",
    conversation_history: str = "",
) -> Tuple[str, int | None]:
    try:
        structured, lat = generate_structured_completion(
            context, question, sources, ticket_context, conversation_history
        )
        return structured.response, lat
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        return "Technical difficulties. Please contact support.", None


def compute_prompt_hash(
    context: str, question: str, conversation_history: str = ""
) -> str:
    return hashlib.sha256(
        f"{conversation_history}\n---\n{context}\n---\n{question}".encode()
    ).hexdigest()[:16]


QUERY_EXPANSION_PROMPT = """Rewrite the user's support query into 2-3 alternative search queries that would
match knowledge base articles better. Fix spelling, expand abbreviations (e.g. VPN →
virtual private network), and rephrase informally written questions into technical
terms. Keep each query under 12 words.

Respond with VALID JSON only, matching this exact schema:
{"queries": ["original intent query", "alternative query", "alternative query"]}"""


class QueryExpansionError(RuntimeError):
    """Raised when query expansion fails after all retries."""


def expand_query(query: str) -> List[str]:
    """
    Expand a user query into alternative search queries via one cheap LLM call.
    Returns [original, ...alternatives].

    Raises QueryExpansionError after 3 retry attempts so callers (retrieve)
    can surface degraded-search state to the UI. Retries 429/5xx per
    provider-agnostic HTTP semantics.
    """
    try:
        # Short timeout — expansion is optional; a hanging provider must
        # not delay retrieval by the full 30s
        text = _call_llm_with_retry(
            f"{QUERY_EXPANSION_PROMPT}\n\nUSER QUERY: {query}",
            json_mode=True,
            timeout_s=8.0,
        )
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        data = json.loads(cleaned)
        alternatives = [
            str(q).strip() for q in data.get("queries", []) if str(q).strip()
        ]
        # Dedupe, keep original first, cap total at 3
        seen = {query}
        out = [query]
        for alt in alternatives:
            if alt not in seen and len(out) < 3:
                seen.add(alt)
                out.append(alt)
        return out
    except Exception as e:
        logger.warning("Query expansion failed (%s) — caller should degrade", e)
        raise QueryExpansionError(str(e)) from e


KB_DRAFT_PROMPT = """You are writing a knowledge base article for an internal IT knowledge base.
Summarize the conversation below into a reusable how-to article.

Respond with VALID JSON only, matching this exact schema:
{
  "title": "Short descriptive article title (max 80 chars)",
  "content": "Markdown-formatted article covering the problem, resolution steps, and notes. 200-600 words."
}

GUIDELINES:
- Strip customer names, emails, ticket IDs, and any PII
- Write steps so a colleague can resolve the same issue next time
- If the ticket lacks a clear resolution, say so in content and suggest escalation follow-up"""


def generate_kb_draft(conversation: str) -> Tuple[str, str]:
    """Generate a KB article draft from a ticket conversation. Returns (title, content)."""
    prompt = f"{KB_DRAFT_PROMPT}\n\nCONVERSATION:\n{conversation}"
    try:
        text = _call_llm(prompt, json_mode=True)
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        data = json.loads(cleaned)
        return str(data.get("title", "Untitled KB Article")), str(
            data.get("content", "")
        )
    except Exception as e:
        logger.error("KB draft generation failed: %s", e)
        raise
