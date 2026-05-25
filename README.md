# Strata — SME IT Operations Platform

**The complete IT operations platform for small and medium enterprises.**

Strata brings ticketing, asset management, contracts, procurement, patch tracking, cost intelligence, change management, incident response, and HR IT automation into one place — AI-first, open-core, built for teams of 1–10 IT people managing 50–500 employees.

---

## Modules

| Module | What it does | Plan |
|--------|-------------|------|
| **TicketPilot** | AI-powered support tickets, SLA, canned responses, CSAT | Community |
| **KnowBase** | Searchable knowledge articles, FAISS-backed AI retrieval | Starter |
| **AssetLog** | Hardware/software inventory, QR codes, warranty alerts | Starter |
| **ContractVault** | Vendor directory, contract renewals, document links | Starter |
| **ProcureFlow** | Purchase requests → approvals → delivery → AssetLog | Starter |
| **ServiceHub** | Employee self-service portal, dynamic request forms | Starter |
| **PatchWatch** | Patch status by asset and severity, maintenance windows | Business |
| **CostLens** | Unused licenses, idle assets, renewal forecasts | Business |
| **ChangeBoard** | Lightweight RFC workflow, blackout periods, change calendar | Business |
| **IncidentBridge** | P1 war room, live timeline, stakeholder comms | Business |
| **FlowBot** | IF/THEN automation rules engine for ticket workflows | Business |
| **StatusCast** | Public status page, auto-updated by IncidentBridge | Business |
| **PeopleSync** | Joiner/Mover/Leaver IT checklists, HR webhook integration | Enterprise |

---

## Stack

- **Backend:** FastAPI · psycopg3 · Supabase/PostgreSQL · FAISS · Groq (llama-3.3-70b) · Jina embeddings
- **Frontend:** Next.js 15 · React 19 · Tailwind CSS · Framer Motion
- **Auth:** Supabase Auth (JWT)
- **AI:** RAG pipeline with HNSW vector search, BM25 hybrid retrieval, semantic cache

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- A Supabase project (free tier works)

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Backend |
| Node.js | 18+ | Frontend |
| npm | any | Frontend deps |
| Supabase account | — | Database + Auth (dev project) |
| Google AI Studio key | — | Embeddings + LLM |
| Docker (optional) | any | Local PostgreSQL |

### Quick start (3 commands)

```bash
git clone https://github.com/yourusername/ticketpilot.git
cd ticketpilot
make setup     # creates env files, installs deps
make migrate   # runs all pending migrations
make dev       # starts backend + frontend
```

### Step by step

**1. Create a Supabase DEV project**

Create a separate Supabase project for local development (never share with production).

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and note:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
   - **JWT Secret** (under "JWT Settings") → `SUPABASE_JWT_SECRET`

   > **Critical**: `SUPABASE_JWT_SECRET` is the raw signing secret shown under
   > "JWT Settings", NOT the service_role JWT token itself.
   > Using the JWT token instead of the secret will cause all authentication
   > to fail with `Invalid token` errors.

3. Go to **Settings → Database → Connection string → URI** and copy the
   **Transaction mode pooler** URL (port **6543**, not 5432) → `DATABASE_URL`

**2. Run `make setup`**

```bash
make setup
```

This copies the env templates, prompts you to fill in credentials,
creates a Python venv, and installs all dependencies.

If you prefer doing it manually:

```bash
cp backend/.env.dev.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Edit both files with your Supabase dev project credentials
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install
```

**3. Migrations auto-run on startup**

Migrations apply automatically when the backend starts (see `migration_runner.py`).
No manual SQL Editor step needed. To run them explicitly:

```bash
make migrate
```

### Optional: Local PostgreSQL via Docker

If you want a local Postgres (for offline dev or testing):

```bash
docker compose up -d     # starts PostgreSQL + pgAdmin
# Point DATABASE_URL to: postgresql://postgres:postgres@localhost:5432/ticketpilot
```

pgAdmin is available at http://localhost:5050 (dev@ticketpilot.local / ticketpilot).

---

## First-Time Configuration

### Promote your account to admin

After signing up through the UI, run this in the Supabase SQL Editor:

