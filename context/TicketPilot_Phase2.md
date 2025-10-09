Got it—here’s the full, copy-paste friendly Phase 2 spec inline.

# TicketPilot — Phase 2 (Knowledge Base Ingestion & Vector Index)

**Goal:** Add a minimal, reliable ingestion pipeline for internal knowledge (files or raw text) that produces clean chunks, deduplicates content, generates embeddings, and persists a FAISS vector index + mappings for later retrieval (Phase 4). Keep it lean; no LLM chat yet.

---

## 0) Outcomes & Acceptance Criteria

**Outcomes**

* ✅ Backend accepts **file upload** (PDF/TXT/MD/DOCX) or **raw text** and stores a **document** record.
* ✅ Content is **normalized, chunked** (windowing with overlap), and **deduplicated** (doc-level + chunk-level SHA256).
* ✅ Embeddings are generated and **appended** to a **persistent FAISS index** on disk.
* ✅ A **chunk↔vector mapping** is persisted so we can reconstruct results after restarts.
* ✅ Ingestion is **rep-only** (403 unless user has role `rep`). For local dev, role can be assigned via SQL.
* ✅ Basic **diagnostic endpoints** exist to list docs, view counts, and run a **top-k similarity search** (no LLM).

**Acceptance Checklist**

1. Uploading a supported file returns `{ document_id, chunks_ingested, vectors_added }`.
2. Re-uploading the **same content** returns **409** (doc-level dedupe).
3. Restarting the server does **not** lose the FAISS index or chunk mappings.
4. `GET /api/kb/stats` shows non-zero `documents` and `chunks` after ingestion.
5. `GET /api/kb/search?q=...&k=3` returns the top chunks with `score` and `document_id` (for validation only).
6. Requests to `/api/kb/ingest` from non-`rep` users return **403**.

**Non-Goals (Phase 2)**

* ❌ No LLM calls, no answer synthesis, no citations formatting.
* ❌ No UI console for ingestion (we’ll add a console in Phase 5). Use cURL/Postman for now.
* ❌ No multi-tenant, no versioned document sets, no deletes/garbage-collection. (Add later if needed.)

---

## 1) Tech & Versions

* **Backend:** FastAPI (existing)
* **Vector Index:** FAISS (CPU)
* **Embeddings:** Google Generative AI Embeddings `text-embedding-004` (default). Keep provider pluggable but don’t over-engineer.
* **Parsing:** `pypdf` for PDFs, `python-docx` for DOCX, plain reads for TXT/MD.
* **DB:** Supabase Postgres (hosted) — add `documents` and `chunks` tables under `app` schema.

> You can add an alternative local embedding fallback later (e.g., `sentence-transformers`). For Phase 2, stick to one provider.

---

## 2) Repository Changes

```
ticketpilot/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                 # mounts kb router
│  │  ├─ kb.py                   # routes: ingest, stats, list, search
│  │  ├─ embeddings.py           # provider wrapper
│  │  ├─ chunker.py              # chunking logic
│  │  ├─ store.py                # FAISS index manager + mapping
│  │  ├─ utils.py                # hashing, text normalization, file readers
│  │  ├─ deps.py                 # (already present) auth deps
│  │  ├─ models.py               # (placeholder; Phase 3+), not required here
│  │  └─ __init__.py
│  ├─ migrations/
│  │  ├─ 0001_user_roles.sql     # from Phase 1
│  │  └─ 0002_kb.sql             # NEW: documents + chunks tables
│  ├─ .env.example               # add provider vars
│  ├─ requirements.txt           # add new libs
│  └─ data/                      # created at runtime (faiss/ + maps/)
│     ├─ faiss/kb.index
│     └─ maps/kb_map.json
└─ frontend/
   └─ (no required changes in Phase 2)
```

---

## 3) Environment Variables (Backend)

**`backend/.env.example` additions**

```
# Embeddings provider
EMBEDDINGS_PROVIDER=google        # fixed for Phase 2
GOOGLE_API_KEY=                   # from Google AI Studio / MakerSuite

# FAISS paths
VECTOR_INDEX_DIR=./data/faiss
VECTOR_INDEX_FILENAME=kb.index
VECTOR_MAP_DIR=./data/maps
VECTOR_MAP_FILENAME=kb_map.json

# Chunking
CHUNK_SIZE_CHARS=2400            # ~600 tokens @ ~4 chars/token
CHUNK_OVERLAP_CHARS=400
```

> Keep `SUPABASE_JWT_SECRET` and `WEB_ORIGIN` from Phase 1.

---

## 4) Database Migration

**`backend/migrations/0002_kb.sql`**

