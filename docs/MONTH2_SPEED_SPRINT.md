# Month 2 — Speed Sprint Plan

**Goal:** Make every part of the app noticeably faster — AI responses, search recall, page navigation, and list rendering — without adding new user-facing features.

---

## Status

| # | Item | Status | File(s) |
|---|------|--------|---------|
| P7 | Composite DB indexes | ✅ Done | `migrations/0029_perf_indexes.sql` |
| P8 | Materialized view (ticket counts) | ✅ Done | `migrations/0030_mv_dashboard.sql` |
| P4 | AI Streaming (SSE) | ✅ Done | `backend/app/ai.py`, `backend/app/tickets.py`, `frontend/.../tickets/[id]/page.tsx` |
| P1 | HNSW vector index | ⬜ | `backend/app/store.py` |
| P9 | Matryoshka 512-dim embeddings | ⬜ | `backend/app/embeddings.py` |
| P2 | BM25 hybrid search + RRF | ⬜ | `backend/app/rag.py` |
| P3 | Semantic response cache | ⬜ | `backend/app/tickets.py` |
| P5 | SWR frontend data layer | ⬜ | `frontend/src/app/(protected)/tickets/page.tsx` |
| P6 | Virtual scroll | ⬜ | `frontend/src/app/(protected)/tickets/page.tsx` |

---

## P4 — AI Streaming (SSE)

**Problem:** The AI chat on a ticket waits 5–8 seconds for the full Groq response, then renders everything at once. Users stare at a spinner.

**Fix:** Stream tokens from Groq as they arrive using Server-Sent Events (SSE).

**How it works:**
1. New backend endpoint: `GET /api/tickets/{id}/chat/stream`
   - Sets `Content-Type: text/event-stream`
   - Calls Groq with `stream=True`
   - Yields `data: <token>\n\n` for each chunk
   - Yields `data: [DONE]\n\n` when finished
2. Frontend reads the stream using `fetch` + `ReadableStream` + `TextDecoder`
3. Tokens are appended to the message as they arrive — typewriter effect

**Expected result:** First token appears in ~300ms. Full response feels 5–10× faster subjectively.

**New dep:** None — Groq SDK already supports streaming.

---

## P1 — HNSW Vector Index

**Problem:** FAISS `IndexFlatIP` does brute-force cosine search — O(N) per query. At 10k KB articles it takes ~100ms, at 100k it takes ~1s+.

**Fix:** Replace with `IndexHNSWFlat` — approximate nearest-neighbour, O(log N).

**Settings:**
- `M=32` — graph connections per node (higher = better recall, more RAM)
- `efSearch=64` — search beam width at query time (higher = better recall, slower)
- `efConstruction=200` — beam width when building the graph (set once at ingest)

**Expected gain:** 10k vectors: 100ms → 4ms. 100k: ~1s → 8ms.

**Caveat:** HNSW doesn't support `remove_ids`. Deletions trigger a full `rebuild_org_from_db()`, which already exists.

**File:** `backend/app/store.py` — `_load_org_index()` function.

---

## P9 — Matryoshka 512-dim Embeddings

**Problem:** Jina v3 outputs 3072-dimensional vectors. FAISS stores and compares all 3072 dims — 6× more work than necessary.

**Fix:** Jina v3 supports Matryoshka representation learning — you can truncate to 512 dims with <2% accuracy loss on BEIR benchmarks.

**Expected gain:** 6× smaller FAISS index, 6× faster similarity search.

**One-time migration:** After changing `EMBEDDING_DIM=512`, call `rebuild_org_from_db()` per org to re-embed with the new dimension. All existing vectors must be rebuilt.

**Files:** `backend/app/embeddings.py`, `.env` (`EMBEDDING_DIM`).

> P1 and P9 should be done together — rebuild the index once with both changes.

---

## P2 — BM25 Hybrid Search (Reciprocal Rank Fusion)

