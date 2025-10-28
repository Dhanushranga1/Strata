#!/bin/bash

echo "🚀 TicketPilot Deployment Setup Script"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 This script will help you set up deployment platforms...${NC}"
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Run this script from the TicketPilot root directory${NC}"
    exit 1
fi

# 1. Install CLI tools
echo -e "${YELLOW}📦 Installing deployment CLI tools...${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is required. Please install Node.js first.${NC}"
    exit 1
fi

# Install Vercel CLI
echo "Installing Vercel CLI..."
npm install -g vercel

# Install Railway CLI
echo "Installing Railway CLI..."
npm install -g @railway/cli

echo -e "${GREEN}✅ CLI tools installed successfully!${NC}"
echo ""

# 2. Frontend deployment setup
echo -e "${YELLOW}🎨 Setting up Frontend (Vercel)...${NC}"
echo "1. Run: vercel login"
echo "2. Run: cd frontend && vercel --prod"
echo "3. Note down your Project ID and Team ID from Vercel dashboard"
echo ""

# 3. Backend deployment setup  
echo -e "${YELLOW}🐍 Setting up Backend (Railway)...${NC}"
echo "1. Run: railway login"
echo "2. Run: cd backend && railway up"
echo "3. Note down your Service ID from Railway dashboard"
echo ""

# 4. GitHub secrets setup
echo -e "${YELLOW}🔑 GitHub Secrets Setup${NC}"
echo "Go to: https://github.com/Dhanushranga1/ticketpilot/settings/secrets/actions"
echo ""
echo "Add these secrets:"
echo "===================="
echo "VERCEL_TOKEN=<your_vercel_token>"
echo "VERCEL_ORG_ID=<your_vercel_org_id>"  
echo "VERCEL_PROJECT_ID=<your_vercel_project_id>"
echo "RAILWAY_TOKEN=<your_railway_token>"
echo "RAILWAY_SERVICE_ID=<your_railway_service_id>"
echo "RAILWAY_APP_URL=<your_railway_app_url>"
echo ""
echo "Plus your existing Supabase and Google API secrets..."
echo ""

# 5. Test pipeline
echo -e "${YELLOW}🧪 Testing the Pipeline${NC}"
echo "After setting up secrets, test with:"
echo "git checkout -b test-cicd"
echo "git add ."  
echo "git commit -m 'test: CI/CD pipeline'"
echo "git push origin test-cicd"
echo "# Then create a PR on GitHub"
echo ""

echo -e "${GREEN}🎉 Setup guide complete!${NC}"
echo -e "${GREEN}Follow the steps above to get your CI/CD pipeline running.${NC}"