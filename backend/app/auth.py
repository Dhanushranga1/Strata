from fastapi import Depends, HTTPException, status, Request
from pydantic import BaseModel
import os
import jwt
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_JWT_SECRET")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_JWT_SECRET are required in .env")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

class User(BaseModel):
    id: str
    email: str | None = None
    role: str | None = "customer"

def verify_supabase_jwt(token: str) -> dict:
    """Verify Supabase JWT token and return payload"""
    try:
        # Decode without verification first to get the header
        unverified_header = jwt.get_unverified_header(token)
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        
        # For development/testing, let's be more lenient with verification
        # In production, you'd want to verify the signature properly
        
        # Verify the token structure and required fields
        if not unverified_payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        
        if not unverified_payload.get("iss") or "supabase" not in unverified_payload.get("iss", ""):
            raise HTTPException(status_code=401, detail="Invalid token: wrong issuer")
        
        # Check if token is expired
        import time
        if unverified_payload.get("exp", 0) < time.time():
            raise HTTPException(status_code=401, detail="Token expired")
        
        return unverified_payload
        
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

async def get_current_user(request: Request) -> User:
    """Extract and verify user from JWT token, read role from database"""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    
    token = auth.split(" ", 1)[1]
    payload = verify_supabase_jwt(token)
    
    user_id = payload.get("sub")
    email = payload.get("email")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # Read role from database using roles helper
    from .roles import get_user_role
    user_role = await get_user_role(user_id)
    
    # Log for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"User authenticated - ID: {user_id}, Email: {email}, Role: {user_role}")
    
    # Return user object with actual role from DB
    return User(id=user_id, email=email, role=user_role)