#!/bin/bash
# Shared helpers sourced by the other scripts in this folder. Not run directly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_DIR="${DEPLOY_DIR:-/opt/healthcare-reporting}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.offline.yml"
ENV_FILE="$DEPLOY_DIR/.env"

compose() {
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "ERROR: docker is not installed or not on PATH." >&2
        exit 1
    fi
    if ! docker compose version >/dev/null 2>&1; then
        echo "ERROR: 'docker compose' plugin not available." >&2
        exit 1
    fi
}

read_env_var() {
    # read_env_var VARNAME DEFAULT
    local var="$1" default="$2"
    if [ -f "$ENV_FILE" ]; then
        local val
        val="$(grep -E "^${var}=" "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
        [ -n "$val" ] && echo "$val" && return
    fi
    echo "$default"
}
