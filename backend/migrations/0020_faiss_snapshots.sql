-- Store serialized FAISS index as a binary blob so cold-start recovery is
-- a single DB read (O(1)) rather than reconstructing from individual vectors.
CREATE TABLE IF NOT EXISTS app.faiss_snapshots (
  id        bigserial PRIMARY KEY,
  data      bytea NOT NULL,
  vector_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