```sql
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
```

> For local dev, enable `pgcrypto` (or use Supabase’s `extensions`) to get `gen_random_uuid()`.

---

## 5) Backend Dependencies

**`backend/requirements.txt` additions**

```
faiss-cpu==1.8.0
google-generativeai==0.7.2
pypdf==4.3.1
python-docx==1.1.2
# existing:
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-dotenv==1.0.1
python-jose==3.3.0
pydantic==2.7.1
```

---

## 6) Core Modules (Backend)

### 6.1 `utils.py` — normalization, hashing, readers

```python
import re, hashlib
from typing import Tuple
from pypdf import PdfReader
from docx import Document as DocxDocument

def normalize_text(text: str) -> str:
    # unify whitespace + strip control chars
    text = re.sub(r'\r\n?', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode('utf-8')).hexdigest()

def read_txt_bytes(b: bytes, encoding='utf-8') -> str:
    return b.decode(encoding, errors='ignore')

def read_md_bytes(b: bytes) -> str:
    # treat as plain text for Phase 2
    return read_txt_bytes(b)

def read_pdf_bytes(b: bytes) -> str:
    from io import BytesIO
    reader = PdfReader(BytesIO(b))
    parts = [p.extract_text() or '' for p in reader.pages]
    return "\n".join(parts)

def read_docx_bytes(b: bytes) -> str:
    from io import BytesIO
    doc = DocxDocument(BytesIO(b))
    parts = [p.text for p in doc.paragraphs]
    return "\n".join(parts)

def sniff_and_read(mime: str, filename: str, raw: bytes) -> Tuple[str, str]:
    ext = (filename or '').lower()
    if mime == 'application/pdf' or ext.endswith('.pdf'):
        return 'application/pdf', read_pdf_bytes(raw)
    if mime in ('text/plain', 'text/markdown') or ext.endswith(('.txt', '.md', '.markdown')):
        return ('text/markdown' if ext.endswith(('.md', '.markdown')) else 'text/plain'), read_txt_bytes(raw)
    if mime in ('application/vnd.openxmlformats-officedocument.wordprocessingml.document',) or ext.endswith('.docx'):
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', read_docx_bytes(raw)
    # fallback to plain text
    return mime or 'text/plain', read_txt_bytes(raw)
```

### 6.2 `chunker.py` — windowed chunks

```python
import math
from typing import List

def make_chunks(text: str, size_chars: int, overlap_chars: int) -> List[str]:
    if size_chars <= 0: raise ValueError("size_chars must be > 0")
    if overlap_chars < 0 or overlap_chars >= size_chars: raise ValueError("invalid overlap")
    parts = []
    i = 0
    n = len(text)
    while i < n:
        j = min(i + size_chars, n)
        parts.append(text[i:j])
        if j == n: break
        i = j - overlap_chars
    return parts
```

### 6.3 `embeddings.py` — provider wrapper (Google)

```python
import os
import google.generativeai as genai
from typing import List

MODEL = "text-embedding-004"

def init_provider():
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GOOGLE_API_KEY is required")
    genai.configure(api_key=key)

def embed_texts(texts: List[str]) -> List[List[float]]:
    # Google API supports batch embeddings
    init_provider()
    resp = genai.embed_content(
        model=MODEL,
        content=texts,
        task_type="retrieval_document",
    )
    # embed_content returns a single embedding for non-batch; use embed_content for each if needed
    # Safer batch approach (SDK versions vary):
    if isinstance(texts, str):
        return [resp["embedding"]]
    # If SDK returns a dict with 'embeddings':
    if isinstance(resp, dict) and "embeddings" in resp:
        return [e["values"] for e in resp["embeddings"]]
    # Fallback: call per text
    out = []
    for t in texts:
        r = genai.embed_content(model=MODEL, content=t, task_type="retrieval_document")
        out.append(r["embedding"] if "embedding" in r else r["data"][0]["embedding"])
    return out
```

### 6.4 `store.py` — FAISS manager + mapping

