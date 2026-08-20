#!/bin/bash
# Checks that the installation is healthy. Safe to run any time.
# Usage: ./verify_installation.sh [deploy_dir]
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

if [ "${1:-}" != "" ]; then
    DEPLOY_DIR="$1"
    COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
    ENV_FILE="$DEPLOY_DIR/.env"
fi

BACKEND_PORT="$(read_env_var BACKEND_PORT 8001)"
FRONTEND_PORT="$(read_env_var FRONTEND_PORT 8080)"
FAIL=0

echo "==> Container status"
compose ps || FAIL=1

echo
echo "==> Backend health (http://localhost:${BACKEND_PORT}/health)"
if curl -fs "http://localhost:${BACKEND_PORT}/health"; then
    echo
    echo "    OK"
else
    echo "    FAILED"
    FAIL=1
fi

echo
echo "==> Frontend (http://localhost:${FRONTEND_PORT}/)"
if curl -fs -o /dev/null -w "    HTTP %{http_code}\n" "http://localhost:${FRONTEND_PORT}/"; then
    echo "    OK"
else
    echo "    FAILED"
    FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then
    echo "All checks passed."
else
    echo "One or more checks FAILED. See release/documentation/TROUBLESHOOTING.md"
fi
exit "$FAIL"
