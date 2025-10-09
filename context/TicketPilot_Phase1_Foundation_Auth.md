# TicketPilot — Phase 1 (Foundation & Auth)

**Goal:** Stand up a lean, working foundation for the TicketPilot MVP with user authentication, a running backend, strict route protection, and a minimal protected page in the UI. No AI, no ticketing, no RAG yet.

---

## 0) Outcomes & Acceptance Criteria

**Outcomes**
- ✅ Users can sign in via Supabase Auth (email/password or magic link).
- ✅ Next.js app loads a protected page (`/dashboard`) **only** when logged in.
- ✅ FastAPI backend runs with CORS configured and exposes `GET /api/health`.
- ✅ Protected backend route (`GET /api/me`) verifies Supabase JWT, returns user identity (id, email) and a role (default `customer` unless explicitly assigned).
- ✅ Shared, copy‑pasteable `.env.example` for frontend & backend; clear run scripts.
- ✅ A small `user_roles` table exists (for future rep/admin), though Phase 1 may default to `customer` for every new user if no mapping is present.

**Acceptance Checklist**
1. Visiting `/login` shows a working Supabase sign-in form; successful sign-in redirects to `/dashboard`.
2. Hitting `GET /api/health` returns `{ ok: true, api: "ticketpilot", version: "…" }`.
3. From the browser, the frontend can call `GET /api/me` with `Authorization: Bearer <access_token>` and receive `{ id, email, role }`.
4. When no token (or invalid token) is provided, `/api/me` returns `401`.
5. Protected UI route denies access when logged out (redirects to `/login`).

**Non-Goals (explicit for Phase 1)**
- ❌ No tickets, messages, RAG, embeddings, uploads, SSE/WebSockets.
- ❌ No Docker, CI/CD, analytics, admin consoles.
- ❌ No multi-tenant; single-environment local dev is fine.

---

## 1) Tech & Versions

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Auth:** Supabase Auth (Hosted, free tier OK)
- **Backend:** FastAPI + Uvicorn
- **DB:** Supabase Postgres (hosted) — for Phase 1 only `user_roles` is relevant
- **JWT Verify:** HS256 using `SUPABASE_JWT_SECRET`
- **Runtime:** Node 20+, Python 3.11+

> Tip: Use a single repo (monorepo) with `/frontend` and `/backend`. That’s plenty for MVP.

---

## 2) Repository Layout

```
ticketpilot/
├─ frontend/
│  ├─ app/
│  │  ├─ (public)/login/page.tsx
│  │  ├─ (protected)/dashboard/page.tsx
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ lib/
│  │  ├─ supabaseClient.ts
│  │  └─ api.ts
│  ├─ middleware.ts           # optional: auth guard (redirect to /login)
│  ├─ components/
│  │  └─ AuthGate.tsx
│  ├─ styles/globals.css
│  ├─ env.d.ts
│  ├─ .env.example
│  ├─ package.json
│  └─ tailwind.config.ts
└─ backend/
   ├─ app/
   │  ├─ main.py
   │  ├─ auth.py
   │  ├─ deps.py
   │  ├─ models.py             # placeholder for Phase 2+
   │  └─ __init__.py
   ├─ migrations/
   │  └─ 0001_user_roles.sql
   ├─ .env.example
   ├─ requirements.txt
   └─ pyproject.toml           # optional (or stick to requirements.txt)
```

---

## 3) Environment Variables

### Frontend: `frontend/.env.example`
```
# Supabase (project settings → API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Backend API base (used by lib/api.ts)
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000

# Where the web runs (enforced by CORS on backend)
NEXT_PUBLIC_WEB_ORIGIN=http://localhost:3000
```

### Backend: `backend/.env.example`
```
# CORS allowlist (frontend URL)
WEB_ORIGIN=http://localhost:3000

# Supabase JWT secret (Project Settings → API → JWT Secret)
SUPABASE_JWT_SECRET=

# Optional future use (Phase 2+)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
API_VERSION=0.1.0
```

> Copy `.env.example` → `.env` in both `frontend` and `backend` and fill in values.

---

## 4) Database (Phase 1 Minimal)

> Supabase automatically manages `auth.users`. We add a tiny mapping for roles (future-proofing Phase 5).

**`backend/migrations/0001_user_roles.sql`**
```sql
create schema if not exists app;

create table if not exists app.user_roles (
  user_id uuid primary key,
  role text not null check (role in ('customer','rep','admin')),
  created_at timestamptz default now()
);

-- Optional helper view to join email from auth.users
create or replace view app.v_user_roles as
select
  ur.user_id,
  ur.role,
  u.email,
  ur.created_at
from app.user_roles ur
left join auth.users u on u.id = ur.user_id;
```

> For Phase 1, the backend may default to `customer` whenever no mapping is found. In Phase 5 we’ll actually manage/assign `rep` roles in UI.

---

## 5) Backend (FastAPI)

### Dependencies

**`backend/requirements.txt`**
```
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-dotenv==1.0.1
python-jose==3.3.0
pydantic==2.7.1
```

