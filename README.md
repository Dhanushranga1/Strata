# TicketPilot — AI-Powered Customer Support

A modern, AI-powered customer support ticketing system with RAG (Retrieval-Augmented Generation) powered by Google Gemini, built with Next.js 15 and FastAPI.

## 📋 Product Audit Available

**✨ NEW:** We've completed a comprehensive UX & usability audit!

📁 **See [`audit/`](./audit/)** folder for:
- Product health analysis (7/10 score)
- 7 Quick Wins (8 hours to implement)
- Strategic improvements roadmap
- Implementation guides with code snippets
- ROI analysis ($26K/year return on $3K investment)

**Quick Start:** Read [`audit/VISUAL_AUDIT_SUMMARY.md`](./audit/VISUAL_AUDIT_SUMMARY.md) (5 min)

---

## Project Structure

```
ticketpilot/
├─ frontend/          # Next.js app (TypeScript, Tailwind, App Router)
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ (public)/login/page.tsx     # Public login page
│  │  │  ├─ (protected)/dashboard/page.tsx  # Protected dashboard
│  │  │  ├─ layout.tsx
│  │  │  └─ page.tsx
│  │  ├─ lib/
│  │  │  ├─ supabaseClient.ts           # Supabase client
│  │  │  └─ api.ts                      # API helper with auth
│  │  └─ components/
│  │     └─ AuthGate.tsx                # Route protection
│  └─ .env.example
└─ backend/           # FastAPI backend
   ├─ app/
   │  ├─ main.py                        # JWT auth & CORS
   │  ├─ kb.py                          # Knowledge base routes
   │  ├─ embeddings.py                  # Google embeddings
   │  ├─ chunker.py                     # Text chunking
   │  ├─ store.py                       # FAISS vector store
   │  └─ utils.py                       # File parsing utilities
   ├─ migrations/
   │  ├─ 0001_user_roles.sql           # User roles table
   │  └─ 0002_kb.sql                   # Knowledge base tables
   ├─ requirements.txt
   ├─ .env.example
   └─ data/                             # Created at runtime
      ├─ faiss/kb.index                 # FAISS vector index
      └─ maps/kb_map.json               # Chunk to vector mapping
```

## Setup

### 1. Supabase Project
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API
3. Copy `URL`, `anon key`, and `JWT Secret`

### 2. Google AI API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key for embeddings

### 3. Database Migration
Run the migrations in your Supabase SQL editor:
```sql
-- First, run 0001_user_roles.sql (from Phase 1)
-- Then, run 0002_kb.sql (Phase 2)
```

### 4. Environment Setup

**Frontend (.env)**
```bash
cd frontend
cp .env.example .env
# Fill in your Supabase values
```

**Backend (.env)**
```bash
cd backend
cp .env.example .env
# Fill in:
# - SUPABASE_JWT_SECRET
# - GOOGLE_API_KEY  
# - DATABASE_URL (Supabase connection string)
```

### 5. Install Dependencies

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Frontend**
```bash
cd frontend
pnpm install
```

## Run

**Backend (Terminal 1)**
```bash
cd backend
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Frontend (Terminal 2)**
```bash
cd frontend
pnpm dev
```

## Test

### Phase 1 (Authentication)
1. Visit http://localhost:3000
2. Click "Go to Login →"
3. Sign in (create account if needed)
4. Should redirect to `/dashboard` showing your email and role
5. Check http://localhost:8000/api/health returns `{ ok: true }`

### Phase 2 (Knowledge Base)

**1. Assign rep role to your user:**
```sql
-- In Supabase SQL editor, find your user ID first:
SELECT id, email FROM auth.users;

-- Then assign rep role:
INSERT INTO app.user_roles (user_id, role) 
VALUES ('<your-user-uuid>', 'rep')
ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;
```

**2. Get your access token:**
- Sign in to the frontend
- Open browser developer tools → Application → Local Storage
- Find your Supabase session and copy the `access_token`

**3. Test ingestion with cURL:**

```bash
# Set your token
TOKEN="<paste_your_access_token_here>"

# Ingest raw text
curl -X POST "http://127.0.0.1:8000/api/kb/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -F "raw_text=Hello TicketPilot. This is knowledge base content about our product features and documentation."

# Ingest a file (create a test file first)
echo "TicketPilot User Manual: Getting started with tickets and support." > test_doc.txt
curl -X POST "http://127.0.0.1:8000/api/kb/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_doc.txt"

# Test duplicate (should return 409)
curl -X POST "http://127.0.0.1:8000/api/kb/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -F "raw_text=Hello TicketPilot. This is knowledge base content about our product features and documentation."

# Check stats
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8000/api/kb/stats"

# Search knowledge base
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8000/api/kb/search?q=TicketPilot%20features&k=3"

# Test non-rep access (should return 403)
curl -X POST "http://127.0.0.1:8000/api/kb/ingest" \
  -H "Authorization: Bearer <customer_token>" \
  -F "raw_text=Should fail"
```

**4. Restart server test:**
```bash
# Stop server (Ctrl+C), then restart
uvicorn app.main:app --reload --port 8000

# Stats and search should still work:
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8000/api/kb/stats"
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8000/api/kb/search?q=features&k=2"
```

## API Endpoints

### Phase 1 (Authentication)
- `GET /api/health` - Health check (public)
- `GET /api/me` - Get current user (requires auth)

### Phase 2 (Knowledge Base)
- `POST /api/kb/ingest` - Ingest documents (rep-only)
- `GET /api/kb/stats` - Get ingestion statistics (any authenticated user)
- `GET /api/kb/search?q=<query>&k=<count>` - Search knowledge base (any authenticated user)

## Features Complete

### Phase 1 ✅
- [x] Supabase Auth (email/password + magic link)
- [x] Protected routes (`/dashboard` requires login)
- [x] JWT verification in backend
- [x] CORS configured for frontend origin
- [x] User roles table (defaults to `customer`)
- [x] Health check endpoint

### Phase 2 ✅
- [x] File ingestion (PDF/TXT/MD/DOCX) and raw text
- [x] Content normalization and chunking with overlap
- [x] Document-level and chunk-level deduplication
- [x] Google text-embedding-004 embeddings
- [x] Persistent FAISS vector index on disk
- [x] Chunk-to-vector mapping with restart persistence
- [x] Rep-only ingestion (403 for non-reps)
- [x] Knowledge base statistics and search endpoints