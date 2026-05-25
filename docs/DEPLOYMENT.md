# Deployment

## Architecture

```
Frontend → Vercel (static export via next build)
Backend  → Render (Python web service)
DB       → Supabase PostgreSQL (prod project)
```

## Backend — Render

### 1. Create a Supabase prod project

Same steps as setup, but name it `ticketpilot-prod`.
Note all credentials — they differ from dev.

### 2. Deploy backend to Render

1. Connect your GitHub repo to Render
2. Use the existing `render.yaml` (Infrastructure as Code) or create a Web Service:
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health check path**: `/api/health`
3. Set env vars in Render dashboard (use your **prod** Supabase project):

```env
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=raw-jwt-signing-secret
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
GOOGLE_API_KEY=AIza...
WEB_ORIGIN=https://your-frontend.vercel.app
ENVIRONMENT=production
LOG_LEVEL=INFO
```

Render auto-deploys from your `main` branch. Every deploy:
1. Installs deps
2. Starts the server
3. `migration_runner.py` auto-applies any pending migrations
4. FAISS indices are rebuilt from stored embeddings in the DB

> **FAISS caveat**: On ephemeral filesystems (Render free tier), FAISS
> index files are wiped on every deploy. The system rebuilds them from
> DB- stored embeddings on cold start, but you may need to re-upload
> KB documents if the DB embeddings are also stale.

## Frontend — Vercel

1. Connect your GitHub repo to Vercel
2. Set **Root directory**: `frontend`
3. Set **Build command**: `npm run build` → output `.next`
4. Set **Framework preset**: Next.js
5. Set env vars in Vercel dashboard:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

## CI/CD

| Trigger | What happens |
|---------|-------------|
| PR to `main` | CI pipeline: frontend checks → backend checks → integration tests |
| Push to `main` | Staging deploy (Vercel preview + Render staging) |
| Manual workflow_dispatch | Production deploy (Vercel prod + Render prod) |

## Pre-deploy checklist

- [ ] Prod Supabase project created with all migrations applied
- [ ] `SUPABASE_JWT_SECRET` is the JWT signing secret (NOT the service_role token)
- [ ] `WEB_ORIGIN` set to exact frontend URL, no trailing slash
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (required for invite emails)
- [ ] `ENVIRONMENT=production`
- [ ] FAISS indices will be rebuilt on first request after deploy
