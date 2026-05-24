#!/bin/bash
# Script to run database migrations on Supabase

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TicketPilot Database Migration Runner ===${NC}\n"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    echo "Please set it with your Supabase connection string:"
    echo "export DATABASE_URL='postgresql://postgres:[YOUR-PASSWORD]@db.nvgmgvplfpukckfkjuso.supabase.co:5432/postgres'"
    exit 1
fi

echo -e "${YELLOW}Database URL: ${DATABASE_URL:0:40}...${NC}\n"

# Get the migrations directory
MIGRATIONS_DIR="./backend/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}ERROR: Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}Found migrations directory: $MIGRATIONS_DIR${NC}\n"

# Run migrations in order
for migration in $(ls $MIGRATIONS_DIR/*.sql | sort); do
    filename=$(basename "$migration")
    
    # Skip rollback migrations
    if [[ "$filename" == "rollback"* ]]; then
        echo -e "${YELLOW}Skipping: $filename${NC}"
        continue
    fi
    
    echo -e "${GREEN}Running: $filename${NC}"
    
    # Run the migration using psql
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" -f "$migration"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Success: $filename${NC}\n"
        else
            echo -e "${RED}❌ Failed: $filename${NC}\n"
            echo -e "${YELLOW}Continuing with next migration...${NC}\n"
        fi
    else
        echo -e "${RED}ERROR: psql command not found${NC}"
        echo "Please install PostgreSQL client: sudo apt-get install postgresql-client"
        exit 1
    fi
done

echo -e "${GREEN}=== Migration process complete ===${NC}"
