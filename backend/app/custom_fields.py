"""Custom ticket fields — org-defined extra fields on tickets."""

import json
import logging
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, Request, status

from .auth import User, get_current_user
from .org_middleware import (
    get_user_role_from_request,
    require_org_context,
    require_org_role,
)
from .schemas import (
    FieldDefCreate,
    FieldDefOut,
    FieldDefUpdate,
    FieldValueUpsert,
    TicketFieldEntry,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/custom-fields", tags=["custom-fields"])

_VALID_TYPES = {"text", "number", "select", "date", "boolean"}


async def _get_db():
    from .db import get_connection

    return await get_connection()


def _row_to_def(row) -> FieldDefOut:
    opts = row.get("options")
    if isinstance(opts, str):
        opts = json.loads(opts)
    return FieldDefOut(
        id=str(row["id"]),
        name=row["name"],
        label=row["label"],
        field_type=row["field_type"],
        options=opts,
        is_required=row["is_required"],
        is_active=row["is_active"],
        sort_order=row["sort_order"],
        created_at=row["created_at"],
    )


# ─── Field Definition endpoints ───────────────────────────────────────────────


@router.get("/defs", response_model=list[FieldDefOut])
async def list_field_defs(request: Request, user: User = Depends(get_current_user)):
    """List active custom field definitions for the org."""
    org_id = require_org_context(request)
    conn = await _get_db()
    try:
        rows = await conn.fetch(
            "SELECT id, name, label, field_type, options, is_required, is_active, sort_order, created_at "
            "FROM app.ticket_field_defs "
            "WHERE organization_id = $1 AND is_active = TRUE "
            "ORDER BY sort_order ASC, created_at ASC",
            uuid_lib.UUID(org_id),
        )
        return [_row_to_def(r) for r in rows]
    finally:
        await conn.close()


@router.post("/defs", response_model=FieldDefOut, status_code=status.HTTP_201_CREATED)
async def create_field_def(
    payload: FieldDefCreate,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Create a custom field definition. Requires owner or admin."""
    org_id = require_org_context(request)
    require_org_role(request, {"owner", "admin"})

    if payload.field_type == "select" and not payload.options:
        raise HTTPException(
            status_code=422, detail="Select fields require at least one option"
        )

    conn = await _get_db()
    try:
        options_json = json.dumps(payload.options) if payload.options else None
        row = await conn.fetchrow(
            """
            INSERT INTO app.ticket_field_defs
                (organization_id, name, label, field_type, options, is_required, sort_order)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
            RETURNING id, name, label, field_type, options, is_required, is_active, sort_order, created_at
            """,
            uuid_lib.UUID(org_id),
            payload.name,
            payload.label,
            payload.field_type,
            options_json,
            payload.is_required,
            payload.sort_order,
        )
        return _row_to_def(row)
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="A field with that name already exists in this organisation",
            )
        raise
    finally:
        await conn.close()


@router.patch("/defs/{def_id}", response_model=FieldDefOut)
async def update_field_def(
    def_id: str,
    payload: FieldDefUpdate,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Update a field definition (label, options, required, sort_order, active). Requires owner or admin."""
    org_id = require_org_context(request)
    require_org_role(request, {"owner", "admin"})

    conn = await _get_db()
    try:
        updates = []
        params: list = []

        if payload.label is not None:
            params.append(payload.label)
            updates.append(f"label = ${len(params)}")
        if payload.options is not None:
            params.append(json.dumps(payload.options))
            updates.append(f"options = ${len(params)}::jsonb")
        if payload.is_required is not None:
            params.append(payload.is_required)
            updates.append(f"is_required = ${len(params)}")
        if payload.sort_order is not None:
            params.append(payload.sort_order)
            updates.append(f"sort_order = ${len(params)}")
        if payload.is_active is not None:
            params.append(payload.is_active)
            updates.append(f"is_active = ${len(params)}")

        if not updates:
            raise HTTPException(status_code=422, detail="No fields to update")

        updates.append("updated_at = NOW()")
        params.extend([uuid_lib.UUID(def_id), uuid_lib.UUID(org_id)])

        row = await conn.fetchrow(
            f"UPDATE app.ticket_field_defs SET {', '.join(updates)} "
            f"WHERE id = ${len(params) - 1} AND organization_id = ${len(params)} "
            f"RETURNING id, name, label, field_type, options, is_required, is_active, sort_order, created_at",
            *params,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Field definition not found")
        return _row_to_def(row)
    finally:
        await conn.close()


@router.delete("/defs/{def_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_def(
    def_id: str,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Soft-delete a field definition (sets is_active=FALSE, preserves values). Requires owner or admin."""
    org_id = require_org_context(request)
    require_org_role(request, {"owner", "admin"})

    conn = await _get_db()
    try:
        result = await conn.execute(
            "UPDATE app.ticket_field_defs SET is_active = FALSE, updated_at = NOW() "
            "WHERE id = $1 AND organization_id = $2",
            uuid_lib.UUID(def_id),
            uuid_lib.UUID(org_id),
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Field definition not found")
    finally:
        await conn.close()


# ─── Field Value endpoints ────────────────────────────────────────────────────


@router.get("/tickets/{ticket_id}", response_model=list[TicketFieldEntry])
async def get_ticket_fields(
    ticket_id: str,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Return all field defs with current values for this ticket (single request)."""
    org_id = require_org_context(request)
    conn = await _get_db()
    try:
        # Verify ticket belongs to this org
        t = await conn.fetchrow(
            "SELECT created_by FROM app.tickets WHERE id = $1 AND organization_id = $2",
            uuid_lib.UUID(ticket_id),
            uuid_lib.UUID(org_id),
        )
        if not t:
            raise HTTPException(status_code=404, detail="Ticket not found")

        # Fetch active defs for this org
        defs = await conn.fetch(
            "SELECT id, name, label, field_type, options, is_required, is_active, sort_order, created_at "
            "FROM app.ticket_field_defs "
            "WHERE organization_id = $1 AND is_active = TRUE "
            "ORDER BY sort_order ASC, created_at ASC",
            uuid_lib.UUID(org_id),
        )

        # Fetch existing values for this ticket
        vals = await conn.fetch(
            "SELECT field_def_id, value_text, value_number, value_date, value_bool "
            "FROM app.ticket_field_values WHERE ticket_id = $1",
            uuid_lib.UUID(ticket_id),
        )
        val_map = {str(v["field_def_id"]): v for v in vals}

        result = []
        for d in defs:
            v = val_map.get(str(d["id"]))
            result.append(
                TicketFieldEntry(
                    field_def=_row_to_def(d),
                    value_text=v["value_text"] if v else None,
                    value_number=(
                        float(v["value_number"])
                        if v and v["value_number"] is not None
                        else None
                    ),
                    value_date=str(v["value_date"]) if v and v["value_date"] else None,
                    value_bool=v["value_bool"] if v else None,
                )
            )
        return result
    finally:
        await conn.close()


@router.patch("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_ticket_fields(
    ticket_id: str,
    payload: FieldValueUpsert,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Upsert custom field values for a ticket. Validates type against field definition."""
    org_id = require_org_context(request)

    # Reps can update any ticket; customers can only update their own
    org_role = get_user_role_from_request(request)
    is_rep = org_role in ("rep", "admin", "owner")

    conn = await _get_db()
    try:
        t = await conn.fetchrow(
            "SELECT created_by FROM app.tickets WHERE id = $1 AND organization_id = $2",
            uuid_lib.UUID(ticket_id),
            uuid_lib.UUID(org_id),
        )
        if not t:
            raise HTTPException(status_code=404, detail="Ticket not found")
        if not is_rep and str(t["created_by"]) != user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        for v in payload.values:
            # Validate field belongs to this org
            def_row = await conn.fetchrow(
                "SELECT field_type FROM app.ticket_field_defs "
                "WHERE id = $1 AND organization_id = $2 AND is_active = TRUE",
                uuid_lib.UUID(v.field_def_id),
                uuid_lib.UUID(org_id),
            )
            if not def_row:
                raise HTTPException(
                    status_code=404,
                    detail=f"Field {v.field_def_id} not found in this organisation",
                )

            ft = def_row["field_type"]

            # Type validation — ensure at least one typed value matches the field type
            if ft == "text" and v.value_text is None and v.value_number is not None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Field {v.field_def_id} expects text, got number",
                )
            if (
                ft == "number"
                and v.value_text is None
                and v.value_number is None
                and v.value_date is None
                and v.value_bool is None
            ):
                raise HTTPException(
                    status_code=422, detail=f"Field {v.field_def_id} expects a number"
                )
            if ft == "number" and v.value_text is not None:
                try:
                    v = v.model_copy(
                        update={"value_number": float(v.value_text), "value_text": None}
                    )
                except ValueError:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Field {v.field_def_id} expects a number",
                    )

            await conn.execute(
                """
                INSERT INTO app.ticket_field_values
                    (ticket_id, field_def_id, value_text, value_number, value_date, value_bool, updated_at)
                VALUES ($1, $2, $3, $4, $5::date, $6, NOW())
                ON CONFLICT (ticket_id, field_def_id)
                DO UPDATE SET
                    value_text   = EXCLUDED.value_text,
                    value_number = EXCLUDED.value_number,
                    value_date   = EXCLUDED.value_date,
                    value_bool   = EXCLUDED.value_bool,
                    updated_at   = NOW()
                """,
                uuid_lib.UUID(ticket_id),
                uuid_lib.UUID(v.field_def_id),
                v.value_text,
                v.value_number,
                v.value_date,
                v.value_bool,
            )
    finally:
        await conn.close()
