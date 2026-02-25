#!/bin/bash

# Database restore script for PostgreSQL
# Usage: ./scripts/restore-postgres.sh <backup-file>

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <backup-file>"
    echo ""
    echo "Example:"
    echo "  $0 backups/postgres_backup_20240101_120000.sql"
    echo ""
    echo "Available backups:"
    ls -lh backups/*.sql 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Restoring PostgreSQL database from backup..."
echo "   Backup file: $BACKUP_FILE"
echo ""
echo "⚠️  WARNING: This will overwrite the current database"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q live-presence-postgres; then
    echo "❌ PostgreSQL container is not running"
    echo "   Start it with: make start-local"
    exit 1
fi

# Drop and recreate database
echo "Dropping existing database..."
docker exec live-presence-postgres dropdb -U postgres livepresence --if-exists

echo "Creating new database..."
docker exec live-presence-postgres createdb -U postgres livepresence

# Restore from backup
echo "Restoring from backup..."
docker exec -i live-presence-postgres psql -U postgres livepresence < "$BACKUP_FILE"

echo ""
echo "✅ Restore completed successfully"
echo ""
