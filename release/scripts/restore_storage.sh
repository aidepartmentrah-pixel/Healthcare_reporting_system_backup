#!/bin/bash
# Restores application data from a backup produced by backup_storage.sh.
# This OVERWRITES the current storage directory — use with care.
# Usage: ./restore_storage.sh <path-to-backup.tar.gz> [deploy_dir]
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
    echo "Usage: $0 <path-to-backup.tar.gz> [deploy_dir]" >&2
    exit 1
fi
if [ "${2:-}" != "" ]; then
    DEPLOY_DIR="$2"
    COMPOSE_FILE="$DEPLOY_DIR/docker-compose.offline.yml"
    ENV_FILE="$DEPLOY_DIR/.env"
fi
STORAGE_ROOT="$(read_env_var STORAGE_ROOT "$DEPLOY_DIR/storage")"

echo "This will STOP the application and REPLACE all data under:"
echo "  $STORAGE_ROOT"
echo "with the contents of:"
echo "  $ARCHIVE"
read -r -p "Type YES to continue: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "Aborted."
    exit 1
fi

echo "==> Stopping the stack"
compose down

echo "==> Restoring data"
rm -rf "$STORAGE_ROOT"
mkdir -p "$(dirname "$STORAGE_ROOT")"
tar -xzf "$ARCHIVE" -C "$(dirname "$STORAGE_ROOT")"

echo "==> Starting the stack"
compose up -d

echo
echo "Restore complete. Verify with: ./verify_installation.sh"
