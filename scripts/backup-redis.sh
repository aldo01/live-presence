#!/bin/bash

# Redis backup script
# Usage: ./scripts/backup-redis.sh [backup-name]

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${1:-redis_backup_$TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.rdb"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Backing up Redis database..."
echo "   File: $BACKUP_FILE"
echo ""

# Check if container is running
if ! docker ps | grep -q live-presence-redis; then
    echo "❌ Redis container is not running"
    echo "   Start it with: make start-local"
    exit 1
fi

# Trigger background save
docker exec live-presence-redis redis-cli BGSAVE
sleep 1  # Give it a moment to start

# Wait for save to complete
echo "Waiting for Redis to save..."
while docker exec live-presence-redis redis-cli LASTSAVE > /dev/null 2>&1; do
    sleep 1
done

# Copy the dump file
docker cp live-presence-redis:/data/dump.rdb "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completed successfully"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $SIZE"
    echo ""
    echo "📌 To restore:"
    echo "   ./scripts/restore-redis.sh $BACKUP_FILE"
else
    echo "❌ Backup failed"
    exit 1
fi
