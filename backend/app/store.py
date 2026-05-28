"""
Vector store — per-organisation FAISS isolation.

Each organisation gets its own FAISS IndexFlatIP stored at:
  {INDEX_DIR}/orgs/{org_id}.index
  {MAP_DIR}/orgs/{org_id}.json

An LRU in-memory cache (MAX_CACHED_ORGS slots) keeps the most recently
accessed indexes hot. Per-org threading.Lock objects prevent concurrent
reads/writes to the same org's index file.

Legacy single-index functions (add_vectors_for_chunks, search_vectors, …)
are kept for backward compatibility but forward to the per-org path.
"""

import os
import re
import json
import time
import pickle
import threading
import logging
import numpy as np
import faiss
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

INDEX_DIR = os.getenv("VECTOR_INDEX_DIR", "./data/faiss")
MAP_DIR   = os.getenv("VECTOR_MAP_DIR",   "./data/maps")
DIM       = int(os.getenv("EMBEDDING_DIM", "1024"))

# Tune these via env vars for larger deployments
MAX_CACHED_ORGS = int(os.getenv("FAISS_MAX_CACHED_ORGS", "50"))


class VectorStoreError(Exception):
    pass


# ---------------------------------------------------------------------------
# HNSW index factory
# ---------------------------------------------------------------------------

def _make_hnsw_index(dim: int) -> faiss.IndexHNSWFlat:
    """
    Create an HNSW approximate-nearest-neighbour index using inner product
    (same metric as the old IndexFlatIP — cosine similarity on normalised vectors).
    O(log N) search vs O(N) for IndexFlatIP.

    M=32      — graph connections per node (recall vs RAM trade-off)
    efSearch  — beam width at query time (64 ≈ 99% recall vs brute-force)
    efConstruction — beam width when adding vectors (only affects build speed)
    """
    index = faiss.IndexHNSWFlat(dim, 32, faiss.METRIC_INNER_PRODUCT)
    index.hnsw.efSearch = 64
    index.hnsw.efConstruction = 200
    return index


# ---------------------------------------------------------------------------
# Per-org path helpers
# ---------------------------------------------------------------------------

def _org_paths(org_id: str) -> Tuple[str, str]:
    """Return (index_path, map_path) for an org, creating dirs if needed."""
    idx_dir = os.path.join(INDEX_DIR, "orgs")
    map_dir = os.path.join(MAP_DIR,   "orgs")
    os.makedirs(idx_dir, exist_ok=True)
    os.makedirs(map_dir, exist_ok=True)
    return (
        os.path.join(idx_dir, f"{org_id}.index"),
        os.path.join(map_dir, f"{org_id}.json"),
    )


# ---------------------------------------------------------------------------
# LRU in-memory cache  { org_id → (index, mapping, last_access_ts) }
# ---------------------------------------------------------------------------

_cache: Dict[str, Tuple[faiss.Index, Dict, float]] = {}
_cache_lock = threading.Lock()          # guards _cache mutations

_per_org_locks: Dict[str, threading.RLock] = {}
_per_org_locks_lock = threading.Lock()  # guards _per_org_locks mutations


def _get_org_lock(org_id: str) -> threading.RLock:
    with _per_org_locks_lock:
        if org_id not in _per_org_locks:
            _per_org_locks[org_id] = threading.RLock()
        return _per_org_locks[org_id]


def _evict_lru():
    """Evict the least-recently-used org from the cache. Caller holds _cache_lock."""
    if len(_cache) <= MAX_CACHED_ORGS:
        return
    lru = min(_cache.items(), key=lambda x: x[1][2])[0]
    del _cache[lru]
    logger.debug("[store] LRU evicted org %s from FAISS cache", lru)


