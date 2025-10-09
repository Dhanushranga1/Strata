#!/usr/bin/env python3

import jwt
import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_test_jwt(user_id: str, email: str = "test@example.com"):
    """Create a test JWT token for API testing"""
    
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        print("❌ SUPABASE_JWT_SECRET not found in .env file")
        return None
    
    # Create payload similar to what Supabase would create
    payload = {
        "sub": user_id,
        "user_id": user_id,
        "email": email,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iss": "supabase",
        "aud": "authenticated"
    }
    
    # Generate token
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_test_jwt.py <user_id> [email]")
        print("Example: python create_test_jwt.py 12345678-1234-1234-1234-123456789012 test@example.com")
        sys.exit(1)
    
    user_id = sys.argv[1]
    email = sys.argv[2] if len(sys.argv) > 2 else "test@example.com"
    
    token = create_test_jwt(user_id, email)
    if token:
        print("✅ Test JWT token created:")
        print(token)
        print()
        print("🧪 Test with curl:")
        print(f'curl "http://localhost:8000/api/kb/stats" -H "Authorization: Bearer {token}"')
    else:
        print("❌ Failed to create JWT token")