```python
import os, json
import numpy as np
import faiss
from typing import List, Dict

INDEX_DIR = os.getenv("VECTOR_INDEX_DIR", "./data/faiss")
INDEX_FILE = os.getenv("VECTOR_INDEX_FILENAME", "kb.index")
MAP_DIR = os.getenv("VECTOR_MAP_DIR", "./data/maps")
MAP_FILE = os.getenv("VECTOR_MAP_FILENAME", "kb_map.json")

DIM = 768  # text-embedding-004 returns 768-dim

def _paths():
    os.makedirs(INDEX_DIR, exist_ok=True)
    os.makedirs(MAP_DIR, exist_ok=True)
    return os.path.join(INDEX_DIR, INDEX_FILE), os.path.join(MAP_DIR, MAP_FILE)

def load_index() -> faiss.IndexFlatIP:
    idx_path, _ = _paths()
    if os.path.exists(idx_path):
        return faiss.read_index(idx_path)
    index = faiss.IndexFlatIP(DIM)
    return index

def save_index(index: faiss.Index):
    idx_path, _ = _paths()
    faiss.write_index(index, idx_path)

def load_map() -> Dict[str, int]:
    _, map_path = _paths()
    if os.path.exists(map_path):
        with open(map_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"next": 0, "chunk_to_faiss": {}}

def save_map(mapping: Dict[str, int]):
    _, map_path = _paths()
    with open(map_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

def add_vectors_for_chunks(chunk_ids: List[str], vectors: List[List[float]]) -> List[int]:
    index = load_index()
    mapping = load_map()
    arr = np.array(vectors, dtype=np.float32)
    # Normalize for cosine similarity (since IndexFlatIP uses dot-product)
    norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
    arr = arr / norms

    start = mapping["next"]
    index.add(arr)  # FAISS assigns ids implicitly by row order
    assigned = list(range(start, start + len(chunk_ids)))

    for cid, fid in zip(chunk_ids, assigned):
        mapping["chunk_to_faiss"][cid] = fid
    mapping["next"] = start + len(chunk_ids)

    save_index(index)
    save_map(mapping)
    return assigned

def search_vectors(vec: List[float], k: int = 3):
    index = load_index()
    v = np.array([vec], dtype=np.float32)
    v = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)
    scores, ids = index.search(v, k)
    return scores[0].tolist(), ids[0].tolist()
```

### 6.5 `kb.py` — routes

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from typing import Optional, List, Dict
from .utils import normalize_text, sha256, sniff_and_read
from .chunker import make_chunks
from .embeddings import embed_texts, init_provider
from .store import add_vectors_for_chunks, search_vectors
from .main import User  # Phase 1 User model
from .main import get_current_user   # auth dep
import os
import asyncpg  # only if you use raw queries; otherwise use your ORM/driver

router = APIRouter(prefix="/api/kb", tags=["kb"])

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE_CHARS", "2400"))
OVERLAP = int(os.getenv("CHUNK_OVERLAP_CHARS", "400"))

# NOTE: Use your preferred DB access layer here. Below is pseudo-code / placeholders.
# In Supabase, you can call via REST/RPC or use psycopg/asyncpg if you have direct access.

async def require_rep(user: User):
    if user.role != "rep":
        raise HTTPException(status_code=403, detail="Rep access required")

class IngestResponse(BaseModel):
    document_id: str
    chunks_ingested: int
    vectors_added: int

@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    user: User = Depends(get_current_user),
    file: UploadFile = File(None),
    raw_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
):
    await require_rep(user)

    if not file and not raw_text:
        raise HTTPException(400, "Provide a file or raw_text")

    # 1) Read & normalize
    if file:
        raw = await file.read()
        mime, text = sniff_and_read(file.content_type, file.filename, raw)
        title = file.filename
        source = f"upload:{file.filename}"
        size_bytes = len(raw)
    else:
        text = raw_text or ""
        text = text.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")
        mime = "text/plain"
        title = filename or "raw"
        source = "raw"
        size_bytes = len(text.encode("utf-8"))

    text = normalize_text(text)
    if not text:
        raise HTTPException(400, "No extractable text")

    doc_hash = sha256(text)

    # 2) Doc-level dedupe (pseudo DB calls)
    # if exists select id from app.documents where doc_hash = :doc_hash
    existing = None  # <- replace with actual query
    if existing:
        raise HTTPException(status_code=409, detail="Document already ingested")

    # create document row -> returning id
    document_id = "UUID_FROM_DB"  # <- replace with insert returning id

    # 3) Chunking
    chunks = make_chunks(text, CHUNK_SIZE, OVERLAP)
    if not chunks:
        raise HTTPException(400, "Chunking produced 0 chunks")

    # 4) Chunk-level dedupe + insert chunks
    unique_chunks = []
    unique_ids = []
    for i, c in enumerate(chunks):
        ch = sha256(c)
        # if exists select 1 from app.chunks where chunk_hash = :ch and doc_id = :document_id
        # avoid duplicates within this doc
        # insert chunk -> returning chunk_id
        chunk_id = f"UUID_CHUNK_{i}"  # <- replace with insert returning id
        unique_chunks.append(c)
        unique_ids.append(chunk_id)

    # 5) Embeddings
    vecs = embed_texts(unique_chunks)  # list[list[float]]
    assigned = add_vectors_for_chunks(unique_ids, vecs)

    # 6) Update rows with faiss_id
    # for each (chunk_id, faiss_id) -> update app.chunks set faiss_id = :faiss_id where id = :chunk_id

    return IngestResponse(document_id=document_id, chunks_ingested=len(unique_ids), vectors_added=len(assigned))

