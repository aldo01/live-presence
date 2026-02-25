#!/bin/bash

# Database backup script for PostgreSQL
# Usage: ./scripts/backup-postgres.sh [backup-name]

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${1:-postgres_backup_$TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Backing up PostgreSQL database..."
echo "   Database: livepresence"
echo "   File: $BACKUP_FILE"
echo ""

# Check if container is running
if ! docker ps | grep -q live-presence-postgres; then
    echo "❌ PostgreSQL container is not running"
    echo "   Start it with: make start-local"
    exit 1
fi

# Create backup
docker exec live-presence-postgres pg_dump -U postgres livepresence > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completed successfully"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $SIZE"
    echo ""
    echo "📌 To restore:"
    echo "   ./scripts/restore-postgres.sh $BACKUP_FILE"
else
    echo "❌ Backup failed"
    exit 1
fi
