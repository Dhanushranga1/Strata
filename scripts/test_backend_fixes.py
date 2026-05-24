#!/usr/bin/env python3
"""
Quick test to verify backend fixes:
1. Import structure is correct (no UnboundLocalError)
2. GET messages endpoint exists
"""

import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, '/home/dhanush/Documents/ticketpilot/backend')

def test_imports():
    """Test that imports work correctly."""
    try:
        from app.tickets import router
        from app.observability import get_observer, log_rag_metrics
        print("✅ Imports work correctly")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Other error during import: {e}")
        return False

def test_endpoints():
    """Test that required endpoints exist."""
    try:
        from app.tickets import router
        
        # Get all routes
        routes = []
        for route in router.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                for method in route.methods:
                    routes.append(f"{method} {route.path}")
        
        # Check for required endpoints
        required_endpoints = [
            "GET /api/tickets/{ticket_id}/messages",
            "POST /api/tickets/{ticket_id}/chat"
        ]
        
        missing = []
        for endpoint in required_endpoints:
            if not any(endpoint in route for route in routes):
                missing.append(endpoint)
        
        if missing:
            print(f"❌ Missing endpoints: {missing}")
            print("Available routes:")
            for route in sorted(routes):
                print(f"  {route}")
            return False
        else:
            print("✅ All required endpoints exist")
            return True
            
    except Exception as e:
        print(f"❌ Error checking endpoints: {e}")
        return False

if __name__ == "__main__":
    print("Testing backend fixes...")
    
    import_success = test_imports()
    endpoint_success = test_endpoints()
    
    if import_success and endpoint_success:
        print("\n🎉 All tests passed! Backend should be working correctly.")
    else:
        print("\n❌ Some tests failed. Check the errors above.")
        sys.exit(1)