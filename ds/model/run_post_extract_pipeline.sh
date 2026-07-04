#!/usr/bin/env bash
# Wait for lang-uk extract to finish, then run unified migration + retrain.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MONGO_URI="${MONGO_URI:-mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin}"
PYTHON="${PYTHON:-$SCRIPT_DIR/.venv/bin/python}"
POLL_SECONDS="${POLL_SECONDS:-300}"
SOURCE_COLLECTION="${SOURCE_COLLECTION:-lang-uk-job}"

log() { echo "[post-extract] $(date -u +%FT%TZ) $*"; }

wait_for_extract() {
  log "Waiting for ${SOURCE_COLLECTION} extract to complete (poll every ${POLL_SECONDS}s)..."
  while true; do
    read -r total done pending <<<"$("$PYTHON" - <<PY
from pymongo import MongoClient
import os
c = MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=8000).get_default_database()
total = c["${SOURCE_COLLECTION}"].count_documents({})
done = c["${SOURCE_COLLECTION}"].count_documents({"extracted": True})
print(total, done, total - done)
PY
)"
    pct=0
    if [[ "$total" -gt 0 ]]; then
      pct=$((done * 100 / total))
    fi
    log "extract progress: ${done}/${total} (${pct}%), pending=${pending}"
    if [[ "$pending" -eq 0 ]]; then
      log "Extract complete."
      return 0
    fi
    sleep "$POLL_SECONDS"
  done
}

run_step() {
  log "$1"
  shift
  MONGO_URI="$MONGO_URI" "$@"
}

wait_for_extract

run_step "Backfill skill_records on job collections" \
  "$PYTHON" migrate_skill_records.py

run_step "Unify into role_skill_observations" \
  "$PYTHON" migrate_unified_skill_observations.py

run_step "Train from unified collection" \
  env TRAIN_USE_UNIFIED=1 \
    SOURCE_WEIGHTS="${SOURCE_WEIGHTS:-linkedin:1.0,lang_uk:0.3}" \
    UNIFIED_SKILLS_COLLECTION="${UNIFIED_SKILLS_COLLECTION:-role_skill_observations}" \
    MONGO_URI="$MONGO_URI" \
    "$PYTHON" train.py

log "Done. Check model.joblib and model_runs in Mongo."
