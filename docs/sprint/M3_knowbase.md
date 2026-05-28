# M3 — KnowBase

**Status:** ✅ Done  
**Sprint:** Month 3

---

## What This Is

KnowBase is the human-readable knowledge article module — SOPs, runbooks, and how-to guides. It is **separate** from the RAG KB (`/kb`), which is for AI vector retrieval (document upload → FAISS). KnowBase is for human readers: searchable articles with categories, tags, view counts, and helpful votes.

---

## What Was Changed

| File | Change |
|------|--------|
| `backend/migrations/0031_knowbase.sql` | Creates `app.knowledge_articles` table, indexes, trigger |
| `backend/app/entitlements/plans.py` | Added `know_base` feature flag (Starter+) |
| `backend/app/knowbase.py` | New router — full CRUD + stats + helpful vote |
| `backend/app/main.py` | Registered knowbase router |
| `frontend/src/app/(protected)/knowbase/page.tsx` | Article list with search + category filter |
| `frontend/src/app/(protected)/knowbase/new/page.tsx` | Create article (markdown editor) |
| `frontend/src/app/(protected)/knowbase/[id]/page.tsx` | Article detail + helpful vote + rep edit/delete |
| `frontend/src/app/(protected)/knowbase/[id]/edit/page.tsx` | Edit article |
| `frontend/src/components/Sidebar.tsx` | Added KnowBase nav item (rep/admin only) |

---

## Schema

```sql
CREATE TABLE app.knowledge_articles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  content          text        NOT NULL,   -- markdown body
  category         text,
  tags             text[]      DEFAULT '{}',
  author_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published     bool        NOT NULL DEFAULT false,
  is_public        bool        NOT NULL DEFAULT false,
  view_count       int         NOT NULL DEFAULT 0,
  helpful_votes    int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

Indexes: composite `(organization_id, is_published, created_at DESC)` + trigram GIN on title. `touch_updated_at()` trigger auto-updates `updated_at` on every row write.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/knowbase/stats` | any | Total/published counts + category list |
| `GET` | `/api/knowbase/articles` | any | List with `q`, `category`, `published_only`, `limit`, `offset` |
| `POST` | `/api/knowbase/articles` | rep/admin | Create article (201) |
| `GET` | `/api/knowbase/articles/{id}` | any | Get article + increment view_count |
| `PUT` | `/api/knowbase/articles/{id}` | rep/admin | Update article |
| `DELETE` | `/api/knowbase/articles/{id}` | rep/admin | Delete article (204) |
| `POST` | `/api/knowbase/articles/{id}/helpful` | any | Increment helpful_votes (204) |

All endpoints require the `know_base` feature entitlement (Starter plan or above). Customers only see `is_published = true` articles; reps/admins see all.

---

## Feature Gate

`"know_base"` → **Starter** plan and above. Community plan shows the UpgradeBanner.

---

## How KnowBase differs from `/kb` (RAG Knowledge Base)

| | `/kb` (RAG KB) | `/knowbase` (KnowBase) |
|---|---|---|
| Purpose | Feed documents to the AI assistant | Human-readable SOPs and guides |
| Format | Any file → chunked → FAISS vectors | Markdown articles authored in-app |
| Audience | AI retrieval pipeline | Reps, admins, optionally customers |
| Search | FAISS + BM25 semantic search | Postgres trigram (`ILIKE`) |
| Public | No | `is_public` flag for self-service portal |

---

## How to Verify

1. Log in as rep/admin, navigate to `/knowbase`
2. Create a new article with a category and tags, mark as Published
3. Confirm it appears in the list with correct metadata
4. Click the article → view count increments, "Was this helpful?" button works
5. Edit the article → changes save correctly
6. Log in as a customer → only published articles are visible
7. Switch org to community plan → UpgradeBanner appears instead of the module
