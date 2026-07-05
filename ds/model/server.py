import os
import re
import logging
import json
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel, field_validator
import joblib
import uvicorn

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from sentence_transformers import SentenceTransformer

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

# CV->title classifier - trained by train_cv_classifier.py directly on the 59
# canonical titles (see taxonomy.py), plus an OTHER_LABEL rejection class for
# non-engineering CVs that is never returned to callers.
cv_to_title_model = joblib.load(f'{os.path.dirname(__file__)}/text_to_job_title_classifier.joblib')

from taxonomy import OTHER_LABEL
from skill_schema import select_display_skills

SKILL_TOP_POOL = int(os.getenv('SKILL_TOP_POOL', '10'))
SKILL_TOP_DISPLAY = int(os.getenv('SKILL_TOP_DISPLAY', '5'))

# Title-string normalizer (NEW.ipynb): sentence-embedding centroids over the 59
# canonical titles, for classifying a short extracted title phrase - a different
# use case from cv_to_title_model, which classifies a full CV body. See
# docs/ds-models for why char n-gram matching was replaced with this (69% -> 93%
# on held-out title strings).
TITLE_NORMALIZER_PATH = os.getenv(
    'TITLE_NORMALIZER_PATH', f'{os.path.dirname(__file__)}/title_normalizer.joblib'
)
title_normalizer = joblib.load(TITLE_NORMALIZER_PATH)
title_encoder = SentenceTransformer(title_normalizer['encoder_name'])
title_centroids = title_normalizer['centroids']
title_labels = title_normalizer['labels']

# Below this cosine similarity, the normalizer's held-out calibration (NEW.ipynb)
# showed accuracy dropping into the 60-80% range with too little data to trust
# further - treat the extracted phrase as unresolved rather than guess.
TITLE_NORMALIZER_ACCEPT_SIM = 0.55

def _title_similarities(candidate: str):
    vec = title_encoder.encode([candidate], normalize_embeddings=True)
    return (vec @ title_centroids.T)[0]

def normalize_title_semantic_topk(candidate: str, k: int = 3):
    """Top-k nearest centroids for a short title phrase, most similar first."""
    sims = _title_similarities(candidate)
    idx_sorted = np.argsort(-sims)[:k]
    return [(title_labels[i], float(sims[i])) for i in idx_sorted]

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

# ── Title extraction: candidate lines scored by the same embedding model ──────
#
# Earlier version: a hand-written keyword list decided "does this line look like
# a title" (_ROLE_KEYWORDS/_looks_like_title), before a separate semantic-model
# step normalized whatever passed the gate. That keyword list needed patching
# twice during E2E testing - once for a substring bug ("cloud" matching inside
# "Cloudscale"), once because titles like "Cryptographer"/"Digital Forensics"
# shared no word with the hand-picked list at all - and a naive fix (deriving
# keywords from all 59 canonical titles) immediately reintroduced false
# positives from generic words ("systems", "platform", "go"). A hand-curated
# keyword gate is fundamentally the wrong tool here.
#
# This replaces that gate with the same nearest-centroid model used for
# normalization: candidate lines/phrases from the header are embedded and
# scored by how close they land to ANY of the 59 canonical centroids. A real
# title lands close to at least one; a company name, date range, or contact
# line lands far from all of them. One model does both "is this a title" and
# "which title" - no keyword list to maintain, and it degrades gracefully as
# the 59-title taxonomy changes. This mirrors how commercial resume parsers
# (e.g. Sovren) treat title extraction as a scored/probabilistic candidate
# selection rather than a deterministic rule, and the general "extract several
# candidates, let a classifier arbitrate" pattern from resume-parsing research.
#
# header_text (see /cv/title below) is a small, separately-preserved slice of
# the CV's ORIGINAL first lines - real line breaks, original case/punctuation -
# supplied by the backend specifically because the CV body text used elsewhere
# has already been flattened to a single line and lowercased for other
# purposes. Without real line breaks, candidate lines cannot be recovered at
# all; when header_text is absent, this falls back to deriving lines from
# cv_text directly (works only if the caller already preserved line breaks -
# e.g. a raw text paste - not a fix for already-flattened text).
_CANDIDATE_MAX_LINES = 8
_CANDIDATE_MAX_WORDS = 6
_CANDIDATE_MAX_CHARS = 60

