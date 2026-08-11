#!/bin/bash
# Run this on the ONLINE build workstation (this laptop) to build, tag, and
# export the backend/frontend images into release/docker-images/, ready for
# transfer to the offline server. Not run on the offline server itself.
set -euo pipefail

VERSION="${1:-1.0.0}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$REPO_ROOT/release"

BACKEND_IMAGE="rah-healthcare-backend:${VERSION}"
FRONTEND_IMAGE="rah-healthcare-frontend:${VERSION}"

echo "==> Building backend image ($BACKEND_IMAGE)"
docker build -t "$BACKEND_IMAGE" "$REPO_ROOT/python-service"

echo "==> Building frontend image ($FRONTEND_IMAGE)"
docker build -t "$FRONTEND_IMAGE" "$REPO_ROOT/frontend"

mkdir -p "$RELEASE_DIR/docker-images" "$RELEASE_DIR/checksums"

echo "==> Exporting backend image to tar"
docker save -o "$RELEASE_DIR/docker-images/backend.tar" "$BACKEND_IMAGE"

echo "==> Exporting frontend image to tar"
docker save -o "$RELEASE_DIR/docker-images/frontend.tar" "$FRONTEND_IMAGE"

echo "==> Writing release version file"
echo "$VERSION" > "$RELEASE_DIR/compose/RELEASE_VERSION.txt"

echo "==> Computing checksums"
(
  cd "$RELEASE_DIR"
  sha256sum \
    docker-images/backend.tar \
    docker-images/frontend.tar \
    compose/docker-compose.offline.yml \
    compose/.env.offline.template \
    > checksums/release_hashes.txt
)

echo
echo "Done. Release version ${VERSION} images are in:"
echo "  $RELEASE_DIR/docker-images/backend.tar"
echo "  $RELEASE_DIR/docker-images/frontend.tar"
echo
echo "Next: copy the whole 'release/' folder to DVD/USB per the hospital's"
echo "approved offline transfer procedure, then follow"
echo "release/documentation/INSTALL_OFFLINE.md on the offline server."
