# SQLite to PostgreSQL Migration Guide

This guide explains how to migrate your trading application from SQLite to PostgreSQL.

## Overview

The application now supports both SQLite and PostgreSQL databases. You can switch between them without changing any application code by setting the `DATABASE_TYPE` environment variable.

**Current Status:**
- ✅ SQLite: Default database (backward compatible)
- ✅ PostgreSQL: New support with full feature parity

## Prerequisites

### PostgreSQL Installation

#### macOS (using Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15

# Create default postgres user (if needed)
createuser -s postgres
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Windows
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Docker
```bash
docker run --name trading-db \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin \
  -e POSTGRES_DB=trading_agent \
  -p 5432:5432 \
  -d postgres:15
```

## Step 1: Configure PostgreSQL

### Create Database and User

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE trading_agent;

# Create user (if not using docker)
CREATE USER admin WITH PASSWORD 'admin';

# Grant privileges
ALTER ROLE admin WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE trading_agent TO admin;

# Exit psql
\q
```

### Or using environment variables

```bash
# Create database
PGPASSWORD=admin psql -h localhost -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = 'trading_agent'" | grep -q 1 || \
  PGPASSWORD=admin psql -h localhost -U postgres -c "CREATE DATABASE trading_agent"

# Create user
PGPASSWORD=admin psql -h localhost -U postgres -c \
  "CREATE USER admin WITH PASSWORD 'admin';" 2>/dev/null || true

# Grant privileges
PGPASSWORD=admin psql -h localhost -U postgres -c \
  "GRANT ALL PRIVILEGES ON DATABASE trading_agent TO admin;"
```

## Step 2: Configure Environment Variables

Create or update your `.env` file:

```bash
# .env
DATABASE_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=trading_agent
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin
```

Or use a single connection URL:

```bash
# .env
DATABASE_TYPE=postgres
POSTGRES_URL=postgresql://admin:admin@localhost:5432/trading_agent
```

### For Deployed Environments

If using hosting services like Railway, Supabase, or Heroku:

```bash
DATABASE_TYPE=postgres
POSTGRES_URL=postgresql://user:password@host:port/database
```

## Step 3: Run Migration Script

The migration script reads data from SQLite and imports it to PostgreSQL.

```bash
# Run the migration
npm run migrate-to-postgres
```

**Migration Output Example:**
```
╔════════════════════════════════════════════════════════════╗
║        SQLite to PostgreSQL Migration                     ║
╚════════════════════════════════════════════════════════════╝

🔧 Initializing PostgreSQL database...
✓ PostgreSQL database initialized

📂 Opening SQLite database...
✓ Connected to SQLite

📊 Migrating account data...
✓ Account data migrated

📈 Migrating positions...
✓ 5 positions migrated

📝 Migrating orders...
✓ 3 orders migrated

📜 Migrating position history...
✓ 12 history records migrated

🏦 Migrating paper positions...
✓ 8 paper positions migrated

🔧 Migrating instruments...
✓ 100 instruments migrated

╔════════════════════════════════════════════════════════════╗
║              Migration Summary                             ║
╠════════════════════════════════════════════════════════════╣
║ ✓ Account data       : Migrated
║ ✓ Positions          : 5 records migrated
║ ✓ Orders             : 3 records migrated
║ ✓ Position History   : 12 records migrated
║ ✓ Paper Positions    : 8 records migrated
║ ✓ Instruments        : 100 records migrated
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  ✅ Migration completed successfully!                     ║
╚════════════════════════════════════════════════════════════╝
```

## Step 4: Update Application Configuration

Update `src/lib/db/index.ts` - it will automatically load the correct service:

```typescript
// The database service is automatically loaded based on DATABASE_TYPE
// No code changes needed!
import * as db from "@/lib/db";

// Both SQLite and PostgreSQL services are transparent to the application
const account = await db.getAccount();
const instruments = await db.getInstruments();
```

## Step 5: Start Your Application

```bash
# With PostgreSQL
DATABASE_TYPE=postgres npm run dev

# Or use .env file configuration
npm run dev
```

## Verification

### Check Database Connection

```bash
# Connect to PostgreSQL
PGPASSWORD=admin psql -h localhost -U admin -d trading_agent

# List tables
\dt

# Count records in instruments
SELECT COUNT(*) FROM instruments;

