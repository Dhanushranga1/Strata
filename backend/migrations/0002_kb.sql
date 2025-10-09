create schema if not exists app;

create table if not exists app.documents (
  id uuid primary key default gen_random_uuid(),
  title text,
  source text not null,                 -- 'upload:<filename>' OR 'raw'
  mime_type text,
  size_bytes bigint,
  doc_hash text not null unique,        -- SHA256 of normalized text
  created_by uuid not null,             -- auth.users.id
  created_at timestamptz default now()
);

create index if not exists idx_documents_created_at on app.documents(created_at desc);

create table if not exists app.chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references app.documents(id) on delete cascade,
  chunk_index int not null,
  text text not null,
  chunk_hash text not null,
  token_count int,
  faiss_id bigint,                      -- row id in FAISS index
  created_at timestamptz default now(),
  unique (doc_id, chunk_index)
);

create index if not exists idx_chunks_doc on app.chunks(doc_id);
create index if not exists idx_chunks_faiss on app.chunks(faiss_id);