```sql
-- 1. Find your user ID (check the auth.users table or the Supabase Auth dashboard)
-- 2. Assign global admin role
INSERT INTO app.user_roles (user_id, role)
VALUES ('your-user-uuid-here', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- 3. Find your default org
SELECT id, name FROM app.organizations LIMIT 5;

-- 4. Make yourself owner of that org
INSERT INTO app.organization_members (organization_id, user_id, role)
VALUES ('your-org-uuid', 'your-user-uuid-here', 'owner')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';
```

### Upload Knowledge Base documents

The AI assistant only returns useful answers once documents are indexed:

1. Log in as admin → go to **Knowledge Base**
2. Upload PDF, TXT, MD, or DOCX files
3. Wait for the "Indexed" status — documents are chunked and embedded into FAISS

> **Cloud deploy note**: FAISS indices are stored on the ephemeral filesystem and
> are wiped on every redeploy. Re-upload all documents after each deploy.

### Invite your team

1. Go to **Organizations** in the sidebar
2. Click the **invite icon** (person+) on your org card
3. Enter the rep's email and select a role
4. If `SUPABASE_SERVICE_ROLE_KEY` is set → email is sent automatically
5. Otherwise → copy the invite link from the modal and share it manually
6. The invitee clicks the link → signs up or logs in → clicks **Accept & Join**

---

## Running the App

### Both servers (recommended)

```bash
make dev
```

### Or individually

```bash
# Terminal 1 — Backend
make dev-backend

# Terminal 2 — Frontend
make dev-frontend
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:8000/api/health | Backend health check |
| http://localhost:8000/docs | Interactive API docs (Swagger) |

### Other useful commands

| Command | What it does |
|---------|-------------|
| `make test` | Run all tests |
| `make test-backend` | Backend tests only |
| `make test-frontend` | Frontend tests only |
| `make lint` | ESLint + Prettier + Black + isort + mypy + bandit |
| `make format` | Auto-format all code |
| `make type-check` | TypeScript checker |
| `make build` | Build frontend for production |
| `make migrate` | Run pending DB migrations |
| `make clean` | Remove build artifacts |
| `make help` | List all targets |

---

## Production Deployment

### Backend — Render

Set these environment variables in the **Render dashboard**:

```env
SUPABASE_URL=https://your-prod-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-raw-jwt-signing-secret
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
GOOGLE_API_KEY=AIza...
WEB_ORIGIN=https://your-frontend.vercel.app
ENVIRONMENT=production
LOG_LEVEL=INFO
```

The backend auto-deploys from git (Render monitors `main`).  
Migrations run automatically on every deploy via `migration_runner.py`.

### Frontend — Vercel

Set in **Vercel → Project → Settings → Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

Build command: `npm run build` · Output directory: `.next` · Framework preset: Next.js

---

## Environment Variable Reference

### Backend (`.env` — copy from `.env.dev.example` or `.env.prod.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Service role key — enables invite emails |
| `SUPABASE_JWT_SECRET` | Yes | Raw JWT signing secret (Settings → API → JWT Settings) — NOT the service_role token |
| `DATABASE_URL` | Yes | Transaction-mode pooler URL (port 6543) |
| `GOOGLE_API_KEY` | Yes | Google AI Studio API key |
| `WEB_ORIGIN` | Yes | Frontend URL for CORS — no trailing slash |
| `ENVIRONMENT` | Yes | `development` or `production` |
| `LOG_LEVEL` | No | Default: `INFO` |
| `GENAI_MODEL` | No | Default: `gemini-1.5-flash` |
| `VECTOR_INDEX_DIR` | No | FAISS directory, default: `./data/faiss` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL — no trailing slash. Dev: `http://localhost:8000`, Prod: `https://your-backend.onrender.com` |
| `NEXT_PUBLIC_LOCAL_DEV` | No | Set `true` in local dev |

---

## Database Migrations

Migrations are in `backend/migrations/`. They **auto-apply on startup** via `migration_runner.py`.

To run them explicitly:

```bash
make migrate
```

Migrations are idempotent (use `IF NOT EXISTS` / `IF EXISTS`). A tracking table
`app.schema_migrations` records which files have been applied.

Current files (28 total, `0001` → `0028`):

