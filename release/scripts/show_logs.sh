#!/bin/bash
# Usage: ./show_logs.sh [deploy_dir] [service]
# service: backend | frontend | (omit for both)
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
if [ "${1:-}" != "" ]; then
    DEPLOY_DIR="$1"; COMPOSE_FILE="$DEPLOY_DIR/docker-compose.offline.yml"; ENV_FILE="$DEPLOY_DIR/.env"
fi
if [ "${2:-}" != "" ]; then
    compose logs -f --tail=200 "$2"
else
    compose logs -f --tail=200
fi
