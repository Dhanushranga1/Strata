#!/bin/bash

echo "🔍 TicketPilot Phase 2 Setup Verification"
echo "=========================================="
echo

# Check if backend is running
echo "📡 Testing Backend API..."
if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ Backend API is running on http://localhost:8000"
    echo "   Health check: $(curl -s http://localhost:8000/api/health)"
else
    echo "❌ Backend API is not responding"
    echo "   Try starting with: cd backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
fi
echo

# Check if frontend is running
echo "🌐 Testing Frontend..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:3000"
else
    echo "❌ Frontend is not responding"
    echo "   Try starting with: cd frontend && npm run dev"
fi
echo

# Test knowledge base endpoints (these will require authentication)
echo "🧠 Testing Knowledge Base API Endpoints..."
echo "📊 KB Stats endpoint:"
KB_STATS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/kb/stats)
if [ "$KB_STATS" = "401" ]; then
    echo "✅ KB Stats endpoint responding (401 = requires auth, which is correct)"
else
    echo "⚠️  KB Stats endpoint returned: $KB_STATS"
fi

echo "🔍 KB Search endpoint:"
KB_SEARCH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/api/kb/search?q=test")
if [ "$KB_SEARCH" = "401" ]; then
    echo "✅ KB Search endpoint responding (401 = requires auth, which is correct)"
else
    echo "⚠️  KB Search endpoint returned: $KB_SEARCH"
fi

echo "📤 KB Ingest endpoint:"
KB_INGEST=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/kb/ingest)
if [ "$KB_INGEST" = "401" ]; then
    echo "✅ KB Ingest endpoint responding (401 = requires auth, which is correct)"
else
    echo "⚠️  KB Ingest endpoint returned: $KB_INGEST"
fi
echo

# Check database connection
echo "🗄️  Testing Database Connection..."
cd /home/dhanush/Documents/ticketpilot/backend
if psql "postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:5432/postgres" -c "SELECT 'Database connection working' as status;" 2>/dev/null | grep -q "Database connection working"; then
    echo "✅ Database connection working"
    echo "📋 Tables in app schema:"
    psql "postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:5432/postgres" -c "\dt app.*" 2>/dev/null | grep -E "(user_roles|documents|chunks)"
else
    echo "❌ Database connection failed"
fi
echo

# Check Google API
echo "🤖 Testing Google API..."
if [[ -n "$GOOGLE_API_KEY" ]]; then
    echo "✅ GOOGLE_API_KEY is set in environment"
else
    echo "⚠️  GOOGLE_API_KEY not found in current environment"
    echo "   Check your .env file: cat backend/.env | grep GOOGLE_API_KEY"
fi
echo

echo "🎉 Setup Verification Complete!"
echo
echo "📋 Next Steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Register a new user account"
echo "3. Grant the user 'rep' role in the database"
echo "4. Test knowledge base features"
echo
echo "🔧 Grant rep role command:"
echo "psql \"postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:5432/postgres\" -c \\"
echo "\"INSERT INTO app.user_roles (user_id, role) VALUES ('USER_ID_FROM_REGISTRATION', 'rep') ON CONFLICT (user_id) DO UPDATE SET role = 'rep';\""