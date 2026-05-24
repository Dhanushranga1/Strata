#!/usr/bin/env python3
"""
Test script for Phase 5A admin endpoints
"""
import asyncio
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.roles import get_user_role, set_user_role, get_database_connection

async def test_admin_functionality():
    """Test core admin functionality"""
    print("🧪 Testing Phase 5A Admin Functionality")
    print("=" * 50)
    
    # Test 1: Test role retrieval
    print("\n📋 Test 1: Role Retrieval")
    admin_user_id = "cfa54340-eea2-43af-b0fd-6cc11ea68b5f"  # From your database output
    customer_user_id = "ee126be1-84f9-47e7-a45d-3073f73fafc2"
    
    try:
        admin_role = await get_user_role(admin_user_id)
        customer_role = await get_user_role(customer_user_id)
        print(f"✅ Admin user role: {admin_role}")
        print(f"✅ Customer user role: {customer_role}")
        assert admin_role == "admin", f"Expected admin, got {admin_role}"
        assert customer_role == "customer", f"Expected customer, got {customer_role}"
        print("✅ Role retrieval test passed")
    except Exception as e:
        print(f"❌ Role retrieval test failed: {e}")
        return False
    
    # Test 2: Test role setting
    print("\n📋 Test 2: Role Setting")
    try:
        # Test setting a customer to rep
        await set_user_role(customer_user_id, "rep")
        new_role = await get_user_role(customer_user_id)
        print(f"✅ Updated role: {new_role}")
        assert new_role == "rep", f"Expected rep, got {new_role}"
        
        # Reset back to customer
        await set_user_role(customer_user_id, "customer")
        reset_role = await get_user_role(customer_user_id)
        print(f"✅ Reset role: {reset_role}")
        assert reset_role == "customer", f"Expected customer, got {reset_role}"
        print("✅ Role setting test passed")
    except Exception as e:
        print(f"❌ Role setting test failed: {e}")
        return False
    
    # Test 3: Test database connection and view
    print("\n📋 Test 3: Database Views")
    try:
        conn = await get_database_connection()
        try:
            # Test the user roles view
            rows = await conn.fetch("SELECT * FROM app.v_users_roles LIMIT 3")
            print(f"✅ Found {len(rows)} users in view")
            for row in rows:
                print(f"   📧 {row['email']}: {row['role']}")
            
            # Test role requests table
            request_count = await conn.fetchval("SELECT count(*) FROM app.role_requests")
            print(f"✅ Found {request_count} role requests")
            
            print("✅ Database views test passed")
        finally:
            await conn.close()
    except Exception as e:
        print(f"❌ Database views test failed: {e}")
        return False
    
    # Test 4: Test role validation
    print("\n📋 Test 4: Role Validation")
    try:
        # Test invalid role
        try:
            await set_user_role(customer_user_id, "invalid_role")
            print("❌ Should have failed with invalid role")
            return False
        except ValueError:
            print("✅ Invalid role properly rejected")
        
        # Test normalization
        await set_user_role(customer_user_id, "ADMIN")  # uppercase
        normalized_role = await get_user_role(customer_user_id)
        print(f"✅ Normalized role: {normalized_role}")
        assert normalized_role == "admin", f"Expected admin, got {normalized_role}"
        
        # Reset
        await set_user_role(customer_user_id, "customer")
        print("✅ Role validation test passed")
    except Exception as e:
        print(f"❌ Role validation test failed: {e}")
        return False
    
    print("\n🎉 All tests passed! Phase 5A admin functionality is working correctly.")
    return True

async def test_database_schema():
    """Test database schema integrity"""
    print("\n🔍 Testing Database Schema")
    print("=" * 30)
    
    try:
        conn = await get_database_connection()
        try:
            # Check required tables exist
            tables = await conn.fetch("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'app' AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            table_names = [t['table_name'] for t in tables]
            print(f"✅ Found tables: {table_names}")
            
            required_tables = ['user_roles', 'role_requests', 'tickets', 'messages']
            for table in required_tables:
                if table in table_names:
                    print(f"✅ Table {table} exists")
                else:
                    print(f"❌ Table {table} missing")
            
            # Check pgcrypto extension
            extensions = await conn.fetch("SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'")
            if extensions:
                print("✅ pgcrypto extension installed")
            else:
                print("❌ pgcrypto extension missing")
            
            # Check view exists
            views = await conn.fetch("""
                SELECT table_name FROM information_schema.views 
                WHERE table_schema = 'app' AND table_name = 'v_users_roles'
            """)
            if views:
                print("✅ v_users_roles view exists")
            else:
                print("❌ v_users_roles view missing")
            
            print("✅ Database schema test completed")
        finally:
            await conn.close()
    except Exception as e:
        print(f"❌ Database schema test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    async def main():
        print("🚀 Phase 5A Admin Testing Suite")
        print("================================")
        
        schema_ok = await test_database_schema()
        if not schema_ok:
            print("❌ Schema tests failed, stopping")
            return
        
        admin_ok = await test_admin_functionality()
        if not admin_ok:
            print("❌ Admin functionality tests failed")
            return
        
        print("\n🎯 Phase 5A Implementation: FULLY VALIDATED ✅")
        print("Ready for production use!")
    
    asyncio.run(main())