**Problem:** Dense vector search misses exact keyword matches. If a KB article says "Error 0x80070005" and the user types that exact string, FAISS may rank it low because the embedding is averaged over many tokens.

**Fix:** Add BM25 sparse retrieval alongside FAISS. Merge the two ranked lists using Reciprocal Rank Fusion (RRF):

```
final_score = Σ  1 / (60 + rank_i)
```

**Implementation:**
- `rank-bm25` library (Apache 2.0, no FAISS changes needed)
- Build a per-org BM25 corpus at ingest time, persisted as a pickle alongside the FAISS index
- `backend/app/rag.py:retrieve()` — run FAISS + BM25 in parallel, apply RRF, then MMR dedup

**Expected gain:** +15–25% recall on IT queries with model numbers, error codes, or product names.

---

## P3 — Semantic Response Cache

**Problem:** If two agents ask the same question ("how do I reset a password?"), Groq is called twice, costs tokens twice, and takes 5s twice.

**Fix:** Before each Groq call, check if the query embedding is within cosine distance 0.05 of a recent cached query for the same org. If yes, return the cached answer instantly.

**Implementation:**
- In-memory dict: `{org_id: [(embedding, answer, timestamp), ...]}`
- TTL: 1 hour. Max 200 entries per org (LRU evict).
- ~0.1ms per lookup (NumPy matmul — no new deps)
- `backend/app/tickets.py:chat_with_ai()`

**Expected gain:** 0ms on cache hits for repeated or semantically similar queries.

---

## P5 — SWR Frontend Data Layer

**Problem:** Every page mount calls `useEffect → fetch`, blocking render. Navigate away and back = another full fetch.

**Fix:** Replace `useState + useEffect + fetch` with `swr@2`. SWR gives:
- Stale-while-revalidate — serves cache instantly, revalidates in background
- Request deduplication — multiple components requesting the same data = one request
- Background refresh — data stays fresh without manual polling

**Start with:** ticket list, rep queue, platform module stats.

**New dep:** `swr@2` (MIT, ~5kb gzipped).

---

## P6 — Virtual Scroll

**Problem:** If an org has 500+ tickets, the DOM has 500+ rows. Scroll is janky, initial render is slow.

**Fix:** `@tanstack/react-virtual@3` (MIT, ~3kb) renders only the ~20 rows in the viewport. DOM stays tiny regardless of list size.

**Files:** `frontend/src/app/(protected)/tickets/page.tsx`, `frontend/src/app/(protected)/rep/page.tsx`

**New dep:** `@tanstack/react-virtual@3`

---

## Implementation Order

```
P4  → most visible user win, ships fast
P9  → change dim, triggers rebuild
P1  → swap index type, rebuild (combined with P9 — one rebuild)
P2  → add BM25 alongside FAISS
P3  → add cache layer in tickets.py
P5  → SWR (can be done in parallel with backend work)
P6  → virtual scroll (last, lowest risk)
```

---

## Testing Checklist

- [x] P4: SSE endpoint registered at `POST /api/tickets/{id}/chat/stream`
- [x] P4: Auth + feature gate correctly return 401 / 402
- [x] P4: SSE format verified — `data: {"token":...}` then `data: {"done":true,"message_id":...}`
- [x] P4: DB persistence verified — message saved and message_id returned
- [ ] P4: Browser test — first token visible within ~500ms (requires KB data + Jina key)
- [ ] P4: Typewriter cursor animates while streaming
- [ ] P1/P9: RAG still returns correct KB articles after index rebuild
- [ ] P1/P9: Embedding dimension in FAISS matches `.env` `EMBEDDING_DIM`
- [ ] P2: Exact keyword query ("Error 0x80070005") returns the correct article
- [ ] P3: Second identical query returns instantly (check backend logs for "cache hit")
- [ ] P5: Navigating away and back to ticket list does not show loading spinner (served from cache)
- [ ] P6: Ticket list with 100+ rows scrolls smoothly, check DevTools element count stays ~20 rows
