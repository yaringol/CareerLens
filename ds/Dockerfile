FROM python:3.11-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --user -r requirements.txt
RUN python -m spacy download en_core_web_lg

FROM python:3.11-slim AS runner
WORKDIR /app
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
COPY ./src /app/src
COPY ./model/model.joblib ./model/server.py ./model/train.py /app/
COPY ./docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

# Entrypoint seeds the model volume on first boot, then runs uvicorn. Override the model
# location via MODEL_PATH / CANONICAL_TITLES_PATH (set to the volume in docker-compose).
ENTRYPOINT ["/app/docker-entrypoint.sh"]
