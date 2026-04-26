import os
import json
import logging
import numpy as np
import faiss
from typing import List, Dict, Tuple, Optional

# Configure logging
logger = logging.getLogger(__name__)

# Configuration
INDEX_DIR = os.getenv("VECTOR_INDEX_DIR", "./data/faiss")
INDEX_FILE = os.getenv("VECTOR_INDEX_FILENAME", "kb.index")
MAP_DIR = os.getenv("VECTOR_MAP_DIR", "./data/maps")
MAP_FILE = os.getenv("VECTOR_MAP_FILENAME", "kb_map.json")
DIM = int(os.getenv("EMBEDDING_DIM", "3072"))  # gemini-embedding-001 returns 3072-dim

class VectorStoreError(Exception):
    """Custom exception for vector store operations"""
    pass

def _paths():
    """Get file paths and ensure directories exist with error handling."""
    try:
        os.makedirs(INDEX_DIR, exist_ok=True)
        os.makedirs(MAP_DIR, exist_ok=True)
        index_path = os.path.join(INDEX_DIR, INDEX_FILE)
        map_path = os.path.join(MAP_DIR, MAP_FILE)
        
        logger.debug(f"Vector store paths: index={index_path}, map={map_path}")
        return index_path, map_path
        
    except Exception as e:
        raise VectorStoreError(f"Failed to create vector store directories: {e}") from e

def load_index() -> faiss.IndexFlatIP:
    """Load existing FAISS index or create new one with error handling."""
    try:
        idx_path, _ = _paths()
        
        if os.path.exists(idx_path):
            logger.info(f"Loading existing FAISS index from {idx_path}")
            index = faiss.read_index(idx_path)
            
            # Validate loaded index
            if index.d != DIM:
                raise VectorStoreError(f"Index dimension mismatch: expected {DIM}, got {index.d}")
            
            logger.info(f"Loaded FAISS index with {index.ntotal} vectors")
            return index
        else:
            logger.info(f"Creating new FAISS index with dimension {DIM}")
            index = faiss.IndexFlatIP(DIM)
            return index
            
    except Exception as e:
        logger.error(f"Failed to load FAISS index: {e}")
        raise VectorStoreError(f"Index loading failed: {e}") from e

def save_index(index: faiss.Index):
    """Save FAISS index to disk with error handling."""
    try:
        if index is None:
            raise VectorStoreError("Cannot save None index")
        
        idx_path, _ = _paths()
        
        # Create backup if index exists
        if os.path.exists(idx_path):
            backup_path = f"{idx_path}.backup"
            try:
                os.rename(idx_path, backup_path)
                logger.debug(f"Created backup at {backup_path}")
            except Exception as backup_error:
                logger.warning(f"Failed to create backup: {backup_error}")
        
        # Save new index
        faiss.write_index(index, idx_path)
        logger.info(f"Saved FAISS index with {index.ntotal} vectors to {idx_path}")
        
        # Remove backup on success
        backup_path = f"{idx_path}.backup"
        if os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except Exception:
                pass  # Non-critical if backup removal fails
                
    except Exception as e:
        logger.error(f"Failed to save FAISS index: {e}")
        raise VectorStoreError(f"Index saving failed: {e}") from e

