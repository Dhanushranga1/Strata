#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Stopping TicketPilot services...${NC}"

PROJECT_ROOT=$(pwd)

# Function to kill process
kill_process() {
    local pid=$1
    local name=$2
    if kill -0 $pid 2>/dev/null; then
        kill $pid 2>/dev/null
        echo -e "${GREEN}✅ Stopped $name (PID: $pid)${NC}"
    else
        echo -e "${YELLOW}⚠️  $name process not running${NC}"
    fi
}

# Stop backend
if [ -f "backend/.backend.pid" ]; then
    BACKEND_PID=$(cat backend/.backend.pid)
    kill_process $BACKEND_PID "Backend"
    rm -f backend/.backend.pid
fi

# Stop frontend
if [ -f "frontend/.frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend/.frontend.pid)
    kill_process $FRONTEND_PID "Frontend"
    rm -f frontend/.frontend.pid
fi

# Kill any remaining processes on ports
echo -e "${YELLOW}🔍 Checking for remaining processes...${NC}"

# Kill port 8000 (backend)
if lsof -ti:8000 > /dev/null 2>&1; then
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ Cleaned up port 8000${NC}"
fi

# Kill port 3000 (frontend)
if lsof -ti:3000 > /dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ Cleaned up port 3000${NC}"
fi

echo -e "${GREEN}✅ All services stopped!${NC}"