#!/bin/bash

echo "🚀 Setting up deployment platforms for TicketPilot CI/CD"
echo "========================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}📝 You provided these credentials:${NC}"
echo "Vercel Team ID: team_fSwUAUyPDRzgTG0Yxvi1vUWz"  
echo "Vercel Token: Q1gT9To4ewmtHkyyIbicz72j"
echo "Railway Project ID: b7ec1cd3-1925-4db7-88ca-104b145a6619"
echo "Railway Token: 803cad39-3b88-41ad-93d1-e1b276b1d583"
echo ""

# 1. Setup Vercel Frontend
echo -e "${BLUE}🎨 Setting up Vercel frontend deployment...${NC}"
cd frontend

# Login to Vercel with token
echo "Q1gT9To4ewmtHkyyIbicz72j" | npx vercel login --token

# Link to existing project or create new one
echo -e "${YELLOW}Linking to Vercel project...${NC}"
npx vercel link --token Q1gT9To4ewmtHkyyIbicz72j --yes

# Get project info
if [ -f ".vercel/project.json" ]; then
    PROJECT_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ Vercel Project ID: $PROJECT_ID${NC}"
else
    echo -e "${YELLOW}⚠️  No project.json found. Creating new project...${NC}"
    npx vercel --token Q1gT9To4ewmtHkyyIbicz72j --yes
    PROJECT_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4)
fi

cd ..

# 2. Setup Railway Backend  
echo -e "${BLUE}🚂 Setting up Railway backend deployment...${NC}"
cd backend

# Login to Railway
echo "803cad39-3b88-41ad-93d1-e1b276b1d583" | railway login --token

# Link to existing project
echo -e "${YELLOW}Linking to Railway project...${NC}"
railway link b7ec1cd3-1925-4db7-88ca-104b145a6619

# Get service info
SERVICE_ID=$(railway status --json 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$SERVICE_ID" ]; then
    echo -e "${YELLOW}Creating new service...${NC}"
    railway up --detach
    sleep 10
    SERVICE_ID=$(railway status --json 2>/dev/null | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

# Get deployment URL
RAILWAY_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)

echo -e "${GREEN}✅ Railway Service ID: $SERVICE_ID${NC}"
echo -e "${GREEN}✅ Railway URL: $RAILWAY_URL${NC}"

cd ..

# 3. Generate GitHub secrets configuration
echo -e "${BLUE}🔑 Generating GitHub secrets configuration...${NC}"

cat > github-secrets-config.txt << EOF
# 🔑 GitHub Repository Secrets Configuration
# Go to: https://github.com/Dhanushranga1/ticketpilot/settings/secrets/actions
# Add these as Repository Secrets:

## Vercel Configuration
VERCEL_TOKEN=Q1gT9To4ewmtHkyyIbicz72j
VERCEL_ORG_ID=team_fSwUAUyPDRzgTG0Yxvi1vUWz
VERCEL_PROJECT_ID=$PROJECT_ID

## Railway Configuration
RAILWAY_TOKEN=803cad39-3b88-41ad-93d1-e1b276b1d583
RAILWAY_PROJECT_ID=b7ec1cd3-1925-4db7-88ca-104b145a6619
RAILWAY_SERVICE_ID=$SERVICE_ID
RAILWAY_APP_URL=$RAILWAY_URL

## Application Configuration (Use your existing values)
NEXT_PUBLIC_SUPABASE_URL=[your_existing_supabase_url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_existing_supabase_anon_key]
SUPABASE_URL=[same_as_above]
SUPABASE_SERVICE_KEY=[your_existing_supabase_service_key]
GOOGLE_API_KEY=[your_existing_google_api_key]
NEXT_PUBLIC_API_URL=$RAILWAY_URL

## Optional Security Tools
SNYK_TOKEN=[optional_snyk_token]
EOF

echo -e "${GREEN}✅ Configuration saved to github-secrets-config.txt${NC}"
echo ""
echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
echo "1. Copy the secrets from github-secrets-config.txt"
echo "2. Go to: https://github.com/Dhanushranga1/ticketpilot/settings/secrets/actions"
echo "3. Add each secret using 'New repository secret'"
echo "4. Test the pipeline by creating a pull request"
echo ""
echo -e "${GREEN}🎉 Deployment platforms setup complete!${NC}"