#!/bin/bash
# ============================================================
# ERP/POS Database Restore Script
# Usage: ./restore.sh <backup_file.sql.gz>
# ============================================================

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -t ./backups/erp_backup_*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ File not found: $BACKUP_FILE"
  exit 1
fi

DB_NAME=${POSTGRES_DB:-erp_pos}
DB_USER=${POSTGRES_USER:-erp_user}

echo "⚠️  WARNING: This will OVERWRITE the database '$DB_NAME'!"
echo "Backup file: $BACKUP_FILE"
read -p "Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "🔄 Restoring database..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME"

echo "✅ Restore complete!"
