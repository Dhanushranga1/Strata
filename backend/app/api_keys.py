"""
Per-org API key management.

Keys are single-use credentials (format: sk_live_<32 random chars>).
Only the SHA-256 hash is stored — the plain key is returned once on creation
and never again (like GitHub PATs, Stripe keys, etc.).
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import hashlib
import secrets
import string

from .auth import User, get_current_user
from .org_middleware import require_org_context
from .db_sync import get_db_connection

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

_ALPHABET = string.ascii_letters + string.digits


def _generate_key() -> tuple[str, str, str]:
    """Return (full_key, prefix, hash)."""
    random_part = "".join(secrets.choice(_ALPHABET) for _ in range(32))
    key = f"sk_live_{random_part}"
    prefix = key[:12]                                 # "sk_live_XXXX"
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    return key, prefix, key_hash


def _require_admin(user: User) -> None:
    """Only org admins/owners may manage API keys."""
    from .auth import get_user_role
    role = get_user_role(user.id)
    if role not in ("admin", "rep"):   # reps allowed to read; write restricted below
        raise HTTPException(status_code=403, detail="Admin role required")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    name: str
    expires_days: Optional[int] = None   # None = no expiry


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("")
def list_keys(request: Request, user: User = Depends(get_current_user)):
    """List all API keys for the org (prefix + metadata only, never the full key)."""
    org_id = require_org_context(request)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, name, key_prefix, is_active, last_used_at, expires_at, created_at
            FROM app.api_keys
            WHERE organization_id = %s
            ORDER BY created_at DESC
            """,
            (org_id,),
        )
        rows = cur.fetchall()
    return {"keys": [dict(r) for r in rows]}


@router.post("", status_code=201)
def create_key(
    payload: CreateKeyRequest,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Create a new API key. Returns the full key ONCE — store it immediately."""
    org_id = require_org_context(request)

    from .auth import get_user_role
    if get_user_role(user.id) not in ("admin",):
        raise HTTPException(status_code=403, detail="Only admins may create API keys")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Key name is required")

    full_key, prefix, key_hash = _generate_key()

    expires_at = None
    if payload.expires_days:
        from datetime import datetime, timedelta, timezone
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_days)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO app.api_keys
              (organization_id, created_by, name, key_prefix, key_hash, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, name, key_prefix, created_at
            """,
            (org_id, user.id, name, prefix, key_hash, expires_at),
        )
        row = dict(cur.fetchone())

    return {
        **row,
        "key": full_key,   # shown once — not stored
        "warning": "Store this key securely. It will not be shown again.",
    }


@router.delete("/{key_id}", status_code=204)
def revoke_key(
    key_id: str,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Revoke (soft-delete) an API key."""
    org_id = require_org_context(request)

    from .auth import get_user_role
    if get_user_role(user.id) not in ("admin",):
        raise HTTPException(status_code=403, detail="Only admins may revoke API keys")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE app.api_keys
            SET is_active = false
            WHERE id = %s AND organization_id = %s
            RETURNING id
            """,
            (key_id, org_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="API key not found")
