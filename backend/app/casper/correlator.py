"""
CASPER Entity Correlator — Vector-Relational cross-entity linking.

On ticket creation, CASPER searches ALL registered entity namespaces for
semantically related entities. Future modules (AssetLog, ContractVault)
register themselves here; CASPER automatically searches them.

Registration pattern:
    from app.casper import casper_engine
    casper_engine.correlator.register_namespace(EntityNamespace(
        name="asset",
        search_fn=search_assets_by_embedding,
        format_fn=lambda row: {"id": row["id"], "label": row["name"], "type": "asset"},
    ))
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CorrelatedEntity:
    namespace:   str           # "kb_chunk", "asset", "contract", "knowbase_article"
    entity_id:   str
    label:       str
    score:       float
    snippet:     str = ""
    metadata:    Dict[str, Any] = field(default_factory=dict)


@dataclass
class EntityNamespace:
    name:         str
    search_fn:    Callable[[List[float], str, int], List[Dict]]
    # search_fn(query_embedding, org_id, top_k) → List[{id, label, score, snippet, ...}]
    format_fn:    Optional[Callable[[Dict], CorrelatedEntity]] = None
    enabled:      bool = True


class EntityCorrelator:
    """
    Cross-entity semantic correlator.

    Maintains a registry of entity namespaces. On `correlate()`, runs a semantic
    search across all enabled namespaces and returns a merged, ranked list of
    correlated entities for a given query embedding.
    """

    def __init__(self) -> None:
        self._namespaces: Dict[str, EntityNamespace] = {}

    def register_namespace(self, ns: EntityNamespace) -> None:
        self._namespaces[ns.name] = ns
        logger.info("CASPER namespace registered: %s", ns.name)

    def correlate(
        self,
        query_embedding: List[float],
        org_id: str,
        top_k_per_namespace: int = 3,
    ) -> List[CorrelatedEntity]:
        """
        Search all enabled namespaces and return a merged ranked list.
        Never raises — failures in individual namespaces are logged and skipped.
        """
        all_results: List[CorrelatedEntity] = []

        for ns_name, ns in self._namespaces.items():
            if not ns.enabled:
                continue
            try:
                raw = ns.search_fn(query_embedding, org_id, top_k_per_namespace)
                for item in raw:
                    if ns.format_fn:
                        entity = ns.format_fn(item)
                    else:
                        entity = CorrelatedEntity(
                            namespace=ns_name,
                            entity_id=str(item.get("id", "")),
                            label=str(item.get("label", item.get("title", ""))),
                            score=float(item.get("score", 0.0)),
                            snippet=str(item.get("snippet", item.get("text", ""))[:200]),
                            metadata=item,
                        )
                    all_results.append(entity)
            except Exception as exc:
                logger.warning("Correlator namespace '%s' failed: %s", ns_name, exc)

        # Sort by score descending, return top N overall
        all_results.sort(key=lambda e: e.score, reverse=True)
        return all_results[: top_k_per_namespace * 2]

    def registered_namespaces(self) -> List[str]:
        return list(self._namespaces.keys())
