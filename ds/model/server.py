import os
import re
import logging
import json
from typing import Optional
from fastapi import FastAPI
import joblib
import uvicorn

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

import numpy as np

import spacy
from spacy.matcher import PhraseMatcher
from skillNer.general_params import SKILL_DB
from skillNer.skill_extractor_class import SkillExtractor

nlp = spacy.load("en_core_web_lg")
skill_extractor = SkillExtractor(nlp, SKILL_DB, PhraseMatcher)

app = FastAPI()

# MODEL_PATH / CANONICAL_TITLES_PATH point at the shared model volume in the deploy
# image, so a container restart picks up a freshly-trained model.
MODEL_PATH = os.getenv('MODEL_PATH', f'{os.path.dirname(__file__)}/model.joblib')
artifacts = joblib.load(MODEL_PATH)
vectorizer = artifacts['vectorizer']
knn = artifacts['knn_model']
skills_data = artifacts['skills']
titles_data = artifacts['titles']            # canonical title per variant row
variant_titles = artifacts['variant_titles'] # variant phrase per row (parallel to titles_data)
feature_matrix = artifacts.get('feature_matrix', {})   # recency-weighted prevalence + trend (if trained)
model_trained_at = artifacts.get('trained_at')

cv_to_title_model = joblib.load(f'{os.path.dirname(__file__)}/text_to_job_title_classifier.joblib')

from label_map import to_supported_title

# Optional per-role record counts / confidence (written by train.py alongside model.joblib).
_canonical_json = os.getenv(
    'CANONICAL_TITLES_PATH', f'{os.path.dirname(__file__)}/canonical_titles.json'
)
try:
    with open(_canonical_json, encoding='utf-8') as _f:
        canonical_data = json.load(_f)
except FileNotFoundError:
    canonical_data = {'record_counts': {}, 'confidence_levels': {}}

def confidence_level(n: int) -> str:
    if n >= 100: return 'high'
    if n >= 50:  return 'medium'
    return 'low'

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)

# ── Title extraction (regex + keyword fallback, no PDF dependency) ────────────
_ROLE_KEYWORDS = {
    'engineer', 'developer', 'analyst', 'manager', 'scientist',
    'designer', 'devops', 'architect', 'lead', 'director',
    'specialist', 'consultant', 'researcher', 'qa', 'tester',
    'product', 'frontend', 'backend', 'fullstack', 'data',
    'machine learning', 'ml', 'cloud', 'security',
}

_TITLE_PATTERNS = [
    r'^([A-Za-z][A-Za-z\s/\-\.&]{3,50}?)\s*[|·,]\s*(?:[A-Z][a-z]|\d{4})',
    r'(?:current role|position|title|role)\s*[:\-]\s*([A-Za-z][A-Za-z\s/\-\.]{3,50})',
    r'^([A-Za-z][A-Za-z\s/\-\.]{3,50}?)\s+at\s+[A-Z]',
]

def _looks_like_title(text: str) -> bool:
    words = text.lower().split()
    return any(kw in ' '.join(words) for kw in _ROLE_KEYWORDS)