# Exit
\q
```

### Verify Data in Application

```bash
# Check API endpoint
curl http://localhost:3000/api/instruments | head -50
```

## Database File Structure (PostgreSQL)

```
PostgreSQL Database: trading_agent
├── Table: account
│   └── Columns: id, total_capital, available_balance, invested_amount, total_pnl, ...
├── Table: positions
│   └── Columns: id, symbol, quantity, entry_price, current_price, ...
├── Table: orders
│   └── Columns: id, symbol, order_type, quantity, price_per_unit, ...
├── Table: position_history
│   └── Columns: id, symbol, quantity, entry_price, exit_price, ...
├── Table: paper_positions
│   └── Columns: id, symbol, quantity, entry_price, invested, ...
├── Table: instruments
│   └── Columns: id, symbol, name, industry, weight, ...
└── Indexes:
    ├── idx_positions_symbol
    ├── idx_orders_symbol
    ├── idx_instruments_symbol
    ├── idx_history_closed_at
    ├── idx_paper_positions_symbol
    └── idx_paper_positions_status
```

## Switching Between Databases

### Switch to PostgreSQL

```bash
echo 'DATABASE_TYPE=postgres' >> .env
npm run dev
```

### Switch Back to SQLite

```bash
echo 'DATABASE_TYPE=sqlite' >> .env
npm run dev
```

Data remains in each database independently. SQLite data is in `.data/paper-trading.db`.

## Performance Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| **Concurrent Users** | ~5-10 | 100+ |
| **Query Performance** | Good | Excellent |
| **Scalability** | Limited | High |
| **Setup** | None | Required |
| **Backup** | Single file | Database tools |
| **Production Ready** | No | Yes |

## Troubleshooting

### Issue: "Connection refused"

**Check PostgreSQL is running:**
```bash
# macOS
brew services list | grep postgres

# Linux
systemctl status postgresql

# Docker
docker ps | grep postgres
```

### Issue: "FATAL: Ident authentication failed for user"

**Update pg_hba.conf:**
```bash
# Find postgres config directory
sudo -u postgres psql -c "SHOW config_file"

# Edit pg_hba.conf and change 'ident' to 'md5' or 'scram-sha-256'
# Then restart PostgreSQL
```

### Issue: "database trading_agent does not exist"

**Create the database:**
```bash
PGPASSWORD=admin psql -h localhost -U postgres -c \
  "CREATE DATABASE trading_agent;"
```

### Issue: "Migration script fails"

**Ensure:**
1. PostgreSQL is running
2. Database exists
3. User credentials are correct
4. SQLite database exists at `.data/paper-trading.db`

```bash
# Test PostgreSQL connection
psql -h localhost -U admin -d trading_agent -c "SELECT 1"

# Test SQLite database
file .data/paper-trading.db
```

## Rollback to SQLite

If you want to revert to SQLite:

1. Update `.env`:
   ```bash
   DATABASE_TYPE=sqlite
   ```

2. Restart the application:
   ```bash
   npm run dev
   ```

**Note:** SQLite database is preserved at `.data/paper-trading.db`, so all original data remains unchanged.

## Advanced: PostgreSQL Connection Pooling

For production, configure connection pooling in `src/lib/db/postgres.ts`:

```typescript
const pool = new Pool({
  connectionString,
  max: 20,              // Maximum number of clients in pool
  min: 2,               // Minimum number of clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Advanced: PostgreSQL Backups

```bash
# Backup database
pg_dump -h localhost -U admin -d trading_agent \
  > trading_agent_backup.sql

# Restore database
psql -h localhost -U admin -d trading_agent \
  < trading_agent_backup.sql
```

## Support

### Environment Variables

- `DATABASE_TYPE`: `sqlite` (default) or `postgres`
- `POSTGRES_HOST`: PostgreSQL server hostname
- `POSTGRES_PORT`: PostgreSQL server port (default: 5432)
- `POSTGRES_DATABASE`: Database name
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_URL`: Alternative: full connection string

### Files Created/Modified

#### New Files
- `src/lib/db/postgres.ts` - PostgreSQL connection pool
- `src/lib/db/service-postgres.ts` - PostgreSQL service functions
- `migrate-to-postgres.ts` - Migration script
- `.env.postgres` - PostgreSQL configuration template

#### Modified Files
- `src/lib/db/index.ts` - Database abstraction layer
- `package.json` - Added migration script

#### Unchanged Files
- `src/lib/db/service.ts` - SQLite service (kept for backward compatibility)
- `src/lib/db/init.ts` - SQLite database init (kept for backward compatibility)
- `.data/paper-trading.db` - SQLite database file (unchanged)

## Next Steps

1. ✅ Install PostgreSQL
2. ✅ Create database and user
3. ✅ Configure environment variables
4. ✅ Run migration script
5. ✅ Test the application
6. ✅ Deploy to production

For questions or issues, check the troubleshooting section above.
