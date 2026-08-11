#!/bin/bash
# Loads the backend/frontend images from the release tar files into the
# local Docker image store. Uses local files only — no internet required.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_docker

echo "==> Loading backend image"
docker load -i "$RELEASE_DIR/docker-images/backend.tar"

echo "==> Loading frontend image"
docker load -i "$RELEASE_DIR/docker-images/frontend.tar"

echo "==> Images now available:"
docker images | grep -E "rah-healthcare-(backend|frontend)" || true

echo
echo "Done."
