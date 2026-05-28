"""
CASPER Phase 2 — Natural Language Query endpoint.

POST /api/casper/query  →  plain-English question across all Strata modules.
The engine embeds the query, routes it through all registered namespaces,
and returns ranked entity cards the frontend renders.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..auth import User, get_current_user
from ..entitlements import requires_feature
from ..org_middleware import require_org_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/casper", tags=["casper"])


class NLQueryIn(BaseModel):
    query: str
    top_k: int = 5


class EntityCard(BaseModel):
    entity_type: str
    entity_id:   str
    label:       str
    score:       float
    href:        str
    namespace:   str


@router.post("/query")
def nl_query(
    body: NLQueryIn,
    request: Request,
    user: User = Depends(get_current_user),
):
    """
    Multi-namespace semantic search across every embedded entity type.
    Returns ranked entity cards the frontend renders as clickable chips/cards.
    """
    org_id = require_org_context(request)

    if not body.query.strip():
        raise HTTPException(400, "query must not be empty")

    try:
        from ..embeddings import embed_texts
        q_emb = embed_texts([body.query.strip()], task_type="retrieval_query")[0]
    except Exception as exc:
        logger.error("[casper/query] embedding failed: %s", exc)
        raise HTTPException(503, "Embedding service unavailable")

    try:
        from ..casper.engine import casper_engine
        raw = casper_engine.correlator.correlate(
            q_emb, org_id, top_k_per_namespace=body.top_k
        )
    except Exception as exc:
        logger.error("[casper/query] correlate failed: %s", exc)
        raise HTTPException(503, "CASPER correlator unavailable")

    cards = []
    for item in raw:
        cards.append(EntityCard(
            entity_type=item.get("entity_type", item.get("namespace", "unknown")),
            entity_id=item.get("entity_id", ""),
            label=item.get("label", item.get("title", "Untitled")),
            score=round(float(item.get("score", 0)), 3),
            href=item.get("href", "#"),
            namespace=item.get("namespace", ""),
        ))

    cards.sort(key=lambda c: c.score, reverse=True)
    return {"results": [c.model_dump() for c in cards[:body.top_k * 3]], "query": body.query}
