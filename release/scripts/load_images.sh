#!/bin/bash
# Loads every image archive under docker-images/ into the local Docker
# image store. Uses local files only — no internet required.
#
# Archive filenames are not fixed — the Packager names them
# rah-{app_slug}-{service}_{version}.tar (version-embedded, so multiple
# Release versions never collide) — so this loads every *.tar file found
# rather than assuming specific names.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_docker

shopt -s nullglob
archives=("$RELEASE_DIR"/docker-images/*.tar)
shopt -u nullglob

if [ "${#archives[@]}" -eq 0 ]; then
    echo "ERROR: no image archives found under $RELEASE_DIR/docker-images/" >&2
    exit 1
fi

for archive in "${archives[@]}"; do
    echo "==> Loading $(basename "$archive")"
    docker load -i "$archive"
done

echo "==> Images now available:"
docker images | grep -E "rah-indicator-" || true

echo
echo "Done."
