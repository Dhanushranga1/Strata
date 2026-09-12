-- Migration 0035: Widen embedding columns from 768 to 1536 dims
-- Rationale: 1536 is the de-facto standard among embedding APIs
-- (OpenAI text-embedding-3-small native, and MRL-truncatable target for
-- Gemini 3072-native / Cohere / Jina), and stays under pgvector's
-- 2000-dim HNSW limit on Supabase.
-- pgvector cannot cast between different dims, so existing vectors are
-- nulled first (they were 768-dim probe/legacy vectors) — re-ingest or
-- re-embed regenerates them at 1536.

-- 1. Drop HNSW indexes (must precede the type change)
DROP INDEX IF EXISTS app.idx_chunks_embedding_vec;
DROP INDEX IF EXISTS app.idx_tickets_title_embedding;

-- 2. Null 768-dim vectors (cannot be cast to 1536)
UPDATE app.chunks SET embedding_vec = NULL WHERE embedding_vec IS NOT NULL;
UPDATE app.tickets SET title_embedding = NULL WHERE title_embedding IS NOT NULL;

-- 3. Widen the columns
ALTER TABLE app.chunks
    ALTER COLUMN embedding_vec TYPE vector(1536);
ALTER TABLE app.tickets
    ALTER COLUMN title_embedding TYPE vector(1536);

-- 4. Recreate HNSW indexes (same params as before)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_vec
    ON app.chunks USING hnsw (embedding_vec vector_cosine_ops)
    WITH (m='16', ef_construction='64');
CREATE INDEX IF NOT EXISTS idx_tickets_title_embedding
    ON app.tickets USING hnsw (title_embedding vector_cosine_ops)
    WITH (m='16', ef_construction='64');
