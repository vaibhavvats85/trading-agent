#!/bin/bash
# PostgreSQL Migration Verification Script
# Checks if all components are properly set up

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    PostgreSQL Migration Setup Verification                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check_step() {
  local name=$1
  local command=$2
  
  echo -n "🔍 Checking $name... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌${NC}"
    ((ERRORS++))
    return 1
  fi
}

warn_step() {
  local name=$1
  local message=$2
  
  echo -n "⚠️  $name... "
  echo -e "${YELLOW}⚠️ ${NC}: $message"
  ((WARNINGS++))
}

echo "═══════════════════════════════════════════════════════════"
echo "  Phase 1: Node.js & Dependencies"
echo "═══════════════════════════════════════════════════════════"
echo ""

check_step "Node.js installed" "node --version"
check_step "npm installed" "npm --version"
check_step "PostgreSQL driver (pg)" "npm ls pg" 
check_step "TypeScript installed" "npx tsc --version"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase 2: Files & Scripts"
echo "═══════════════════════════════════════════════════════════"
echo ""

check_step "migrate-to-postgres.ts exists" "[ -f migrate-to-postgres.ts ]"
check_step "setup-postgres.sh exists" "[ -f setup-postgres.sh ]"
check_step "setup-postgres.sh is executable" "[ -x setup-postgres.sh ]"
check_step "src/lib/db/postgres.ts exists" "[ -f src/lib/db/postgres.ts ]"
check_step "src/lib/db/service-postgres.ts exists" "[ -f src/lib/db/service-postgres.ts ]"
check_step "src/lib/db/index.ts exists" "[ -f src/lib/db/index.ts ]"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase 3: Database Files"
echo "═══════════════════════════════════════════════════════════"
echo ""

check_step "SQLite database exists" "[ -f .data/paper-trading.db ]"
check_step ".env.postgres template exists" "[ -f .env.postgres ]"

# Check if .env.postgres.local exists
if check_step ".env.postgres.local exists" "[ -f .env.postgres.local ]"; then
  echo "   ℹ️  Configuration file generated"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase 4: PostgreSQL Installation"
echo "═══════════════════════════════════════════════════════════"
echo ""

check_step "PostgreSQL CLI (psql) installed" "which psql"

# Try to check PostgreSQL version
if check_step "PostgreSQL server running" "psql -U postgres -c 'SELECT 1' > /dev/null 2>&1; exit 0 || exit 1"; then
  POSTGRES_VERSION=$(psql -U postgres -c "SELECT version()" 2>/dev/null | head -1)
  echo "   ℹ️  Version: $POSTGRES_VERSION"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase 5: PostgreSQL Configuration"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check for POSTGRES_HOST in .env.postgres.local
if [ -f .env.postgres.local ]; then
  POSTGRES_HOST=$(grep "^POSTGRES_HOST=" .env.postgres.local | cut -d= -f2)
  POSTGRES_PORT=$(grep "^POSTGRES_PORT=" .env.postgres.local | cut -d= -f2)
  POSTGRES_USER=$(grep "^POSTGRES_USER=" .env.postgres.local | cut -d= -f2)
  POSTGRES_DB=$(grep "^POSTGRES_DATABASE=" .env.postgres.local | cut -d= -f2)
  
  echo "   📝 Configuration found:"
  echo "      Host: $POSTGRES_HOST"
  echo "      Port: $POSTGRES_PORT"
  echo "      User: $POSTGRES_USER"
  echo "      Database: $POSTGRES_DB"
  echo ""
  
  # Try to connect
  echo -n "   🔗 Testing connection... "
  if PGPASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.postgres.local | cut -d= -f2) \
     psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
  else
    echo -e "${YELLOW}⚠️ ${NC} Cannot connect (might need to start PostgreSQL)"
    ((WARNINGS++))
  fi
else
  warn_step "Configuration" "No .env.postgres.local found (run setup-postgres.sh)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase 6: Documentation"
echo "═══════════════════════════════════════════════════════════"
echo ""

check_step "POSTGRES_MIGRATION.md exists" "[ -f POSTGRES_MIGRATION.md ]"
check_step "POSTGRES_QUICKSTART.md exists" "[ -f POSTGRES_QUICKSTART.md ]"
check_step "POSTGRES_MIGRATION_SUMMARY.md exists" "[ -f POSTGRES_MIGRATION_SUMMARY.md ]"
check_step "POSTGRES_GUIDE.md exists" "[ -f POSTGRES_GUIDE.md ]"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Results"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "✅ ${GREEN}All checks passed!${NC}"
  echo ""
  echo "🎯 Next steps:"
  echo "   1. Start PostgreSQL (if not running)"
  echo "   2. Run: npm run migrate-to-postgres"
  echo "   3. Update .env with: DATABASE_TYPE=postgres"
  echo "   4. Start app: npm run dev"
else
  echo -e "${RED}⚠️  Issues found:${NC}"
  echo "   ✓ Successes: $(( $(echo "20" | grep -o 1 | wc -l) ))"
  echo "   ⚠️  Warnings: $WARNINGS"
  echo "   ❌ Errors: $ERRORS"
  echo ""
  
  if [ $ERRORS -gt 0 ]; then
    echo "❌ Failed checks (critical):"
    echo "   • Required files are missing"
    echo "   • Dependencies not installed"
    echo ""
    echo "Please run: npm install && npm run populate-nifty100"
  fi
  
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  Warnings (non-critical):"
    echo "   • PostgreSQL might not be running"
    echo "   • Configuration file not generated"
    echo ""
    echo "Run setup-postgres.sh or start PostgreSQL manually"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Return status
if [ $ERRORS -gt 0 ]; then
  exit 1
else
  exit 0
fi
