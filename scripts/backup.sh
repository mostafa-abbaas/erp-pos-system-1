#!/bin/bash
# ============================================================
# ERP/POS Database Backup Script
# Usage: ./backup.sh [backup_dir]
# ============================================================

set -e

BACKUP_DIR=${1:-./backups}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME=${POSTGRES_DB:-erp_pos}
DB_USER=${POSTGRES_USER:-erp_user}
BACKUP_FILE="${BACKUP_DIR}/erp_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Backing up database: $DB_NAME"
echo "📁 Output: $BACKUP_FILE"

docker compose exec -T postgres pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-password \
  --verbose \
  --format=plain \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "✅ Backup complete! Size: $SIZE"
echo ""

# Keep only last 30 backups
echo "🧹 Cleaning old backups (keeping last 30)..."
ls -t "${BACKUP_DIR}"/erp_backup_*.sql.gz | tail -n +31 | xargs -r rm --
echo "Done."
