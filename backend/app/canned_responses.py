"""Canned responses — pre-written reply snippets for reps."""

import logging
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from .auth import User, get_current_user
from .org_middleware import require_org_context, require_org_role
from .schemas import CannedResponseCreate, CannedResponseOut, CannedResponseUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/canned-responses", tags=["canned-responses"])


async def _get_db():
    from .db import get_connection

    return await get_connection()


@router.get("", response_model=list[CannedResponseOut])
async def list_canned_responses(
    request: Request,
    q: str | None = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
):
    """List canned responses for the org. Optionally filter by title."""
    org_id = require_org_context(request)
    conn = await _get_db()
    try:
        if q:
            rows = await conn.fetch(
                "SELECT id, title, body, tags, created_by, created_at, updated_at "
                "FROM app.canned_responses "
                "WHERE organization_id = $1 AND title ILIKE $2 "
                "ORDER BY created_at DESC",
                uuid_lib.UUID(org_id),
                f"%{q}%",
            )
        else:
            rows = await conn.fetch(
                "SELECT id, title, body, tags, created_by, created_at, updated_at "
                "FROM app.canned_responses "
                "WHERE organization_id = $1 "
                "ORDER BY created_at DESC",
                uuid_lib.UUID(org_id),
            )
        return [
            CannedResponseOut(
                id=str(r["id"]),
                title=r["title"],
                body=r["body"],
                tags=list(r["tags"] or []),
                created_by=str(r["created_by"]) if r["created_by"] else None,
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
            for r in rows
        ]
    finally:
        await conn.close()


@router.post("", response_model=CannedResponseOut, status_code=status.HTTP_201_CREATED)
async def create_canned_response(
    payload: CannedResponseCreate,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Create a canned response. Requires org owner or admin."""
    org_id = require_org_context(request)
    require_org_role(request, {"owner", "admin"})
    conn = await _get_db()
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO app.canned_responses (organization_id, title, body, tags, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, title, body, tags, created_by, created_at, updated_at
            """,
            uuid_lib.UUID(org_id),
            payload.title,
            payload.body,
            payload.tags or [],
            uuid_lib.UUID(user.id),
        )
        return CannedResponseOut(
            id=str(row["id"]),
            title=row["title"],
            body=row["body"],
            tags=list(row["tags"] or []),
            created_by=str(row["created_by"]) if row["created_by"] else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    finally:
        await conn.close()


@router.patch("/{response_id}", response_model=CannedResponseOut)
async def update_canned_response(
    response_id: str,
    payload: CannedResponseUpdate,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Update a canned response. Requires org owner or admin."""
    org_id = require_org_context(request)
    require_org_role(request, {"owner", "admin"})
    conn = await _get_db()
    try:
        updates = []
        params: list = []

        if payload.title is not None:
            params.append(payload.title)
            updates.append(f"title = ${len(params)}")
        if payload.body is not None:
            params.append(payload.body)
            updates.append(f"body = ${len(params)}")
        if payload.tags is not None:
            params.append(payload.tags)
            updates.append(f"tags = ${len(params)}")

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No fields to update",
            )

        updates.append("updated_at = NOW()")
        params.extend([uuid_lib.UUID(response_id), uuid_lib.UUID(org_id)])

        row = await conn.fetchrow(
            f"UPDATE app.canned_responses SET {', '.join(updates)} "
            f"WHERE id = ${len(params) - 1} AND organization_id = ${len(params)} "
            f"RETURNING id, title, body, tags, created_by, created_at, updated_at",
            *params,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Canned response not found")

        return CannedResponseOut(
            id=str(row["id"]),
            title=row["title"],
            body=row["body"],
            tags=list(row["tags"] or []),
            created_by=str(row["created_by"]) if row["created_by"] else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    finally:
        await conn.close()


@router.delete("/{response_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_canned_response(
    response_id: str,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Delete a canned response. Requires org owner or admin."""
    org_id = require_org_context(request)
    require_org_role(request, {"owner", "admin"})
    conn = await _get_db()
    try:
        result = await conn.execute(
            "DELETE FROM app.canned_responses WHERE id = $1 AND organization_id = $2",
            uuid_lib.UUID(response_id),
            uuid_lib.UUID(org_id),
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Canned response not found")
    finally:
        await conn.close()
