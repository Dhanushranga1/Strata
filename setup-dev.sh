#!/bin/bash
# ─────────────────────────────────────────────────────────────
# TicketPilot — local development environment setup
# ─────────────────────────────────────────────────────────────
# Run once after cloning:
#   bash setup-dev.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== TicketPilot Dev Setup ==="
echo ""

# ── 1. Backend .env ──────────────────────────────────────────
if [ -f backend/.env ]; then
    echo -e "${YELLOW}backend/.env already exists — skipping${NC}"
else
    cp backend/.env.dev.example backend/.env
    echo ""
    echo "──────────────────────────────────────────────"
    echo "  Edit backend/.env with your Supabase dev project credentials:"
    echo "    SUPABASE_URL"
    echo "    SUPABASE_ANON_KEY"
    echo "    SUPABASE_SERVICE_ROLE_KEY"
    echo "    SUPABASE_JWT_SECRET"
    echo "    DATABASE_URL"
    echo "    GOOGLE_API_KEY  (or GROQ_API_KEY / JINA_API_KEY)"
    echo "──────────────────────────────────────────────"
    echo ""
    read -rp "  Press Enter after you've edited backend/.env... "
fi

# ── 2. Frontend .env.local ───────────────────────────────────
if [ -f frontend/.env.local ]; then
    echo -e "${YELLOW}frontend/.env.local already exists — skipping${NC}"
else
    cp frontend/.env.local.example frontend/.env.local
    echo ""
    echo "──────────────────────────────────────────────"
    echo "  Edit frontend/.env.local with your Supabase dev project:"
    echo "    NEXT_PUBLIC_SUPABASE_URL"
    echo "    NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "──────────────────────────────────────────────"
    echo ""
    read -rp "  Press Enter after you've edited frontend/.env.local... "
fi

# ── 3. Backend venv + deps ────────────────────────────────────
if [ -d backend/.venv ]; then
    echo -e "${YELLOW}backend/.venv already exists — skipping${NC}"
else
    echo ""
    echo "Creating Python virtual environment..."
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -q -r requirements.txt
    cd ..
    echo -e "${GREEN}Backend deps installed${NC}"
fi

# ── 4. Frontend deps ─────────────────────────────────────────
if [ -d frontend/node_modules ]; then
    echo -e "${YELLOW}frontend/node_modules already exists — skipping${NC}"
else
    echo ""
    echo "Installing frontend dependencies..."
    cd frontend
    npm install --silent
    cd ..
    echo -e "${GREEN}Frontend deps installed${NC}"
fi

# ── 5. Verify ─────────────────────────────────────────────────
echo ""
echo "──────────────────────────────"
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Create a Supabase DEV project: https://supabase.com"
echo "  2. Run all migrations/ files in its SQL Editor"
echo "  3. Update the env files with dev project credentials"
echo "  4. Start developing:"
echo "       make dev          # backend + frontend"
echo "       make test         # run all tests"
echo "       make lint         # check code style"
echo "──────────────────────────────"
