#!/bin/bash
# Quick PostgreSQL setup script
# Sets up PostgreSQL database and user for the trading application

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        PostgreSQL Trading Agent Setup                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Docker detection - automatically find PostgreSQL container
DOCKER_CONTAINER=""
DETECTED_DOCKER_IP=""

if command -v docker &> /dev/null; then
    DOCKER_CONTAINER=$(docker ps --filter "ancestor=postgres" --format "{{.Names}}" 2>/dev/null | head -1)
    
    if [ -n "$DOCKER_CONTAINER" ]; then
        DETECTED_DOCKER_IP=$(docker inspect "$DOCKER_CONTAINER" --format='{{.NetworkSettings.IPAddress}}' 2>/dev/null || true)
        
        if [ -z "$DETECTED_DOCKER_IP" ] || [ "$DETECTED_DOCKER_IP" = "0.0.0.0" ]; then
            DETECTED_DOCKER_IP=""
        fi
    fi
fi

# Default values
if [ -n "$DETECTED_DOCKER_IP" ]; then
    POSTGRES_HOST=${1:-$DETECTED_DOCKER_IP}
else
    POSTGRES_HOST=${1:-localhost}
fi
POSTGRES_PORT=${2:-5432}
POSTGRES_USER=${3:-admin}
POSTGRES_PASSWORD=${4:-admin}
POSTGRES_DB="trading_agent"

echo "📋 Configuration:"
if [ -n "$DETECTED_DOCKER_IP" ]; then
    echo "   🐳 Docker Container: $DOCKER_CONTAINER"
    echo "   IP Address: $DETECTED_DOCKER_IP"
fi
echo "   Host:     $POSTGRES_HOST"
echo "   Port:     $POSTGRES_PORT"
echo "   Database: $POSTGRES_DB"
echo "   User:     $POSTGRES_USER"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed or psql is not in PATH"
    echo ""
    echo "📥 Install PostgreSQL:"
    echo "   macOS:   brew install postgresql@15"
    echo "   Linux:   sudo apt-get install postgresql"
    echo "   Windows: https://www.postgresql.org/download/windows/"
    echo ""
    exit 1
fi

echo "🔍 Checking PostgreSQL connection..."
if ! PGCONNECT_TIMEOUT=5 PGPASSWORD=postgres psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -tc "SELECT 1" &>/dev/null; then
    echo "❌ Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
    echo ""
    echo "💡 Connection troubleshooting:"
    echo ""
    if [ -n "$DETECTED_DOCKER_IP" ]; then
        echo "   Docker PostgreSQL detected at $DETECTED_DOCKER_IP ($DOCKER_CONTAINER)"
        echo "   • Verify Docker container is running: docker ps"
        echo "   • Check logs: docker logs $DOCKER_CONTAINER"
        echo "   • Test connection: psql -h $DETECTED_DOCKER_IP -U postgres -tc 'SELECT 1'"
    else
        echo "   For local PostgreSQL:"
        echo "   • macOS: brew services start postgresql@15"
        echo "   • Linux: sudo systemctl start postgresql"
        echo ""
        echo "   For Docker PostgreSQL:"
        echo "   • Start Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres"
        echo "   • Then re-run this script"
    fi
    echo ""
    echo "   Or manually specify host: ./setup-postgres.sh 172.17.0.2 5432 admin admin"
    echo ""
    exit 1
fi

echo "✓ PostgreSQL is running"
echo ""

# Create database
echo "🗄️  Creating database '$POSTGRES_DB'..."
PGPASSWORD=postgres PGCONNECT_TIMEOUT=5 psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" | grep -q 1 || \
    PGPASSWORD=postgres PGCONNECT_TIMEOUT=5 psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -c \
    "CREATE DATABASE $POSTGRES_DB;" 2>/dev/null || true
echo "✓ Database created"

# Create user
echo "👤 Creating user '$POSTGRES_USER'..."
PGPASSWORD=postgres PGCONNECT_TIMEOUT=5 psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -c \
    "CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null || \
    PGPASSWORD=postgres PGCONNECT_TIMEOUT=5 psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -c \
    "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null || true
echo "✓ User created"

# Grant privileges
echo "🔐 Granting privileges..."
PGPASSWORD=postgres PGCONNECT_TIMEOUT=5 psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -c \
    "ALTER ROLE $POSTGRES_USER WITH CREATEDB;" 2>/dev/null || true
PGPASSWORD=postgres PGCONNECT_TIMEOUT=5 psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -c \
    "GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;" 2>/dev/null || true
echo "✓ Privileges granted"

# Test connection
echo ""
echo "🧪 Testing connection..."
if PGPASSWORD=$POSTGRES_PASSWORD PGCONNECT_TIMEOUT=5 psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" &>/dev/null; then
    echo "✓ Connection successful"
else
    echo "⚠️  Connection test failed, but setup may still work"
fi

# Create .env file
echo ""
echo "📝 Creating .env file..."
cat > .env.postgres.local << EOF
# PostgreSQL Configuration
DATABASE_TYPE=postgres
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PORT=$POSTGRES_PORT
POSTGRES_DATABASE=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF
echo "✓ Configuration saved to .env.postgres.local"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Setup Complete! ✅                             ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║ Next steps:                                              ║"
echo "║                                                            ║"
echo "║ 1. Copy environment variables to .env:                   ║"
echo "║    cat .env.postgres.local >> .env                      ║"
echo "║                                                            ║"
echo "║ 2. Run migration script:                                 ║"
echo "║    npm run migrate-to-postgres                           ║"
echo "║                                                            ║"
echo "║ 3. Start your application:                              ║"
echo "║    npm run dev                                           ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
