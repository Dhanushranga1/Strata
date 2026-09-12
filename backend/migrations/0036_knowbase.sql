-- KnowBase: human-readable knowledge articles (SOPs, runbooks, how-tos)
-- Separate from app.chunks / RAG KB (which is for AI vector retrieval)

CREATE TABLE IF NOT EXISTS app.knowledge_articles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  content          text        NOT NULL,   -- markdown body
  category         text,
  tags             text[]      DEFAULT '{}',
  author_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published     bool        NOT NULL DEFAULT false,
  is_public        bool        NOT NULL DEFAULT false,   -- visible in self-service portal
  view_count       int         NOT NULL DEFAULT 0,
  helpful_votes    int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- fast org + published lookups
CREATE INDEX IF NOT EXISTS idx_articles_org_published
  ON app.knowledge_articles(organization_id, is_published, created_at DESC);

-- full-text title search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm
  ON app.knowledge_articles USING gin(title gin_trgm_ops);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON app.knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
