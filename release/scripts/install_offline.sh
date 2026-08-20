#!/bin/bash
# First-time installation on the offline Debian server.
# Usage: ./install_offline.sh [deploy_dir]   (default: /opt/healthcare-reporting)
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

if [ "${1:-}" != "" ]; then
    DEPLOY_DIR="$1"
    COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
    ENV_FILE="$DEPLOY_DIR/.env"
fi

require_docker

echo "==> Installing to: $DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

echo "==> Loading Docker images"
"$SCRIPT_DIR/load_images.sh"

echo "==> Copying compose file"
cp "$RELEASE_DIR/compose/docker-compose.yml" "$COMPOSE_FILE"

if [ -f "$ENV_FILE" ]; then
    echo "==> .env already exists at $ENV_FILE — leaving it untouched"
else
    echo "==> Creating .env from template"
    cp "$RELEASE_DIR/configuration/.env.offline.template" "$ENV_FILE"
    # Anchor STORAGE_ROOT to the actual install location, so a custom
    # deploy_dir doesn't silently fall back to the template's /opt default.
    sed -i "s#^STORAGE_ROOT=.*#STORAGE_ROOT=${DEPLOY_DIR}/storage#" "$ENV_FILE"
    echo "    Edit $ENV_FILE now if you need different ports before continuing."
fi

STORAGE_ROOT="$(read_env_var STORAGE_ROOT "$DEPLOY_DIR/storage")"
echo "==> Creating persistent storage directories under: $STORAGE_ROOT"
mkdir -p \
    "$STORAGE_ROOT/app-storage/config" \
    "$STORAGE_ROOT/app-storage/data" \
    "$STORAGE_ROOT/app-storage/charts" \
    "$STORAGE_ROOT/app-storage/reports" \
    "$STORAGE_ROOT/app-storage/temp" \
    "$STORAGE_ROOT/root-storage/uploads" \
    "$STORAGE_ROOT/root-storage/charts" \
    "$STORAGE_ROOT/root-storage/reports" \
    "$STORAGE_ROOT/root-storage/temp" \
    "$STORAGE_ROOT/logs"

echo "==> Starting the application stack"
compose up -d

BACKEND_PORT="$(read_env_var BACKEND_PORT 8001)"
FRONTEND_PORT="$(read_env_var FRONTEND_PORT 8080)"

echo "==> Waiting for backend health check (up to 60s)"
for i in $(seq 1 20); do
    if curl -fs "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
        echo "    Backend is healthy."
        break
    fi
    if [ "$i" -eq 20 ]; then
        echo "ERROR: backend did not become healthy in time. Run:"
        echo "  docker logs healthcare-backend"
        exit 1
    fi
    sleep 3
done

echo "==> Checking frontend"
if curl -fs -o /dev/null "http://localhost:${FRONTEND_PORT}/"; then
    echo "    Frontend is responding."
else
    echo "WARNING: frontend did not respond on port ${FRONTEND_PORT}."
fi

echo
echo "=================================================================="
echo " Installation complete."
echo
echo " Open: http://<this-server-IP>:${FRONTEND_PORT}"
echo " Default login: admin / admin123"
echo " CHANGE THIS PASSWORD IMMEDIATELY via the Admin panel."
echo "=================================================================="
