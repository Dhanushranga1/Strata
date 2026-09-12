"""
Re-embed KB chunks whose vectors are missing/stale.

Used after dimension migrations (e.g. 0035: 768 -> 1536 nulled every
embedding_vec) or after an embedding-model switch cleared vectors.
Reads chunk text from the DB — no re-uploading required.

Usage:
    python scripts/reembed_chunks.py            # all orgs
    python scripts/reembed_chunks.py <org_id>   # one org

Idempotent: only touches chunks WHERE embedding_vec IS NULL.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BATCH = 32


async def reembed(org_id: str | None = None) -> None:
    from app.db_sync import get_db_connection
    from app.embeddings import embed_texts

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if org_id:
                cur.execute(
                    """
                    SELECT c.id, c.text
                    FROM app.chunks c
                    WHERE c.embedding_vec IS NULL AND c.organization_id = %s
                    ORDER BY c.created_at
                    """,
                    (org_id,),
                )
            else:
                cur.execute("""
                    SELECT c.id, c.text
                    FROM app.chunks c
                    WHERE c.embedding_vec IS NULL
                    ORDER BY c.created_at
                    """)
            rows = cur.fetchall()

    if not rows:
        print("Nothing to re-embed — all chunks have vectors.")
        return

    print(
        f"Re-embedding {len(rows)} chunk(s) with {os.getenv('EMBEDDING_MODEL', 'auto') or 'configured model'}..."
    )

    done = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        texts = [r["text"] for r in batch]
        vectors = await asyncio.to_thread(embed_texts, texts)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                for r, vec in zip(batch, vectors):
                    cur.execute(
                        """
                        UPDATE app.chunks
                        SET embedding_vec = %s::vector
                        WHERE id = %s::uuid
                        """,
                        (str(list(vec)), str(r["id"])),
                    )
                conn.commit()
        done += len(batch)
        print(f"  {done}/{len(rows)} embedded")

    print(f"Done at {datetime.now(timezone.utc).isoformat()}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(reembed(target))
