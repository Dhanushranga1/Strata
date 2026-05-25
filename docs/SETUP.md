# Setup Guide

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- A Supabase account (create two projects: one dev, one prod)
- A Google AI Studio API key (or Groq key)

## Quick start (3 commands)

```bash
make setup     # copies env files, installs deps
make migrate   # applies all 28 migrations
make dev       # starts both servers
```

## Step-by-step

### 1. Create a Supabase dev project

1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `ticketpilot-dev`
3. Note the **Database Password** (you won't see it again)
4. After creation, go to **Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT Secret` (under JWT Settings) → `SUPABASE_JWT_SECRET`

5. Go to **Settings → Database → Connection string → URI**
   - Copy the **Transaction mode pooler** URI (port **6543**, not 5432) → `DATABASE_URL`

> **Critical**: `SUPABASE_JWT_SECRET` is the raw signing secret shown under
> "JWT Settings". It is NOT the service_role JWT token. Using the wrong value
> causes `401 Invalid token` on every request.

### 2. Run `make setup`

```bash
make setup
```

This runs `setup-dev.sh` which:
1. Copies `backend/.env.dev.example` → `backend/.env`
2. Copies `frontend/.env.local.example` → `frontend/.env.local`
3. Creates a Python venv and installs backend deps
4. Installs frontend npm deps
5. Pauses for you to edit `.env` files with your Supabase credentials

### 3. Run `make migrate`

```bash
make migrate
```

This connects to your database (via `DATABASE_URL` in `.env`) and applies
all unapplied migration files from `backend/migrations/`. Migrations are
idempotent — safe to run multiple times.

### 4. Run `make dev`

```bash
make dev
```

Starts both servers in parallel:
- Backend: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend: `npm run dev` (port 3000)

### 5. Promote yourself to admin

Register at http://localhost:3000, then run this in the Supabase SQL Editor:

```sql
INSERT INTO app.user_roles (user_id, role)
VALUES ('your-user-uuid', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

Find your UUID in Supabase **Auth → Users**.

### 6. Upload knowledge base docs

1. Log in as admin → go to **Knowledge Base** in sidebar
2. Upload PDF, TXT, MD, or DOCX files
3. Wait for "Indexed" status — documents are chunked and embedded into FAISS

## Manual setup (without Makefile)

```bash
# Backend
cp backend/.env.dev.example backend/.env
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Migrations auto-run on first startup, or manually:
python -c "import asyncio; from app.migration_runner import run_migrations; asyncio.run(run_migrations())"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cp frontend/.env.local.example frontend/.env.local
cd frontend
npm install
npm run dev
```

## Verify it works

```bash
# Backend health
curl http://localhost:8000/api/health

# Open frontend
open http://localhost:3000
```

## Docker PostgreSQL (optional)

If you want a local Postgres instead of a cloud Supabase DB:

```bash
docker compose up -d
# Then set DATABASE_URL to: postgresql://postgres:postgres@localhost:5432/ticketpilot
```

pgAdmin at http://localhost:5050 (dev@ticketpilot.local / ticketpilot).
