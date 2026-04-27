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
import json
import time
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
DIM       = int(os.getenv("EMBEDDING_DIM", "3072"))

# Tune these via env vars for larger deployments
MAX_CACHED_ORGS = int(os.getenv("FAISS_MAX_CACHED_ORGS", "50"))


class VectorStoreError(Exception):
    pass


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

_per_org_locks: Dict[str, threading.Lock] = {}
_per_org_locks_lock = threading.Lock()  # guards _per_org_locks mutations


def _get_org_lock(org_id: str) -> threading.Lock:
    with _per_org_locks_lock:
        if org_id not in _per_org_locks:
            _per_org_locks[org_id] = threading.Lock()
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
                    logger.warning("[store] Org %s index dim mismatch (%d != %d), recreating", org_id, index.d, DIM)
                    index = faiss.IndexFlatIP(DIM)
            except Exception as e:
                logger.warning("[store] Failed to load index for org %s: %s — creating fresh", org_id, e)
                index = faiss.IndexFlatIP(DIM)
        else:
            index = faiss.IndexFlatIP(DIM)

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
        if index.d != DIM:
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
                SELECT id, faiss_id, embedding FROM app.chunks
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

        index = faiss.IndexFlatIP(DIM)
        mapping: Dict = {"next": 0, "chunk_to_faiss": {}}
        vecs, counter = [], 0

        for row in rows:
            emb = row["embedding"]
            if emb is None or len(list(emb)) != DIM:
                continue
            vecs.append(list(emb))
            mapping["chunk_to_faiss"][str(row["id"])] = counter
            counter += 1

        if not vecs:
            return 0

        arr = np.array(vecs, dtype=np.float32)
        arr = arr / (np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12)
        index.add(arr)
        mapping["next"] = counter

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
        return faiss.read_index(idx_path)
    return faiss.IndexFlatIP(DIM)


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
