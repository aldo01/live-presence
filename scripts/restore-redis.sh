#!/bin/bash

# Redis restore script
# Usage: ./scripts/restore-redis.sh <backup-file>

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <backup-file>"
    echo ""
    echo "Example:"
    echo "  $0 backups/redis_backup_20240101_120000.rdb"
    echo ""
    echo "Available backups:"
    ls -lh backups/*.rdb 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Restoring Redis database from backup..."
echo "   Backup file: $BACKUP_FILE"
echo ""
echo "⚠️  WARNING: This will overwrite the current Redis data"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q live-presence-redis; then
    echo "❌ Redis container is not running"
    echo "   Start it with: make start-local"
    exit 1
fi

# Stop Redis to prevent writes during restore
echo "Stopping Redis (to prevent writes)..."
docker exec live-presence-redis redis-cli SHUTDOWN NOSAVE || true
sleep 2

# Copy backup file
echo "Restoring backup file..."
docker cp "$BACKUP_FILE" live-presence-redis:/data/dump.rdb

# Start Redis
echo "Starting Redis..."
docker start live-presence-redis
sleep 2

# Verify
if docker exec live-presence-redis redis-cli PING > /dev/null 2>&1; then
    echo "✅ Restore completed successfully"
    echo ""
    echo "Restored data size:"
    docker exec live-presence-redis redis-cli DBSIZE
else
    echo "❌ Redis did not start properly"
    exit 1
fi
