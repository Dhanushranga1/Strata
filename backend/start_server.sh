#!/bin/bash

# TicketPilot Backend Startup Script
# Run this script to start the backend server

echo "🚀 TicketPilot Backend Startup"
echo "==============================="

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ -d ".venv" ]; then
    echo "📦 Activating virtual environment..."
    source .venv/bin/activate
else
    echo "⚠️  No virtual environment found, using system Python"
fi

# Check if dependencies are installed
echo "🔍 Checking dependencies..."
python -c "
import sys
required = ['fastapi', 'uvicorn', 'psycopg', 'supabase', 'python_dotenv']
missing = []
for pkg in required:
    try:
        __import__(pkg.replace('-', '_'))
    except ImportError:
        missing.append(pkg)

if missing:
    print(f'❌ Missing packages: {missing}')
    print(f'Installing: pip install {\" \".join(missing)}')
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install'] + missing)
else:
    print('✅ All dependencies installed')
"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "📝 Please create .env file with required environment variables"
    exit 1
fi

echo "✅ Environment file found"

# Start the server
echo ""
echo "🚀 Starting TicketPilot Backend..."
echo "📍 Server: http://127.0.0.1:8000"
echo "📋 Health: http://127.0.0.1:8000/api/health"
echo "📖 Docs: http://127.0.0.1:8000/docs"
echo "🛑 Press Ctrl+C to stop"
echo ""

# Set PYTHONPATH and start uvicorn
PYTHONPATH=. python -c "
import uvicorn
from app.main import app
uvicorn.run(app, host='127.0.0.1', port=8000, log_level='info')
"