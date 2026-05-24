#!/usr/bin/env python3
"""
Quick test to verify TicketPilot backend is accessible
"""

import sys
try:
    import requests
except ImportError:
    print("❌ 'requests' library not installed")
    print("   Run: pip3 install requests")
    sys.exit(1)

BACKEND_URL = "https://ticketpilot-backend.onrender.com"

print("🔍 Testing TicketPilot Backend...")
print(f"   URL: {BACKEND_URL}")
print()

try:
    # Test health endpoint
    print("1. Checking health endpoint...")
    response = requests.get(f"{BACKEND_URL}/health", timeout=60)
    
    if response.status_code == 200:
        print("   ✅ Backend is healthy!")
        print(f"   Response: {response.json()}")
    else:
        print(f"   ⚠️  Unexpected status: {response.status_code}")
    
    print()
    
    # Test root endpoint
    print("2. Checking root endpoint...")
    response = requests.get(f"{BACKEND_URL}/", timeout=30)
    
    if response.status_code == 200:
        print("   ✅ Root endpoint accessible!")
    else:
        print(f"   ⚠️  Status: {response.status_code}")
    
    print()
    print("✅ Backend is accessible and ready!")
    print()
    print("Next steps:")
    print("1. Get your AUTH_TOKEN from the frontend")
    print("2. Run: ./create-demo-tickets.sh")
    print()

except requests.exceptions.Timeout:
    print("   ⏱️  Request timed out (backend may be sleeping)")
    print("   💡 Try again - first request can take 30-60 seconds")
    sys.exit(1)

except requests.exceptions.ConnectionError:
    print("   ❌ Cannot connect to backend")
    print("   Check your internet connection or backend URL")
    sys.exit(1)

except Exception as e:
    print(f"   ❌ Error: {str(e)}")
    sys.exit(1)
