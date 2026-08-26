#!/usr/bin/env bash
# Restore the CareerLens database dump on the production host.
#
# Runs entirely on the server, so it needs no inbound access to port 27017 - which is
# the point: docker-compose.yaml never publishes MongoDB, and exposing root Mongo to
# the internet is not something to do for a one-off migration.
#
# Additive by default: mongorestore without --drop inserts new documents and SKIPS any
# _id that already exists. It does not update existing documents.
#
# Usage:
#   ./restore-on-server.sh [--drop] [--dir <db-dir>]
#
# Requires MONGO_URI, e.g.
#   export MONGO_URI='mongodb://root:PASSWORD@localhost:27017/?authSource=admin'

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/db"
TARGET_DB="${TARGET_DB:-careerlens}"
SOURCE_DB="${SOURCE_DB:-careerlens}"
CONTAINER="${MONGO_CONTAINER:-mongodb}"
DROP=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --drop) DROP=1; shift ;;
        --dir)  DB_DIR="$2"; shift 2 ;;
        -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 2 ;;
    esac
done

if [[ -z "${MONGO_URI:-}" ]]; then
    echo "ERROR: MONGO_URI is not set." >&2
    echo "  export MONGO_URI='mongodb://root:PASSWORD@localhost:27017/?authSource=admin'" >&2
    exit 2
fi
[[ -d "$DB_DIR" ]] || { echo "ERROR: no db directory at $DB_DIR" >&2; exit 2; }

# --- how do we reach mongorestore? -------------------------------------------------
# Preference order: host binary, then the running mongo container (the image ships the
# database tools), piping the archive in over stdin.
MODE=""
if command -v mongorestore >/dev/null 2>&1; then
    MODE="host"
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    if docker exec "$CONTAINER" sh -c 'command -v mongorestore' >/dev/null 2>&1; then
        MODE="docker"
    fi
fi

if [[ -z "$MODE" ]]; then
    cat >&2 <<'EOF'
ERROR: cannot find mongorestore.

Tried:
  1. a mongorestore binary on this host
  2. mongorestore inside the running mongo container

Fix either one:
  # Debian/Ubuntu host
  wget https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2204-x86_64-100.17.0.deb
  sudo dpkg -i mongodb-database-tools-*.deb

  # or confirm the container name (default: mongodb)
  docker ps --format '{{.Names}}'
  MONGO_CONTAINER=<name> ./restore-on-server.sh
EOF
    exit 3
fi

echo "=== Restore plan"
echo "  dump dir : $DB_DIR"
echo "  target   : ${TARGET_DB} (via ${MODE})"
if [[ $DROP -eq 1 ]]; then
    echo "  mode     : --drop  ** DESTRUCTIVE - target collections are deleted first **"
else
    echo "  mode     : additive (insert-only; existing _id values are skipped)"
fi

shopt -s nullglob
ARCHIVES=("$DB_DIR"/*.gz)
shopt -u nullglob
[[ ${#ARCHIVES[@]} -gt 0 ]] || { echo "ERROR: no .gz archives in $DB_DIR" >&2; exit 2; }

echo "  archives :"
for a in "${ARCHIVES[@]}"; do
    printf '    %-28s %8s\n' "$(basename "$a" .gz)" "$(du -h "$a" | cut -f1)"
done

# --- mandatory backup before a destructive run -------------------------------------
if [[ $DROP -eq 1 ]]; then
    BACKUP_DIR="${BACKUP_DIR:-$HOME/careerlens-prod-backup}"
    mkdir -p "$BACKUP_DIR"
    STAMP="$(date +%Y%m%d-%H%M%S)"
    BACKUP_FILE="$BACKUP_DIR/prod-full-$STAMP.gz"
    echo
    echo "=== Backing up production first -> $BACKUP_FILE"
    if [[ "$MODE" == "host" ]]; then
        mongodump --uri="$MONGO_URI" --gzip --archive="$BACKUP_FILE"
    else
        docker exec "$CONTAINER" mongodump --uri="$MONGO_URI" --gzip --archive > "$BACKUP_FILE"
    fi
    [[ -s "$BACKUP_FILE" ]] || { echo "ERROR: backup is empty - refusing to --drop." >&2; exit 4; }
    echo "  backup OK ($(du -h "$BACKUP_FILE" | cut -f1))"
    echo "  rollback: mongorestore --uri=\"\$MONGO_URI\" --gzip --archive=$BACKUP_FILE --drop"
fi

echo
read -r -p "Proceed with restore? Type YES: " ANSWER
[[ "$ANSWER" == "YES" ]] || { echo "Aborted."; exit 1; }

echo
echo "=== Restoring"
FAILED=0
for archive in "${ARCHIVES[@]}"; do
    coll="$(basename "$archive" .gz)"
    printf '  %-28s ' "$coll"
    start=$(date +%s)

    args=(
        --gzip
        "--nsFrom=${SOURCE_DB}.${coll}"
        "--nsTo=${TARGET_DB}.${coll}"
        --numInsertionWorkersPerCollection=4
        --quiet
    )
    [[ $DROP -eq 1 ]] && args+=(--drop)

    if [[ "$MODE" == "host" ]]; then
        if mongorestore --uri="$MONGO_URI" "${args[@]}" --archive="$archive"; then
            echo "ok ($(( $(date +%s) - start ))s)"
        else
            echo "FAILED"; FAILED=$((FAILED + 1))
        fi
    else
        if docker exec -i "$CONTAINER" mongorestore --uri="$MONGO_URI" "${args[@]}" --archive < "$archive"; then
            echo "ok ($(( $(date +%s) - start ))s)"
        else
            echo "FAILED"; FAILED=$((FAILED + 1))
        fi
    fi
done

echo
if [[ $FAILED -gt 0 ]]; then
    echo "$FAILED collection(s) failed. Completed ones re-run safely without --drop." >&2
    exit 1
fi
echo "Restore complete. Next: ./verify-on-server.sh"