class KBStats(BaseModel):
    documents: int
    chunks: int

@router.get("/stats", response_model=KBStats)
async def stats(user: User = Depends(get_current_user)):
    # allow any authenticated user to see counts
    # SELECT count(*) from app.documents, app.chunks
    return KBStats(documents=0, chunks=0)  # replace with counts

class SearchResult(BaseModel):
    faiss_id: int
    score: float
    document_id: Optional[str] = None
    chunk_id: Optional[str] = None
    text_preview: Optional[str] = None

@router.get("/search", response_model=List[SearchResult])
async def search(q: str, k: int = 3, user: User = Depends(get_current_user)):
    # diagnostics only (no role restriction)
    vec = embed_texts([q])[0]
    scores, ids = search_vectors(vec, k=k)
    # map faiss ids -> chunk ids -> doc ids + small preview from DB
    results = []
    for score, fid in zip(scores, ids):
        results.append(SearchResult(faiss_id=int(fid), score=float(score)))
    return results
```

### 6.6 `main.py` — mount the router

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from .kb import router as kb_router

app = FastAPI(title="TicketPilot API")

WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEB_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# existing health + auth deps from Phase 1 ...
app.include_router(kb_router)
```

> Replace the “pseudo DB” comments with actual DB access (Supabase SQL editor, RPC, or your Python DB driver). The table design is intentionally simple to keep iteration fast.

---

## 7) Endpoints (Phase 2)

### `POST /api/kb/ingest`  (rep-only)

* **Form-Data** (one of):

  * `file`: PDF/TXT/MD/DOCX
  * `raw_text`: string (plus optional `filename`)
* **Headers:** `Authorization: Bearer <token>`
* **Responses:**

  * `200`: `{ document_id, chunks_ingested, vectors_added }`
  * `409`: duplicate document (by `doc_hash`)
  * `400`: unsupported/empty input
  * `403`: non-rep access

### `GET /api/kb/stats`

* **Auth:** any signed-in user
* **Response:** `{ documents, chunks }`

### `GET /api/kb/search?q=<query>&k=<int>`

* **Auth:** any signed-in user
* **Response:** `[{ faiss_id, score, document_id?, chunk_id?, text_preview? }]`
* **Note:** Diagnostics only. No LLM, no final UX. Used to validate index health.

---

## 8) Testing & Dev Steps

1. **Assign rep role** to your test user (find your `auth.users.id` in Supabase):

   ```sql
   insert into app.user_roles (user_id, role) values ('<your-user-uuid>', 'rep')
   on conflict (user_id) do update set role = excluded.role;
   ```
2. **Start backend**; verify health endpoint still works.
3. **Ingest a TXT** via curl:

   ```bash
   TOKEN="<paste access_token>"
   curl -X POST "http://127.0.0.1:8000/api/kb/ingest" \
     -H "Authorization: Bearer $TOKEN" \
     -F "raw_text=Hello TicketPilot. This is a KB seed."
   ```
4. **Ingest a PDF**:

   ```bash
   curl -X POST "http://127.0.0.1:8000/api/kb/ingest" \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@./handbook.pdf"
   ```
5. **Duplicate test**: Re-run the same command and expect **409**.
6. **Check stats**: `GET /api/kb/stats` → non-zero counts.
7. **Search**: `GET /api/kb/search?q=handbook&k=3` → get top chunks + scores.
8. **Restart server** and repeat **stats**/**search** to confirm persistence.

---

## 9) Troubleshooting

* **403 on /ingest:** Ensure your user is `rep`. See step 1 SQL.
* **409 on /ingest:** Document already ingested (same `doc_hash`). Modify content or title and re-try.
* **0 results on /search:** Check that embeddings were created and FAISS index exists under `data/faiss`.
* **Invalid Google API key:** Ensure `GOOGLE_API_KEY` is set and active in your project.
* **Memory issues with huge files:** Start with smaller PDFs; you can add page-wise chunking later if needed.

---

## 10) What’s Next (Phase 3 Preview)

* Ticket + message tables and endpoints.
* UI pages for ticket list and detail.
* Persisting user/agent messages and wire-up for future RAG retrieval (Phase 4).

---

