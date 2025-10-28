#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║          🚀 TicketPilot Quick Start Script              ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check current directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Run this script from the TicketPilot root directory${NC}"
    exit 1
fi

PROJECT_ROOT=$(pwd)

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}🔧 Killing process on port $port...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

echo -e "${BLUE}📋 Pre-flight Checks...${NC}"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Check Python
if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo -e "${GREEN}✅ Python: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}❌ Python not found. Please install Python 3.11+ first.${NC}"
    exit 1
fi

# Check environment files
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✅ Backend .env file exists${NC}"
else
    echo -e "${RED}❌ Backend .env file missing${NC}"
    exit 1
fi

if [ -f "frontend/.env.local" ]; then
    echo -e "${GREEN}✅ Frontend .env.local file exists${NC}"
else
    echo -e "${RED}❌ Frontend .env.local file missing${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🎯 Starting TicketPilot...${NC}"
echo ""

# Clean up any existing processes
if check_port 8000; then
    echo -e "${YELLOW}⚠️  Port 8000 (backend) is already in use${NC}"
    read -p "Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 8000
    fi
fi

if check_port 3000; then
    echo -e "${YELLOW}⚠️  Port 3000 (frontend) is already in use${NC}"
    read -p "Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 3000
    fi
fi

# Start Backend
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🐍 Starting Backend (FastAPI)...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cd "$PROJECT_ROOT/backend"

# Check/create virtual environment
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}📦 Creating Python virtual environment...${NC}"
    python -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install/update dependencies
echo -e "${YELLOW}📦 Installing/updating Python dependencies...${NC}"
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Start backend in background
echo -e "${GREEN}🚀 Launching FastAPI server on http://localhost:8000${NC}"
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > .backend.pid

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready!${NC}"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Start Frontend
cd "$PROJECT_ROOT/frontend"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🎨 Starting Frontend (Next.js)...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
    npm install
fi

# Start frontend in background
echo -e "${GREEN}🚀 Launching Next.js server on http://localhost:3000${NC}"
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > .frontend.pid

# Wait for frontend to start
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is ready!${NC}"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

cd "$PROJECT_ROOT"

# Summary
echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║          ✅ TicketPilot is Running!                      ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo -e "   🐍 Backend:   ${GREEN}http://localhost:8000${NC}"
echo -e "   📖 API Docs:  ${GREEN}http://localhost:8000/docs${NC}"
echo -e "   🎨 Frontend:  ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}📋 Process IDs:${NC}"
echo -e "   Backend:  ${BACKEND_PID}"
echo -e "   Frontend: ${FRONTEND_PID}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   • View backend logs:  ${BLUE}tail -f backend/backend.log${NC}"
echo -e "   • View frontend logs: ${BLUE}tail -f frontend/frontend.log${NC}"
echo -e "   • Stop services:      ${BLUE}./stop-local.sh${NC}"
echo -e "   • Health check:       ${BLUE}curl http://localhost:8000/api/health${NC}"
echo ""
echo -e "${YELLOW}🔧 Known Issue - Supabase CORS:${NC}"
echo -e "   If you see CORS errors:"
echo -e "   1. Check Supabase dashboard: Settings → API → CORS"
echo -e "   2. Add http://localhost:3000 to allowed origins"
echo -e "   3. Or open in Chrome: ${BLUE}google-chrome --disable-web-security --user-data-dir=\"/tmp/chrome_dev\" http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}🎉 Happy coding!${NC}"
echo ""