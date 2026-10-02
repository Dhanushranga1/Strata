# Architecture

```
Frontend (Next.js 15, port 3000)
  │  REST + JWT (HS256)
Backend (FastAPI, Python 3.11, port 8000)
  │
  ├── Supabase PostgreSQL (app. schema, port 6543)
  ├── pgvector index in Postgres (per org, persistent)
  └── Google AI / Groq (embeddings + LLM)
```

## Multi-tenancy

Every request carries an `X-Organization-ID` header. The `org_middleware.py`
extracts it, looks up the user's role in that org, and sets `request.state`.
All DB queries filter by `organization_id`. No cross-org data leak.

Two role systems:
- **Global** (`app.user_roles`): admin / rep / customer. Controls API access.
- **Per-org** (`app.organization_members`): owner / admin / rep / member. Controls UI actions.

## RAG pipeline

```
User query → PII scrub → embed (gemini-embedding-001, 1536-dim)
  → pgvector cosine search over app.chunks.embedding_vec (per org)
  → MMR re-ranking (relevance × diversity)
  → configured LLM generates response with [N] citations
  → CASPER confidence scoring (intent-adaptive, KB-density-calibrated)
```

## Database

Supabase PostgreSQL, `app.` schema (not `public`). 38 migration files (0001–0035) in
`backend/migrations/`. Auto-applied on startup via `migration_runner.py`.

Two connection pools:
- **asyncpg** (`db.py`): async pool, min=0 max=3, circuit breaker
- **psycopg3** (`db_sync.py`): sync pool, min=0 max=2

## Key architecture decisions

| Decision | Rationale |
|----------|-----------|
| Separate Supabase projects for dev/prod | Zero risk of dev ops touching prod data |
| Transaction pooler (port 6543) | IPv4-compatible, connection pooling built-in |
| pgvector per org (`organization_id` column + scoped queries) | Complete tenant isolation for vector search |
| Vectors stored in Postgres | No ephemeral disk, no cold-start rebuild — survives deploys |
| Two DB pools (async + sync) | asyncpg for async routes, psycopg3 for sync routes (both coexist) |
| Migration runner on startup | No manual SQL Editor step; idempotent, tracks applied in `app.schema_migrations` |
