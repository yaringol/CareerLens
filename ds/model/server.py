import os
import sys
import logging
import json

# cv_pipeline lives in ds/src — add ds/ to path so the import resolves correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.pipeline.cv_pipeline import extract_title_from_cv

from fastapi import FastAPI
import joblib
import uvicorn

from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

import numpy as np

import spacy
from spacy.matcher import PhraseMatcher
from skillNer.general_params import SKILL_DB
from skillNer.skill_extractor_class import SkillExtractor

# ── NLP init ──────────────────────────────────────────────────────────────────
nlp             = spacy.load("en_core_web_lg")
skill_extractor = SkillExtractor(nlp, SKILL_DB, PhraseMatcher)

app = FastAPI()

# ── Model loading ─────────────────────────────────────────────────────────────
artifacts      = joblib.load(f'{os.path.dirname(__file__)}/model.joblib')
vectorizer     = artifacts['vectorizer']
knn            = artifacts['knn_model']
skills_data    = artifacts['skills']           # list of sorted skill lists (backward compat)
variant_labels = artifacts['titles']           # canonical title per variant index
variant_titles = artifacts['variant_titles']
feature_matrix = artifacts.get('feature_matrix', {})

# ── Canonical titles metadata (created by DS-8, optional) ────────────────────
def confidence_level(n: int) -> str:
    if n >= 100: return 'high'
    if n >= 50:  return 'medium'
    return 'low'

_canonical_json = os.path.join(os.path.dirname(__file__), 'canonical_titles.json')
try:
    with open(_canonical_json, encoding='utf-8') as f:
        canonical_data = json.load(f)
except FileNotFoundError:
    canonical_data = {'record_counts': {}, 'confidence_levels': {}}

# ── Preferences schema ────────────────────────────────────────────────────────
class SkillPreferences(BaseModel):
    title_match: float = Field(default=0.0, ge=0.0, le=1.0)
    # default=0.0: backward compatible — identical to pre-feature-matrix model
    # trending / growth / stability removed — no temporal data in current dataset

# ── Ranking ───────────────────────────────────────────────────────────────────
def rank_skills(canonical_title: str, prefs: SkillPreferences | None = None, n: int = 5) -> list[str]:
    """
    score = 0.7 × prevalence + 0.3 × title_match × title_specificity
    prefs=None (default title_match=0.0) → pure prevalence → identical to old model.
    """
    p = prefs or SkillPreferences()

    if canonical_title not in feature_matrix:
        idx = next((i for i, t in enumerate(variant_labels) if t == canonical_title), 0)
        return skills_data[idx][:n]

    scored = [
        (skill, 0.7 * feats['prevalence'] + 0.3 * p.title_match * feats['title_specificity'])
        for skill, feats in feature_matrix[canonical_title].items()
    ]
    scored.sort(key=lambda x: -x[1])
    return [s for s, _ in scored[:n]]

# ── JSON encoder for numpy types ──────────────────────────────────────────────
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/text/skills")
def predict_skills_from_text(text: str):
    try:
        annotations  = skill_extractor.annotate(text)
        full_matches = annotations['results']['full_matches']
        ngram_matches = annotations['results']['ngram_scored']
        skills = {"full_matches": full_matches, "ngram_matches": ngram_matches}
        return json.loads(json.dumps(skills, ensure_ascii=False, cls=NpEncoder))
    except Exception:
        return {}


@app.get("/title/skills")
def predict_skills(title: str, title_match: float = 0.0):
    prefs = SkillPreferences(title_match=title_match)

    vec = vectorizer.transform([title])
    _, indices = knn.kneighbors(vec)
    matched_canonical = variant_labels[indices[0][0]]

    record_count = canonical_data['record_counts'].get(matched_canonical, 0)

    return {
        "suggested_skills": rank_skills(matched_canonical, prefs),
        "matched_canonical": matched_canonical,
        "data_confidence":   confidence_level(record_count),
        "records_count":     record_count,
    }

@app.get("/title/match")
def match_title(title: str):
    normalized_title = title.strip()
    if not normalized_title:
        return {"suggestions": []}

    vec = vectorizer.transform([normalized_title])
    distances, indices = knn.kneighbors(vec, n_neighbors=len(variant_labels))

    suggestions = []
    seen_titles = set()
    for distance, index in zip(distances[0], indices[0]):
        canonical_title = variant_labels[index]
        if canonical_title in seen_titles:
            continue
        seen_titles.add(canonical_title)
        suggestions.append({
            "canonical_title": canonical_title,
            "matched_variant": variant_titles[index],
            "confidence": round(max(0.0, 1.0 - float(distance)) * 100),
        })
        if len(suggestions) == 3:
            break

    return {"suggestions": suggestions}


class CvTitleRequest(BaseModel):
    text: str

@app.post("/cv/title")
def extract_cv_title(body: CvTitleRequest):
    extracted = extract_title_from_cv(body.text)

    if extracted is None:
        return {"extracted_title": None, "canonical_title": None,
                "confidence": 0.0, "low_confidence": True}

    vec = vectorizer.transform([extracted])
    distances, indices = knn.kneighbors(vec)
    confidence = float(1 - distances[0][0])
    canonical  = variant_labels[indices[0][0]]

    return {
        "extracted_title": extracted,
        "canonical_title": canonical,
        "confidence":      round(confidence, 2),
        "low_confidence":  confidence < 0.4,
    }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logging.info("server is starting")
    uvicorn.run(app, host="0.0.0.0", port=8000)