def load_map() -> Dict:
    """Load chunk to FAISS ID mapping with error handling."""
    try:
        _, map_path = _paths()
        
        if os.path.exists(map_path):
            logger.debug(f"Loading mapping from {map_path}")
            with open(map_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Validate mapping structure
            if not isinstance(data, dict):
                raise VectorStoreError("Invalid mapping format: not a dictionary")
            
            if "next" not in data or "chunk_to_faiss" not in data:
                raise VectorStoreError("Invalid mapping format: missing required keys")
            
            logger.debug(f"Loaded mapping with {len(data['chunk_to_faiss'])} entries")
            return data
        else:
            logger.info("Creating new mapping file")
            return {"next": 0, "chunk_to_faiss": {}}
            
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse mapping JSON: {e}")
        raise VectorStoreError(f"Mapping file corrupted: {e}") from e
    except Exception as e:
        logger.error(f"Failed to load mapping: {e}")
        raise VectorStoreError(f"Mapping loading failed: {e}") from e

def save_map(mapping: Dict):
    """Save chunk to FAISS ID mapping with error handling."""
    try:
        if not isinstance(mapping, dict):
            raise VectorStoreError("Mapping must be a dictionary")
        
        _, map_path = _paths()
        
        # Create backup if mapping exists
        if os.path.exists(map_path):
            backup_path = f"{map_path}.backup"
            try:
                with open(map_path, 'r') as f:
                    backup_data = f.read()
                with open(backup_path, 'w') as f:
                    f.write(backup_data)
            except Exception as backup_error:
                logger.warning(f"Failed to create mapping backup: {backup_error}")
        
        # Save new mapping
        with open(map_path, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, ensure_ascii=False, indent=2)
        
        logger.debug(f"Saved mapping with {len(mapping.get('chunk_to_faiss', {}))} entries")
        
    except Exception as e:
        logger.error(f"Failed to save mapping: {e}")
        raise VectorStoreError(f"Mapping saving failed: {e}") from e


def add_vectors_for_chunks(chunk_ids: List[str], vectors: List[List[float]]) -> List[int]:
    """Add vectors to FAISS index and update mapping with comprehensive error handling."""
    try:
        if not chunk_ids or not vectors:
            raise VectorStoreError("Cannot add empty chunk_ids or vectors")
        
        if len(chunk_ids) != len(vectors):
            raise VectorStoreError(f"Mismatch: {len(chunk_ids)} chunk_ids vs {len(vectors)} vectors")
        
        # Validate vector dimensions
        for i, vector in enumerate(vectors):
            if not isinstance(vector, list) or len(vector) != DIM:
                raise VectorStoreError(f"Vector {i} has invalid dimension: expected {DIM}, got {len(vector) if isinstance(vector, list) else 'not a list'}")
        
        # Load index and mapping
        index = load_index()
        mapping = load_map()
        
        # Convert to numpy array and normalize for cosine similarity
        try:
            arr = np.array(vectors, dtype=np.float32)
            
            # Check for invalid values
            if np.any(np.isnan(arr)) or np.any(np.isinf(arr)):
                raise VectorStoreError("Vectors contain NaN or infinite values")
            
            # Normalize vectors
            norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
            arr = arr / norms
            
        except Exception as e:
            raise VectorStoreError(f"Vector processing failed: {e}") from e
        
        # Add vectors to index
        try:
            start_id = mapping["next"]
            index.add(arr)
            assigned_ids = list(range(start_id, start_id + len(chunk_ids)))
            
            # Update mapping
            for chunk_id, faiss_id in zip(chunk_ids, assigned_ids):
                mapping["chunk_to_faiss"][str(chunk_id)] = faiss_id
            mapping["next"] = start_id + len(chunk_ids)
            
            # Save updates atomically
            save_index(index)
            save_map(mapping)
            
            logger.info(f"Successfully added {len(vectors)} vectors for chunks {chunk_ids[:3]}{'...' if len(chunk_ids) > 3 else ''}")
            return assigned_ids
            
        except Exception as e:
            logger.error(f"Failed to add vectors to index: {e}")
            raise VectorStoreError(f"Index update failed: {e}") from e
            
    except VectorStoreError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in add_vectors_for_chunks: {e}")
        raise VectorStoreError(f"Vector addition failed: {e}") from e

async def save_index_snapshot(index: faiss.Index, vector_count: int) -> bool:
    """
    Serialize the FAISS index as a binary blob and upsert into app.faiss_snapshots.
    Keeps only the latest snapshot (deletes old ones after inserting).
    Returns True on success.
    """
    try:
        from .db import get_connection
        import io

        buf = faiss.serialize_index(index)
        data_bytes = buf.tobytes()

        conn = await get_connection()
        try:
            await conn.execute(
                """
                INSERT INTO app.faiss_snapshots (data, vector_count)
                VALUES ($1, $2)
                """,
                data_bytes,
                vector_count,
            )
            # Keep only the latest 3 snapshots to avoid unbounded growth
            await conn.execute(
                """
                DELETE FROM app.faiss_snapshots
                WHERE id NOT IN (
                    SELECT id FROM app.faiss_snapshots ORDER BY created_at DESC LIMIT 3
                )
                """
            )
        finally:
            await conn.close()

        logger.info("[store] FAISS snapshot saved to DB (%d vectors, %d bytes)", vector_count, len(data_bytes))
        return True
    except Exception as exc:
        logger.warning("[store] Failed to save FAISS snapshot to DB: %s", exc)
        return False


async def load_index_from_snapshot() -> Optional[Tuple[faiss.Index, Dict, int]]:
    """
    Load the latest FAISS snapshot from DB.
    Returns (index, empty_mapping_skeleton, vector_count) or None if no snapshot exists.
    The caller should rebuild the full chunk_to_faiss mapping from DB after loading.
    """
    try:
        from .db import get_connection
        import numpy as np

        conn = await get_connection()
        try:
            row = await conn.fetchrow(
                "SELECT data, vector_count FROM app.faiss_snapshots ORDER BY created_at DESC LIMIT 1"
            )
        finally:
            await conn.close()

        if not row:
            return None

        data_bytes = bytes(row["data"])
        arr = np.frombuffer(data_bytes, dtype=np.uint8)
        index = faiss.deserialize_index(arr)

        if index.d != DIM:
            logger.warning("[store] Snapshot dimension mismatch: expected %d got %d", DIM, index.d)
            return None

        logger.info("[store] Loaded FAISS snapshot from DB: %d vectors", index.ntotal)
        return index, row["vector_count"]
    except Exception as exc:
        logger.warning("[store] Failed to load FAISS snapshot from DB: %s", exc)
        return None


async def rebuild_faiss_from_db() -> int:
    """
    Rebuild the FAISS index from embeddings stored in app.chunks.
    Called on startup when the index file is absent (e.g. after Render cold start).
    Returns the number of vectors loaded.
    """
    try:
        from .db import get_connection
        conn = await get_connection()
        try:
            rows = await conn.fetch(
                "SELECT id, faiss_id, embedding FROM app.chunks WHERE embedding IS NOT NULL ORDER BY faiss_id ASC NULLS LAST"
            )
        finally:
            await conn.close()

        if not rows:
            logger.info("[store] No stored embeddings found — FAISS index stays empty")
            return 0

        idx_path, map_path = _paths()
        index = faiss.IndexFlatIP(DIM)
        mapping: Dict = {"next": 0, "chunk_to_faiss": {}}

        vecs = []
        faiss_counter = 0
        for row in rows:
            emb = row["embedding"]
            if emb is None:
                continue
            vec_list = list(emb)
            if len(vec_list) != DIM:
                continue
            vecs.append(vec_list)
            mapping["chunk_to_faiss"][str(row["id"])] = faiss_counter
            faiss_counter += 1

        if not vecs:
            logger.info("[store] All stored embeddings had wrong dimensions — skipping rebuild")
            return 0

        arr = np.array(vecs, dtype=np.float32)
        norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
        arr = arr / norms
        index.add(arr)
        mapping["next"] = faiss_counter

        save_index(index)
        save_map(mapping)

        logger.info("[store] Rebuilt FAISS index from DB: %d vectors", faiss_counter)

        # Persist a binary snapshot so the next cold start can skip per-vector rebuild
        import asyncio
        asyncio.ensure_future(save_index_snapshot(index, faiss_counter))

        return faiss_counter

    except Exception as exc:
        logger.error("[store] Failed to rebuild FAISS from DB: %s", exc)
        return 0


def search_vectors(vec: List[float], k: int = 3) -> Tuple[List[float], List[int]]:
    """Search for similar vectors in FAISS index with error handling."""
    try:
        if not vec:
            raise VectorStoreError("Cannot search with empty vector")
        
        if len(vec) != DIM:
            raise VectorStoreError(f"Query vector dimension mismatch: expected {DIM}, got {len(vec)}")
        
        if k <= 0:
            raise VectorStoreError(f"k must be positive, got {k}")
        
        # Load index
        index = load_index()
        
        if index.ntotal == 0:
            logger.warning("No vectors in index for search")
            return [], []
        
        # Limit k to available vectors
        actual_k = min(k, index.ntotal)
        
        # Normalize query vector for cosine similarity
        try:
            v = np.array([vec], dtype=np.float32)
            
            # Check for invalid values
            if np.any(np.isnan(v)) or np.any(np.isinf(v)):
                raise VectorStoreError("Query vector contains NaN or infinite values")
            
            norm = np.linalg.norm(v, axis=1, keepdims=True) + 1e-12
            v = v / norm
            
        except Exception as e:
            raise VectorStoreError(f"Query vector processing failed: {e}") from e
        
        # Perform search
        try:
            scores, ids = index.search(v, actual_k)
            
            # Convert to lists and validate results
            score_list = scores[0].tolist()
            id_list = ids[0].tolist()
            
            # Filter out invalid IDs (FAISS returns -1 for empty slots)
            valid_results = []
            for score, idx in zip(score_list, id_list):
                if idx >= 0:  # Valid FAISS ID
                    valid_results.append((score, idx))
            
            if valid_results:
                final_scores, final_ids = zip(*valid_results)
                logger.debug(f"Search returned {len(final_scores)} valid results")
                return list(final_scores), list(final_ids)
            else:
                logger.warning("Search returned no valid results")
                return [], []
                
        except Exception as e:
            logger.error(f"FAISS search failed: {e}")
            raise VectorStoreError(f"Vector search failed: {e}") from e
            
    except VectorStoreError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in search_vectors: {e}")
        raise VectorStoreError(f"Vector search failed: {e}") from e