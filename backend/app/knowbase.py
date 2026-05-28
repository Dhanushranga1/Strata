"""
KnowBase — human-readable knowledge articles (SOPs, runbooks, how-tos).
Separate from the RAG KB (app.chunks / FAISS) which is for AI retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional, List
import logging

from .auth import User, get_current_user
from .org_middleware import require_org_context
from .db_sync import get_db_connection
from .entitlements import requires_feature

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowbase", tags=["knowbase"])


def _require_rep(user: User):
    if user.role not in ("rep", "admin"):
        raise HTTPException(403, "Rep/Admin access required")


# ── Pydantic models ────────────────────────────────────────────────────────────

class ArticleIn(BaseModel):
    title: str
    content: str
    category: Optional[str] = None
    tags: List[str] = []
    is_published: bool = False
    is_public: bool = False


class ArticleOut(BaseModel):
    id: str
    title: str
    content: str
    category: Optional[str]
    tags: List[str]
    author_id: Optional[str]
    author_email: Optional[str]
    is_published: bool
    is_public: bool
    view_count: int
    helpful_votes: int
    created_at: str
    updated_at: str


class ArticleSummary(BaseModel):
    id: str
    title: str
    category: Optional[str]
    tags: List[str]
    is_published: bool
    is_public: bool
    view_count: int
    helpful_votes: int
    created_at: str
    updated_at: str


class KnowBaseStats(BaseModel):
    total: int
    published: int
    categories: List[str]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/platform-stats")
def knowbase_platform_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
):
    """Stats for the Strata Platform Hub card."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_published) AS published "
            "FROM app.knowledge_articles WHERE organization_id = %s",
            (org_id,),
        )
        row = cur.fetchone()
    total = row["total"] or 0
    published = row["published"] or 0
    drafts = total - published
    stats = [f"{total} article{'s' if total != 1 else ''}"]
    if drafts: stats.append(f"{drafts} draft{'s' if drafts != 1 else ''}")
    return {"stats": stats, "health": "healthy"}


@router.get("/stats", response_model=KnowBaseStats)
def knowbase_stats(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_published) AS published "
            "FROM app.knowledge_articles WHERE organization_id = %s",
            (org_id,),
        )
        row = cur.fetchone()
        cur.execute(
            "SELECT DISTINCT category FROM app.knowledge_articles "
            "WHERE organization_id = %s AND category IS NOT NULL ORDER BY category",
            (org_id,),
        )
        cats = [r["category"] for r in cur.fetchall()]
    return KnowBaseStats(
        total=row["total"] or 0,
        published=row["published"] or 0,
        categories=cats,
    )


@router.get("/articles", response_model=List[ArticleSummary])
def list_articles(
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    published_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    org_id = require_org_context(request)
    is_rep = user.role in ("rep", "admin")

    conditions = ["organization_id = %s"]
    params: list = [org_id]

    # customers only see published articles
    if not is_rep or published_only:
        conditions.append("is_published = TRUE")

    if q:
        conditions.append("(title ILIKE %s OR content ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]

    if category:
        conditions.append("category = %s")
        params.append(category)

    where = " AND ".join(conditions)
    params += [limit, offset]

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT id, title, category, tags, is_published, is_public,
                   view_count, helpful_votes, created_at, updated_at
            FROM app.knowledge_articles
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            params,
        )
        rows = cur.fetchall()

    return [
        ArticleSummary(
            id=str(r["id"]),
            title=r["title"],
            category=r["category"],
            tags=list(r["tags"] or []),
            is_published=r["is_published"],
            is_public=r["is_public"],
            view_count=r["view_count"],
            helpful_votes=r["helpful_votes"],
            created_at=r["created_at"].isoformat(),
            updated_at=r["updated_at"].isoformat(),
        )
        for r in rows
    ]


@router.post("/articles", response_model=ArticleOut, status_code=201)
def create_article(
    body: ArticleIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    if not body.title.strip():
        raise HTTPException(400, "Title is required")
    if not body.content.strip():
        raise HTTPException(400, "Content is required")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO app.knowledge_articles
              (organization_id, title, content, category, tags, author_id, is_published, is_public)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (org_id, body.title.strip(), body.content.strip(),
             body.category or None, body.tags,
             user.id, body.is_published, body.is_public),
        )
        row = cur.fetchone()
        conn.commit()

    try:
        from .casper import casper_engine
        casper_engine.embed_entity(
            "knowbase_article", str(row["id"]),
            f"[article] {body.title} {body.content[:500]}",
            org_id,
        )
    except Exception:
        pass

    return _row_to_out(row, author_email=user.email)


@router.get("/articles/{article_id}", response_model=ArticleOut)
def get_article(
    article_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
):
    org_id = require_org_context(request)
    is_rep = user.role in ("rep", "admin")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ka.*, au.email AS author_email
            FROM app.knowledge_articles ka
            LEFT JOIN auth.users au ON au.id = ka.author_id
            WHERE ka.id = %s::uuid AND ka.organization_id = %s
            """,
            (article_id, org_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Article not found")
        if not is_rep and not row["is_published"]:
            raise HTTPException(404, "Article not found")

        # increment view count (fire-and-forget, don't fail on error)
        try:
            cur.execute(
                "UPDATE app.knowledge_articles SET view_count = view_count + 1 WHERE id = %s::uuid",
                (article_id,),
            )
            conn.commit()
        except Exception:
            pass

    return _row_to_out(row, author_email=row.get("author_email"))


@router.put("/articles/{article_id}", response_model=ArticleOut)
def update_article(
    article_id: str,
    body: ArticleIn,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM app.knowledge_articles WHERE id = %s::uuid AND organization_id = %s",
            (article_id, org_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Article not found")

        cur.execute(
            """
            UPDATE app.knowledge_articles
            SET title = %s, content = %s, category = %s, tags = %s,
                is_published = %s, is_public = %s
            WHERE id = %s::uuid AND organization_id = %s
            RETURNING *
            """,
            (body.title.strip(), body.content.strip(),
             body.category or None, body.tags,
             body.is_published, body.is_public,
             article_id, org_id),
        )
        row = cur.fetchone()
        conn.commit()

    try:
        from .casper import casper_engine
        casper_engine.embed_entity(
            "knowbase_article", article_id,
            f"[article] {body.title} {body.content[:500]}",
            org_id,
        )
    except Exception:
        pass

    return _row_to_out(row, author_email=user.email)


@router.delete("/articles/{article_id}", status_code=204)
def delete_article(
    article_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
):
    org_id = require_org_context(request)
    _require_rep(user)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM app.knowledge_articles WHERE id = %s::uuid AND organization_id = %s RETURNING id",
            (article_id, org_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Article not found")
        conn.commit()


@router.post("/articles/{article_id}/helpful", status_code=204)
def mark_helpful(
    article_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("know_base"),
):
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE app.knowledge_articles SET helpful_votes = helpful_votes + 1 "
            "WHERE id = %s::uuid AND organization_id = %s RETURNING id",
            (article_id, org_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Article not found")
        conn.commit()


# ── Helper ─────────────────────────────────────────────────────────────────────

def _row_to_out(row, author_email: Optional[str] = None) -> ArticleOut:
    return ArticleOut(
        id=str(row["id"]),
        title=row["title"],
        content=row["content"],
        category=row["category"],
        tags=list(row["tags"] or []),
        author_id=str(row["author_id"]) if row["author_id"] else None,
        author_email=author_email,
        is_published=row["is_published"],
        is_public=row["is_public"],
        view_count=row["view_count"],
        helpful_votes=row["helpful_votes"],
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )
