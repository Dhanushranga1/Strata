# TicketPilot

**AI-Powered Multi-Tenant Customer Support Platform**

TicketPilot combines enterprise ticketing with a RAG-based AI assistant so support reps get instant, cited answers from your knowledge base — reducing search time from minutes to seconds.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Local Setup](#local-setup)
3. [First-Time Configuration](#first-time-configuration)
4. [Running the App](#running-the-app)
5. [Production Deployment](#production-deployment)
6. [Environment Variable Reference](#environment-variable-reference)
7. [Database Migrations](#database-migrations)
8. [How Invites Work](#how-invites-work)
9. [RAG Pipeline](#rag-pipeline)
10. [Roles & Permissions](#roles--permissions)
11. [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌──────────────────┐
│  Frontend        │  Next.js 15 · React 19 · TypeScript
│  Port 3000       │  Tailwind CSS · Radix UI · Framer Motion
└────────┬─────────┘
         │ REST / JWT (HS256)
┌────────▼─────────┐
│  Backend         │  FastAPI · Python 3.10+
│  Port 8000       │  psycopg3 · FAISS · httpx
└────────┬─────────┘
         │
    ┌────┴──────────────────────────┐
    │                               │
┌───▼──────────┐          ┌─────────▼───────────┐
│  PostgreSQL  │          │  Google AI           │
│  (Supabase)  │          │  text-embedding-004  │
│              │          │  gemini-1.5-flash    │
│  Auth · RLS  │          │  FAISS vector index  │
└──────────────┘          └──────────────────────┘
```

**Security**: JWT HS256 verification · Row-Level Security (RLS) · IP-based rate limiting (slowapi) · Security headers middleware

---

## Local Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Backend |
| Node.js | 18+ | Frontend |
| npm or pnpm | any | Frontend deps |
| Supabase account | — | Database + Auth |
| Google AI Studio key | — | Embeddings + LLM |

### 1 — Clone

```bash
git clone https://github.com/yourusername/ticketpilot.git
cd ticketpilot
```

### 2 — Create a Supabase project

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

### 3 — Run migrations

Open the Supabase **SQL Editor** and execute each file in order:

```
backend/migrations/0001_user_roles.sql
backend/migrations/0002_kb.sql
backend/migrations/0003_tickets_core.sql
backend/migrations/0004_ai_chat.sql
backend/migrations/0005_rep_console.sql
backend/migrations/0005a_admin_roles.sql
backend/migrations/0006_ai_feedback.sql
backend/migrations/0007_organizations.sql
backend/migrations/0008_add_organization_id.sql
backend/migrations/0009_migrate_existing_data.sql
backend/migrations/0010_enable_rls.sql
backend/migrations/0011_invites.sql
```

### 4 — Get a Google AI key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create an API key → `GOOGLE_API_KEY`

### 5 — Backend environment

```bash
cd backend
cp .env.example .env
# Open .env and fill in these required fields:
```

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-raw-jwt-signing-secret
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
GOOGLE_API_KEY=AIza...
WEB_ORIGIN=http://localhost:3000
ENVIRONMENT=development
```

### 6 — Frontend environment

```bash
cd frontend
cp .env.local.example .env.local
# Open .env.local and fill in:
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 7 — Install dependencies

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install                    # or: pnpm install
```

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

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:8000/api/health | Backend health check |
| http://localhost:8000/docs | Interactive API docs (Swagger) |

---

## Production Deployment

### Backend — Railway or Render

Set these environment variables in the platform dashboard:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-raw-jwt-signing-secret
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
GOOGLE_API_KEY=AIza...
WEB_ORIGIN=https://your-frontend.vercel.app
ENVIRONMENT=production
LOG_LEVEL=INFO
```

Start command:
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

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

### Backend (`backend/.env`)

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
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL — no trailing slash |
| `NEXT_PUBLIC_LOCAL_DEV` | No | Set `true` in local dev |

---

## Database Migrations

12 sequential migrations in `backend/migrations/`:

| File | Creates / Updates |
|------|------------------|
| `0001_user_roles.sql` | `app.user_roles` — global role store |
| `0002_kb.sql` | `app.documents`, `app.chunks` — knowledge base |
| `0003_tickets_core.sql` | `app.tickets`, `app.messages` |
| `0004_ai_chat.sql` | AI chat history |
| `0005_rep_console.sql` | Rep console features |
| `0005a_admin_roles.sql` | Admin role management |
| `0006_ai_feedback.sql` | `app.ai_feedback` — response feedback |
| `0007_organizations.sql` | `app.organizations`, `app.organization_members` |
| `0008_add_organization_id.sql` | Adds `organization_id` to all tables |
| `0009_migrate_existing_data.sql` | Backfills data to default org |
| `0010_enable_rls.sql` | Row-Level Security policies on all tables |
| `0011_invites.sql` | `app.invites` — email-based invite system |

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

---

## RAG Pipeline

**Ingestion** (admin uploads a document):

```
Upload → text extraction → chunking (2400 chars, 400 overlap)
  → Google text-embedding-004 → 768-dim vectors
  → FAISS IndexFlatIP (one index per org)
  → chunk metadata saved to app.chunks
```

**Query** (rep uses AI assistant):

```
Rep question → embed → FAISS top-10 search
  → MMR re-ranking (relevance × diversity)
  → context assembled → Gemini generates response with citations
  → 7-factor confidence score (0–100%) → displayed to rep
```

**Confidence score factors:**

| Factor | Weight |
|--------|--------|
| Retrieval quality (avg similarity) | 30% |
| Citation coverage | 20% |
| Semantic coherence | 20% |
| Response completeness | 10% |
| Information density | 10% |
| Source diversity | 10% |
| Variance penalty | deducted if all scores too similar |

**Score interpretation:**
- **80–100%** → use confidently
- **60–79%** → review before using
- **Below 60%** → escalate or research manually

---

## Roles & Permissions

Two role systems run in parallel:

**Global** (`app.user_roles`) — controls API access:

| Role | Access |
|------|--------|
| `admin` | All API endpoints |
| `rep` | Rep console, tickets |
| `customer` | Own tickets only |

**Per-org** (`app.organization_members`) — controls UI and org actions:

| Role | Permissions |
|------|------------|
| `owner` | Full control |
| `admin` | Invite members, manage KB and settings |
| `rep` | Handle and reply to tickets |
| `member` | Submit tickets only |

When a user accepts an invite, both tables are updated atomically.

---

## Project Structure

```
ticketpilot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point + lifespan
│   │   ├── auth.py              # JWT HS256 verification
│   │   ├── organizations.py     # Org CRUD + member management
│   │   ├── invites.py           # Invite create / validate / accept
│   │   ├── tickets.py           # Ticket CRUD + messages
│   │   ├── rep.py               # Rep console AI chat
│   │   ├── admin.py             # Admin analytics
│   │   ├── kb.py                # Knowledge base upload / delete
│   │   ├── rag.py               # RAG pipeline + confidence scoring
│   │   ├── security.py          # Rate limiting + security headers
│   │   └── org_middleware.py    # Organization context middleware
│   ├── migrations/              # 0001 → 0011 SQL (run in order)
│   ├── data/                    # gitignored — FAISS indices at runtime
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (public)/
│       │   │   ├── login/
│       │   │   ├── signup/
│       │   │   └── auth/callback/   # Magic link + PKCE handler
│       │   ├── (protected)/
│       │   │   ├── dashboard/
│       │   │   ├── tickets/[id]/
│       │   │   ├── rep/             # Rep console + AI chat
│       │   │   ├── kb/              # Knowledge base management
│       │   │   ├── admin/           # Admin analytics + roles
│       │   │   └── organizations/   # Org list + invite modal
│       │   └── invite/[token]/      # Public invite accept page
│       ├── components/ui/
│       ├── contexts/OrganizationContext.tsx
│       └── lib/
│           ├── api-client.ts        # Auth-aware fetch wrapper
│           └── supabaseClient.ts
│
└── docs/                            # Detailed technical documentation
    ├── 00_PROJECT_OVERVIEW_AND_NAVIGATION.md
    ├── 01_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md
    ├── 02_COMPLETE_FEATURE_INVENTORY.md
    ├── 03_DATABASE_SCHEMA_AND_DATA_MODEL.md
    ├── 04_KNOWN_ISSUES_AND_KNOWLEDGE_GAPS.md
    └── 05_PILOT_DEPLOYMENT_AND_OPERATIONS_GUIDE.md
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Invalid token` on all requests | `SUPABASE_JWT_SECRET` is wrong (set to JWT token instead of raw secret) | Set to the raw string from Settings → API → JWT Settings |
| AI answers are all low confidence | FAISS index wiped (ephemeral deploy) | Re-upload KB documents after every deploy |
| Invite email not sent | `SUPABASE_SERVICE_ROLE_KEY` not set | Add it to backend env — or copy invite link from modal manually |
| `403 You are not a member` | User missing from `organization_members` | Run the admin SQL from "First-Time Configuration" |
| CORS errors in browser | `WEB_ORIGIN` mismatch | Set `WEB_ORIGIN` in backend env to exact frontend URL, no trailing slash |
| `500 DATABASE_URL not configured` | Missing env var | Set `DATABASE_URL` in backend `.env` |
| Invite link says "expired" | Link older than 7 days | Re-send the invite from the Organizations page |

---

## License

MIT
