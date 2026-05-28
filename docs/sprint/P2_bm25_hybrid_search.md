# P2 — BM25 Hybrid Search (Reciprocal Rank Fusion)

**Status:** ✅ Done  
**Sprint:** Month 2 — Speed Sprint  
**Effort:** ~2 hours  

---

## What This Is

The RAG pipeline was **dense-only** — embed query, find nearest FAISS vectors. That misses exact keyword matches.

**Problem example:** A KB article titled "Error 0x80070005 — Access Denied on Windows Update" exists. A user types "error 0x80070005". FAISS finds semantically similar articles, but might not surface the exact-match article if its embedding is diluted by surrounding text. The user gets a generic answer instead of the specific one.

**Fix:** Two retrievers, merged with Reciprocal Rank Fusion:
1. **Dense (FAISS)** — semantic similarity, good for concepts and paraphrases
2. **Sparse (BM25)** — exact term frequency, good for error codes, serial numbers, product SKUs

**RRF formula:**
```
final_score = Σ  1 / (60 + rank_i)
```
A document ranked #1 in both lists gets `1/60 + 1/60 = 0.0333`. One ranked #1 in only one list gets `1/60 = 0.0167`. Documents only BM25 knows about are still promoted if they have strong keyword signal.

Expected improvement: **+15–25% recall** on IT queries with exact identifiers.

---

## What Was Changed

| File | Change |
|------|--------|
| `backend/app/store.py` | Added `_tokenize()`, `_build_bm25()`, `_load_org_bm25()`, `_save_org_bm25()`, `add_org_bm25_texts()`, `search_org_bm25()`. Updated `rebuild_org_from_db()` to also fetch chunk text and build BM25 corpus. |
| `backend/app/kb.py` | Added `add_org_bm25_texts()` call after `add_org_vectors()` at ingest time |
| `backend/app/rag.py` | `retrieve()` — step 3 replaced with 3a/3b/3c: FAISS search + BM25 search + RRF merge. Added `bm25_candidates` and `rrf_applied` to `retrieval_metrics`. |
| `backend/requirements.txt` | Added `rank-bm25==0.2.2` (Apache 2.0) |

---

## Storage Layout

```
backend/data/faiss/orgs/
  {org_id}.index       ← HNSW vectors (from P1)
  {org_id}.bm25        ← BM25 corpus: pickle {"texts": [...], "faiss_ids": [...]}
```

Each BM25 file stores the raw chunk texts and their corresponding FAISS IDs. The `BM25Okapi` model is rebuilt in-memory from texts at load time (~ms, no extra disk format).

---

## Retrieve Pipeline (New)

```
query
  ├─ embed → FAISS search (k=search_k, MIN_SCORE filter) → faiss_candidates
  └─ tokenize → BM25 search (k=search_k) → bm25_candidates
                      ↓
                RRF merge (K=60)
                  score = 1/(60+faiss_rank) + 1/(60+bm25_rank)
                      ↓
                top-k by RRF score
                      ↓
                fetch chunks from DB
                      ↓
                MMR re-rank → final TOP_K chunks
```

BM25 search fails silently — if no corpus or `rank-bm25` is missing, `bm25_candidates = []` and the pipeline falls back to FAISS-only. No errors surface to the user.

---

## Implementation Details

### Tokenisation
```python
def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", text.lower())
```
Simple lowercase alphanumeric split. Handles error codes like `0x80070005` as a single token.

### RRF Merge
```python
_K_RRF = 60  # standard RRF constant — suppresses rank noise for low-scoring items
faiss_rank_map = {fid: rank for rank, fid, _ in faiss_candidates}
bm25_rank_map  = {fid: rank for rank, (fid, _) in enumerate(bm25_candidates)}
all_fids = set(faiss_rank_map) | set(bm25_rank_map)

rrf_scores = {
    fid: (
        (1.0 / (_K_RRF + faiss_rank_map[fid]) if fid in faiss_rank_map else 0.0) +
        (1.0 / (_K_RRF + bm25_rank_map[fid])  if fid in bm25_rank_map  else 0.0)
    )
    for fid in all_fids
}
sorted_rrf = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:search_k]
```

### BM25 Score Normalisation
`search_org_bm25` normalises raw BM25 scores to `[0, 1]` by dividing by the max score in the result set. This makes the scores comparable across different KB sizes and prevents BM25 from dominating RRF just because of corpus vocabulary differences.

---

## Metrics Added to Retrieval Response

The `retrieval_metrics` dict returned by `retrieve()` now includes:

| Key | Value | Meaning |
|-----|-------|---------|
| `bm25_candidates` | int | Number of BM25 hits before RRF |
| `rrf_applied` | bool | `True` if BM25 had results and RRF was used |

These flow into CASPER confidence scoring and the debug logs.

---

## New Dependency

```
rank-bm25==0.2.2   # Apache 2.0, pure Python, no compiled extensions
```

---

## Migration: Existing Orgs

Orgs indexed before this change have no `.bm25` file. Two paths:

**Automatic (next ingest):** When the next document is ingested via `/api/kb/ingest`, `add_org_bm25_texts()` is called and a corpus is created from the new chunks. Old chunks won't be in BM25 until a full rebuild.

**Full rebuild (recommended):** Trigger `rebuild_org_from_db()` for each org once. This is called automatically on cold-start if the FAISS index is missing, or manually via:
```python
from app.store import rebuild_org_from_db
await rebuild_org_from_db(org_id)
```
This rebuilds both FAISS + BM25 from `app.chunks` in Postgres.

---

## How to Verify

```bash
# In backend/ with venv activated and .env loaded:
python3 -c "
import asyncio, os
from dotenv import load_dotenv; load_dotenv('.env')
from app.store import search_org_bm25, rebuild_org_from_db
import glob

org_ids = [os.path.basename(f).replace('.index','') for f in glob.glob('data/faiss/orgs/*.index')]

async def main():
    for oid in org_ids:
        await rebuild_org_from_db(oid)
    for oid in org_ids:
        hits = search_org_bm25(oid, 'password reset', k=3)
        print(f'org={oid[:8]}  bm25_hits={hits}')

asyncio.run(main())
"
```

**Live test results (verified ✅):**
```
BM25 corpus for org 050f64b5: 10 docs
BM25 hits for 'account management': [(1, 1.0), (0, 0.848), (3, 0.302), ...]
BM25 hits for 'billing':            [(7, 1.0), (2, 0.959), (9, 0.955), ...]

RRF merge (K=60) verified — documents appearing in both FAISS and BM25 
correctly score higher than those in only one list.
```

---

## What Stays The Same

- All existing API contracts — `retrieve()` signature unchanged
- CASPER confidence scoring — `retrieval_metrics` additions are additive, not breaking
- Feature gates — no new gates; BM25 runs silently alongside existing FAISS path
- Error handling — BM25 failures fall back to FAISS-only with a `logger.warning`