# Splits a header line on common title/company/date separators so that either
# ordering - "Title | Company" or "Company | Title | Dates" - produces the
# title as one of the resulting segments; the embedding score (not word order)
# decides which segment, if any, actually is the title.
_PIPE_SPLIT_RE = re.compile(r'\s*[|·]\s*|\s+\bat\b\s+', re.IGNORECASE)
_PIPE_AND_COMMA_SPLIT_RE = re.compile(r'\s*[|·,]\s*|\s+\bat\b\s+', re.IGNORECASE)

def _split_line_into_segments(line: str) -> list:
    """
    Comma is only trustworthy as a title/company separator ("Senior Engineer,
    Acme Corp") when the line has exactly one - a tech-stack list embedded in a
    summary sentence ("Kubernetes, Terraform, and multi-cloud architectures for
    a 200-person org.") has several, and splitting on every comma there shreds
    it into single buzzwords. Found via debugging a real false positive: the
    lone word "Kubernetes" scored 80.5% similarity against "Kubernetes
    Engineer" - well above the UI's auto-accept bar - despite never being a
    title. A line ending in sentence punctuation is prose, never "Title,
    Company", regardless of comma count, so comma-splitting is skipped there too.
    """
    is_prose = line.rstrip().endswith(('.', '?', '!'))
    if not is_prose and line.count(',') == 1:
        return [p.strip() for p in _PIPE_AND_COMMA_SPLIT_RE.split(line) if p.strip()]
    return [p.strip() for p in _PIPE_SPLIT_RE.split(line) if p.strip()]

# Contact-info lines (email/phone/URL) are cheap to rule out and frequently sit
# right above or below the title in a header block.
_CONTACT_LINE_RE = re.compile(r'@|https?://|\+?\d[\d\-\s()]{7,}\d')

# Bullet points ("- Built X", "• Owned Y") can land inside the header region on
# short/dense CVs - these describe an action, not a title.
_BULLET_LINE_RE = re.compile(r'^[\-\*•●▪·]\s')

# Generic resume section headers ("Work Experience", "Summary", ...) are boilerplate,
# not a judgment call - harmless if scored (the similarity gate rejects them, seen
# in testing), but filtering them here avoids wasting an embedding call on a candidate
# that can never be a title.
_SECTION_HEADER_RE = re.compile(
    r'^(work\s+)?experience$|^(professional\s+)?summary$|^education$|^skills?$|'
    r'^projects?$|^certifications?$|^objective$|^profile$|^contact(\s+info)?$',
    re.IGNORECASE,
)

def _is_noise_line(line: str) -> bool:
    return bool(
        _CONTACT_LINE_RE.search(line)
        or _BULLET_LINE_RE.match(line)
        or _SECTION_HEADER_RE.match(line.strip())
    )

def _merge_wrapped_lines(lines: list) -> list:
    """
    PDF text extraction can't reliably tell a real line break from a soft
    line-wrap - a summary sentence that happens to wrap produces a short
    trailing physical line ("cloud-native operations.") that passes every
    length/word-count filter and looks exactly like a valid header candidate,
    scoring deceptively high on whichever buzzword it contains. It also defeats
    the comma/period prose-detection in _split_line_into_segments, since the
    wrap can leave the fragment's own trailing comma or period on a different
    physical line entirely. Found via testing real PDF uploads (not synthetic
    text), where two independent CVs both misfired this way after the earlier
    comma-splitting fix closed the previous hole.
    A genuine header/title line is a label - labels don't start with a
    lowercase word. A wrapped sentence continuation, by definition, picks up
    mid-sentence and does. That's a cheap, reliable signal to fold a line back
    onto the previous one (reconstructing the real sentence, with its real
    length and real terminal punctuation) before any candidate filtering ever
    sees it, rather than special-casing each new wrap shape that slips through.
    """
    merged = []
    for line in lines:
        # Don't fold an independently-structural line (contact info, bullet,
        # section header) into the previous one just because it happens to
        # start lowercase - emails routinely do ("maya.chen@email.com"). Found
        # immediately by regression testing: without this guard, a contact
        # line silently swallowed the genuine title line right above it (the
        # merged "Title maya.chen@email.com" then got discarded as noise for
        # containing "@", destroying a perfectly good candidate). Only fold
        # genuine prose continuations, never a line that's independently
        # recognizable as its own kind of noise.
        if merged and line[:1].islower() and not _is_noise_line(line):
            merged[-1] = f'{merged[-1]} {line}'.strip()
        else:
            merged.append(line)
    return merged

