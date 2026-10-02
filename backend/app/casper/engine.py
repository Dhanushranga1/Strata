"""
CASPEREngine — Central AI Orchestration Layer for Strata.

Sits between the database and application logic. Not a UI feature.

All AI operations flow through this class:
  - process_ticket_creation() → profile, route, correlate, embed ticket
  - process_chat()            → retrieve, generate, execute tools, escalate
  - correlate_with_kb()       → cross-entity semantic linking (KB now, assets/contracts later)
  - embed_entity()            → background entity embedding for cross-entity search

Modules plug in via:
  casper_engine.tool_registry.register(Tool(...))
  casper_engine.correlator.register_namespace(EntityNamespace(...))
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np

from .correlator import CorrelatedEntity, EntityCorrelator, EntityNamespace
from .tools import ExecutionContext, ToolRegistry, ToolResult, build_default_registry

logger = logging.getLogger(__name__)


def _search_entity_vectors(
    org_id: str,
    entity_type: str,
    q_emb: List[float],
    top_k: int,
    min_score: float = 0.25,
) -> List[Dict[str, Any]]:
    """Cosine-search entity embeddings in pgvector (FAISS removed in 0031)."""
    from ..db_sync import get_db_connection

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ee.entity_id::text AS entity_id,
                   1.0 - (ee.embedding_vec <=> %s::vector) AS score
            FROM app.entity_embeddings ee
            WHERE ee.organization_id = %s
              AND ee.entity_type = %s
              AND ee.embedding_vec IS NOT NULL
            ORDER BY ee.embedding_vec <=> %s::vector
            LIMIT %s
            """,
            (str(q_emb), org_id, entity_type, str(q_emb), top_k),
        )
        rows = cur.fetchall()
    return [
        {"entity_id": row["entity_id"], "score": float(row["score"])}
        for row in rows
        if row["score"] is not None and float(row["score"]) >= min_score
    ]


# ── Result types ───────────────────────────────────────────────────────────────


@dataclass
class TicketAIResult:
    priority_level: str  # P1–P7
    requires_senior: bool
    routing_reason: str
    suggested_assignee_id: Optional[str] = None
    suggested_assignee_email: Optional[str] = None
    correlated_entities: List[CorrelatedEntity] = field(default_factory=list)
    tool_results: List[ToolResult] = field(default_factory=list)


@dataclass
class ChatAIResult:
    response: str
    confidence: float
    suggest_escalation: bool
    citations: List[str] = field(default_factory=list)
    tool_results: List[ToolResult] = field(default_factory=list)
    escalation_info: Dict[str, Any] = field(default_factory=dict)
    retrieval_metrics: Dict[str, Any] = field(default_factory=dict)
    cache_hit: bool = False
    latency_ms: int = 0


# ── Engine ─────────────────────────────────────────────────────────────────────