def _load_org_index(org_id: str) -> Tuple[faiss.Index, Dict]:
    """
    Return (index, mapping) for org_id, loading from disk on first access.
    Updates LRU timestamp on every call.
    """
    # Fast path: already cached
    with _cache_lock:
        if org_id in _cache:
            idx, mp, _ = _cache[org_id]
            _cache[org_id] = (idx, mp, time.monotonic())
            return idx, mp

    # Slow path: load from disk under per-org lock
    org_lock = _get_org_lock(org_id)
    with org_lock:
        # Re-check cache after acquiring lock
        with _cache_lock:
            if org_id in _cache:
                idx, mp, _ = _cache[org_id]
                _cache[org_id] = (idx, mp, time.monotonic())
                return idx, mp

        idx_path, map_path = _org_paths(org_id)

        # Load or create FAISS index
        if os.path.exists(idx_path):
            try:
                index = faiss.read_index(idx_path)
                if index.d != DIM:
                    logger.warning("[store] Org %s dim mismatch (%d vs %d) — rebuilding as HNSW", org_id, index.d, DIM)
                    index = _make_hnsw_index(DIM)
                elif not isinstance(index, faiss.IndexHNSWFlat):
                    logger.warning("[store] Org %s index is %s, not HNSW — upgrading", org_id, type(index).__name__)
                    index = _make_hnsw_index(DIM)
            except Exception as e:
                logger.warning("[store] Failed to load index for org %s: %s — creating fresh HNSW", org_id, e)
                index = _make_hnsw_index(DIM)
        else:
            index = _make_hnsw_index(DIM)

        # Load or create mapping
        if os.path.exists(map_path):
            try:
                with open(map_path, "r", encoding="utf-8") as f:
                    mapping = json.load(f)
            except Exception as e:
                logger.warning("[store] Failed to load map for org %s: %s — creating fresh", org_id, e)
                mapping = {"next": 0, "chunk_to_faiss": {}}
        else:
            mapping = {"next": 0, "chunk_to_faiss": {}}

        with _cache_lock:
            _cache[org_id] = (index, mapping, time.monotonic())
            _evict_lru()

        logger.debug("[store] Loaded org %s index (%d vectors)", org_id, index.ntotal)
        return index, mapping


