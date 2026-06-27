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

cv_to_title_model = joblib.load(f'{os.path.dirname(__file__)}/text_to_job_title_classifier.joblib')

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

@app.get("/cv/role")
def match_role_to_cv(text: str):
    probabilities = cv_to_title_model.predict_proba([text])[0]
    class_labels = cv_to_title_model.classes_
    
    results = [
        {
            "job_title": str(label), 
            "confidence": round(float(prob) * 100, 2)
        }
        for label, prob in zip(class_labels, probabilities)
    ]
    
    results.sort(key=lambda x: x['confidence'], reverse=True)
    top_3 = results[:3]
    return top_3

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logging.info("server is starting")
    uvicorn.run(app, host="0.0.0.0", port=8000)