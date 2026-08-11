#!/bin/bash
# Backs up all persistent application data. There is no database to dump —
# this is the entire backup: a tar of the storage directories.
# Usage: ./backup_storage.sh [deploy_dir] [backup_dir]
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

if [ "${1:-}" != "" ]; then
    DEPLOY_DIR="$1"
    ENV_FILE="$DEPLOY_DIR/.env"
fi
BACKUP_DIR="${2:-$DEPLOY_DIR/backups}"
STORAGE_ROOT="$(read_env_var STORAGE_ROOT "$DEPLOY_DIR/storage")"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/healthcare-storage-backup-${TIMESTAMP}.tar.gz"

echo "==> Backing up $STORAGE_ROOT"
tar -czf "$ARCHIVE" -C "$(dirname "$STORAGE_ROOT")" "$(basename "$STORAGE_ROOT")"

echo "==> Backup written to: $ARCHIVE"
echo "Copy this file off the server (network share / external media) for safekeeping."
