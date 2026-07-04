FROM python:3.11-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# --extra-index-url pulls the CPU-only torch build (a few hundred MB) instead of
# the multi-GB CUDA default — this service never runs on GPU.
RUN pip install --no-cache-dir --user \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt
RUN python -m spacy download en_core_web_lg
# Bake the title-normalizer's sentence-transformer weights into the image so the
# container never needs network access to Hugging Face at runtime/startup.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

FROM python:3.11-slim AS runner
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY --from=builder /root/.cache/huggingface /root/.cache/huggingface
ENV PATH=/root/.local/bin:$PATH
COPY ./src /app/src
# taxonomy.py is imported by both server.py and train.py; the CV->title classifier
# and title_normalizer joblibs are loaded by server.py at startup — all must ship
# with the image.
COPY ./model/model.joblib ./model/canonical_titles.json \
     ./model/text_to_job_title_classifier.joblib \
     ./model/title_normalizer.joblib \
     ./model/server.py ./model/train.py ./model/taxonomy.py /app/
COPY ./docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

# Entrypoint seeds the model volume on first boot, then runs uvicorn. Override the model
# location via MODEL_PATH / CANONICAL_TITLES_PATH (set to the volume in docker-compose).
ENTRYPOINT ["/app/docker-entrypoint.sh"]