def _candidate_phrases(cv_text: str, header_text: Optional[str] = None) -> list:
    """Returns (phrase, line_index) pairs - line_index feeds best_title_candidate's
    positional tie-break (a title declared at the very top outranks a same-scoring
    phrase found further down, e.g. inside a summary sentence)."""
    source = header_text if header_text else cv_text
    lines = [ln.strip() for ln in source.splitlines() if ln.strip()]
    lines = _merge_wrapped_lines(lines)
    lines = lines[:_CANDIDATE_MAX_LINES]

    candidates, seen = [], set()
    for line_idx, line in enumerate(lines):
        if len(line) > 120 or _is_noise_line(line):
            continue
        pieces = [line] + _split_line_into_segments(line)
        for piece in pieces:
            if not (0 < len(piece) <= _CANDIDATE_MAX_CHARS):
                continue
            words = piece.split()
            if not (1 <= len(words) <= _CANDIDATE_MAX_WORDS):
                continue
            key = piece.lower()
            if key in seen:
                continue
            seen.add(key)
            candidates.append((piece, line_idx))
    return candidates

# Seniority/employment-type words are a small, closed, universally-recognized
# vocabulary - unlike the "is this a title" gate (moved off keyword-matching
# after two false-positive bugs: substrings inside company names, and generic
# words like "systems"/"platform"), there's no equivalent collision risk here:
# "senior"/"junior"/"freelance" don't appear as substrings of real job titles.
# Stripping them (a) makes the displayed title cleaner ("Middle/Senior React
# Developer" -> "React Developer"), and (b) very slightly firms up the
# embedding score by removing noise words that carry no title-identifying
# signal - seniority prefixes alone rarely flip which centroid wins, but
# cleaning first is free and can only help.
_SENIORITY_RE = re.compile(
    r'\b(?:principal|staff|head\s+of|director|vp|senior|sr\.?|lead|'
    r'mid-level|middle|mid|junior|jr\.?|intern)\b',
    re.IGNORECASE,
)
_EMPLOYMENT_TYPE_RE = re.compile(
    r'\b(?:freelance|contract|part-time|full-time|temporary|remote|hybrid|on-?site)\b',
    re.IGNORECASE,
)

