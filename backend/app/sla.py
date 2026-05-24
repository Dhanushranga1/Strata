"""SLA policy management — per-org, per-priority first-response and resolution targets."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
import uuid as uuid_lib
import logging

from .auth import User, get_current_user
from .org_middleware import require_org_context, require_org_role
from .schemas import SLAPolicyItem, SLAPolicyUpsert, SLAPolicyResponse
from .entitlements import requires_feature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sla", tags=["sla"])

# Default SLA hours — used to seed new orgs and as fallback in the overdue scan.
SLA_DEFAULTS: dict[int, dict[str, float]] = {
    1: {"first_response_hours": 48.0, "resolution_hours": 168.0},
    2: {"first_response_hours": 24.0, "resolution_hours": 72.0},
    3: {"first_response_hours": 8.0,  "resolution_hours": 48.0},
    4: {"first_response_hours": 4.0,  "resolution_hours": 24.0},
    5: {"first_response_hours": 2.0,  "resolution_hours": 12.0},
    6: {"first_response_hours": 1.0,  "resolution_hours": 6.0},
    7: {"first_response_hours": 1.0,  "resolution_hours": 4.0},
}


async def _get_db():
    from .db import get_connection
    return await get_connection()


@router.get("", response_model=SLAPolicyResponse)
async def get_sla_policies(request: Request, user: User = Depends(get_current_user)):
    """Return the 7-row SLA policy for the current org. Seeds defaults on first call."""
    org_id = require_org_context(request)
    conn = await _get_db()
    try:
        rows = await conn.fetch(
            "SELECT priority_level, first_response_hours, resolution_hours "
            "FROM app.sla_policies WHERE organization_id = $1 AND is_active = TRUE "
            "ORDER BY priority_level",
            uuid_lib.UUID(org_id),
        )

        if not rows:
            for lvl, defaults in SLA_DEFAULTS.items():
                await conn.execute(
                    """
                    INSERT INTO app.sla_policies
                        (organization_id, priority_level, first_response_hours, resolution_hours)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (organization_id, priority_level) DO NOTHING
                    """,
                    uuid_lib.UUID(org_id), lvl,
                    defaults["first_response_hours"], defaults["resolution_hours"],
                )
            rows = await conn.fetch(
                "SELECT priority_level, first_response_hours, resolution_hours "
                "FROM app.sla_policies WHERE organization_id = $1 AND is_active = TRUE "
                "ORDER BY priority_level",
                uuid_lib.UUID(org_id),
            )

        return SLAPolicyResponse(policies=[
            SLAPolicyItem(
                priority_level=r["priority_level"],
                first_response_hours=float(r["first_response_hours"]),
                resolution_hours=float(r["resolution_hours"]),
            )
            for r in rows
        ])
    finally:
        await conn.close()


@router.put("", response_model=SLAPolicyResponse)
async def upsert_sla_policies(
    payload: SLAPolicyUpsert,
    request: Request,
    user: User = Depends(get_current_user),
    _gate: None = requires_feature("sla_config"),
):
    """Upsert all SLA policy rows for the org in one batch. Requires owner or admin."""
    org_id = require_org_context(request)
    require_org_role(request, {"owner", "admin"})

    if not payload.policies:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one policy required")

    conn = await _get_db()
    try:
        for p in payload.policies:
            await conn.execute(
                """
                INSERT INTO app.sla_policies
                    (organization_id, priority_level, first_response_hours, resolution_hours, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (organization_id, priority_level)
                DO UPDATE SET
                    first_response_hours = EXCLUDED.first_response_hours,
                    resolution_hours     = EXCLUDED.resolution_hours,
                    updated_at           = NOW()
                """,
                uuid_lib.UUID(org_id), p.priority_level,
                p.first_response_hours, p.resolution_hours,
            )

        rows = await conn.fetch(
            "SELECT priority_level, first_response_hours, resolution_hours "
            "FROM app.sla_policies WHERE organization_id = $1 AND is_active = TRUE "
            "ORDER BY priority_level",
            uuid_lib.UUID(org_id),
        )
        return SLAPolicyResponse(policies=[
            SLAPolicyItem(
                priority_level=r["priority_level"],
                first_response_hours=float(r["first_response_hours"]),
                resolution_hours=float(r["resolution_hours"]),
            )
            for r in rows
        ])
    finally:
        await conn.close()
