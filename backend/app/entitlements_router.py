from fastapi import APIRouter, Depends, Request

from .auth import User, get_current_user
from .entitlements import OrgEntitlements, get_entitlements
from .org_middleware import require_org_context

router = APIRouter(prefix="/api/entitlements", tags=["entitlements"])


@router.get("", response_model=OrgEntitlements)
async def read_entitlements(
    request: Request,
    user: User = Depends(get_current_user),
) -> OrgEntitlements:
    org_id = require_org_context(request)
    return get_entitlements(org_id)
