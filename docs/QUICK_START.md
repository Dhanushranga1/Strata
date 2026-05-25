# Quick Start

## First time (requires a Supabase project)

```bash
git clone <repo-url>
cd ticketpilot
make setup     # create .env files, install deps
make migrate   # run all pending migrations
make dev       # start backend + frontend
```

Open http://localhost:3000.

## Prerequisites

| What | Why | How |
|------|-----|-----|
| Python 3.10+ | Backend | `python3 --version` |
| Node.js 18+ | Frontend | `node --version` |
| Supabase project | Database + Auth | [supabase.com](https://supabase.com) → new project |
| Google AI Studio key | Embeddings + LLM | [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey) |

## Supabase project setup

1. Create a **dev** project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy these into `backend/.env`:
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT Secret` (under JWT Settings) → `SUPABASE_JWT_SECRET`
3. Go to **Settings → Database → Connection string → URI**
   - Copy the **Transaction mode pooler** URI (port **6543**) → `DATABASE_URL`

> `SUPABASE_JWT_SECRET` is the raw signing secret — NOT the service_role token.
> Wrong value = `401 Invalid token` on every request.

## Daily development

```bash
make dev        # both servers
make test       # all tests
make lint       # ESLint + Black + isort + mypy + bandit
make format     # auto-format
make type-check # TypeScript check
make migrate    # run pending migrations
```

## Manual commands (without Makefile)

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

## First-time admin setup

Register at http://localhost:3000, then in Supabase SQL Editor:

```sql
INSERT INTO app.user_roles (user_id, role)
VALUES ('your-user-uuid', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

Find your UUID in Supabase **Auth → Users**.

## URLs

| URL | What |
|-----|------|
| http://localhost:3000 | Frontend |
| http://localhost:8000/api/health | Backend health |
| http://localhost:8000/docs | Swagger API docs |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Invalid token` everywhere | `SUPABASE_JWT_SECRET` is wrong | Set to raw signing secret, not service_role token |
| AI responses all low confidence | FAISS index empty | Upload KB docs after every deploy |
| CORS errors | `WEB_ORIGIN` mismatch | Set to exact frontend URL, no trailing slash |
| DB connection fails | Wrong port or credentials | Use port 6543 (transaction pooler), not 5432 |
| Migrations not applied | First startup | Restart backend — migrations auto-apply in lifespan |
