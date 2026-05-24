# KnowBase — Knowledge Articles

## Problem It Solves
SOPs, runbooks, and how-to guides live in random Google Docs. When a user asks "how do I connect to VPN on my Mac?", the IT rep has to find the doc, copy the link, and paste it — if they can find it at all. New reps spend weeks learning tribal knowledge that was never written down.

KnowBase is the searchable, linkable article library. Articles are written once and reused everywhere: linked from tickets, surfaced by CASPER AI, shown in the ServiceHub portal, and indexed for instant full-text search.

---

## Feature Gate
`"kb"` — Already gated in the current codebase. Starter plan and above.

---

## Relationship to Existing KB
The current codebase has a vector-search KB (`backend/app/kb.py`) for FAISS-indexed documents used by the AI assistant. KnowBase is the **human-readable article layer** on top of it:
- KnowBase articles are stored as structured markdown in PostgreSQL
- They are also indexed into FAISS for AI retrieval
- The FAISS index already handles the AI side; KnowBase adds human authoring + search + portal visibility

The two systems share documents — writing a KnowBase article automatically feeds the FAISS index.

---

## Database Schema
**Migration:** `backend/migrations/0039_knowbase.sql`

```sql
CREATE TABLE app.knowledge_articles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  content          text NOT NULL,                      -- markdown
  category         text,
  tags             text[] NOT NULL DEFAULT ARRAY[]::text[],
  author_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published     bool NOT NULL DEFAULT false,
  is_public        bool NOT NULL DEFAULT false,        -- visible on /portal without login
  view_count       int NOT NULL DEFAULT 0,
  helpful_votes    int NOT NULL DEFAULT 0,
  not_helpful_votes int NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Full-text search index (pg_trgm — already enabled in 0029_perf_indexes.sql)
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm
  ON app.knowledge_articles USING gin(title gin_trgm_ops);

CREATE INDEX idx_articles_org_published
  ON app.knowledge_articles(organization_id, is_published, updated_at DESC);

CREATE INDEX idx_articles_org_public
  ON app.knowledge_articles(organization_id, is_public, is_published)
  WHERE is_public = true AND is_published = true;
```

---

## API Endpoints
**Router prefix:** `/api/kb` (extends existing `kb.py`)
**File:** `backend/app/kb.py` (add article endpoints alongside existing FAISS ingest/search)

### Articles CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kb/articles` | List articles (filter: category, tags, published, public) |
| POST | `/api/kb/articles` | Create article |
| GET | `/api/kb/articles/{id}` | Article detail (increments view_count) |
| PATCH | `/api/kb/articles/{id}` | Update article |
| DELETE | `/api/kb/articles/{id}` | Delete article |
| POST | `/api/kb/articles/{id}/publish` | Publish article (+ auto-index into FAISS) |
| POST | `/api/kb/articles/{id}/vote` | Vote helpful/not helpful |
| GET | `/api/kb/articles/search` | Full-text search with pg_trgm |
| GET | `/api/kb/stats` | Module stats for Strata hub |

### Public portal endpoint (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portal/{org_slug}/kb` | Public articles for ServiceHub portal |
| GET | `/api/portal/{org_slug}/kb/search` | Search public articles |

---

## Search Implementation
`GET /api/kb/articles/search?q=VPN+macOS`

Uses pg_trgm for fast ILIKE search (already indexed). For richer results, also searches tags array:

```sql
SELECT
  id, title, category, tags, is_public, view_count,
  ts_rank_cd(
    to_tsvector('english', title || ' ' || content),
    plainto_tsquery('english', $2)
  ) AS rank
FROM app.knowledge_articles
WHERE organization_id = $1
  AND is_published = true
  AND (
    title ILIKE '%' || $2 || '%'
    OR content ILIKE '%' || $2 || '%'
    OR $2 = ANY(tags)
  )
ORDER BY rank DESC, view_count DESC
LIMIT 20;
```

---

## FAISS Auto-Index on Publish
When `POST /api/kb/articles/{id}/publish` is called:
1. Set `is_published = true`
2. Call the existing KB ingest logic to embed the article and add to FAISS

```python
@router.post("/articles/{article_id}/publish")
async def publish_article(article_id: uuid.UUID, ...):
    article = await db.fetchrow("SELECT * FROM app.knowledge_articles WHERE id=$1", article_id)
    # Mark published
    await db.execute("UPDATE app.knowledge_articles SET is_published=true WHERE id=$1", article_id)
    # Ingest into FAISS (reuse existing kb ingest logic)
    await ingest_document(
        org_id=org_id,
        document_id=str(article_id),
        title=article["title"],
        content=article["content"],
        metadata={"source": "knowbase", "tags": article["tags"]}
    )
    return {"published": True}
```

Unpublishing removes the article from FAISS (calls existing `delete_document()`).

---

## CASPER AI Integration
When CASPER AI confidence score is low on a ticket chat response:
1. Search KnowBase for articles matching the ticket title/description
2. If relevant articles found, append to CASPER's response:
   ```
   📖 Related articles:
   • How to set up VPN on macOS
   • VPN troubleshooting guide
   ```

This is added to `backend/app/rag.py` as a post-retrieval step.

---

## Linking Articles to Ticket Replies
Reps can insert an article link into a ticket reply with a `/kb` slash command in the reply box:
- Type `/kb vpn` → shows matching articles in a dropdown
- Select → inserts `[How to set up VPN on macOS](/kb/articles/{id})` into the reply text

---

## Stats Response (Strata Hub)
```json
{
  "primary": "42 published articles",
  "secondary": "8 drafts",
  "tertiary": "127 searches this month",
  "health": "healthy"
}
```

---

## Frontend Pages
**Base route:** `/kb` (extends existing KB page)

The existing `/kb` page handles FAISS document upload. Add article management:

| Page | Path | Description |
|------|------|-------------|
| Article list | `/kb/articles` | List all articles with publish status |
| Article detail | `/kb/articles/{id}` | Read view + vote buttons |
| Article editor | `/kb/articles/{id}/edit` | Markdown editor with preview |
| New article | `/kb/articles/new` | Create form |

### Article editor
- Split-pane: markdown on left, preview on right
- Frontmatter fields: Category, Tags (tag input), Public (checkbox)
- "Publish" button → calls publish endpoint (auto-indexes to FAISS)
- "Save Draft" → saves without publishing

---

## Cross-Module Links
- **TicketPilot:** CASPER AI surfaces related articles; reps link articles in replies
- **ServiceHub:** Public articles (`is_public = true`) appear on the employee portal
- **FAISS/RAG:** Published articles auto-ingest into the vector index
- **Strata Hub:** Article count + search activity shown as KnowBase module stat

---

## Notes
- `is_public` articles show on the portal without login — don't put internal SOPs there
- `view_count` is incremented on `GET /api/kb/articles/{id}` — useful for spotting high-value articles
- The helpful/not-helpful vote is anonymous (no user tracking) — just a count
- Article categories are free-text in v1 (not enforced list) — org can use whatever taxonomy makes sense
- The existing FAISS document upload (`/kb/upload`) remains unchanged for non-article documents (PDFs, etc.)
