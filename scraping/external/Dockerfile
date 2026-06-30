FROM python:3.11-alpine
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ./linkedin.py .
RUN python -m spacy download en_core_web_lg

CMD ["python", "linkedin.py"]
