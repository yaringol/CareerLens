# Daily batch image: scrape LinkedIn -> Mongo, retrain the model from Mongo, then
# restart the DS container so it loads the new model. Built on slim (not alpine) so
# scikit-learn installs from wheels. Build context is the repo root.
FROM python:3.11-slim
WORKDIR /app

# build-essential: safety net for any source builds; docker CLI: to restart the DS
# container at the end of the run via the mounted docker socket.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl ca-certificates \
    && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
        | tar -xz -C /usr/local/bin --strip-components=1 docker/docker \
    && apt-get purge -y curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY pipeline/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Reuse the exact scraper + trainer sources (single source of truth).
COPY scraping/external/linkedin.py /app/linkedin.py
COPY ds/model/train.py            /app/train.py
COPY pipeline/run_daily.sh        /app/run_daily.sh
RUN chmod +x /app/run_daily.sh

CMD ["/app/run_daily.sh"]