def _save_org_index(org_id: str, index: faiss.Index, mapping: Dict):
    """Persist index + mapping to disk. Caller should hold per-org lock."""
    idx_path, map_path = _org_paths(org_id)
    faiss.write_index(index, idx_path)
    with open(map_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# BM25 sparse corpus  (stored alongside FAISS index, one file per org)
# ---------------------------------------------------------------------------

_bm25_cache: Dict[str, Dict] = {}   # { org_id: {"texts": [...], "faiss_ids": [...], "model": BM25Okapi} }
_bm25_lock = threading.Lock()


def _bm25_path(org_id: str) -> str:
    idx_dir = os.path.join(INDEX_DIR, "orgs")
    os.makedirs(idx_dir, exist_ok=True)
    return os.path.join(idx_dir, f"{org_id}.bm25")


def _tokenize(text: str) -> List[str]:
    """Simple whitespace + punctuation tokeniser — fast and dependency-free."""
    return re.findall(r"[a-z0-9]+", text.lower())


def _build_bm25(texts: List[str]):
    """Build a BM25Okapi model from a list of texts. Returns None if library absent."""
    try:
        from rank_bm25 import BM25Okapi
        corpus = [_tokenize(t) for t in texts]
        return BM25Okapi(corpus)
    except Exception as exc:
        logger.warning("[store] BM25 build failed: %s", exc)
        return None


def _load_org_bm25(org_id: str) -> Optional[Dict]:
    """Return the cached BM25 corpus for org_id, loading from disk on first access."""
    with _bm25_lock:
        if org_id in _bm25_cache:
            return _bm25_cache[org_id]

    path = _bm25_path(org_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)   # {"texts": [...], "faiss_ids": [...]}
        model = _build_bm25(data["texts"])
        if model is None:
            return None
        corpus = {"texts": data["texts"], "faiss_ids": data["faiss_ids"], "model": model}
        with _bm25_lock:
            _bm25_cache[org_id] = corpus
        return corpus
    except Exception as exc:
        logger.warning("[store] BM25 load failed for org %s: %s", org_id, exc)
        return None


def _save_org_bm25(org_id: str, texts: List[str], faiss_ids: List[int]):
    """Persist BM25 corpus to disk and update the in-memory cache."""
    path = _bm25_path(org_id)
    try:
        with open(path, "wb") as f:
            pickle.dump({"texts": texts, "faiss_ids": faiss_ids}, f)
        model = _build_bm25(texts)
        if model:
            with _bm25_lock:
                _bm25_cache[org_id] = {"texts": texts, "faiss_ids": faiss_ids, "model": model}
    except Exception as exc:
        logger.warning("[store] BM25 save failed for org %s: %s", org_id, exc)


def add_org_bm25_texts(org_id: str, texts: List[str], faiss_ids: List[int]):
    """
    Append new chunk texts + their FAISS IDs to the org's BM25 corpus.
    Called at ingest time alongside add_org_vectors().
    """
    existing = _load_org_bm25(org_id)
    if existing:
        all_texts = existing["texts"] + texts
        all_ids   = existing["faiss_ids"] + faiss_ids
    else:
        all_texts, all_ids = texts, faiss_ids
    _save_org_bm25(org_id, all_texts, all_ids)
    logger.info("[store] BM25 corpus for org %s: %d docs", org_id, len(all_texts))


def search_org_bm25(org_id: str, query: str, k: int = 10) -> List[Tuple[int, float]]:
    """
    Search the org's BM25 corpus. Returns [(faiss_id, normalised_score), ...] top-k,
    sorted descending. Normalised score is in [0, 1].
    Returns [] if no corpus or rank-bm25 not installed.
    """
    corpus = _load_org_bm25(org_id)
    if not corpus or not corpus["texts"]:
        return []
    try:
        tokens = _tokenize(query)
        if not tokens:
            return []
        raw_scores = corpus["model"].get_scores(tokens)   # numpy array, len = corpus size
        max_score = float(raw_scores.max())
        if max_score == 0:
            return []
        norm_scores = raw_scores / max_score              # normalise to [0, 1]
        top_idx = np.argsort(norm_scores)[::-1][:k]
        results = [
            (corpus["faiss_ids"][i], float(norm_scores[i]))
            for i in top_idx
            if norm_scores[i] > 0
        ]
        return results
    except Exception as exc:
        logger.warning("[store] BM25 search failed for org %s: %s", org_id, exc)
        return []


# ---------------------------------------------------------------------------
# Public per-org API
# ---------------------------------------------------------------------------

def add_org_vectors(org_id: str, chunk_ids: List[str], vectors: List[List[float]]) -> List[int]:
    """
    Add vectors for an org's chunks to its private FAISS index.
    Returns the list of assigned FAISS IDs.
    """
    if not org_id:
        raise VectorStoreError("org_id is required for per-org vector addition")
    if not chunk_ids or not vectors:
        raise VectorStoreError("chunk_ids and vectors must not be empty")
    if len(chunk_ids) != len(vectors):
        raise VectorStoreError(f"Mismatch: {len(chunk_ids)} chunk_ids vs {len(vectors)} vectors")

    arr = np.array(vectors, dtype=np.float32)
    if np.any(np.isnan(arr)) or np.any(np.isinf(arr)):
        raise VectorStoreError("Vectors contain NaN or infinite values")
    norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
    arr = arr / norms

    org_lock = _get_org_lock(org_id)
    with org_lock:
        index, mapping = _load_org_index(org_id)
        start_id = mapping["next"]
        index.add(arr)
        assigned_ids = list(range(start_id, start_id + len(chunk_ids)))
        for cid, fid in zip(chunk_ids, assigned_ids):
            mapping["chunk_to_faiss"][str(cid)] = fid
        mapping["next"] = start_id + len(chunk_ids)

        # Write back to cache
        with _cache_lock:
            _cache[org_id] = (index, mapping, time.monotonic())

        _save_org_index(org_id, index, mapping)

    logger.info("[store] Added %d vectors for org %s (total: %d)", len(vectors), org_id, index.ntotal)
    return assigned_ids


def search_org_vectors(org_id: str, vec: List[float], k: int = 6) -> Tuple[List[float], List[int]]:
    """
    Search only this org's FAISS index. Returns (scores, faiss_ids).
    Zero cross-org bleed — no results from other orgs can appear.
    """
    if not org_id:
        # Fallback to legacy global search (graceful degradation)
        return search_vectors(vec, k)

    if len(vec) != DIM:
        raise VectorStoreError(f"Query vector dim mismatch: expected {DIM}, got {len(vec)}")

    index, _ = _load_org_index(org_id)

    if index.ntotal == 0:
        return [], []

    v = np.array([vec], dtype=np.float32)
    v = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)
    actual_k = min(k, index.ntotal)
    scores, ids = index.search(v, actual_k)

    valid = [(float(s), int(i)) for s, i in zip(scores[0], ids[0]) if i >= 0]
    if not valid:
        return [], []
    final_scores, final_ids = zip(*valid)
    return list(final_scores), list(final_ids)


