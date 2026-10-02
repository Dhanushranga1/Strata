-- Migration 0050: CASPER entity embeddings on pgvector.
--
-- FAISS was removed in favour of pgvector (migrations 0031/0035), but
-- app.entity_embeddings only ever stored a FAISS row id and had no vector
-- column, so every CASPER namespace search (asset/contract/knowledge
-- article/resolved ticket) crashed with ModuleNotFoundError on app.store.
--
-- This adds the vector column and an HNSW cosine index; the CASPER engine
-- now writes/searches embeddings here directly.
ALTER TABLE app.entity_embeddings
    ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

CREATE INDEX IF NOT EXISTS idx_entity_emb_vec
    ON app.entity_embeddings USING hnsw (embedding_vec vector_cosine_ops)
    WITH (m='16', ef_construction='64');
