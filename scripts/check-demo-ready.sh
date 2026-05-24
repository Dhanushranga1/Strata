#!/bin/bash
# TicketPilot Health Check Script
# Quick verification that everything is running

echo "🔍 TicketPilot Health Check"
echo "=========================="
echo ""

# Check Backend
echo "🔧 Backend (FastAPI)..."
BACKEND_PID=$(pgrep -f "uvicorn.*app.main")
if [ -n "$BACKEND_PID" ]; then
    echo "  ✅ Running (PID: $BACKEND_PID)"
    BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs 2>/dev/null)
    if [ "$BACKEND_STATUS" = "200" ]; then
        echo "  ✅ Responding on http://localhost:8000"
    else
        echo "  ⚠️  Process running but not responding (HTTP $BACKEND_STATUS)"
    fi
else
    echo "  ❌ Not running"
    echo "     Start with: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
fi

echo ""

# Check Frontend
echo "🎨 Frontend (Next.js)..."
FRONTEND_PID=$(pgrep -f "next dev" | head -1)
if [ -n "$FRONTEND_PID" ]; then
    echo "  ✅ Running (PID: $FRONTEND_PID)"
    FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    if [ "$FRONTEND_STATUS" = "200" ]; then
        echo "  ✅ Responding on http://localhost:3000"
    else
        echo "  ⚠️  Process running but not responding (HTTP $FRONTEND_STATUS)"
    fi
else
    echo "  ❌ Not running"
    echo "     Start with: cd frontend && npm run dev"
fi

echo ""

# Check Database
echo "🗄️  Database..."
if [ -f backend/.env ]; then
    if grep -q "DATABASE_URL" backend/.env; then
        echo "  ✅ Configuration exists in backend/.env"
    else
        echo "  ⚠️  DATABASE_URL not found in backend/.env"
    fi
else
    echo "  ❌ backend/.env not found"
fi

echo ""

# Summary
echo "📊 Summary"
echo "==========="
if [ -n "$BACKEND_PID" ] && [ "$BACKEND_STATUS" = "200" ] && [ -n "$FRONTEND_PID" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ ALL SYSTEMS READY FOR DEMO!"
    echo ""
    echo "📍 Access Points:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:8000/docs"
    echo ""
    echo "🎬 Ready to demo!"
else
    echo "⚠️  Some services need attention (see above)"
    echo ""
    echo "💡 Quick Start:"
    echo "   1. cd backend && source .venv/bin/activate && uvicorn app.main:app --reload &"
    echo "   2. cd frontend && npm run dev &"
    echo "   3. Wait 5 seconds and run this script again"
fi

echo ""
