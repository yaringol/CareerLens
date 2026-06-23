import os
import logging
import json

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

artifacts = joblib.load(f'{os.path.dirname(__file__)}/model.joblib')
vectorizer = artifacts['vectorizer']
knn = artifacts['knn_model']
skills_data = artifacts['skills']
canonical_titles = artifacts['titles']
variant_titles = artifacts['variant_titles']
canonical_titles = artifacts['titles']
variant_titles = artifacts['variant_titles']

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)

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
def predict_skills(title: str):
    # 1. Vectorize input title
    vec = vectorizer.transform([title])

    # 2. Snap to the nearest POC role (n_neighbors=1)
    _, indices = knn.kneighbors(vec)
    matched_role = skills_data[indices[0][0]]

    # Skills are pre-sorted by aggregated score — take top 5 directly
    top_5 = matched_role[:5]

    return {
        "suggested_skills": top_5
    }

@app.get("/title/match")
def match_title(title: str):
    normalized_title = title.strip()
    if not normalized_title:
        return {"suggestions": []}

    vec = vectorizer.transform([normalized_title])
    distances, indices = knn.kneighbors(vec, n_neighbors=len(canonical_titles))

    suggestions = []
    seen_titles = set()
    for distance, index in zip(distances[0], indices[0]):
        canonical_title = canonical_titles[index]
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

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logging.info("server is starting")
    uvicorn.run(app, host="0.0.0.0", port=8000)
