#!/usr/bin/env bash

# ============================================================================
# run_migrations.sh - Execute Phase 2 Multi-Tenancy Migrations
# ============================================================================
# Purpose: Apply database migrations for multi-tenant organization support
# Usage: ./run_migrations.sh [environment]
# Environment: local (default) | staging | production
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-local}
MIGRATIONS_DIR="./migrations"
LOG_FILE="migration_$(date +%Y%m%d_%H%M%S).log"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}TicketPilot Phase 2: Multi-Tenancy Migration${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo -e "Environment: ${GREEN}${ENVIRONMENT}${NC}"
echo -e "Log file: ${LOG_FILE}"
echo ""

# ============================================================================
# FUNCTION: Load Environment Variables
# ============================================================================
load_env() {
    if [ -f .env ]; then
        echo -e "${BLUE}Loading environment variables...${NC}"
        export $(cat .env | grep -v '^#' | xargs)
    else
        echo -e "${RED}Error: .env file not found${NC}"
        exit 1
    fi
}

# ============================================================================
# FUNCTION: Check Database Connection
# ============================================================================
check_connection() {
    echo -e "${BLUE}Checking database connection...${NC}"
    
    if [ -z "$SUPABASE_DB_URL" ]; then
        echo -e "${RED}Error: SUPABASE_DB_URL not set in environment${NC}"
        exit 1
    fi
    
    # Test connection
    if psql "$SUPABASE_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        exit 1
    fi
}

# ============================================================================
# FUNCTION: Create Backup
# ============================================================================
create_backup() {
    echo -e "${BLUE}Creating database backup...${NC}"
    
    BACKUP_FILE="backup_before_migration_$(date +%Y%m%d_%H%M%S).sql"
    
    # Backup only the app schema
    if pg_dump "$SUPABASE_DB_URL" \
        --schema=app \
        --no-owner \
        --no-privileges \
        -f "$BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE"; then
        echo -e "${GREEN}✓ Backup created: ${BACKUP_FILE}${NC}"
    else
        echo -e "${YELLOW}⚠ Backup failed, but continuing...${NC}"
    fi
}

# ============================================================================
# FUNCTION: Run Migration
# ============================================================================
run_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file" .sql)
    
    echo ""
    echo -e "${BLUE}Running: ${migration_name}${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────────────────${NC}"
    
    if psql "$SUPABASE_DB_URL" -f "$migration_file" 2>&1 | tee -a "$LOG_FILE"; then
        echo -e "${GREEN}✓ ${migration_name} completed successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ ${migration_name} failed${NC}"
        return 1
    fi
}

# ============================================================================
# FUNCTION: Verify Migration
# ============================================================================
verify_migration() {
    echo ""
    echo -e "${BLUE}Verifying migration results...${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────────────────${NC}"
    
    # Check organizations table exists
    psql "$SUPABASE_DB_URL" -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'app' AND table_name = 'organizations'
        );
    " | tee -a "$LOG_FILE"
    
    # Check organization_members table exists
    psql "$SUPABASE_DB_URL" -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'app' AND table_name = 'organization_members'
        );
    " | tee -a "$LOG_FILE"
    
    # Check organization_id columns exist
    echo ""
    echo "Checking organization_id columns:"
    psql "$SUPABASE_DB_URL" -c "
        SELECT 
            table_name,
            column_name,
            is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'app'
            AND column_name = 'organization_id'
        ORDER BY table_name;
    " | tee -a "$LOG_FILE"
    
    # Count records in default organization
    echo ""
    echo "Default organization statistics:"
    psql "$SUPABASE_DB_URL" -c "
        SELECT 
            o.name,
            o.slug,
            (SELECT COUNT(*) FROM app.organization_members WHERE organization_id = o.id) as members,
            (SELECT COUNT(*) FROM app.tickets WHERE organization_id = o.id) as tickets,
            (SELECT COUNT(*) FROM app.documents WHERE organization_id = o.id) as documents
        FROM app.organizations o
        WHERE o.slug = 'default-org';
    " | tee -a "$LOG_FILE"
    
    # Check RLS is enabled
    echo ""
    echo "RLS status:"
    psql "$SUPABASE_DB_URL" -c "
        SELECT 
            tablename,
            rowsecurity as rls_enabled
        FROM pg_tables
        WHERE schemaname = 'app'
            AND tablename IN ('organizations', 'organization_members', 'tickets', 'messages', 'documents', 'chunks')
        ORDER BY tablename;
    " | tee -a "$LOG_FILE"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

echo -e "${YELLOW}⚠ WARNING: This will modify your database schema${NC}"
echo -e "${YELLOW}⚠ Make sure you have a backup before proceeding${NC}"
echo ""
read -p "Continue with migration? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Migration cancelled${NC}"
    exit 0
fi

echo ""

# Load environment
load_env

# Check database connection
check_connection

# Create backup (optional but recommended)
if [ "$ENVIRONMENT" != "local" ]; then
    create_backup
fi

# Run migrations in order
echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Executing Migrations${NC}"
echo -e "${BLUE}============================================================================${NC}"

MIGRATION_FILES=(
    "$MIGRATIONS_DIR/0007_organizations.sql"
    "$MIGRATIONS_DIR/0008_add_organization_id.sql"
    "$MIGRATIONS_DIR/0009_migrate_existing_data.sql"
    "$MIGRATIONS_DIR/0010_enable_rls.sql"
)

FAILED=false

for migration in "${MIGRATION_FILES[@]}"; do
    if [ ! -f "$migration" ]; then
        echo -e "${RED}Error: Migration file not found: $migration${NC}"
        FAILED=true
        break
    fi
    
    if ! run_migration "$migration"; then
        FAILED=true
        break
    fi
done

# Verify results
if [ "$FAILED" = false ]; then
    verify_migration
    
    echo ""
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${GREEN}✓ All migrations completed successfully!${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Review the migration log: $LOG_FILE"
    echo "2. Test the organization API endpoints"
    echo "3. Update frontend to support organization context"
    echo "4. Test multi-tenant data isolation"
    echo ""
else
    echo ""
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${RED}✗ Migration failed${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo ""
    echo -e "${RED}To rollback, run: ./rollback_migrations.sh${NC}"
    echo -e "${YELLOW}Check the log file for details: $LOG_FILE${NC}"
    echo ""
    exit 1
fi
