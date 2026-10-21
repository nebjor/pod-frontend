#!/usr/bin/env bash
# Nightly backup of the database and the order-files volume. Run from cron on the host:
#   30 2 * * * /opt/3dburg/pod-frontend/deploy/backup.sh >> /var/log/3dburg-backup.log 2>&1
# Restore is described in README.md (and must be rehearsed, not assumed).
set -euo pipefail

cd "$(dirname "$0")"
set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_DIR=${BACKUP_DIR:-/var/backups/3dburg}
KEEP_DAYS=${KEEP_DAYS:-14}
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres \
    pg_dump -U "${DB_USERNAME:-sliceruser}" "${DB_NAME:-slicercore}" \
    | gzip > "$BACKUP_DIR/db-$stamp.sql.gz"

docker run --rm \
    -v 3dburg_order_files:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine:3.20 tar czf "/backup/order-files-$stamp.tar.gz" -C /data .

find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete
echo "$(date -Is) backup written: db-$stamp.sql.gz, order-files-$stamp.tar.gz"