### App setup

**`backend/app/main.py`**
```python
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt, JWTError
import os

API_VERSION = os.getenv("API_VERSION", "0.1.0")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000")

if not SUPABASE_JWT_SECRET:
    raise RuntimeError("SUPABASE_JWT_SECRET is required in .env")

app = FastAPI(title="TicketPilot API", version=API_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEB_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALGORITHM = "HS256"

class User(BaseModel):
    id: str
    email: str | None = None
    role: str | None = "customer"

def decode_supabase_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_current_user(request: Request) -> User:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = auth.split(" ", 1)[1]
    payload = decode_supabase_jwt(token)

    sub = payload.get("sub") or payload.get("user_id")
    email = payload.get("email")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    # Phase 1: default role if no mapping yet
    # (Phase 5 will read app.user_roles to override when present)
    return User(id=sub, email=email, role="customer")

@app.get("/api/health")
def health():
    return {"ok": True, "api": "ticketpilot", "version": API_VERSION}

@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return user
```

**Run locally**
```bash
# from repo root
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # fill in values
uvicorn app.main:app --reload --port 8000
```

> Verify: open http://127.0.0.1:8000/api/health (should return ok).

---

## 6) Frontend (Next.js + Tailwind + Supabase)

### Init & packages
```bash
# from repo root
cd frontend
pnpm create next-app@latest . --ts --eslint --app --src-dir=false --tailwind
pnpm add @supabase/supabase-js
# (Tailwind already set up by the Next.js init flag)
cp .env.example .env  # fill in values
pnpm dev
```

### Supabase client

**`frontend/lib/supabaseClient.ts`**
```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Simple API helper to call backend with token

**`frontend/lib/api.ts`**
```ts
import { supabase } from './supabaseClient'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!

export async function apiGet<T>(path: string): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}
```

### Auth gate (client-only)

**`frontend/components/AuthGate.tsx`**
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session && active) router.replace('/login')
      else if (active) setReady(true)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [router])

  if (!ready) return null
  return <>{children}</>
}
```

### Public login page

**`frontend/app/(public)/login/page.tsx`**
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setLoading(true); setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.replace('/dashboard')
  }

  const signInMagic = async () => {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) { setError(error.message); return }
    alert('Magic link sent. Check your email.')
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="email@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="••••••••"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full rounded bg-black text-white py-2"
        >
          {loading ? 'Signing in…' : 'Sign in with password'}
        </button>
        <button
          onClick={signInMagic}
          disabled={loading || !email}
          className="w-full rounded border py-2"
        >
          Send magic link
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </main>
  )
}
```

### Protected dashboard

**`frontend/app/(protected)/dashboard/page.tsx`**
```tsx
'use client'

import AuthGate from '@/components/AuthGate'
import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'

type Me = { id: string; email?: string; role?: string }

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try { setMe(await apiGet<Me>('/api/me')) }
      catch (e: any) { setError(e.message) }
    })()
  }, [])

  return (
    <AuthGate>
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {me && (
          <div className="rounded border p-4">
            <p><b>User:</b> {me.email ?? me.id}</p>
            <p><b>Role:</b> {me.role}</p>
          </div>
        )}
        {error && <p className="text-red-600">{error}</p>}
      </main>
    </AuthGate>
  )
}
```

### App shell

**`frontend/app/page.tsx`**
```tsx
export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center">
      <a className="underline" href="/login">Go to Login →</a>
    </main>
  )
}
```

**`frontend/app/layout.tsx`**
```tsx
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TicketPilot',
  description: 'MVP — Phase 1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

---

## 7) Local Dev — End-to-End Test

1. **Create Supabase project** → copy `URL`, `anon key`, and `JWT secret`.
2. Fill **`frontend/.env`** and **`backend/.env`**.
3. **Start backend**: `uvicorn app.main:app --reload --port 8000`.
4. **Start frontend**: `pnpm dev` (http://localhost:3000).
5. Visit **`/login`** → sign in (create user in Supabase Auth if needed).
6. Redirect to **`/dashboard`**. You should see your email and role=`customer`.
7. Open devtools → Network: confirm `/api/me` sent `Authorization: Bearer …` and succeeded.
8. Hit **`/api/health`** in the browser to see `{ ok: true }`.

---

## 8) Troubleshooting

- **401 on /api/me**: Ensure frontend sends the Supabase `access_token`. Confirm you are signed in and `supabase.auth.getSession()` returns a session.
- **CORS error**: `WEB_ORIGIN` must match browser origin (e.g., `http://localhost:3000`).
- **Invalid token**: Double‑check `SUPABASE_JWT_SECRET` from Supabase → Project Settings → API.
- **Redirect loop**: Clear site data; verify `AuthGate` and Supabase session events.

---

## 9) What’s Next (Phase 2 Preview)

- Ingestion pipeline, chunking & FAISS index.
- `POST /api/kb/ingest` for reps.
- Actual role resolution from `app.user_roles` (rep vs customer) and guard routes accordingly.