def extract_title_from_cv(cv_text: str) -> Optional[str]:
    for line in cv_text.splitlines():
        line = line.strip()
        if not line or len(line) > 80:
            continue
        for pattern in _TITLE_PATTERNS:
            m = re.search(pattern, line, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip().title()
                if _looks_like_title(candidate):
                    return candidate
    for line in cv_text.splitlines():
        line = line.strip()
        if 2 <= len(line.split()) <= 5 and _looks_like_title(line):
            return line.title()
    return None

@app.get("/text/skills")
def predict_skills_from_text(text: str):
    try:
        annotations = skill_extractor.annotate(text)
        full_matches = annotations['results']['full_matches']
        ngram_matches = annotations['results']['ngram_scored']
        
        skills = { "full_matches": full_matches, "ngram_matches": ngram_matches }
        return json.loads(json.dumps(skills, ensure_ascii=False, cls=NpEncoder))
    except:
        return {}

@app.get("/title/skills")
def predict_skills(title: str, top_n: int = 5):
    # 1. Vectorize input title
    vec = vectorizer.transform([title])

    # 2. Snap to the nearest role (n_neighbors=1)
    _, indices = knn.kneighbors(vec)
    matched_role = skills_data[indices[0][0]]

    # Skills are pre-sorted by aggregated score — take the top N.
    # Default 5 keeps existing callers (/analyze) unchanged; the
    # Personalization screen requests more so the user has a real choice.
    n = max(1, top_n)
    top = matched_role[:n]

    return {
        "suggested_skills": top
    }

@app.get("/cv/role")
def match_role_to_cv(text: str):
    probabilities = cv_to_title_model.predict_proba([text])[0]
    class_labels = cv_to_title_model.classes_

    ranked = sorted(zip(class_labels, probabilities), key=lambda lp: -lp[1])[:3]

    # Renormalise the shortlist to sum to 100%. The raw softmax mass is spread
    # across ~38 classes, so a correct top-1 is often only 15-40% — too low for
    # a meaningful UI threshold. The renormalised "share" expresses how dominant
    # the top guess is among the real candidates and behaves like a confidence.
    total = sum(float(p) for _, p in ranked) or 1.0

    return [
        {
            "job_title": str(label),                          # what was detected
            "canonical_title": to_supported_title(str(label)),  # title with skill data
            "confidence": round(float(prob) / total * 100, 2),  # normalised share
            "raw_confidence": round(float(prob) * 100, 2),      # raw softmax prob
        }
        for label, prob in ranked
    ]

@app.get("/title/match")
def match_title(title: str):
    # Map a free-text role to canonical model-supported titles via nearest
    # variant phrases (cosine KNN). Returns up to 3 *distinct* canonical titles.
    vec = vectorizer.transform([title])
    k = min(10, knn.n_samples_fit_)
    distances, indices = knn.kneighbors(vec, n_neighbors=k)

    suggestions = []
    seen = set()
    for dist, idx in zip(distances[0], indices[0]):
        canonical = titles_data[idx]
        if canonical in seen:
            continue
        seen.add(canonical)
        suggestions.append({
            "canonical_title": canonical,
            "matched_variant": variant_titles[idx],
            "confidence": round(float(1.0 - dist), 4),
        })
        if len(suggestions) == 3:
            break

    return {"suggestions": suggestions}

@app.get("/titles")
def list_titles():
    """All canonical roles the model supports (source of truth for seeding the backend)."""
    titles = canonical_data.get('canonical_titles')
    if not titles:
        seen, titles = set(), []
        for t in titles_data:
            if t not in seen:
                seen.add(t)
                titles.append(t)
    rc = canonical_data.get('record_counts', {})
    return {
        "titles": [
            {"title": t, "records_count": rc.get(t, 0), "data_confidence": confidence_level(rc.get(t, 0))}
            for t in titles
        ]
    }

@app.get("/title/trending-skills")
def trending_skills(title: str, n: int = 5):
    """
    Time-aware skills for a role (call before analyze). `prevalence` is recency-weighted at
    train time so ranking by it surfaces current demand; `trend` flags rising/stable/falling.
    Falls back to the plain pre-sorted skill list when the model has no time fields yet.
    """
    vec = vectorizer.transform([title])
    _, indices = knn.kneighbors(vec)
    idx = indices[0][0]
    matched_canonical = titles_data[idx]
    rc = canonical_data.get('record_counts', {}).get(matched_canonical, 0)

    feats = feature_matrix.get(matched_canonical, {})
    if feats:
        ranked = sorted(feats.items(), key=lambda kv: -kv[1].get('prevalence', 0.0))[:n]
        skills = [
            {
                "skill":             s,
                "prevalence":        round(float(f.get('prevalence', 0.0)), 4),
                "recent_prevalence": round(float(f.get('recent_prevalence', 0.0)), 4),
                "trend":             f.get('trend', 'stable'),
            }
            for s, f in ranked
        ]
    else:
        skills = [
            {"skill": s, "prevalence": None, "recent_prevalence": None, "trend": "stable"}
            for s in skills_data[idx][:n]
        ]

    return {
        "matched_canonical": matched_canonical,
        "data_confidence":   confidence_level(rc),
        "records_count":     rc,
        "skills":            skills,
        "trained_at":        model_trained_at,
    }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logging.info("server is starting")
    uvicorn.run(app, host="0.0.0.0", port=8000)