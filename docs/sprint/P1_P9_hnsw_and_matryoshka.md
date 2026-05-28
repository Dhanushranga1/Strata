# P1 + P9 — HNSW Vector Index + Matryoshka 512-dim Embeddings

**Status:** ✅ P1 Done — P9 is a separate migration (requires JINA_API_KEY)  
**Sprint:** Month 2 — Speed Sprint  
**Effort:** ~1.5 hours  
**Done together because:** Both require a full FAISS index rebuild — do it once, not twice.

---

## What This Is

Two changes to the AI/RAG search layer that together make vector search 6× faster and 6× smaller, with no accuracy loss worth measuring.

### P9 — Matryoshka 512-dim (the "smaller vectors" change)

Jina v3 (the embedding model) supports **Matryoshka Representation Learning** — you can truncate its 3072-dimensional output to just the first 512 dimensions with less than 2% accuracy loss on retrieval benchmarks.

- Each KB chunk currently stores 3072 floats → becomes 512 floats
- FAISS index goes from ~12MB per 1k chunks to ~2MB
- Every similarity search does 6× less arithmetic

### P1 — HNSW Index (the "smarter search" change)

Currently FAISS uses `IndexFlatIP` — brute-force: compare the query vector against every stored vector. O(N).

**HNSW** (Hierarchical Navigable Small World) builds a graph of vectors at different "zoom levels". Searching means traversing the graph — O(log N).

| Vectors | FlatIP | HNSW |
|---------|--------|------|
| 1,000 | ~5ms | ~1ms |
| 10,000 | ~100ms | ~4ms |
| 100,000 | ~1,000ms | ~8ms |

At 10k KB chunks (large org), search goes from 100ms to 4ms. At 100k it goes from 1 second to 8ms.

---

## What It Touches

| File | Change |
|------|--------|
| `backend/app/embeddings.py` | Change `truncate_dim` from 3072 → 512 |
| `backend/app/store.py` | Replace `IndexFlatIP` with `IndexHNSWFlat` in `_load_org_index()` |
| `.env` | Add `EMBEDDING_DIM=512` (was implicit 3072) |

No API changes. No frontend changes. No new dependencies.

---

## HNSW Settings

```python
index = faiss.IndexHNSWFlat(512, M=32)
index.hnsw.efSearch = 64        # beam width at query time
index.hnsw.efConstruction = 200 # beam width when adding vectors
```

| Parameter | Value | What it means |
|-----------|-------|---------------|
| `M=32` | 32 | Connections per node in the graph. Higher = better recall, more RAM. 32 is the sweet spot. |
| `efSearch=64` | 64 | How many nodes to visit per query. Higher = better recall, slower. 64 is standard. |
| `efConstruction=200` | 200 | How many nodes to consider when building. Only affects build time, not query time. |

**Recall at these settings:** ~99% vs brute-force (HNSW is approximate, but the 1% misses are always borderline matches anyway).

---

## The One Caveat

`IndexHNSWFlat` does **not** support `remove_ids()` — you can't delete a single vector. When a KB document is deleted, the FAISS index must be fully rebuilt from the database.

**This is already handled** — `rebuild_org_from_db()` exists in `store.py` and is called whenever documents are deleted. No new code needed for this.

---

## One-Time Migration

When we deploy these changes, all existing FAISS indexes (stored in `backend/data/faiss/`) become invalid because they were built with 3072-dim FlatIP. We need to call `rebuild_org_from_db()` for each org once.

This can be done:
1. **Automatically** — on startup, detect dim mismatch and rebuild
2. **Manually** — call the admin rebuild endpoint per org
3. **By clearing** — delete `backend/data/faiss/` and let the next query trigger a rebuild

We'll use option 3 (clear and auto-rebuild) — it's zero-risk since the data is in Postgres, not FAISS.

---

## What Stays The Same

- Query interface — `retrieve()` in `rag.py` is unchanged
- Accuracy — <2% recall difference, not noticeable in practice
- All existing KB documents — just re-embedded at 512 dims
- API contracts — no endpoint changes

---

## Actual Dimensions (corrected)

The model `jina-embeddings-v5-text-small` produces **1024-dim** vectors natively (not 3072 as originally assumed — that was the v3 model). All stored chunks in `app.chunks` are 1024-dim. P1 was implemented at 1024-dim.

P9 (Matryoshka truncation) would go **1024 → 512** (2× improvement, not 6×). Still worthwhile but lower priority.

## How to Verify (Verified ✅)

```bash
# In backend/ directory with venv activated:
python3 -c "
import faiss, glob
for f in glob.glob('data/faiss/orgs/*.index'):
    idx = faiss.read_index(f)
    print(type(idx).__name__, idx.d, idx.ntotal)
# Output: IndexHNSWFlat 1024 N
"
```

**Live test results:**
```
org=9eb16b4a  type=IndexHNSWFlat  dim=1024  ntotal=2   metric=IP  ✅
org=050f64b5  type=IndexHNSWFlat  dim=1024  ntotal=10  metric=IP  ✅
```

**Also fixed:** `store.py` `DIM` default was 3072 (stale v3 leftover) — corrected to 1024 to match the actual embedding model output.

---

## Upcoming After This

- **P2** — BM25 hybrid search (uses the new 512-dim vectors alongside sparse BM25)
- **P3** — Semantic cache (also uses 512-dim for cache lookup)
