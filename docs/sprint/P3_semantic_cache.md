# P3 — Semantic Response Cache

**Status:** ✅ Done  
**Sprint:** Month 2 — Speed Sprint  
**Effort:** ~1 hour  

---

## What This Is

Before every Groq call, check whether a semantically identical question was already answered for this org in the last hour. If yes, return the cached answer instantly — **0ms, 0 Groq tokens**.

"Semantically similar" = cosine similarity ≥ 0.95 between the new query embedding and a stored one. This catches rephrased but equivalent questions:
- "How do I reset a password?" ≈ "What's the process for resetting passwords?"
- "VPN not connecting" ≈ "Can't connect to VPN"

---

## What Was Changed

| File | Change |
|------|--------|
| `backend/app/tickets.py` | Added `_cache_lookup()`, `_cache_store()`, cache data structures. Modified both `chat_with_ai()` and `chat_with_ai_stream()` to check cache first, pass pre-computed embedding to `retrieve()`. |
| `backend/app/rag.py` | Added optional `query_vector` parameter to `retrieve()` — skips embedding step when caller provides a pre-computed vector. |

No new dependencies.

---

## Cache Design

```python
# In-memory per-org cache
_response_cache: Dict[str, list] = {}   # {org_id: [entry, ...]}
_response_cache_lock = threading.Lock()

# Entry structure
{"emb": np.ndarray, "answer": str, "ts": float}

# Tuneable via environment
RESPONSE_CACHE_TTL  = 3600    # 1 hour TTL per entry
RESPONSE_CACHE_MAX  = 200     # max entries per org (LRU evict oldest)
RESPONSE_CACHE_SIM  = 0.95    # cosine similarity threshold
```

---

## Request Flow

**Cache hit (fast path):**
```
query
  → scrub PII
  → embed query (1 Jina call)
  → cosine check vs cached entries (~0.1ms, NumPy matmul)
  → return cached answer + persist to DB
  ← response in ~100ms total (no Groq call)
```

**Cache miss (normal path):**
```
query
  → scrub PII
  → embed query (1 Jina call)           ← same embedding reused below
  → cosine check → miss
  → retrieve(query_vector=emb)           ← embedding reused, no double embed
  → Groq generation (~2s)
  → store in cache (if confidence ≥ 0.5 and chunks found and no escalation)
  ← response in ~2s
```

**Key optimisation:** The query embedding computed for the cache check is forwarded to `retrieve()` via the new `query_vector` parameter. Cache misses pay exactly 1 Jina call (not 2). Cache hits pay 1 Jina call + skip Groq entirely.

---

## What Gets Cached vs. Skipped

**Cached:**
- Responses with `confidence ≥ 0.5`
- Responses where KB chunks were found (not no-context fallbacks)
- Non-escalated responses only (`should_escalate_flag = False` for non-streaming)

**Never cached:**
- No-context responses (`"I don't have enough information..."`) — each ticket situation differs
- Low-confidence responses (< 0.5) — uncertain answers shouldn't be replayed
- Streaming endpoint stores with `confidence=0.7` approximation when chunks existed

---

## Similarity Logic

```python
embs_u = embs / np.where(norms > 0, norms, 1.0)   # L2-normalise stored entries
sims = embs_u @ (q_emb / q_norm)                   # batch cosine, O(N·D) matmul
best = int(np.argmax(sims))
if sims[best] >= 0.95:
    return entries[best]["answer"]
```

For 200 entries at 1024-dim: ~200×1024 = 204k multiply-adds per lookup ≈ **0.1ms**. Effectively free.

---

## Cache Invalidation

Entries expire naturally via `RESPONSE_CACHE_TTL = 3600s`. When a new KB document is ingested (`/api/kb/ingest`), the cache is NOT explicitly invalidated — the TTL handles it. Worst case: a stale answer survives for up to 1 hour after a KB update. Acceptable for most IT support scenarios.

To force invalidation (e.g., after a major KB update):

```python
# One-liner to clear all caches for an org:
from app.tickets import _response_cache, _response_cache_lock
import threading
with _response_cache_lock:
    _response_cache.pop("org-id-here", None)
```

---

## Expected Impact

For a typical IT support org:
- Common question ("password reset") asked 10× per day
- First answer: Groq call (~2s) + 1 Jina embed
- Answers 2–10: cache hit (~100ms) + 1 Jina embed — **Groq skipped**
- 20 common questions × 9 cache hits = **180 Groq calls saved/day**
- At $0.002/call: ~$0.36/day saved per active org

---

## How to Verify

```bash
# In backend/ with venv activated:
python3 - <<'EOF'
import numpy as np
from app.tickets import _cache_lookup, _cache_store

org = "test-org"
emb = np.random.randn(1024).astype(np.float32)
emb /= np.linalg.norm(emb)

_cache_store(org, emb, "The answer is X.", confidence=0.8)

# Exact hit
assert _cache_lookup(org, emb) == "The answer is X."

# Near-identical (slight noise, should still hit)
noisy = emb + np.random.randn(1024).astype(np.float32) * 0.01
noisy /= np.linalg.norm(noisy)
assert _cache_lookup(org, noisy) == "The answer is X."

# Random vector (should miss)
rand = np.random.randn(1024).astype(np.float32)
assert _cache_lookup(org, rand) is None

# Low confidence (should not store)
_cache_store(org, rand, "uncertain", confidence=0.3)
assert _cache_lookup(org, rand) is None

print("All cache tests passed!")
EOF
```

**Verified ✅** — all four cases pass.

---

## What Stays The Same

- API contracts — `chat_with_ai` and `chat_with_ai_stream` signatures unchanged
- `retrieve()` — backward compatible; `query_vector=None` default means all existing callers continue to work
- DB schema — no changes; cache hits persist a regular `app.messages` row with `meta.cache_hit = true`
- Feature gates — cache runs transparently inside the existing `ai_rag` gate
