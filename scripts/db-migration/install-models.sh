#!/usr/bin/env bash
# Place the four production model artifacts where the DS server expects them.
#
# These are NOT in MongoDB - ds/model/server.py loads them from disk. In the repo they
# are Git-LFS pointers, so a plain `git clone` without `git lfs pull` leaves ~130-byte
# stubs behind and the DS server fails at load. This script copies the real files from
# the transfer bundle instead, which is why the bundle carries them.
#
# Usage:
#   ./install-models.sh [--dest <dir>]        # default: ../ds/model relative to repo
#   ./install-models.sh --docker-volume       # seed the model_data volume used by compose

set -euo pipefail

BUNDLE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$BUNDLE/models"
DEST=""
DOCKER_VOLUME=0
DS_CONTAINER="${DS_CONTAINER:-careerlens-ds}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dest) DEST="$2"; shift 2 ;;
        --docker-volume) DOCKER_VOLUME=1; shift ;;
        -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 2 ;;
    esac
done

[[ -d "$SRC" ]] || { echo "ERROR: no models directory at $SRC" >&2; exit 2; }

echo "=== Model artifacts in this bundle"
for f in "$SRC"/*; do
    printf '  %-46s %8s\n' "$(basename "$f")" "$(du -h "$f" | cut -f1)"
done

if [[ $DOCKER_VOLUME -eq 1 ]]; then
    command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found" >&2; exit 3; }
    docker ps --format '{{.Names}}' | grep -qx "$DS_CONTAINER" \
        || { echo "ERROR: container '$DS_CONTAINER' is not running (set DS_CONTAINER)" >&2; exit 3; }

    echo
    echo "=== Copying into $DS_CONTAINER:/models"
    for f in "$SRC"/*; do
        printf '  %-46s ' "$(basename "$f")"
        docker cp "$f" "$DS_CONTAINER:/models/$(basename "$f")"
        echo ok
    done
    echo
    echo "Restart the DS service so it reloads:  docker restart $DS_CONTAINER"
    exit 0
fi

if [[ -z "$DEST" ]]; then
    # Walk up looking for a checkout, else fall back to ./ds/model
    if [[ -d "$BUNDLE/../ds/model" ]]; then
        DEST="$(cd "$BUNDLE/../ds/model" && pwd)"
    else
        DEST="./ds/model"
    fi
fi

mkdir -p "$DEST"
echo
echo "=== Copying to $DEST"
for f in "$SRC"/*; do
    printf '  %-46s ' "$(basename "$f")"
    cp -f "$f" "$DEST/"
    echo ok
done

echo
echo "Done. Verify the DS server can load them:"
echo "  cd $DEST && python server.py"
echo
echo "Required serving env (without these, boilerplate skills top every list):"
echo "  SKILL_UBIQUITY_CAP=11"
echo "  ROLE_COUNT_MIN_PREVALENCE=0.05"