def get_org_index(org_id: str) -> Optional[faiss.Index]:
    """Return the in-memory FAISS index for an org (None if empty)."""
    try:
        index, _ = _load_org_index(org_id)
        return index if index.ntotal > 0 else None
    except Exception:
        return None


async def save_org_snapshot(org_id: str, index: faiss.Index, vector_count: int) -> bool:
    """Persist per-org FAISS binary snapshot to app.faiss_snapshots."""
    try:
        from .db import get_connection
        buf = faiss.serialize_index(index)
        data_bytes = buf.tobytes()
        conn = await get_connection()
        try:
            await conn.execute(
                """
                INSERT INTO app.faiss_snapshots (organization_id, data, vector_count)
                VALUES ($1, $2, $3)
                """,
                org_id, data_bytes, vector_count,
            )
            await conn.execute(
                """
                DELETE FROM app.faiss_snapshots
                WHERE organization_id = $1
                  AND id NOT IN (
                    SELECT id FROM app.faiss_snapshots
                    WHERE organization_id = $1
                    ORDER BY created_at DESC LIMIT 3
                  )
                """,
                org_id,
            )
        finally:
            await conn.close()
        logger.info("[store] Saved snapshot for org %s (%d vectors, %d bytes)", org_id, vector_count, len(data_bytes))
        return True
    except Exception as exc:
        logger.warning("[store] Snapshot save failed for org %s: %s", org_id, exc)
        return False


async def load_org_snapshot(org_id: str) -> Optional[int]:
    """
    Load the latest snapshot for org_id into the in-memory cache.
    Returns vector count on success, None if no snapshot.
    """
    try:
        from .db import get_connection
        conn = await get_connection()
        try:
            row = await conn.fetchrow(
                """
                SELECT data, vector_count FROM app.faiss_snapshots
                WHERE organization_id = $1
                ORDER BY created_at DESC LIMIT 1
                """,
                org_id,
            )
        finally:
            await conn.close()

        if not row:
            return None

        arr = np.frombuffer(bytes(row["data"]), dtype=np.uint8)
        index = faiss.deserialize_index(arr)
        if index.d != DIM or not isinstance(index, faiss.IndexHNSWFlat):
            logger.info("[store] Snapshot for org %s is stale (type=%s, dim=%d) — will rebuild as HNSW", org_id, type(index).__name__, index.d)
            return None

        mapping: Dict = {"next": index.ntotal, "chunk_to_faiss": {}}
        with _cache_lock:
            _cache[org_id] = (index, mapping, time.monotonic())
            _evict_lru()

        logger.info("[store] Loaded snapshot for org %s (%d vectors)", org_id, index.ntotal)
        return int(row["vector_count"])
    except Exception as exc:
        logger.warning("[store] Snapshot load failed for org %s: %s", org_id, exc)
        return None


