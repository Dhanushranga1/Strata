#!/bin/bash

echo "=== TicketPilot Deployment Readiness Check ==="
echo ""

# Check backend
echo "Checking Backend..."
if [ -f "backend/.env" ]; then
    echo "✅ Backend .env exists"
else
    echo "❌ Backend .env missing"
fi

if [ -f "backend/railway.toml" ]; then
    echo "✅ Railway config exists"
else
    echo "❌ Railway config missing"
fi

# Check frontend
echo ""
echo "Checking Frontend..."
if [ -f "frontend/.env.local" ]; then
    echo "✅ Frontend .env.local exists"
else
    echo "❌ Frontend .env.local missing"
fi

if [ -f "vercel.json" ]; then
    echo "✅ Vercel config exists"
else
    echo "❌ Vercel config missing"
fi

# Check git
echo ""
echo "Checking Git..."
if git remote -v | grep -q "github.com"; then
    echo "✅ GitHub remote configured"
else
    echo "❌ GitHub remote not configured"
fi

# Check if clean
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ No uncommitted changes"
else
    echo "⚠️  Uncommitted changes exist"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Deploy backend to Railway: https://railway.app"
echo "2. Deploy frontend to Vercel: https://vercel.com"
echo "3. Update CORS origin in Railway with Vercel URL"
echo ""
