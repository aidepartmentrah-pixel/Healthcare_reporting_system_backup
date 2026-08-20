#!/bin/bash
# Updates an existing offline installation to a new release. Run this from
# the NEW release folder (the one containing this script), pointed at the
# EXISTING deploy directory. Storage volumes are untouched — data survives.
# Usage: ./update_offline.sh [deploy_dir]   (default: /opt/healthcare-reporting)
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

if [ "${1:-}" != "" ]; then
    DEPLOY_DIR="$1"
    COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
    ENV_FILE="$DEPLOY_DIR/.env"
fi

require_docker

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: no existing installation found at $DEPLOY_DIR (.env missing)." >&2
    echo "Use install_offline.sh for a first-time install." >&2
    exit 1
fi

echo "==> Loading new Docker images"
"$SCRIPT_DIR/load_images.sh"

echo "==> Backing up storage before updating (see backup_storage.sh output below)"
"$SCRIPT_DIR/backup_storage.sh" "$DEPLOY_DIR"

echo "==> Updating compose file"
cp "$RELEASE_DIR/compose/docker-compose.yml" "$COMPOSE_FILE"

echo "==> Recreating containers with the new images (storage volumes untouched)"
compose up -d

BACKEND_PORT="$(read_env_var BACKEND_PORT 8001)"
echo "==> Waiting for backend health check (up to 60s)"
for i in $(seq 1 20); do
    if curl -fs "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
        echo "    Backend is healthy."
        break
    fi
    if [ "$i" -eq 20 ]; then
        echo "ERROR: backend did not become healthy after update. Check logs:"
        echo "  docker logs healthcare-backend"
        echo "To roll back: restore the previous release's images with its"
        echo "own load_images.sh, then 'docker compose up -d' again."
        exit 1
    fi
    sleep 3
done

echo
echo "Update complete. Existing data was preserved."
