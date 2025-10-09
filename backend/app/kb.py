from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from typing import Optional, List
import os
import psycopg
from psycopg.rows import dict_row
from .utils import normalize_text, sha256, sniff_and_read
from .chunker import make_chunks
from .embeddings import embed_texts
from .store import add_vectors_for_chunks, search_vectors
from .auth import User, get_current_user

router = APIRouter(prefix="/api/kb", tags=["kb"])

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE_CHARS", "2400"))
OVERLAP = int(os.getenv("CHUNK_OVERLAP_CHARS", "400"))
DATABASE_URL = os.getenv("DATABASE_URL")


def get_db_connection():
    """Get database connection (simplified for Phase 2)."""
    if not DATABASE_URL:
        raise HTTPException(500, "DATABASE_URL not configured")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def require_rep(user: User):
    """Ensure user has rep / admin role."""
    if user.role not in ["rep", "admin"]:
        raise HTTPException(status_code=403, detail="Rep/Admin access required")


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
    require_rep(user)

    if not file and not raw_text:
        raise HTTPException(400, "Provide a file or raw_text")

    # 1) Read & normalize
    if file:
        raw = await file.read()
        detected_mime, text = sniff_and_read(
            file.content_type or "", 
            file.filename or "", 
            raw
        )
        source = f"upload:{file.filename or 'unknown'}"
        title = file.filename or "Uploaded file"
        size_bytes = len(raw)
    else:
        text = raw_text or ""
        detected_mime = "text/plain"
        source = "raw"
        title = filename or "Raw text input"
        size_bytes = len(text.encode("utf-8"))

    text = normalize_text(text)
    if not text:
        raise HTTPException(400, "No extractable text")

    doc_hash = sha256(text)

    # 2) Database operations
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check for duplicate document
            cur.execute(
                "SELECT id FROM app.documents WHERE doc_hash = %s", 
                (doc_hash,)
            )
            existing = cur.fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="Document already ingested")

            # Create document record
            cur.execute("""
                INSERT INTO app.documents (title, source, mime_type, size_bytes, doc_hash, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (title, source, detected_mime, size_bytes, doc_hash, user.id))
            
            document_record = cur.fetchone()
            document_id = str(document_record['id'])

            # 3) Chunking
            chunks = make_chunks(text, CHUNK_SIZE, OVERLAP)
            if not chunks:
                raise HTTPException(400, "Chunking produced 0 chunks")

            # 4) Process chunks with deduplication
            unique_chunks = []
            unique_ids = []
            
            for i, chunk_text in enumerate(chunks):
                chunk_hash = sha256(chunk_text)
                
                # Insert chunk (will skip if duplicate hash within doc due to unique constraint)
                try:
                    cur.execute("""
                        INSERT INTO app.chunks (doc_id, chunk_index, text, chunk_hash, token_count)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id
                    """, (document_record['id'], i, chunk_text, chunk_hash, len(chunk_text.split())))
                    
                    chunk_record = cur.fetchone()
                    chunk_id = str(chunk_record['id'])
                    unique_chunks.append(chunk_text)
                    unique_ids.append(chunk_id)
                    
                except psycopg.IntegrityError:
                    # Skip duplicate chunks within the same document
                    conn.rollback()
                    continue

            if not unique_chunks:
                raise HTTPException(400, "All chunks were duplicates")

            # 5) Generate embeddings and add to FAISS
            vectors = embed_texts(unique_chunks)
            assigned_faiss_ids = add_vectors_for_chunks(unique_ids, vectors)

            # 6) Update chunks with FAISS IDs
            for chunk_id, faiss_id in zip(unique_ids, assigned_faiss_ids):
                cur.execute(
                    "UPDATE app.chunks SET faiss_id = %s WHERE id = %s",
                    (faiss_id, chunk_id)
                )

            conn.commit()

            return IngestResponse(
                document_id=document_id,
                chunks_ingested=len(unique_ids),
                vectors_added=len(assigned_faiss_ids)
            )


class KBStats(BaseModel):
    documents: int
    chunks: int


class DocumentItem(BaseModel):
    id: str
    title: str
    source_type: str
    chunk_count: int
    created_at: str


@router.get("/documents", response_model=List[DocumentItem])
async def list_documents(user: User = Depends(get_current_user)):
    """Get list of knowledge base documents (rep/admin only)."""
    require_rep(user)
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    d.id,
                    d.title,
                    d.mime_type as source_type,
                    d.created_at,
                    COUNT(c.id) as chunk_count
                FROM app.documents d
                LEFT JOIN app.chunks c ON d.id = c.doc_id
                GROUP BY d.id, d.title, d.mime_type, d.created_at
                ORDER BY d.created_at DESC
            """
            cur.execute(query)
            rows = cur.fetchall()
            
            return [
                DocumentItem(
                    id=str(row["id"]),
                    title=row["title"] or "Untitled",
                    source_type=row["source_type"] or "unknown",
                    chunk_count=row["chunk_count"] or 0,
                    created_at=row["created_at"].isoformat() if row["created_at"] else ""
                )
                for row in rows
            ]


@router.get("/stats", response_model=KBStats)
async def stats(user: User = Depends(get_current_user)):
    """Get knowledge base statistics."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS count FROM app.documents")
            row = cur.fetchone()
            doc_count = (row["count"] if isinstance(row, dict) else row[0]) if row else 0
            
            cur.execute("SELECT COUNT(*) AS count FROM app.chunks")
            row = cur.fetchone()
            chunk_count = (row["count"] if isinstance(row, dict) else row[0]) if row else 0
        
        return KBStats(documents=doc_count or 0, chunks=chunk_count or 0)


class SearchResult(BaseModel):
    faiss_id: int
    score: float
    document_id: Optional[str] = None
    chunk_id: Optional[str] = None
    text_preview: Optional[str] = None


@router.get("/search", response_model=List[SearchResult])
async def search(q: str, k: int = 3, user: User = Depends(get_current_user)):
    """Search knowledge base for similar content."""
    # Generate query embedding
    query_vector = embed_texts([q])[0]
    
    # Search FAISS index
    scores, faiss_ids = search_vectors(query_vector, k=k)
    
    # Map FAISS IDs back to chunks and documents
    with get_db_connection() as conn:
        results = []
        with conn.cursor() as cur:
            for score, faiss_id in zip(scores, faiss_ids):
                # Find chunk by FAISS ID
                cur.execute("""
                    SELECT c.id as chunk_id, c.doc_id, c.text, d.id as document_id
                    FROM app.chunks c
                    JOIN app.documents d ON c.doc_id = d.id
                    WHERE c.faiss_id = %s
                """, (faiss_id,))
                
                chunk_record = cur.fetchone()
                
                if chunk_record:
                    # Truncate text for preview
                    preview = chunk_record['text'][:200] + "..." if len(chunk_record['text']) > 200 else chunk_record['text']
                    
                    results.append(SearchResult(
                        faiss_id=int(faiss_id),
                        score=float(score),
                        document_id=str(chunk_record['document_id']),
                        chunk_id=str(chunk_record['chunk_id']),
                        text_preview=preview
                    ))
                else:
                    # Handle case where FAISS ID doesn't map to a chunk
                    results.append(SearchResult(
                        faiss_id=int(faiss_id),
                        score=float(score)
                    ))
        
        return results