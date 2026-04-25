-- Store raw embedding vectors alongside chunks so FAISS can be rebuilt after
-- a cold start without re-calling the embedding API.
ALTER TABLE app.chunks ADD COLUMN IF NOT EXISTS embedding float4[];