async def rebuild_org_from_db(org_id: str) -> int:
    """
    Rebuild the FAISS index for one org from its stored embeddings in app.chunks.
    Used on cold start (Render spin-up, first-ever request for that org).
    """
    try:
        from .db import get_connection
        conn = await get_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT id, faiss_id, embedding, text FROM app.chunks
                WHERE organization_id = $1 AND embedding IS NOT NULL
                ORDER BY faiss_id ASC NULLS LAST
                """,
                org_id,
            )
        finally:
            await conn.close()

        if not rows:
            logger.info("[store] No embeddings for org %s — empty index", org_id)
            return 0

        index = _make_hnsw_index(DIM)
        mapping: Dict = {"next": 0, "chunk_to_faiss": {}}
        vecs, counter = [], 0
        bm25_texts: List[str] = []
        bm25_faiss_ids: List[int] = []

        for row in rows:
            emb = row["embedding"]
            if emb is None or len(list(emb)) != DIM:
                continue
            vecs.append(list(emb))
            mapping["chunk_to_faiss"][str(row["id"])] = counter
            if row["text"]:
                bm25_texts.append(row["text"])
                bm25_faiss_ids.append(counter)
            counter += 1

        if not vecs:
            return 0

        arr = np.array(vecs, dtype=np.float32)
        arr = arr / (np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12)
        index.add(arr)
        mapping["next"] = counter

        # Rebuild BM25 corpus from DB texts
        if bm25_texts:
            _save_org_bm25(org_id, bm25_texts, bm25_faiss_ids)
            logger.info("[store] BM25 corpus rebuilt for org %s: %d docs", org_id, len(bm25_texts))

        org_lock = _get_org_lock(org_id)
        with org_lock:
            _save_org_index(org_id, index, mapping)
            with _cache_lock:
                _cache[org_id] = (index, mapping, time.monotonic())
                _evict_lru()

        logger.info("[store] Rebuilt org %s index from DB: %d vectors", org_id, counter)

        import asyncio
        asyncio.ensure_future(save_org_snapshot(org_id, index, counter))
        return counter

    except Exception as exc:
        logger.error("[store] Rebuild failed for org %s: %s", org_id, exc)
        return 0


# ---------------------------------------------------------------------------
# Legacy global-index API (backward compat — used by tests / CLI tools)
# These forward to a special "__global__" org slot so existing call sites
# don't break, but new code should always pass an explicit org_id.
# ---------------------------------------------------------------------------

_GLOBAL_ORG = "__global__"


def _paths():
    os.makedirs(INDEX_DIR, exist_ok=True)
    os.makedirs(MAP_DIR, exist_ok=True)
    return (
        os.path.join(INDEX_DIR, "kb.index"),
        os.path.join(MAP_DIR,   "kb_map.json"),
    )


def load_index() -> faiss.Index:
    idx_path, _ = _paths()
    if os.path.exists(idx_path):
        idx = faiss.read_index(idx_path)
        if isinstance(idx, faiss.IndexHNSWFlat) and idx.d == DIM:
            return idx
    return _make_hnsw_index(DIM)


def save_index(index: faiss.Index):
    idx_path, _ = _paths()
    faiss.write_index(index, idx_path)


def load_map() -> Dict:
    _, map_path = _paths()
    if os.path.exists(map_path):
        with open(map_path, "r") as f:
            return json.load(f)
    return {"next": 0, "chunk_to_faiss": {}}


def save_map(mapping: Dict):
    _, map_path = _paths()
    with open(map_path, "w") as f:
        json.dump(mapping, f)


def add_vectors_for_chunks(chunk_ids: List[str], vectors: List[List[float]]) -> List[int]:
    """Legacy global-index add. Prefer add_org_vectors(org_id, …) for multi-tenant use."""
    logger.warning("[store] add_vectors_for_chunks called without org_id — using global index")
    return add_org_vectors(_GLOBAL_ORG, chunk_ids, vectors)


def search_vectors(vec: List[float], k: int = 6) -> Tuple[List[float], List[int]]:
    """Legacy global-index search. Prefer search_org_vectors(org_id, …) for multi-tenant use."""
    logger.warning("[store] search_vectors called without org_id — using global index")
    return search_org_vectors(_GLOBAL_ORG, vec, k)


async def save_index_snapshot(index: faiss.Index, vector_count: int) -> bool:
    """Legacy snapshot save. Prefer save_org_snapshot(org_id, …)."""
    return await save_org_snapshot(_GLOBAL_ORG, index, vector_count)


async def load_index_from_snapshot():
    return None  # legacy stub — callers should use load_org_snapshot


async def rebuild_faiss_from_db() -> int:
    """Legacy full rebuild. Rebuilds global index only."""
    return await rebuild_org_from_db(_GLOBAL_ORG)


def add_to_org_index(org_id: str, embedding: List[float], metadata: Dict) -> Optional[int]:
    """
    Single-vector convenience wrapper for CASPER entity embedding.
    Adds one embedding vector and returns its assigned FAISS ID.
    metadata must include at least: entity_type, entity_id, text, title.
    Returns None on failure — callers should degrade gracefully.
    """
    try:
        entity_id = str(metadata.get("entity_id", id(embedding)))
        ids = add_org_vectors(org_id, [entity_id], [embedding])
        return ids[0] if ids else None
    except Exception as exc:
        logger.warning("[store] add_to_org_index failed: %s", exc)
        return None
