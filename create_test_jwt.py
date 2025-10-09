#!/usr/bin/env python3

import jwt
import datetime
import os

# JWT secret - this should match what's in your app config
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-here")

# Create payload
payload = {
    "user_id": "test_user_123",
    "email": "test@example.com", 
    "role": "admin",
    "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    "iat": datetime.datetime.utcnow()
}

# Generate token
token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
print(f"Token: {token}")