class CASPEREngine:
    """
    Central AI orchestration engine. Instantiated once at app startup.

    Usage:
        from app.casper import casper_engine

        # Ticket creation
        result = casper_engine.process_ticket_creation(...)

        # AI chat
        result = casper_engine.process_chat(...)

        # Register a new module's tool
        casper_engine.tool_registry.register(Tool(...))

        # Register a new searchable entity namespace
        casper_engine.correlator.register_namespace(EntityNamespace(...))
    """

    def __init__(self) -> None:
        self.tool_registry = build_default_registry()
        self.correlator = EntityCorrelator()
        self._kb_search_registered = False

    # ── Ticket creation pipeline ───────────────────────────────────────────────

    def process_ticket_creation(
        self,
        ticket_id: str,
        title: str,
        description: str,
        org_id: str,
        reps: List[Dict],
        db_cursor: Any,
        user_id: str = "",
    ) -> TicketAIResult:
        """
        Full AI pipeline on ticket creation:
          1. CASPER profile → intent, complexity, urgency, priority, routing
          2. Cross-entity correlation → find related KB articles (and future: assets, contracts)
          3. Background entity embedding → ticket is searchable for future cross-ticket dedup

        Never raises — failures degrade gracefully (routing skipped, no correlation, etc.).
        """
        from ..rag_scoring import casper_route, profile_ticket

        result = TicketAIResult(
            priority_level="P4",
            requires_senior=False,
            routing_reason="default",
        )

        # 1) CASPER profile + routing
        try:
            profile = profile_ticket(title, description or "")
            result.priority_level = profile.suggested_priority_level
            result.requires_senior = profile.requires_senior
            result.routing_reason = profile.routing_reason

            best = casper_route(profile, reps)
            if best:
                result.suggested_assignee_id = best["user_id"]
                result.suggested_assignee_email = best["email"]
        except Exception as exc:
            logger.warning(
                "CASPER profile/route failed for ticket %s: %s", ticket_id, exc
            )

        # 2) Cross-entity correlation — embed ticket text, search all namespaces
        try:
            from ..embeddings import embed_texts

            q_emb = embed_texts([f"{title} {description or ''}"])[0]
            result.correlated_entities = self.correlator.correlate(
                query_embedding=q_emb,
                org_id=org_id,
                top_k_per_namespace=3,
            )
            if result.correlated_entities and db_cursor:
                top_labels = ", ".join(
                    f"{e.namespace}:{e.label[:30]}"
                    for e in result.correlated_entities[:3]
                )
                db_cursor.execute(
                    "INSERT INTO app.messages (ticket_id, sender_id, sender_role, organization_id, body) "
                    "VALUES (%s, %s, 'system', %s, %s)",
                    (
                        ticket_id,
                        user_id,
                        org_id,
                        f"[system] CASPER correlated: {top_labels}",
                    ),
                )
        except Exception as exc:
            logger.debug("Correlation skipped for ticket %s: %s", ticket_id, exc)

        # 3) Background entity embedding — ticket becomes searchable
        threading.Thread(
            target=self._embed_ticket_bg,
            args=(ticket_id, title, description or "", org_id),
            daemon=True,
        ).start()

        return result

    def _embed_ticket_bg(
        self, ticket_id: str, title: str, description: str, org_id: str
    ) -> None:
        """Background: embed ticket into app.entity_embeddings (pgvector)."""
        self._store_entity_embedding(
            "ticket", ticket_id, f"[ticket] {title}\n{description}", org_id
        )

    # ── Chat pipeline ──────────────────────────────────────────────────────────

    def process_chat(
        self,
        query: str,
        org_id: str,
        ticket_id: str,
        user_id: str,
        user_role: str,
        fetch_chunks_fn: Callable,
        query_vector: Optional[np.ndarray] = None,
        kb_chunk_count: int = 100,
        conversation_length: int = 1,
    ) -> ChatAIResult:
        """
        Full AI chat pipeline:
          1. Semantic cache check — returns instantly on hit
          2. RAG retrieval (FAISS + BM25 + RRF + intent-adaptive MMR)
          3. LLM generation with tool-calling prompt
          4. CASPER confidence + adaptive escalation
          5. Tool call extraction + execution
          6. Cache write

        Returns ChatAIResult — caller stores message and returns to frontend.
        """
        from ..ai import generate_structured_completion, stream_groq_completion
        from ..rag import compute_confidence, retrieve, should_escalate
        from ..redact import scrub

        t_start = time.time()

        # 1) Semantic cache
        clean_query = scrub(query)
        q_emb = query_vector

        if q_emb is None:
            try:
                from ..embeddings import embed_texts

                q_emb = np.array(
                    embed_texts([clean_query], task_type="retrieval_query")[0]
                )
            except Exception as exc:
                logger.error("Query embedding failed in CASPEREngine: %s", exc)
                return ChatAIResult(
                    response="I'm having trouble processing your request. Please try again.",
                    confidence=0.0,
                    suggest_escalation=True,
                )

        from ..tickets import _cache_lookup, _cache_store

        cached = _cache_lookup(org_id, q_emb)
        if cached is not None:
            return ChatAIResult(
                response=cached,
                confidence=0.7,
                suggest_escalation=False,
                cache_hit=True,
                latency_ms=int((time.time() - t_start) * 1000),
            )

        # 2) RAG retrieval
        chunks, sources, context, scores, faiss_ids, retrieval_metrics = retrieve(
            clean_query,
            fetch_chunks_fn,
            org_id=org_id,
            query_vector=q_emb.tolist() if isinstance(q_emb, np.ndarray) else q_emb,
        )

        if not chunks:
            return ChatAIResult(
                response=(
                    "I don't have enough information in the knowledge base to answer your question. "
                    "This issue requires human assistance."
                ),
                confidence=0.0,
                suggest_escalation=True,
                retrieval_metrics=retrieval_metrics,
                latency_ms=int((time.time() - t_start) * 1000),
            )

        # 3) LLM generation — tool schemas injected into prompt
        tool_schemas = self.tool_registry.tool_schemas()
        try:
            structured_response, latency_ms = generate_structured_completion(
                context,
                clean_query,
                sources,
                tool_schemas=tool_schemas,
            )
            ai_response = structured_response.response
        except Exception as exc:
            logger.error("Structured generation failed: %s", exc)
            return ChatAIResult(
                response="I'm experiencing technical difficulties. Please contact support.",
                confidence=0.0,
                suggest_escalation=True,
                latency_ms=int((time.time() - t_start) * 1000),
            )

        # 4) CASPER confidence + escalation
        confidence, confidence_components = compute_confidence(
            scores,
            ai_response,
            len(chunks),
            retrieval_metrics=retrieval_metrics,
            query=clean_query,
            kb_chunk_count=kb_chunk_count,
        )
        escalate_flag, escalation_info = should_escalate(
            confidence,
            retrieval_metrics,
            ai_response,
            conversation_length=conversation_length,
            confidence_breakdown=confidence_components,
        )

        # 5) Tool call execution
        tool_results: List[ToolResult] = []
        raw_tool_calls = getattr(structured_response, "tool_calls", None) or []
        if raw_tool_calls:
            exec_ctx = ExecutionContext(
                org_id=org_id,
                user_id=user_id,
                user_role=user_role,
                ticket_id=ticket_id,
            )
            tool_results = self.tool_registry.execute_all(
                [{"tool": tc.tool, "params": tc.params} for tc in raw_tool_calls],
                exec_ctx,
            )

        # 6) Cache write (only high-confidence, non-escalated responses)
        if confidence >= 0.7 and not escalate_flag:
            _cache_store(org_id, q_emb, ai_response, confidence)

        return ChatAIResult(
            response=ai_response,
            confidence=confidence,
            suggest_escalation=escalate_flag,
            citations=sources,
            tool_results=tool_results,
            escalation_info=escalation_info,
            retrieval_metrics=retrieval_metrics,
            cache_hit=False,
            latency_ms=int((time.time() - t_start) * 1000),
        )

    # ── KB correlation helper (used externally) ────────────────────────────────

    def correlate_with_kb(
        self,
        text: str,
        org_id: str,
        fetch_chunks_fn: Callable,
        top_k: int = 3,
    ) -> List[Dict]:
        """
        Semantic search the KB for text related to a given string.
        Returns lightweight dicts: [{title, snippet, score, faiss_id, chunk_id}]
        Used on ticket creation to surface relevant articles immediately.
        """
        try:
            from ..db_sync import get_db_connection
            from ..embeddings import embed_texts

            emb = embed_texts([text])[0]
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT c.id::text AS chunk_id, c.faiss_id, c.text, d.title,
                           1.0 - (c.embedding_vec <=> %s::vector) AS score
                    FROM app.chunks c
                    JOIN app.documents d ON d.id = c.doc_id
                    WHERE c.organization_id = %s
                      AND c.embedding_vec IS NOT NULL
                    ORDER BY c.embedding_vec <=> %s::vector
                    LIMIT %s
                    """,
                    (str(emb), org_id, str(emb), top_k * 2),
                )
                rows = cur.fetchall()
            return [
                {
                    "title": row["title"] or "",
                    "snippet": (row["text"] or "")[:200],
                    "score": round(float(row["score"]), 4),
                    "faiss_id": row["faiss_id"],
                    "chunk_id": row["chunk_id"],
                }
                for row in rows
                if row["score"] is not None and float(row["score"]) >= 0.3
            ][:top_k]
        except Exception as exc:
            logger.debug("KB correlation failed: %s", exc)
            return []

    # ── Entity embedding (callable by any module) ──────────────────────────────

    def embed_entity(
        self,
        entity_type: str,
        entity_id: str,
        text: str,
        org_id: str,
    ) -> None:
        """
        Embed any entity in background. Call this from any module on create/update.
        The entity becomes findable via cross-entity correlation.

        Example:
            casper_engine.embed_entity("asset", asset_id, f"{name} {serial} {specs}", org_id)
        """
        threading.Thread(
            target=self._embed_entity_bg,
            args=(entity_type, entity_id, text, org_id),
            daemon=True,
        ).start()

    def _embed_entity_bg(
        self,
        entity_type: str,
        entity_id: str,
        text: str,
        org_id: str,
    ) -> None:
        self._store_entity_embedding(entity_type, entity_id, text, org_id)

    def _store_entity_embedding(
        self,
        entity_type: str,
        entity_id: str,
        text: str,
        org_id: str,
    ) -> None:
        """Embed an entity and upsert its vector into app.entity_embeddings."""
        try:
            from ..db_sync import get_db_connection
            from ..embeddings import embed_texts

            emb = embed_texts([text])[0]
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """INSERT INTO app.entity_embeddings
                           (organization_id, entity_type, entity_id, embedding_vec)
                       VALUES (%s, %s, %s::uuid, %s::vector)
                       ON CONFLICT (organization_id, entity_type, entity_id)
                       DO UPDATE SET embedding_vec = EXCLUDED.embedding_vec,
                                     last_embedded = NOW()""",
                    (org_id, entity_type, entity_id, str(emb)),
                )
                conn.commit()
        except Exception as exc:
            logger.debug(
                "Background embedding failed (%s %s): %s", entity_type, entity_id, exc
            )

    def _register_kb_namespace(self) -> None:
        """Register the KB chunk namespace so ticket creation searches it."""
        if self._kb_search_registered:
            return

        def _kb_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..db_sync import get_db_connection

            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT c.id::text AS chunk_id, c.text, d.title,
                           1.0 - (c.embedding_vec <=> %s::vector) AS score
                    FROM app.chunks c
                    JOIN app.documents d ON d.id = c.doc_id
                    WHERE c.organization_id = %s
                      AND c.embedding_vec IS NOT NULL
                    ORDER BY c.embedding_vec <=> %s::vector
                    LIMIT %s
                    """,
                    (str(q_emb), org_id, str(q_emb), top_k),
                )
                rows = cur.fetchall()
            return [
                {
                    "id": row["chunk_id"],
                    "label": row["title"] or "KB chunk",
                    "score": float(row["score"]),
                    "snippet": (row["text"] or "")[:200],
                }
                for row in rows
                if row["score"] is not None and float(row["score"]) >= 0.3
            ][:top_k]

        self.correlator.register_namespace(
            EntityNamespace(
                name="kb_chunk",
                search_fn=_kb_search,
            )
        )
        self._kb_search_registered = True

    def _register_asset_namespace(self) -> None:
        def _asset_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..db_sync import get_db_connection

            hits = _search_entity_vectors(org_id, "asset", q_emb, top_k * 4)
            if not hits:
                return []
            score_map = {h["entity_id"]: h["score"] for h in hits}
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT a.id::text AS entity_id, a.name, a.category, a.asset_tag
                       FROM app.assets a
                       WHERE a.organization_id = %s AND a.id = ANY(%s::uuid[])""",
                    (org_id, list(score_map.keys())),
                )
                rows = cur.fetchall()
            labels = {row["entity_id"]: row for row in rows}
            results = []
            for entity_id, score in score_map.items():
                row = labels.get(entity_id)
                if not row:
                    continue
                results.append(
                    {
                        "id": entity_id,
                        "label": f"{row['name']} ({row['asset_tag']})",
                        "score": score,
                        "snippet": row["category"] or "",
                        "entity_type": "asset",
                        "href": f"/assets/{entity_id}",
                    }
                )
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(
            EntityNamespace(name="asset", search_fn=_asset_search)
        )

    def _register_contract_namespace(self) -> None:
        def _contract_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..db_sync import get_db_connection

            hits = _search_entity_vectors(org_id, "contract", q_emb, top_k * 4)
            if not hits:
                return []
            score_map = {h["entity_id"]: h["score"] for h in hits}
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT c.id::text AS entity_id, c.title, c.status,
                              v.name AS vendor_name
                       FROM app.contracts c
                       LEFT JOIN app.vendors v ON v.id = c.vendor_id
                       WHERE c.organization_id = %s AND c.id = ANY(%s::uuid[])""",
                    (org_id, list(score_map.keys())),
                )
                rows = cur.fetchall()
            labels = {row["entity_id"]: row for row in rows}
            results = []
            for entity_id, score in score_map.items():
                row = labels.get(entity_id)
                if not row:
                    continue
                vendor = f" — {row['vendor_name']}" if row["vendor_name"] else ""
                results.append(
                    {
                        "id": entity_id,
                        "label": f"{row['title']}{vendor}",
                        "score": score,
                        "snippet": row["status"],
                        "entity_type": "contract",
                        "href": f"/contracts/{entity_id}",
                    }
                )
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(
            EntityNamespace(name="contract", search_fn=_contract_search)
        )

    def _register_article_namespace(self) -> None:
        def _article_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..db_sync import get_db_connection

            hits = _search_entity_vectors(org_id, "knowbase_article", q_emb, top_k * 4)
            if not hits:
                return []
            score_map = {h["entity_id"]: h["score"] for h in hits}
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT ka.id::text AS entity_id, ka.title, ka.category
                       FROM app.knowledge_articles ka
                       WHERE ka.organization_id = %s
                         AND ka.id = ANY(%s::uuid[])
                         AND ka.is_published = TRUE""",
                    (org_id, list(score_map.keys())),
                )
                rows = cur.fetchall()
            labels = {row["entity_id"]: row for row in rows}
            results = []
            for entity_id, score in score_map.items():
                row = labels.get(entity_id)
                if not row:
                    continue
                results.append(
                    {
                        "id": entity_id,
                        "label": row["title"],
                        "score": score,
                        "snippet": row["category"] or "",
                        "entity_type": "knowbase_article",
                        "href": f"/knowbase/{entity_id}",
                    }
                )
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(
            EntityNamespace(name="knowbase_article", search_fn=_article_search)
        )

    def _register_ticket_namespace(self) -> None:
        def _ticket_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..db_sync import get_db_connection

            hits = _search_entity_vectors(
                org_id, "ticket", q_emb, top_k * 4, min_score=0.3
            )
            if not hits:
                return []
            score_map = {h["entity_id"]: h["score"] for h in hits}
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT t.id::text AS entity_id, t.title, t.status
                       FROM app.tickets t
                       WHERE t.organization_id = %s
                         AND t.id = ANY(%s::uuid[])
                         AND t.status IN ('resolved', 'closed')""",
                    (org_id, list(score_map.keys())),
                )
                rows = cur.fetchall()
            labels = {row["entity_id"]: row for row in rows}
            results = []
            for entity_id, score in score_map.items():
                row = labels.get(entity_id)
                if not row:
                    continue
                results.append(
                    {
                        "id": entity_id,
                        "label": row["title"],
                        "score": score,
                        "snippet": row["status"],
                        "entity_type": "ticket",
                        "href": f"/tickets/{entity_id}",
                    }
                )
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(
            EntityNamespace(name="resolved_ticket", search_fn=_ticket_search)
        )

    def startup(self) -> None:
        """Call from app startup to initialise built-in namespaces."""
        self._register_kb_namespace()
        self._register_asset_namespace()
        self._register_contract_namespace()
        self._register_article_namespace()
        self._register_ticket_namespace()
        logger.info(
            "CASPEREngine ready — tools: %s, namespaces: %s",
            list(self.tool_registry._tools.keys()),
            self.correlator.registered_namespaces(),
        )
