#!/bin/sh
set -e

# The DS service reads its model from the shared `model_data` volume (MODEL_DIR) so a
# container restart picks up whatever the nightly pipeline retrained. On first boot the
# volume is empty, so seed it from the image-baked model.
MODEL_DIR="${MODEL_DIR:-/models}"
mkdir -p "$MODEL_DIR"

if [ ! -f "$MODEL_DIR/model.joblib" ] && [ -f /app/model.joblib ]; then
  echo "[ds] seeding $MODEL_DIR/model.joblib from image-baked model"
  cp /app/model.joblib "$MODEL_DIR/model.joblib"
  if [ -f /app/canonical_titles.json ]; then
    cp /app/canonical_titles.json "$MODEL_DIR/canonical_titles.json"
  fi
fi

exec uvicorn server:app --host 0.0.0.0 --port 8000
