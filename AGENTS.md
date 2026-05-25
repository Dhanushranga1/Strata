# TicketPilot

## Monorepo layout
- `frontend/` — Next.js 15, React 19, TypeScript, Tailwind, Radix UI, HeroUI
- `backend/` — FastAPI, Python 3.11, asyncpg + psycopg3, FAISS, Gemini
- Root `package-lock.json` is empty; all JS deps in `frontend/`

## First-time setup
```bash
make setup     # creates .env, installs deps
make migrate   # runs pending migrations
```

## Run dev servers
```bash
make dev       # both servers in parallel
# OR manually:
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev
```

## Key commands (make targets)

| Command | What it does |
|---------|-------------|
| `make dev` | Start both servers |
| `make test` | All tests |
| `make lint` | ESLint + Prettier + Black + isort + mypy + bandit |
| `make format` | Auto-format |
| `make type-check` | TypeScript tsc --noEmit |
| `make migrate` | Run pending DB migrations |
| `make build` | Frontend production build |

**Frontend-only** (CI order: type-check → lint → format:check → build → test):
- `npm run type-check` — tsc --noEmit
- `npm run lint` — next lint
- `npm run format:check` — prettier --check
- `npm run build` — next build
- `npm test` — jest
- `npm run test:coverage` — jest, 70% threshold

**Backend-only**:
- `pytest -v` — all tests
- `pytest tests/test_rag_scoring.py -v -s` — single file
- `pytest -m "not slow"` — skip slow
- `black --check --diff .` — formatting
- `isort --check-only --diff .` — import sort
- `mypy app/ --ignore-missing-imports` — type check
- `bandit -r app/` — security scan

Integration test (both servers running): `python rag_validation_suite.py`

## Database
- Supabase PostgreSQL, `app.` schema (NOT `public`)
- 27 migrations in `backend/migrations/`, run sequentially via Supabase SQL Editor
- Connection uses **transaction pooler** port **6543**, not 5432
- Migrations auto-apply on startup via `migration_runner.py` (idempotent, tracks applied in `app.schema_migrations`)

## Auth
- JWT HS256 via Supabase
- **CRITICAL**: `SUPABASE_JWT_SECRET` = raw signing secret from Settings→API→JWT Settings, NOT the service_role JWT token. Wrong value → `401 Invalid token` on all requests.

## Architecture quirks
- Two DB pools: asyncpg `db.py` (async) + psycopg3 `db_sync.py` (sync)
- Two role systems: global `app.user_roles` (admin/rep/customer) + per-org `app.organization_members` (owner/admin/rep/member)
- FAISS index per org on ephemeral filesystem — **wiped on every deploy**, re-upload KB docs
- Org context via `X-Organization-ID` header, processed in `org_middleware.py`
- DB pool circuit breaker: 1 failure → 30s cooldown
- Background tasks: overdue scan (15 min), pool keepalive (4 min), FAISS rebuild (startup)

## RAG pipeline
2400 char chunks, 400 overlap → text-embedding-004 (768-dim) → FAISS IndexFlatIP → MMR re-ranking → Gemini 1.5 flash → CASPER confidence scoring (intent-adaptive, KB-density-calibrated)

## Deployment
- Frontend → Vercel: `npm run build`, output `.next`
- Backend → Render (render.yaml): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env var name: `NEXT_PUBLIC_API_URL` (not `_API_BASE`)
- `WEB_ORIGIN` = exact frontend URL, no trailing slash
- Migrations auto-apply on startup — no manual step needed

## Env setup
```
backend/.env.dev.example → backend/.env
frontend/.env.local.example → frontend/.env.local
```

## Pre-deploy reminders
- FAISS indices wiped on redeploy → re-upload KB docs
- `SUPABASE_SERVICE_ROLE_KEY` required for invite emails

## Frontend conventions
- `@/` alias → `src/` (tsconfig.json + next.config.ts webpack alias)
- `next.config.ts` transpiles `@heroui/react` and `@heroui/theme`
- API via `src/lib/api-client.ts` (auto-auth, 30s GET cache, retry 502/503 on cold-start)
- Prettier: single quotes, no trailing comma in func params, 80 width
- ESLint: next/core-web-vitals + next/typescript
