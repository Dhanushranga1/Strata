#!/usr/bin/env python3

import os
import sys
import jwt
import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
if not SUPABASE_JWT_SECRET:
    print("Error: SUPABASE_JWT_SECRET not found in .env file")
    sys.exit(1)

# Create a test user payload that matches Supabase structure
payload = {
    "iss": "supabase",
    "ref": "nvgmgvplfpukckfkjuso", 
    "role": "authenticated",
    "iat": int(datetime.datetime.utcnow().timestamp()),
    "exp": int((datetime.datetime.utcnow() + datetime.timedelta(hours=24)).timestamp()),
    "sub": "cfa54340-eea2-43af-b0fd-6cc11ea68b5f",
    "email": "test@example.com",
    "user_metadata": {
        "role": "rep"
    }
}

# Generate token using Supabase secret
token = jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")
print(f"Token: {token}")