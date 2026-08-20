#!/bin/bash
# Usage: ./start_stack.sh [deploy_dir]
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
if [ "${1:-}" != "" ]; then
    DEPLOY_DIR="$1"; COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"; ENV_FILE="$DEPLOY_DIR/.env"
fi
compose up -d
compose ps