---

## How Invites Work

```
Admin → POST /api/organizations/{org_id}/invites  { email, role }
  ↓
Backend creates token (32 hex bytes), stores in app.invites
  ↓
If SUPABASE_SERVICE_ROLE_KEY set → emails the invitee via Supabase
Otherwise → returns invite_url in response body (admin copies manually)
  ↓
Invitee opens /invite/{token}
  ↓ (if not logged in)
Redirected to /login?redirect=/invite/{token}
  ↓
After auth → POST /api/invites/{token}/accept
  ↓
Backend adds to organization_members + updates user_roles atomically
Invite marked accepted. Link expires in 7 days.
```
```

---

## Self-Hosting (Docker)

```bash
cd infra
docker compose up --build
```

Runs backend on :8000, frontend on :3000, Nginx on :80. Set your env files in `backend/.env` and `frontend/.env.local` before building.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for AWS/VPS setup guide.

---

## Repository Layout

```
strata/
├── backend/
│   ├── app/
│   │   ├── modules/        ← new Strata modules (assetlog, contractvault, etc.)
│   │   ├── entitlements/   ← plan gating (community/starter/business/enterprise)
│   │   └── *.py            ← TicketPilot core (tickets, kb, sla, auth, orgs...)
│   ├── migrations/         ← numbered SQL migrations (0001–0030+)
│   │   └── fixes/          ← one-off SQL patches
│   └── demo/               ← demo seed data
├── frontend/
│   └── src/
│       ├── app/(protected)/  ← all authenticated pages
│       ├── components/       ← shared UI components
│       ├── hooks/            ← React hooks (useEntitlements, etc.)
│       └── lib/              ← API client, plan definitions
├── infra/
│   ├── docker-compose.yml  ← full stack for self-hosting
│   └── nginx.conf
├── docs/
│   ├── modules/            ← full spec for each Strata module
│   └── ...                 ← deployment, security, architecture guides
└── scripts/                ← migration runners, local dev utilities
```

---

## Module Specs

Detailed specs for every module (schema, API, frontend, feature gates, cross-module links) live in [docs/modules/](docs/modules/).

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Invalid token` on all requests | `SUPABASE_JWT_SECRET` is wrong (set to JWT token instead of raw secret) | Set to the raw string from Settings → API → JWT Settings |
| Migrations not applied on new instance | Backend started but migration_runner didn't fire | Restart the backend — migrations auto-apply on startup |
| Backend health fails after deploy | Render cold-start + Supabase pool wake-up | Wait 30–60s, circuit breaker self-heals |
| AI answers are all low confidence | FAISS index wiped (ephemeral deploy) | Re-upload KB documents after every deploy |
| Invite email not sent | `SUPABASE_SERVICE_ROLE_KEY` not set | Add it to backend env — or copy invite link from modal manually |
| `403 You are not a member` | User missing from `organization_members` | Run the admin SQL from "First-Time Configuration" |
| CORS errors in browser | `WEB_ORIGIN` mismatch | Set `WEB_ORIGIN` in backend env to exact frontend URL, no trailing slash |
| `500 DATABASE_URL not configured` | Missing env var | Set `DATABASE_URL` in backend `.env` |
| Invite link says "expired" | Link older than 7 days | Re-send the invite from the Organizations page |

---

## Plans

| Feature | Community | Starter | Business | Enterprise |
|---------|-----------|---------|----------|------------|
| TicketPilot (core) | ✔ | ✔ | ✔ | ✔ |
| AI Assistant (CASPER) | ✘ | ✔ | ✔ | ✔ |
| KnowBase | ✘ | ✔ | ✔ | ✔ |
| AssetLog + ContractVault | ✘ | ✔ | ✔ | ✔ |
| ProcureFlow + ServiceHub | ✘ | ✔ | ✔ | ✔ |
| PatchWatch + CostLens | ✘ | ✘ | ✔ | ✔ |
| ChangeBoard + IncidentBridge | ✘ | ✘ | ✔ | ✔ |
| FlowBot + StatusCast | ✘ | ✘ | ✔ | ✔ |
| PeopleSync (HR) | ✘ | ✘ | ✘ | ✔ |
