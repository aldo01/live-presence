#!/bin/bash

# Database health check script
# Usage: ./scripts/db-health.sh

set -e

echo "🏥 Database Health Check"
echo "=========================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==============================================================================
# PostgreSQL
# ==============================================================================

echo "📊 PostgreSQL Check..."
echo ""

if docker ps | grep -q live-presence-postgres; then
    echo -e "${GREEN}✓${NC} PostgreSQL container is running"
    
    # Check connection
    if docker exec live-presence-postgres pg_isready -U postgres -q; then
        echo -e "${GREEN}✓${NC} PostgreSQL is accepting connections"
    else
        echo -e "${RED}✗${NC} PostgreSQL is not accepting connections"
    fi
    
    # Check database
    if docker exec live-presence-postgres psql -U postgres -d livepresence -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Database 'livepresence' is accessible"
    else
        echo -e "${RED}✗${NC} Database 'livepresence' is not accessible"
    fi
    
    # Check tables
    TABLE_COUNT=$(docker exec live-presence-postgres psql -U postgres -d livepresence -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")
    echo -e "${GREEN}✓${NC} Tables in database: $TABLE_COUNT"
    
    # Check connections
    CONN_COUNT=$(docker exec live-presence-postgres psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity")
    echo -e "${GREEN}✓${NC} Active connections: $CONN_COUNT"
    
    # Check disk usage
    DISK_USAGE=$(docker exec live-presence-postgres du -sh /var/lib/postgresql/data | cut -f1)
    echo -e "${GREEN}✓${NC} Disk usage: $DISK_USAGE"
    
else
    echo -e "${RED}✗${NC} PostgreSQL container is not running"
    echo "  Start with: make start-local"
fi

echo ""

# ==============================================================================
# Redis
# ==============================================================================

echo "🔴 Redis Check..."
echo ""

if docker ps | grep -q live-presence-redis; then
    echo -e "${GREEN}✓${NC} Redis container is running"
    
    # Check connection
    if docker exec live-presence-redis redis-cli PING > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is accepting connections"
    else
        echo -e "${RED}✗${NC} Redis is not accepting connections"
    fi
    
    # Check database size
    KEY_COUNT=$(docker exec live-presence-redis redis-cli DBSIZE | grep -oP '\d+')
    echo -e "${GREEN}✓${NC} Keys in database: $KEY_COUNT"
    
    # Check memory usage
    MEMORY_USED=$(docker exec live-presence-redis redis-cli INFO memory | grep used_memory_human | cut -d':' -f2 | tr -d '\r')
    echo -e "${GREEN}✓${NC} Memory usage: $MEMORY_USED"
    
    # Check connected clients
    CLIENTS=$(docker exec live-presence-redis redis-cli INFO clients | grep connected_clients | cut -d':' -f2 | tr -d '\r')
    echo -e "${GREEN}✓${NC} Connected clients: $CLIENTS"
    
    # Check version
    VERSION=$(docker exec live-presence-redis redis-cli INFO server | grep redis_version | cut -d':' -f2 | tr -d '\r')
    echo -e "${GREEN}✓${NC} Redis version: $VERSION"
    
else
    echo -e "${RED}✗${NC} Redis container is not running"
    echo "  Start with: make start-local"
fi

echo ""

# ==============================================================================
# Backup Status
# ==============================================================================

echo "💾 Backup Status..."
echo ""

if [ -d "backups" ]; then
    POSTGRES_BACKUPS=$(ls -1 backups/*.sql 2>/dev/null | wc -l)
    REDIS_BACKUPS=$(ls -1 backups/*.rdb 2>/dev/null | wc -l)
    
    echo -e "${GREEN}✓${NC} PostgreSQL backups: $POSTGRES_BACKUPS"
    echo -e "${GREEN}✓${NC} Redis backups: $REDIS_BACKUPS"
    
    if [ $POSTGRES_BACKUPS -gt 0 ]; then
        LATEST_PG=$(ls -t backups/*.sql 2>/dev/null | head -1)
        PG_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$LATEST_PG" 2>/dev/null || stat -c "%y" "$LATEST_PG" | cut -d' ' -f1-2)
        echo "  Latest PostgreSQL: $LATEST_PG ($PG_TIME)"
    fi
    
    if [ $REDIS_BACKUPS -gt 0 ]; then
        LATEST_REDIS=$(ls -t backups/*.rdb 2>/dev/null | head -1)
        REDIS_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$LATEST_REDIS" 2>/dev/null || stat -c "%y" "$LATEST_REDIS" | cut -d' ' -f1-2)
        echo "  Latest Redis: $LATEST_REDIS ($REDIS_TIME)"
    fi
else
    echo -e "${YELLOW}⚠${NC} No backups directory found"
    echo "  Create backups with:"
    echo "    ./scripts/backup-postgres.sh"
    echo "    ./scripts/backup-redis.sh"
fi

echo ""
echo "✅ Health check complete"
