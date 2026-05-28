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
from typing import Literal, Tuple, Dict, Any, List, Optional, Iterator
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
TEMPERATURE = float(os.getenv("GENAI_TEMPERATURE", "0.2"))
MAX_OUTPUT_TOKENS = int(os.getenv("GENAI_MAX_OUTPUT_TOKENS", "1024"))
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2.0


class CASPERCitation(BaseModel):
    index: int
    confidence: float
    relevance_score: float


class CASPERToolCall(BaseModel):
    tool:   str
    params: Dict[str, Any]


class CASPERResponse(BaseModel):
    response: str
    citations_used: list[CASPERCitation]
    confidence_indicators: Dict[str, float]
    escalation_signals: Dict[str, Any]
    retrieval_quality: Dict[str, float]
    reasoning_trace: Optional[str] = None
    tool_calls: Optional[List[CASPERToolCall]] = None


# Backward-compat aliases (remove after all callers updated)
GeminiCitation = CASPERCitation
GeminiResponse = CASPERResponse


_RESPONSE_FORMAT = """\

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
  "reasoning_trace": "Brief explanation of reasoning process",
  "tool_calls": []
}

ANSWER GUIDELINES:
- Use ONLY provided context sources
- Include [N] citations for every factual claim
- Be concise but comprehensive
- If insufficient information, indicate clearly in escalation_signals
- Provide confidence scores between 0.0-1.0 for all metrics
- Set requires_human=true if answer requires human expertise
- Only call tools when the action would genuinely help resolve the ticket faster
- Do NOT call tools for simple informational queries"""

_TICKETPILOT_PERSONA = """You are CASPER, the AI assistant for TicketPilot — the smartest IT support desk for SMEs.

Your job is to help IT teams resolve support tickets faster with less back-and-forth.
You have access to the organisation's knowledge base, past ticket resolutions, asset records, and vendor contracts.

When a user reports an issue:
- Check for known solutions in the knowledge base first
- Check if the affected asset is under warranty or has a support contract
- Reference similar resolved tickets to find proven fixes
- Suggest a resolution with clear, actionable steps
- Flag if escalation or a change request is needed

Be direct, practical, and SME-friendly. No ITIL jargon."""

_STRATA_PERSONA = """You are CASPER, the AI core of Strata — an IT operations platform for SMEs.

You can query and correlate across modules: TicketPilot (support tickets), AssetLog (hardware/software/licenses),
ContractVault (vendors/contracts), KnowBase (articles/runbooks), ProcureFlow (purchase requests).

Use the tools available to look up entities, surface insights, and take lightweight actions.
Always cite your sources with entity type and ID.
When data spans multiple modules, show the connections clearly."""

_SYSTEM_PROMPT_BASE = _TICKETPILOT_PERSONA + _RESPONSE_FORMAT

SYSTEM_PROMPT = _SYSTEM_PROMPT_BASE  # backward-compat alias


def _build_system_prompt(
    tool_schemas: Optional[List[Dict]] = None,
    context: Literal["ticketpilot", "strata"] = "ticketpilot",
) -> str:
    """Build the system prompt for the given context, injecting CASPER tool schemas."""
    persona = _TICKETPILOT_PERSONA if context == "ticketpilot" else _STRATA_PERSONA
    base = persona + _RESPONSE_FORMAT
    if not tool_schemas:
        return base
    schemas_json = json.dumps(tool_schemas, indent=2)
    return (
        base
        + f"""

AVAILABLE CASPER TOOLS (call only when genuinely helpful):
{schemas_json}

To call a tool, include it in the "tool_calls" array:
  "tool_calls": [{{"tool": "tool_name", "params": {{...}}}}]

Leave "tool_calls" as [] when no action is needed."""
    )


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


def validate_gemini_response(response_text: str) -> Optional[CASPERResponse]:
    try:
        json_text = response_text.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]
        if json_text.endswith("```"):
            json_text = json_text[:-3]
        json_text = json_text.strip()
        parsed = json.loads(json_text)
        return CASPERResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as e:
        logger.warning(f"Failed to validate response: {e}")
        return None


def generate_structured_completion(
    rag_context: str,
    question: str,
    sources: list[str],
    tool_schemas: Optional[List[Dict]] = None,
    casper_context: Literal["ticketpilot", "strata"] = "ticketpilot",
) -> Tuple[CASPERResponse, int]:
    system = _build_system_prompt(tool_schemas, context=casper_context)
    prompt = f"""{system}

CONTEXT:
{rag_context}

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
    return generate_fallback_response(rag_context, question, sources, start_time)


def generate_fallback_response(rag_context: str, question: str, sources: list[str], start_time: float) -> Tuple[CASPERResponse, int]:
    try:
        simple_prompt = f"""Answer this question using only the provided context:

CONTEXT: {rag_context}

QUESTION: {question}

Answer concisely with [N] citations:"""

        text = _call_groq(simple_prompt, json_mode=False)

        fallback = CASPERResponse(
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
        error_response = CASPERResponse(
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


_STREAM_PROMPT = """You are CASPER, the AI assistant for TicketPilot — the smartest IT support desk for SMEs.
Answer using ONLY the context below. Be direct, practical, and SME-friendly.
Use [N] citation markers (e.g. [1], [2]) for every factual claim.

CONTEXT:
{context}

SOURCES:
{sources}

QUESTION: {question}

Answer:"""


def stream_groq_completion(context: str, question: str, sources: list[str]) -> Iterator[str]:
    """Yield text tokens from Groq's streaming API. Plain text — no JSON mode."""
    api_key = _get_api_key()
    prompt = _STREAM_PROMPT.format(
        context=context,
        sources="\n".join(sources),
        question=question,
    )
    payload: Dict[str, Any] = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": TEMPERATURE,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "stream": True,
    }
    with httpx.stream(
        "POST", GROQ_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=60.0,
    ) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line.startswith("data: "):
                continue
            data = line[6:]
            if data.strip() == "[DONE]":
                return
            try:
                chunk = json.loads(data)
                token = chunk["choices"][0]["delta"].get("content", "")
                if token:
                    yield token
            except (json.JSONDecodeError, KeyError):
                continue
