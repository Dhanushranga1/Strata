#!/bin/bash

echo "🚀 Starting TicketPilot Local Development"
echo "========================================"

# Check if frontend is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:3000"
else
    echo "❌ Frontend is not running. Starting..."
    cd /home/dhanush/Documents/ticketpilot/frontend && npm run dev &
    sleep 3
fi

# Check if backend is running  
if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ Backend is running on http://localhost:8000"
else
    echo "❌ Backend is not running. Starting..."
    cd /home/dhanush/Documents/ticketpilot/backend && uvicorn app.main:app --reload --port 8000 &
    sleep 3
fi

echo ""
echo "🌐 Opening TicketPilot with CORS disabled for local development..."
echo ""

# Try different browsers with CORS disabled
if command -v google-chrome &> /dev/null; then
    google-chrome --disable-web-security --disable-features=VizDisplayCompositor --user-data-dir=/tmp/chrome_dev_session http://localhost:3000 &
elif command -v chromium-browser &> /dev/null; then
    chromium-browser --disable-web-security --disable-features=VizDisplayCompositor --user-data-dir=/tmp/chrome_dev_session http://localhost:3000 &
elif command -v firefox &> /dev/null; then
    echo "⚠️  Firefox detected. For best results, disable CORS in about:config"
    firefox http://localhost:3000 &
else
    echo "🌐 Please open http://localhost:3000 in your browser"
    echo "⚠️  If you still get CORS errors, start Chrome with:"
    echo "google-chrome --disable-web-security --disable-features=VizDisplayCompositor --user-data-dir=/tmp/chrome_dev_session http://localhost:3000"
fi

echo ""
echo "🎉 TicketPilot is running locally!"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "🛠️  If you get CORS errors, use the Chrome command above"