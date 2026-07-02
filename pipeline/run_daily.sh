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

# 1) Scrape last 24h of LinkedIn jobs into Mongo (jobs.jobs) + local jsonl backups.
echo "[pipeline] $(date -u +%FT%TZ) scrape: starting"
python /app/linkedin.py

# 2) Retrain from Mongo, writing model.joblib + canonical_titles.json to the shared
#    volume (MODEL_OUT_DIR=/models) that the DS service reads on (re)start.
echo "[pipeline] $(date -u +%FT%TZ) train: starting"
python /app/train.py

# 3) Restart the DS container so it loads the freshly trained model.
DS_CONTAINER="${DS_CONTAINER:-careerlens-ds}"
echo "[pipeline] $(date -u +%FT%TZ) restarting DS container: ${DS_CONTAINER}"
docker restart "${DS_CONTAINER}"

echo "[pipeline] $(date -u +%FT%TZ) done"