def _clean_title_phrase(phrase: str):
    """Returns (clean_phrase, seniority_terms_found) - strips seniority and
    employment-type words, collapsing any separators ('/', ',', '-') they leave
    behind. Falls back to the original phrase if cleaning empties it out."""
    seniority, seen = [], set()
    for m in _SENIORITY_RE.finditer(phrase):
        term = m.group(0)
        if term.lower() not in seen:
            seen.add(term.lower())
            seniority.append(term)

    clean = _EMPLOYMENT_TYPE_RE.sub(' ', _SENIORITY_RE.sub(' ', phrase))
    clean = re.sub(r'[/,\-]+', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip(' /,-')
    return (clean or phrase), seniority

# A tie-break, not a ranking override: found via testing that a genuine header
# title ("Middle/Senior React Developer" -> cleaned "React Developer", 0.599
# similarity to Frontend Developer) can be narrowly outscored by an incidental
# phrase further down ("Freelance frontend work for 4 years." literally
# contains the word "frontend", scoring 0.631) - the same ambiguity the
# original plan doc calls out ("prefer the header title... it may represent
# the candidate's target role"). This nudges early-line candidates just enough
# to win near-ties without letting position override a real gap in similarity.
_POSITION_BONUS = 0.03

def best_title_candidate(candidates: list):
    """
    Cleans (strips seniority/employment-type words) and batch-embeds every
    header-line candidate, returning whichever lands closest to any of the 59
    canonical centroids - one pass does both candidate SELECTION ("is this a
    title") and NORMALIZATION ("which title"). `candidates` is a list of
    (phrase, line_index) pairs from _candidate_phrases.
    Returns (raw_text, clean_text, seniority_terms, canonical_title, similarity)
    or (None, None, [], None, 0.0). The returned similarity is the model's raw
    score (unadjusted) - the positional nudge only affects which candidate wins,
    not the confidence reported for it.
    """
    if not candidates:
        return None, None, [], None, 0.0
    phrases = [p for p, _ in candidates]
    cleaned = [_clean_title_phrase(p) for p in phrases]
    clean_texts = [c for c, _ in cleaned]
    vecs = title_encoder.encode(clean_texts, normalize_embeddings=True)
    sims = vecs @ title_centroids.T  # (n_candidates, 59)
    best_label_idx = np.argmax(sims, axis=1)
    best_sim = sims[np.arange(len(candidates)), best_label_idx]
    position_bonus = np.array([
        _POSITION_BONUS * (1 - line_idx / _CANDIDATE_MAX_LINES) for _, line_idx in candidates
    ])
    winner = int(np.argmax(best_sim + position_bonus))
    clean_text, seniority = cleaned[winner]
    return phrases[winner], clean_text, seniority, title_labels[best_label_idx[winner]], float(best_sim[winner])

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
    vec = vectorizer.transform([title])
    _, indices = knn.kneighbors(vec)
    idx = indices[0][0]
    matched_canonical = titles_data[idx]
    feats = feature_matrix.get(matched_canonical, {})
    rc = canonical_data.get('record_counts', {}).get(matched_canonical, 0)

    n = max(1, min(top_n, SKILL_TOP_DISPLAY))
    ranked = select_display_skills(
        feats,
        pool_size=SKILL_TOP_POOL,
        display_count=n,
        fallback=skills_data[idx],
    )

    return {
        "matched_canonical": matched_canonical,
        "data_confidence": confidence_level(rc),
        "records_count": rc,
        "suggested_skills": [r['skill'] for r in ranked],
        "skills": ranked,
        "ranking": {
            "pool_size": SKILL_TOP_POOL,
            "display_count": n,
            "primary_metric": "prevalence",
            "secondary_metric": "stability_score",
        },
        "trained_at": model_trained_at,
    }

def classify_cv_role_with_other_mass(text: str):
    """Full-CV-body classifier ranking + raw OTHER_LABEL probability, shared by
    /cv/role and the /cv/title ladder (the latter also uses other_mass as a veto
    on the title-extraction path - see extract_and_normalize_title)."""
    probabilities = cv_to_title_model.predict_proba([text])[0]
    class_labels = cv_to_title_model.classes_

    # The classifier predicts the canonical 59-title space directly, plus the
    # OTHER_LABEL rejection class ("not an engineering CV"). OTHER_LABEL is
    # filtered out here: when it held most of the probability mass, the surviving
    # top-3 renormalise to low shares, which is exactly the low-confidence signal
    # that routes the request to the backend's LLM fallback.
    ranked = sorted(zip(class_labels, probabilities), key=lambda lp: -lp[1])
    ranked = [(label, prob) for label, prob in ranked if str(label) != OTHER_LABEL][:3]

    # Renormalise the shortlist to sum to 100%. The raw softmax mass is spread
    # across all classes, so a correct top-1 is often only 15-40% - too low for
    # a meaningful UI threshold. The renormalised "share" expresses how dominant
    # the top guess is among the real candidates and behaves like a confidence.
    # NOTE: probabilities are NOT renormalised after dropping OTHER_LABEL - its
    # mass must keep deflating the top-3 shares, that's the rejection signal.
    total = sum(float(p) for _, p in ranked) or 1.0
    other_mass = float(probabilities[list(class_labels).index(OTHER_LABEL)]) \
        if OTHER_LABEL in class_labels else 0.0
    total = total + other_mass

    candidates = [
        {
            "job_title": str(label),           # detected canonical title
            "canonical_title": str(label),     # same space now - kept for API compat
            "confidence": round(float(prob) / total * 100, 2),  # normalised share
            "raw_confidence": round(float(prob) * 100, 2),      # raw softmax prob
        }
        for label, prob in ranked
    ]
    return candidates, other_mass

def classify_cv_role(text: str) -> list:
    candidates, _ = classify_cv_role_with_other_mass(text)
    return candidates

@app.get("/cv/role")
def match_role_to_cv(text: str):
    return classify_cv_role(text)

def _sanitize_text(value: Optional[str]) -> Optional[str]:
    """
    Drops lone/unpaired UTF-16 surrogate codepoints - a real artifact of broken
    font-encoding tables in design-heavy, non-standard-template PDFs (icon
    fonts, custom symbol substitutions). Python happily holds such a string in
    memory, but the tokenizer underneath sentence-transformers cannot convert
    it to a native string and raises a raw TypeError - found via adversarial
    testing, not a hypothetical: an unpaired surrogate in the header 500'd the
    whole request before this existed. encode/decode with errors='ignore' is
    the standard way to silently drop exactly (and only) the unrepresentable
    characters while leaving the rest of the text untouched.
    """
    if value is None:
        return None
    return value.encode('utf-8', errors='ignore').decode('utf-8')

class CvTitleRequest(BaseModel):
    text: str
    header_text: Optional[str] = None

    @field_validator('text', 'header_text')
    @classmethod
    def _strip_lone_surrogates(cls, v):
        return _sanitize_text(v)

# Below this normalised confidence (0-100), the classifier fallback itself is
# unreliable - matches the backend's default TITLE_LLM_FALLBACK_THRESHOLD so a
# direct caller of this endpoint (not going through detectTitleFromCv) still
# gets an honest low_confidence signal.
CLASSIFIER_FALLBACK_LOW_CONFIDENCE = 55.0

# The semantic title normalizer has no rejection class of its own - it is
# trained only on the 59 engineering titles, so it will confidently force ANY
# short phrase into its nearest centroid (e.g. "Digital Marketing Manager" ->
# "Product Manager" at ~59% similarity). The full-CV-body classifier's
# OTHER_LABEL is the only signal that actually knows "not an engineering CV",
# so it vetoes an extraction win whenever it alone thinks that is more likely
# than not - verified against a real Digital-Marketing-Manager CV during testing.
OTHER_LABEL_VETO_THRESHOLD = 0.5

@app.post("/cv/title")
def extract_and_normalize_title(payload: CvTitleRequest):
    """
    Title-detection ladder for the beginning of a CV:
      1. gather header-line candidates (from header_text - the CV's preserved
         original first lines - falling back to cv_text's own lines if absent)
         and score every candidate by embedding similarity to the 59 canonical
         centroids (best_title_candidate) - one model both selects AND
         normalizes, replacing a hand-written keyword gate
      2. accept the winner only above TITLE_NORMALIZER_ACCEPT_SIM, and only if
         the body classifier doesn't itself think this is a non-engineering CV
         (OTHER_LABEL_VETO_THRESHOLD)
      3. otherwise fall back to the full-CV-body classifier (classify_cv_role)
    The backend's LLM fallback (closed-list, 59 titles) is the next rung when
    even this is low-confidence - that step lives in dsModel.ts, not here.
    """
    cv_text = payload.text
    classifier_candidates, other_mass = classify_cv_role_with_other_mass(cv_text)
    candidates = _candidate_phrases(cv_text, payload.header_text)
    raw_extracted, clean_extracted, seniority, canonical, sim = best_title_candidate(candidates)

    if raw_extracted and other_mass < OTHER_LABEL_VETO_THRESHOLD:
        if sim >= TITLE_NORMALIZER_ACCEPT_SIM:
            confidence = round(sim * 100, 2)
            alternatives = [c for c in classifier_candidates if c["canonical_title"] != canonical]
            response_candidates = [{
                "job_title": clean_extracted,
                "canonical_title": canonical,
                "confidence": confidence,
                "raw_confidence": confidence,
            }] + alternatives
            return {
                "extracted_title": clean_extracted,
                "raw_title": raw_extracted,
                "seniority": seniority,
                "canonical_title": canonical,
                "confidence": confidence,
                "low_confidence": False,
                "source": "title_extraction",
                "candidates": response_candidates[:3],
            }

    top = classifier_candidates[0] if classifier_candidates else None
    return {
        "extracted_title": clean_extracted,
        "raw_title": raw_extracted,
        "seniority": seniority,
        "canonical_title": top["canonical_title"] if top else None,
        "confidence": top["confidence"] if top else 0.0,
        "low_confidence": (top["confidence"] if top else 0.0) < CLASSIFIER_FALLBACK_LOW_CONFIDENCE,
        "source": "cv_classifier",
        "candidates": classifier_candidates,
    }

@app.get("/title/normalize")
def normalize_title(title: str):
    """
    Map a short, already-title-shaped free-text string (e.g. a manually typed
    "Sr. SWE" or "Full Stack Dev II") to the nearest of the 59 canonical titles
    via sentence-embedding nearest-centroid (title_normalizer.joblib) - the
    same model the /cv/title ladder uses on its extracted candidate. This is
    NOT for full CV text: do not send a CV body here, use POST /cv/title,
    which runs its own header-extraction step before calling this same
    centroid lookup. Replaces the old char n-gram KNN (measured at 69% vs this
    model's 93% on held-out title strings - see NEW.ipynb).
    """
    matches = normalize_title_semantic_topk(title, k=3)
    return {
        "suggestions": [
            {
                "canonical_title": canonical,
                "matched_variant": title,
                "confidence": round(sim * 100, 2),
            }
            for canonical, sim in matches
        ]
    }

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
    `stability_score` (0..1, 0=flat/stable, 1=steep/trendy) and `growth_trend` (-1..1) are
    fit from per-posting datePosted monthly buckets within the training run (see train.py's
    compute_stability_features) - `time_features_reliable=False` when the title/skill has
    fewer than MIN_RELIABLE_MONTHS distinct months of data, in which case both default to a
    neutral midpoint rather than a misleading number.
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
                "skill":                   s,
                "prevalence":              round(float(f.get('prevalence', 0.0)), 4),
                "recent_prevalence":       round(float(f.get('recent_prevalence', 0.0)), 4),
                "trend":                   f.get('trend', 'stable'),
                "growth_trend":            round(float(f.get('growth_trend', 0.0)), 4),
                "stability_score":         round(float(f.get('stability_score', 0.5)), 4),
                "time_features_reliable":  bool(f.get('time_features_reliable', False)),
            }
            for s, f in ranked
        ]
    else:
        skills = [
            {
                "skill": s, "prevalence": None, "recent_prevalence": None, "trend": "stable",
                "growth_trend": 0.0, "stability_score": 0.5, "time_features_reliable": False,
            }
            for s in skills_data[idx][:n]
        ]

    return {
        "matched_canonical": matched_canonical,
        "data_confidence":   confidence_level(rc),
        "records_count":     rc,
        "skills":            skills,
        "ranking": {
            "pool_size": SKILL_TOP_POOL,
            "display_count": n,
            "primary_metric": "prevalence",
            "secondary_metric": "stability_score",
        },
        "trained_at":        model_trained_at,
    }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logging.info("server is starting")
    uvicorn.run(app, host="0.0.0.0", port=8000)