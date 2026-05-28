# Sprint Doc Index

One file per item. Each file explains what it is, what files it touches, and how to verify it works.

## Month 2 — Speed Sprint

| # | File | Status | What it does |
|---|------|--------|-------------|
| P7 | [P7_composite_db_indexes.md](P7_composite_db_indexes.md) | ✅ Done | Postgres indexes — ticket list, search, messages |
| P8 | [P8_materialized_view.md](P8_materialized_view.md) | ✅ Done | Pre-computed ticket counts for dashboard |
| P4 | [P4_ai_streaming_sse.md](P4_ai_streaming_sse.md) | ✅ Done | AI chat streams tokens live — 5s wait → 300ms first token |
| P1+P9 | [P1_P9_hnsw_and_matryoshka.md](P1_P9_hnsw_and_matryoshka.md) | ✅ P1 Done | HNSW index live at 1024-dim. P9 (→512-dim) needs JINA_API_KEY to re-embed. |
| P2 | [P2_bm25_hybrid_search.md](P2_bm25_hybrid_search.md) | ✅ Done | BM25 + dense search merged via RRF — +15–25% recall |
| P3 | [P3_semantic_cache.md](P3_semantic_cache.md) | ✅ Done | Semantic cache — skip Groq on repeated queries, 0ms on hits |
| P5 | [P5_swr_data_layer.md](P5_swr_data_layer.md) | ✅ Done | SWR — instant navigation on revisit, auto-refresh on rep page |
| P6 | [P6_virtual_scroll.md](P6_virtual_scroll.md) | ✅ Done | Virtual scroll on admin ticket list — DOM stays small at any list size |

## Phase 0 — CASPER Foundation

| # | File | Status | What it does |
|---|------|--------|-------------|
| C0 | [CASPER_PHASE0_FOUNDATION.md](CASPER_PHASE0_FOUNDATION.md) | ✅ Done | Renamed stale classes; 4 entity namespaces; 5 CASPER tools; dual-mode prompt; Related Entities panel |

## Month 3 — Platform Hub + Modules

| # | File | Status | What it does |
|---|------|--------|-------------|
| M3-KB | [M3_knowbase.md](M3_knowbase.md) | ✅ Done | KnowBase — SOPs, runbooks, how-to guides (separate from RAG KB) |
| M3-BV | [M3_billingvault.md](M3_billingvault.md) | ✅ Done | BillingVault — invoice generation, PDF letterhead, clients, payments |
| M3-S1 | [STRATA_MODULES_SPRINT.md](STRATA_MODULES_SPRINT.md) | ✅ Done | CostLens · ProcureFlow · PatchWatch · ChangeBoard — all built, migrated, deployed |
