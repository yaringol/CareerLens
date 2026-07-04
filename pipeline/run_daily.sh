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

# 3) Retrain from unified role_skill_observations -> model.joblib on shared volume.
echo "[pipeline] $(date -u +%FT%TZ) train: starting"
TRAIN_USE_UNIFIED="${TRAIN_USE_UNIFIED:-1}" \
SOURCE_WEIGHTS="${SOURCE_WEIGHTS:-linkedin:1.0,lang_uk:0.3}" \
UNIFIED_SKILLS_COLLECTION="${UNIFIED_SKILLS_COLLECTION:-role_skill_observations}" \
python /app/train.py
train_status=$?

# 4) Restart the DS container only when the new model was promoted (quality gate passed).
DS_CONTAINER="${DS_CONTAINER:-careerlens-ds}"
if [ "$train_status" -eq 0 ]; then
  echo "[pipeline] $(date -u +%FT%TZ) restarting DS container: ${DS_CONTAINER}"
  docker restart "${DS_CONTAINER}"
else
  echo "[pipeline] $(date -u +%FT%TZ) train not promoted (exit=$train_status) — skipping DS restart"
fi

echo "[pipeline] $(date -u +%FT%TZ) done"
