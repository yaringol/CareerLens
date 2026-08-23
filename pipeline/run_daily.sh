#!/bin/sh
set -e

# When launched by ofelia (job-run), credentials arrive via a mounted secrets file
# rather than an inline environment= line (see ofelia/config.ini). The docker-compose
# `pipeline` service instead sets MONGO_URI directly, so this is a no-op there.
if [ -f /run/secrets/mongo.env ]; then
  set -a
  . /run/secrets/mongo.env
  set +a
fi

# 1) Scrape raw LinkedIn postings into Mongo (append-only upsert to raw_postings).
echo "[pipeline] $(date -u +%FT%TZ) scrape: starting"
python /app/linkedin.py

# 2a) SkillNer: LinkedIn raw_postings -> jobs (fresh scraped data).
echo "[pipeline] $(date -u +%FT%TZ) extract linkedin: starting"
SOURCE_COLLECTION="${SOURCE_COLLECTION:-raw_postings}" \
TARGET_COLLECTION="${TARGET_COLLECTION:-jobs}" \
python /app/extract_skills.py

# 2b) SkillNer: lang-uk-job -> lang-uk-job-skills (resumable batch per run).
LANG_UK_EXTRACT_LIMIT="${LANG_UK_EXTRACT_LIMIT:-500}"
echo "[pipeline] $(date -u +%FT%TZ) extract lang-uk: starting (limit=${LANG_UK_EXTRACT_LIMIT})"
SOURCE_COLLECTION=lang-uk-job \
TARGET_COLLECTION=lang-uk-job-skills \
LIMIT="${LANG_UK_EXTRACT_LIMIT}" \
python /app/extract_skills.py

# 2c) Backfill skill_records + unify observations for training.
echo "[pipeline] $(date -u +%FT%TZ) migrate skill_records: starting"
python /app/migrate_skill_records.py

echo "[pipeline] $(date -u +%FT%TZ) migrate unified observations: starting"
python /app/migrate_unified_skill_observations.py

# 3) Retrain from `jobs` -> model.joblib on shared volume.
#
# The training configuration is NOT defined here. `ds/final/model1_retrain.ipynb`
# is the source of truth for it: section 0 of the notebook holds the values and
# section 5 explains why each one differs from train.py's shipped default -
# TREND_WINDOW_DAYS 7 collapses every trend label to `stable` against a corpus
# reaching back to 2020, RECENCY_HALF_LIFE_DAYS 14 decays the historical slice to
# numerically nothing, and an unset SOURCE_EXCLUDE retrains the retired
# `augmented-2026` synthetic bridge every night.
#
# nightly_config.py parses that cell (ast.literal_eval - the notebook is read,
# never executed) and emits `export KEY=${KEY:-<notebook value>}`, so an operator
# can still override a single key for one run, and a change to the notebook
# reaches production without editing this file.
echo "[pipeline] $(date -u +%FT%TZ) train config: reading ds/final/model1_retrain.ipynb"
eval "$(python /app/nightly_config.py)" || {
  echo "[pipeline] $(date -u +%FT%TZ) train: cannot read the notebook config - aborting" >&2
  exit 1
}
echo "[pipeline]   half-life=${RECENCY_HALF_LIFE_DAYS}d window=${TREND_WINDOW_DAYS}d collection=${MONGO_COLLECTION} exclude=${SOURCE_EXCLUDE} unified=${TRAIN_USE_UNIFIED}"

echo "[pipeline] $(date -u +%FT%TZ) train: starting"
python /app/train.py
train_status=$?

# 4) Restart the DS container only when the new model was promoted (quality gate passed).
DS_CONTAINER="${DS_CONTAINER:-careerlens-ds}"
if [ "$train_status" -eq 0 ]; then
  echo "[pipeline] $(date -u +%FT%TZ) restarting DS container: ${DS_CONTAINER}"
  docker restart "${DS_CONTAINER}"
else
  echo "[pipeline] $(date -u +%FT%TZ) train not promoted (exit=$train_status) - skipping DS restart"
fi

echo "[pipeline] $(date -u +%FT%TZ) done"
