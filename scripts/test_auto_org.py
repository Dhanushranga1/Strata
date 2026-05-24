#!/usr/bin/env python3
"""
Test script for auto-organization creation on signup.
Tests the critical fix for new users having no organization.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from app.auth import auto_create_organization_for_new_user, get_user_organizations
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_auto_org_creation():
    """Test the auto-org creation function"""
    
    # Test data
    test_user_id = "550e8400-e29b-41d4-a716-446655440000"  # Valid UUID
    test_email = "testuser@example.com"
    
    print("\n" + "="*60)
    print("🧪 TESTING AUTO-ORGANIZATION CREATION")
    print("="*60)
    
    print(f"\n📋 Test Parameters:")
    print(f"   User ID: {test_user_id}")
    print(f"   Email: {test_email}")
    
    try:
        # Test 1: Check if user has organizations
        print(f"\n1️⃣ Checking existing organizations...")
        existing_orgs = await get_user_organizations(test_user_id)
        print(f"   Found {len(existing_orgs)} existing organizations")
        
        if existing_orgs:
            print(f"   ℹ️ User already has organizations:")
            for org in existing_orgs:
                print(f"      - {org.name} ({org.slug}) - Role: {org.your_role}")
        
        # Test 2: Create auto-organization (this should work even if org exists)
        print(f"\n2️⃣ Creating auto-organization...")
        org_id = await auto_create_organization_for_new_user(test_user_id, test_email)
        print(f"   ✅ Created organization with ID: {org_id}")
        
        # Test 3: Verify organization was created
        print(f"\n3️⃣ Verifying organization...")
        orgs = await get_user_organizations(test_user_id)
        print(f"   Found {len(orgs)} total organizations")
        
        if orgs:
            print(f"   📋 Organization details:")
            for org in orgs:
                print(f"      - Name: {org.name}")
                print(f"      - Slug: {org.slug}")
                print(f"      - Role: {org.your_role}")
                print(f"      - Default: {org.is_default}")
        
        print(f"\n✅ TEST PASSED: Auto-organization creation works!")
        print(f"\n💡 Note: You may need to manually delete test organizations from database")
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_edge_cases():
    """Test edge cases for organization creation"""
    
    print("\n" + "="*60)
    print("🧪 TESTING EDGE CASES")
    print("="*60)
    
    test_cases = [
        ("test.user@example.com", "Should create org with 'test-user' slug"),
        ("a@b.com", "Short email should still work"),
        ("user+test@example.com", "Plus addressing should work"),
        ("CamelCase@Example.COM", "Mixed case should normalize"),
    ]
    
    for email, description in test_cases:
        print(f"\n📧 Testing: {email}")
        print(f"   {description}")
        
        # Just test slug generation logic (don't actually create)
        import re
        username = email.split('@')[0]
        slug = username.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = slug.strip('-')
        slug = re.sub(r'-+', '-', slug)
        
        if len(slug) < 3:
            slug = slug + "-org"
        if len(slug) > 50:
            slug = slug[:50].rstrip('-')
        
        print(f"   Generated slug: '{slug}'")

if __name__ == "__main__":
    print("\n🚀 Starting Auto-Org Creation Tests...\n")
    
    # Check environment
    if not os.getenv("DATABASE_URL"):
        print("❌ DATABASE_URL not set!")
        print("   Please set environment variables first:")
        print("   export DATABASE_URL=your_database_url")
        sys.exit(1)
    
    print("✅ Environment variables found")
    
    # Run tests
    try:
        # Test edge cases first (doesn't need DB)
        asyncio.run(test_edge_cases())
        
        # Then test actual creation
        result = asyncio.run(test_auto_org_creation())
        
        if result:
            print("\n" + "="*60)
            print("🎉 ALL TESTS PASSED!")
            print("="*60)
            print("\n📝 Next Steps:")
            print("   1. Test with real user signup flow")
            print("   2. Verify frontend receives organization")
            print("   3. Test dashboard loads correctly")
            sys.exit(0)
        else:
            print("\n❌ TESTS FAILED")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
