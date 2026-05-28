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


# ── Result types ───────────────────────────────────────────────────────────────

@dataclass
class TicketAIResult:
    priority_level:        str               # P1–P7
    requires_senior:       bool
    routing_reason:        str
    suggested_assignee_id: Optional[str] = None
    suggested_assignee_email: Optional[str] = None
    correlated_entities:   List[CorrelatedEntity] = field(default_factory=list)
    tool_results:          List[ToolResult] = field(default_factory=list)


@dataclass
class ChatAIResult:
    response:        str
    confidence:      float
    suggest_escalation: bool
    citations:       List[str] = field(default_factory=list)
    tool_results:    List[ToolResult] = field(default_factory=list)
    escalation_info: Dict[str, Any] = field(default_factory=dict)
    retrieval_metrics: Dict[str, Any] = field(default_factory=dict)
    cache_hit:       bool = False
    latency_ms:      int = 0


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
        self.correlator    = EntityCorrelator()
        self._kb_search_registered = False

    # ── Ticket creation pipeline ───────────────────────────────────────────────

    def process_ticket_creation(
        self,
        ticket_id:   str,
        title:       str,
        description: str,
        org_id:      str,
        reps:        List[Dict],
        db_cursor:   Any,
        user_id:     str = "",
    ) -> TicketAIResult:
        """
        Full AI pipeline on ticket creation:
          1. CASPER profile → intent, complexity, urgency, priority, routing
          2. Cross-entity correlation → find related KB articles (and future: assets, contracts)
          3. Background entity embedding → ticket is searchable for future cross-ticket dedup

        Never raises — failures degrade gracefully (routing skipped, no correlation, etc.).
        """
        from ..rag_scoring import profile_ticket, casper_route

        result = TicketAIResult(
            priority_level="P4",
            requires_senior=False,
            routing_reason="default",
        )

        # 1) CASPER profile + routing
        try:
            profile = profile_ticket(title, description or "")
            result.priority_level  = profile.suggested_priority_level
            result.requires_senior = profile.requires_senior
            result.routing_reason  = profile.routing_reason

            best = casper_route(profile, reps)
            if best:
                result.suggested_assignee_id    = best["user_id"]
                result.suggested_assignee_email = best["email"]
        except Exception as exc:
            logger.warning("CASPER profile/route failed for ticket %s: %s", ticket_id, exc)

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
                    (ticket_id, user_id, org_id,
                     f"[system] CASPER correlated: {top_labels}"),
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

    def _embed_ticket_bg(self, ticket_id: str, title: str, description: str, org_id: str) -> None:
        """Background: embed ticket and store FAISS ID in entity_embeddings table."""
        try:
            from ..embeddings import embed_texts
            from ..store import add_to_org_index
            from ..db import get_db_connection

            text = f"[ticket] {title}\n{description}"
            emb  = embed_texts([text])[0]
            faiss_id = add_to_org_index(org_id, emb, {
                "entity_type": "ticket",
                "entity_id":   ticket_id,
                "text":        text[:500],
                "title":       title,
            })
            if faiss_id is not None:
                with get_db_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        """INSERT INTO app.entity_embeddings
                               (organization_id, entity_type, entity_id, faiss_id)
                           VALUES (%s, 'ticket', %s, %s)
                           ON CONFLICT (organization_id, entity_type, entity_id)
                           DO UPDATE SET faiss_id = EXCLUDED.faiss_id, last_embedded = NOW()""",
                        (org_id, ticket_id, faiss_id),
                    )
                    conn.commit()
        except Exception as exc:
            logger.debug("Background ticket embedding failed: %s", exc)

    # ── Chat pipeline ──────────────────────────────────────────────────────────

    def process_chat(
        self,
        query:          str,
        org_id:         str,
        ticket_id:      str,
        user_id:        str,
        user_role:      str,
        fetch_chunks_fn: Callable,
        query_vector:   Optional[np.ndarray] = None,
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
        from ..rag import retrieve, compute_confidence, should_escalate
        from ..ai import generate_structured_completion, stream_groq_completion
        from ..redact import scrub

        t_start = time.time()

        # 1) Semantic cache
        clean_query = scrub(query)
        q_emb = query_vector

        if q_emb is None:
            try:
                from ..embeddings import embed_texts
                q_emb = np.array(embed_texts([clean_query], task_type="retrieval_query")[0])
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
                context, clean_query, sources,
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
            scores, ai_response, len(chunks),
            retrieval_metrics=retrieval_metrics,
            query=clean_query,
            kb_chunk_count=kb_chunk_count,
        )
        escalate_flag, escalation_info = should_escalate(
            confidence, retrieval_metrics, ai_response,
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
        text:           str,
        org_id:         str,
        fetch_chunks_fn: Callable,
        top_k:          int = 3,
    ) -> List[Dict]:
        """
        Semantic search the KB for text related to a given string.
        Returns lightweight dicts: [{title, snippet, score, faiss_id}]
        Used on ticket creation to surface relevant articles immediately.
        """
        try:
            from ..embeddings import embed_texts
            from ..store import search_org_vectors

            emb = embed_texts([text])[0]
            scores_raw, ids_raw = search_org_vectors(org_id, emb, k=top_k * 2)
            candidates = [
                (float(s), int(fid))
                for s, fid in zip(scores_raw, ids_raw)
                if s >= 0.3 and fid >= 0
            ]
            if not candidates:
                return []
            faiss_ids = [fid for _, fid in candidates[:top_k * 2]]
            chunks    = fetch_chunks_fn(faiss_ids)
            scored    = sorted(
                [(c, next((s for s, fid in candidates if fid == c.get("faiss_id")), 0.0)) for c in chunks],
                key=lambda x: x[1],
                reverse=True,
            )
            return [
                {
                    "title":    c.get("title", ""),
                    "snippet":  c.get("text", "")[:200],
                    "score":    round(s, 4),
                    "faiss_id": c.get("faiss_id"),
                }
                for c, s in scored[:top_k]
            ]
        except Exception as exc:
            logger.debug("KB correlation failed: %s", exc)
            return []

    # ── Entity embedding (callable by any module) ──────────────────────────────

    def embed_entity(
        self,
        entity_type: str,
        entity_id:   str,
        text:        str,
        org_id:      str,
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
        entity_id:   str,
        text:        str,
        org_id:      str,
    ) -> None:
        try:
            from ..embeddings import embed_texts
            from ..store import add_to_org_index
            from ..db import get_db_connection

            emb      = embed_texts([text])[0]
            faiss_id = add_to_org_index(org_id, emb, {
                "entity_type": entity_type,
                "entity_id":   entity_id,
                "text":        text[:500],
                "title":       text[:80],
            })
            if faiss_id is not None:
                with get_db_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        """INSERT INTO app.entity_embeddings
                               (organization_id, entity_type, entity_id, faiss_id)
                           VALUES (%s, %s, %s, %s)
                           ON CONFLICT (organization_id, entity_type, entity_id)
                           DO UPDATE SET faiss_id = EXCLUDED.faiss_id, last_embedded = NOW()""",
                        (org_id, entity_type, entity_id, faiss_id),
                    )
                    conn.commit()
        except Exception as exc:
            logger.debug("Background embedding failed (%s %s): %s", entity_type, entity_id, exc)

    def _register_kb_namespace(self) -> None:
        """Register the KB chunk namespace so ticket creation searches it."""
        if self._kb_search_registered:
            return

        def _kb_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..store import search_org_vectors
            scores_raw, ids_raw = search_org_vectors(org_id, q_emb, k=top_k * 2)
            return [
                {"id": str(fid), "label": f"KB chunk {fid}", "score": float(s), "snippet": ""}
                for s, fid in zip(scores_raw, ids_raw)
                if s >= 0.3 and fid >= 0
            ][:top_k]

        self.correlator.register_namespace(EntityNamespace(
            name="kb_chunk",
            search_fn=_kb_search,
        ))
        self._kb_search_registered = True

    def _register_asset_namespace(self) -> None:
        def _asset_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..store import search_org_vectors
            from ..db_sync import get_db_connection

            scores_raw, ids_raw = search_org_vectors(org_id, q_emb, k=top_k * 4)
            if not ids_raw:
                return []
            fid_to_score = {
                fid: float(s) for s, fid in zip(scores_raw, ids_raw)
                if s >= 0.25 and fid >= 0
            }
            if not fid_to_score:
                return []
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT ee.faiss_id, ee.entity_id::text, a.name, a.category, a.asset_tag
                       FROM app.entity_embeddings ee
                       JOIN app.assets a ON a.id = ee.entity_id::uuid
                       WHERE ee.organization_id = %s AND ee.entity_type = 'asset'
                       AND ee.faiss_id = ANY(%s)""",
                    (org_id, list(fid_to_score.keys())),
                )
                rows = cur.fetchall()
            results = []
            for row in rows:
                results.append({
                    "id":          row["entity_id"],
                    "label":       f"{row['name']} ({row['asset_tag']})",
                    "score":       fid_to_score.get(row["faiss_id"], 0.0),
                    "snippet":     row["category"],
                    "entity_type": "asset",
                    "href":        f"/assets/{row['entity_id']}",
                })
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(EntityNamespace(name="asset", search_fn=_asset_search))

    def _register_contract_namespace(self) -> None:
        def _contract_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..store import search_org_vectors
            from ..db_sync import get_db_connection

            scores_raw, ids_raw = search_org_vectors(org_id, q_emb, k=top_k * 4)
            if not ids_raw:
                return []
            fid_to_score = {
                fid: float(s) for s, fid in zip(scores_raw, ids_raw)
                if s >= 0.25 and fid >= 0
            }
            if not fid_to_score:
                return []
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT ee.faiss_id, ee.entity_id::text, c.title, c.status,
                              v.name AS vendor_name
                       FROM app.entity_embeddings ee
                       JOIN app.contracts c ON c.id = ee.entity_id::uuid
                       LEFT JOIN app.vendors v ON v.id = c.vendor_id
                       WHERE ee.organization_id = %s AND ee.entity_type = 'contract'
                       AND ee.faiss_id = ANY(%s)""",
                    (org_id, list(fid_to_score.keys())),
                )
                rows = cur.fetchall()
            results = []
            for row in rows:
                vendor = f" — {row['vendor_name']}" if row.get("vendor_name") else ""
                results.append({
                    "id":          row["entity_id"],
                    "label":       f"{row['title']}{vendor}",
                    "score":       fid_to_score.get(row["faiss_id"], 0.0),
                    "snippet":     row["status"],
                    "entity_type": "contract",
                    "href":        f"/contracts/{row['entity_id']}",
                })
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(EntityNamespace(name="contract", search_fn=_contract_search))

    def _register_article_namespace(self) -> None:
        def _article_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..store import search_org_vectors
            from ..db_sync import get_db_connection

            scores_raw, ids_raw = search_org_vectors(org_id, q_emb, k=top_k * 4)
            if not ids_raw:
                return []
            fid_to_score = {
                fid: float(s) for s, fid in zip(scores_raw, ids_raw)
                if s >= 0.25 and fid >= 0
            }
            if not fid_to_score:
                return []
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT ee.faiss_id, ee.entity_id::text, ka.title, ka.category
                       FROM app.entity_embeddings ee
                       JOIN app.knowledge_articles ka ON ka.id = ee.entity_id::uuid
                       WHERE ee.organization_id = %s AND ee.entity_type = 'knowbase_article'
                       AND ee.faiss_id = ANY(%s)
                       AND ka.is_published = TRUE""",
                    (org_id, list(fid_to_score.keys())),
                )
                rows = cur.fetchall()
            results = []
            for row in rows:
                results.append({
                    "id":          row["entity_id"],
                    "label":       row["title"],
                    "score":       fid_to_score.get(row["faiss_id"], 0.0),
                    "snippet":     row.get("category") or "",
                    "entity_type": "knowbase_article",
                    "href":        f"/knowbase/{row['entity_id']}",
                })
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(EntityNamespace(name="knowbase_article", search_fn=_article_search))

    def _register_ticket_namespace(self) -> None:
        def _ticket_search(q_emb: List[float], org_id: str, top_k: int) -> List[Dict]:
            from ..store import search_org_vectors
            from ..db_sync import get_db_connection

            scores_raw, ids_raw = search_org_vectors(org_id, q_emb, k=top_k * 4)
            if not ids_raw:
                return []
            fid_to_score = {
                fid: float(s) for s, fid in zip(scores_raw, ids_raw)
                if s >= 0.3 and fid >= 0
            }
            if not fid_to_score:
                return []
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT ee.faiss_id, ee.entity_id::text, t.title, t.status
                       FROM app.entity_embeddings ee
                       JOIN app.tickets t ON t.id = ee.entity_id::uuid
                       WHERE ee.organization_id = %s AND ee.entity_type = 'ticket'
                       AND ee.faiss_id = ANY(%s)
                       AND t.status IN ('resolved', 'closed')""",
                    (org_id, list(fid_to_score.keys())),
                )
                rows = cur.fetchall()
            results = []
            for row in rows:
                results.append({
                    "id":          row["entity_id"],
                    "label":       row["title"],
                    "score":       fid_to_score.get(row["faiss_id"], 0.0),
                    "snippet":     row["status"],
                    "entity_type": "ticket",
                    "href":        f"/tickets/{row['entity_id']}",
                })
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

        self.correlator.register_namespace(EntityNamespace(name="resolved_ticket", search_fn=_ticket_search))

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
