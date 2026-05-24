#!/bin/bash
# TicketPilot Deployment Script

echo "🚀 TicketPilot Deployment Helper"
echo "================================"

# Check if we're in the right directory
if [ ! -f "package-lock.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Please run this script from the TicketPilot root directory"
    exit 1
fi

echo "✅ Found TicketPilot project structure"

# Check Git status
echo ""
echo "📊 Git Status:"
git status --porcelain

# Function to deploy frontend to Vercel
deploy_frontend() {
    echo ""
    echo "🌐 Deploying Frontend to Vercel..."
    echo "=================================="
    
    if ! command -v vercel &> /dev/null; then
        echo "📦 Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    echo "📁 Deploying from frontend directory..."
    cd frontend
    vercel --prod
    cd ..
    
    echo "✅ Frontend deployed! Check your Vercel dashboard for the live URL."
}

# Function to deploy backend to Railway
deploy_backend_railway() {
    echo ""
    echo "🚂 Deploying Backend to Railway..."
    echo "================================="
    
    if ! command -v railway &> /dev/null; then
        echo "📦 Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    echo "🔑 Please login to Railway and follow the prompts..."
    railway login
    
    echo "📁 Deploying from backend directory..."
    cd backend
    railway up
    cd ..
    
    echo "✅ Backend deployed! Check your Railway dashboard for the live URL."
}

# Function to prepare environment files
setup_env() {
    echo ""
    echo "⚙️  Environment Setup Helper"
    echo "============================"
    
    echo ""
    echo "Frontend Environment (.env.local):"
    echo "Required variables:"
    echo "- NEXT_PUBLIC_SUPABASE_URL=your_supabase_url"
    echo "- NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key" 
    echo "- NEXT_PUBLIC_API_URL=your_backend_url"
    
    echo ""
    echo "Backend Environment (.env):"
    echo "Required variables:"
    echo "- SUPABASE_URL=your_supabase_url"
    echo "- SUPABASE_ANON_KEY=your_anon_key"
    echo "- SUPABASE_JWT_SECRET=your_jwt_secret"
    echo "- DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:6543/postgres"
    echo "- GOOGLE_API_KEY=your_google_api_key"
}

# Function to test local setup
test_local() {
    echo ""
    echo "🧪 Testing Local Setup..."
    echo "========================"
    
    # Test backend
    echo "Testing backend..."
    cd backend
    if [ ! -d ".venv" ]; then
        echo "Creating Python virtual environment..."
        python -m venv .venv
    fi
    
    source .venv/bin/activate
    pip install -r requirements.txt
    
    echo "Starting backend server in background..."
    uvicorn app.main:app --host localhost --port 8000 &
    BACKEND_PID=$!
    cd ..
    
    # Test frontend
    echo "Testing frontend..."
    cd frontend
    npm install
    npm run build
    
    echo "Starting frontend server..."
    npm run start &
    FRONTEND_PID=$!
    cd ..
    
    echo ""
    echo "✅ Servers started!"
    echo "🌐 Frontend: http://localhost:3000"
    echo "🔧 Backend: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo ""
    echo "Press Ctrl+C to stop servers..."
    
    # Wait for Ctrl+C
    trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
    wait
}

# Main menu
echo ""
echo "What would you like to do?"
echo "1) Setup environment variables guide"
echo "2) Test local setup"
echo "3) Deploy frontend to Vercel"
echo "4) Deploy backend to Railway"
echo "5) Deploy everything (Vercel + Railway)"
echo "6) Exit"

read -p "Enter your choice (1-6): " choice

case $choice in
    1) setup_env ;;
    2) test_local ;;
    3) deploy_frontend ;;
    4) deploy_backend_railway ;;
    5) deploy_frontend && deploy_backend_railway ;;
    6) echo "👋 Goodbye!" ;;
    *) echo "❌ Invalid choice" ;;
esac