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

from taxonomy import OTHER_LABEL, CANONICAL_TITLES
from skill_schema import select_display_skills, compute_role_counts
from skillner_utils import annotate_with_fallback

# Ubiquity map: how many of the 59 roles carry each skill. Skills present in
# almost every role (e.g. "backend" in 52/59) are generic posting language, not
# role signals, and are excluded from ranking by select_display_skills.
UBIQUITY_CAP = int(os.getenv('SKILL_UBIQUITY_CAP', '48'))
# On dense corpora presence-only counts saturate (every skill somewhere in every
# role); a prevalence floor keeps the ubiquity signal meaningful. 0.0 = legacy.
ROLE_COUNT_MIN_PREVALENCE = float(os.getenv('ROLE_COUNT_MIN_PREVALENCE', '0.0'))
skill_role_counts = compute_role_counts(
    feature_matrix, min_prevalence=ROLE_COUNT_MIN_PREVALENCE,
)


def recalibrate_trend_labels(matrix: dict) -> dict:
    """Re-label skill trends from the stored prevalence ratios, in memory.

    train.py labels trends with fixed ratio thresholds (rise >= 1.25,
    fall <= 0.80). On the served corpus the entire recent/overall ratio
    range sits inside (0.84, 1.23), so every one of the 60k skills was
    labeled 'stable' and /title/trending-skills could never answer. The
    artifact already stores both prevalences, so the labels can be
    recomputed at load time against the distribution that actually
    exists: rising = top quintile of ratios (and at least +5% movement),
    falling = bottom quintile (and at least -5%). The .joblib on disk is
    never modified.
    """
    ratios = []
    for skills in matrix.values():
        for f in skills.values():
            p, rp = f.get('prevalence') or 0, f.get('recent_prevalence')
            if p > 0 and rp is not None and rp > 0:
                ratios.append(rp / p)
    if len(ratios) < 100:
        return {'relabeled': False, 'reason': f'only {len(ratios)} usable ratios'}

    ratios.sort()
    rise_cut = max(ratios[int(len(ratios) * 0.80)], 1.05)
    fall_cut = min(ratios[int(len(ratios) * 0.20)], 0.95)

    counts = {'rising': 0, 'stable': 0, 'falling': 0}
    for skills in matrix.values():
        for f in skills.values():
            p, rp = f.get('prevalence') or 0, f.get('recent_prevalence')
            if p > 0 and rp is not None and rp > 0:
                ratio = rp / p
                label = 'rising' if ratio >= rise_cut else 'falling' if ratio <= fall_cut else 'stable'
            else:
                label = 'stable'
            f['trend'] = label
            counts[label] += 1
    return {'relabeled': True, 'rise_cut': round(rise_cut, 4),
            'fall_cut': round(fall_cut, 4), 'counts': counts}


TREND_RECALIBRATION = recalibrate_trend_labels(feature_matrix)
print(f"[server] trend recalibration: {TREND_RECALIBRATION}")

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

# ── Agreement signal (M19): skills->title router as a second opinion ───────────
# Measured on the authentic-CV set: when the text path and the skills path agree
# the joint accuracy is ~87%, on disagreement ~50% - so agreement boosts
# confidence past the LLM-fallback threshold and disagreement (or an __other__
# rejection) caps it below, routing the CV to the existing closed-list LLM rung.
# A declared-title hit above DISAGREEMENT_OVERRIDE_MAX is never overridden: the
# router only covers 24 of 59 roles and must not out-vote a confident header.
AGREEMENT_SIGNAL_ENABLED = os.getenv('AGREEMENT_SIGNAL_ENABLED', '0').lower() in ('1', 'true', 'yes')
AGREEMENT_BOOST_CONFIDENCE = float(os.getenv('AGREEMENT_BOOST_CONFIDENCE', '87'))
DISAGREEMENT_OVERRIDE_MAX = float(os.getenv('DISAGREEMENT_OVERRIDE_MAX', '85'))
DISAGREEMENT_CONFIDENCE_CAP = float(os.getenv('DISAGREEMENT_CONFIDENCE_CAP', '50'))
# Above this confidence the signal is provably a no-op: the agree branch only
# lifts to AGREEMENT_BOOST_CONFIDENCE (max() leaves a higher value alone) and the
# disagree/rejects branch is gated on base < DISAGREEMENT_OVERRIDE_MAX. Running
# the check anyway costs a full SkillNer pass (measured 1.2-7.4s, M05 step 3),
# which pushed /cv/role past the backend's DS timeout and returned 503s on the
# headerless path. Short-circuiting here is behaviour-preserving by construction.
SIGNAL_NO_OP_ABOVE = max(AGREEMENT_BOOST_CONFIDENCE, DISAGREEMENT_OVERRIDE_MAX)
SIGNAL_SKIPPED = {
    'agreement': 'skipped_high_confidence',
    'skills_model_title': None,
    'skills_model_confidence': None,
}
SKILLS_ROUTER_PATH = os.getenv(
    'SKILLS_ROUTER_PATH', f'{os.path.dirname(__file__)}/skills_to_24_plus_other.joblib'
)
skills_router = None
if AGREEMENT_SIGNAL_ENABLED:
    try:
        skills_router = joblib.load(SKILLS_ROUTER_PATH)
        print(f"[server] agreement signal ON: router "
              f"{skills_router.get('trained_at')} "
              f"({len(skills_router['label_encoder'].classes_)} classes)")
    except Exception as exc:  # missing/corrupt artifact must never block startup
        print(f"[server] agreement signal DISABLED (router load failed: {exc})")
        skills_router = None
else:
    print("[server] agreement signal off (AGREEMENT_SIGNAL_ENABLED != 1)")

# The router was trained on skills with canonical-title names removed (leakage
# guard); serving must filter identically or the feature distribution drifts.
_LEAK_SKILLS = {t.lower() for t in CANONICAL_TITLES} | {t.lower() + 's' for t in CANONICAL_TITLES}


def agreement_check(base_canonical, cv_text: str):
    """Second opinion from the skills router. Returns None when the signal is
    off/unavailable (callers treat None as fully neutral)."""
    if skills_router is None or not cv_text:
        return None
    try:
        raw = annotate_with_fallback(skill_extractor, cv_text[:20000])
        skills = set()
        for m in raw.get('full_matches', []):
            v = (m.get('doc_node_value') or '').lower().strip()
            if len(v) >= 3 and v not in _LEAK_SKILLS:
                skills.add(v)
        for m in raw.get('ngram_matches', []):
            v = (m.get('doc_node_value') or '').lower().strip()
            if len(v) >= 3 and float(m.get('score', 0)) >= 0.9 and v not in _LEAK_SKILLS:
                skills.add(v)
        if len(skills) < 3:
            return {'agreement': 'no_skills', 'skills_model_title': None,
                    'skills_model_confidence': 0.0}
        le = skills_router['label_encoder']
        proba = skills_router['model'].predict_proba(
            skills_router['vectorizer'].transform([skills]))[0]
        idx = int(proba.argmax())
        pred, conf = str(le.classes_[idx]), float(proba[idx])
        covered = {str(c) for c in le.classes_} - {OTHER_LABEL}
        # Soft agreement: the ladder's answer counting anywhere in the router's
        # top-3 counts as concurrence - adjacent role families (Data Scientist /
        # ML Engineer, Cyber Security / Penetration Tester) collapse into each
        # other in skill space, and a top-1-only rule punishes exactly those
        # legitimate neighbors. Same top-3 semantics as the UI candidate list.
        top3 = {str(le.classes_[i]) for i in proba.argsort()[::-1][:3]}
        if pred == OTHER_LABEL:
            status = 'rejects'
        elif base_canonical not in covered:
            status = 'not_covered'
        elif base_canonical in top3:
            status = 'agree'
        else:
            status = 'disagree'
        return {'agreement': status,
                'skills_model_title': None if pred == OTHER_LABEL else pred,
                'skills_model_confidence': round(conf * 100, 2)}
    except Exception as exc:
        print(f"[server] agreement check failed ({exc.__class__.__name__}) - neutral")
        return None


def apply_agreement_signal(resp: dict, cv_text: str) -> dict:
    """Fold the second opinion into a /cv/title response.

    agree            -> lift confidence to >= AGREEMENT_BOOST_CONFIDENCE (skips
                        the LLM rung the backend triggers below 55)
    disagree/rejects -> when the base answer isn't a confident declared title
                        (< DISAGREEMENT_OVERRIDE_MAX), cap every candidate below
                        the LLM threshold so the existing fallback fires; the
                        router's own pick joins the candidate list for the UI
    not_covered / no_skills / signal-off -> untouched
    """
    if skills_router is not None and float(resp.get('confidence') or 0.0) >= SIGNAL_NO_OP_ABOVE:
        return {**resp, **SIGNAL_SKIPPED}
    signal = agreement_check(resp.get('canonical_title'), cv_text)
    if signal is None:
        return resp
    resp.update(signal)
    base_conf = float(resp.get('confidence') or 0.0)
    if signal['agreement'] == 'agree':
        boosted = round(max(base_conf, AGREEMENT_BOOST_CONFIDENCE), 2)
        resp['confidence'] = boosted
        resp['low_confidence'] = boosted < CLASSIFIER_FALLBACK_LOW_CONFIDENCE
        if resp.get('candidates'):
            resp['candidates'][0] = {**resp['candidates'][0], 'confidence': boosted}
    elif signal['agreement'] in ('disagree', 'rejects') and base_conf < DISAGREEMENT_OVERRIDE_MAX:
        resp['low_confidence'] = True
        resp['confidence'] = round(min(base_conf, DISAGREEMENT_CONFIDENCE_CAP), 2)
        capped = []
        for cand in resp.get('candidates') or []:
            capped.append({**cand,
                           'raw_confidence': cand.get('raw_confidence', cand.get('confidence')),
                           'confidence': round(min(float(cand.get('confidence') or 0.0),
                                                   DISAGREEMENT_CONFIDENCE_CAP), 2)})
        if signal['skills_model_title'] and all(
                c.get('canonical_title') != signal['skills_model_title'] for c in capped):
            capped.append({'job_title': signal['skills_model_title'],
                           'canonical_title': signal['skills_model_title'],
                           'confidence': round(min(signal['skills_model_confidence'],
                                                   DISAGREEMENT_CONFIDENCE_CAP), 2)})
        resp['candidates'] = capped
    return resp

def apply_agreement_signal_to_roles(candidates: list, cv_text: str) -> list:
    """/cv/role variant of apply_agreement_signal - same policy, list shape.

    /cv/role is the rung the PRODUCT actually calls (the backend's ladder in
    dsModel.ts runs LLM header extraction -> /title/normalize, then falls back
    here for headerless CVs; it never calls POST /cv/title). This is exactly
    the signal's active zone - the classifier-only path where agreement
    measured 87% vs ~50% on disagreement. The signal fields are attached to
    every candidate item so the list response shape stays backward compatible.
    """
    top = candidates[0] if candidates else None
    if (top is not None and skills_router is not None
            and float(top.get('confidence') or 0.0) >= SIGNAL_NO_OP_ABOVE):
        return [{**c, **SIGNAL_SKIPPED} for c in candidates]
    signal = agreement_check(top.get('canonical_title') if top else None, cv_text)
    if signal is None or top is None:
        return candidates
    base_conf = float(top.get('confidence') or 0.0)
    if signal['agreement'] == 'agree':
        boosted = round(max(base_conf, AGREEMENT_BOOST_CONFIDENCE), 2)
        candidates = [{**top, 'confidence': boosted}] + candidates[1:]
    elif signal['agreement'] in ('disagree', 'rejects') and base_conf < DISAGREEMENT_OVERRIDE_MAX:
        candidates = [{**c,
                       'raw_confidence': c.get('raw_confidence', c.get('confidence')),
                       'confidence': round(min(float(c.get('confidence') or 0.0),
                                               DISAGREEMENT_CONFIDENCE_CAP), 2)}
                      for c in candidates]
        if signal['skills_model_title'] and all(
                c.get('canonical_title') != signal['skills_model_title'] for c in candidates):
            candidates.append({'job_title': signal['skills_model_title'],
                               'canonical_title': signal['skills_model_title'],
                               'confidence': round(min(signal['skills_model_confidence'],
                                                       DISAGREEMENT_CONFIDENCE_CAP), 2),
                               'raw_confidence': signal['skills_model_confidence']})
    return [{**c, **signal} for c in candidates]

def _title_similarities(candidate: str):
    vec = title_encoder.encode([candidate], normalize_embeddings=True)
    return (vec @ title_centroids.T)[0]


# CV headers often carry a second role after the primary one ("Senior Backend
# Developer, Tech Lead"). Embedding the whole line averages the two roles and
# can rank a centroid the CV never mentions above the right one - the string
# above put Frontend Developer at .7373 over Backend Developer at .7291, while
# the primary segment alone gives Backend .8490 over Frontend .8148.
_TITLE_SEGMENT_SPLIT = re.compile(r'\s*(?:,|/|\||&|\band\b|–|—|\s-\s)\s*')
_MIN_SEGMENT_CHARS = 3


def _title_variants(candidate: str) -> list:
    """The full phrase plus each role-shaped segment inside it, deduplicated."""
    variants = [candidate]
    for segment in _TITLE_SEGMENT_SPLIT.split(candidate):
        segment = segment.strip()
        if len(segment) >= _MIN_SEGMENT_CHARS and segment not in variants:
            variants.append(segment)
    return variants


def normalize_title_semantic_topk(candidate: str, k: int = 3):
    """
    Top-k nearest centroids for a short title phrase, most similar first.

    Each canonical title scores as its best match across the phrase and its
    segments, so a trailing secondary role can no longer outvote the primary
    one. A phrase with no separators has a single variant and behaves exactly
    as it did before.
    """
    sims = np.max([_title_similarities(v) for v in _title_variants(candidate)], axis=0)
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


# Below this many postings, aggregation degrades into n-gram fragments
# ("planning execution") rather than skills - the caller must know the
# list is not trustworthy instead of receiving fabricated-looking output.
LIMITED_DATA_MIN_RECORDS = int(os.getenv('SKILL_MIN_RECORDS', '25'))


def limited_data(records_count: int) -> bool:
    return records_count < LIMITED_DATA_MIN_RECORDS

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
        # Chunked fallback: SkillNer's matcher can crash on specific real-world
        # texts (hit by an authentic CV in M18 eval); annotating in line-aligned
        # chunks recovers the skills instead of silently returning nothing.
        skills = annotate_with_fallback(skill_extractor, text)
        return json.loads(json.dumps(skills, ensure_ascii=False, cls=NpEncoder))
    except Exception:
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
        role_counts=skill_role_counts,
        ubiquity_cap=UBIQUITY_CAP,
    )

    return {
        "matched_canonical": matched_canonical,
        "limited_data": limited_data(rc),
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
    return apply_agreement_signal_to_roles(classify_cv_role(text), text)

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
            return apply_agreement_signal({
                "extracted_title": clean_extracted,
                "raw_title": raw_extracted,
                "seniority": seniority,
                "canonical_title": canonical,
                "confidence": confidence,
                "low_confidence": False,
                "source": "title_extraction",
                "candidates": response_candidates[:3],
            }, cv_text)

    top = classifier_candidates[0] if classifier_candidates else None
    return apply_agreement_signal({
        "extracted_title": clean_extracted,
        "raw_title": raw_extracted,
        "seniority": seniority,
        "canonical_title": top["canonical_title"] if top else None,
        "confidence": top["confidence"] if top else 0.0,
        "low_confidence": (top["confidence"] if top else 0.0) < CLASSIFIER_FALLBACK_LOW_CONFIDENCE,
        "source": "cv_classifier",
        "candidates": classifier_candidates,
    }, cv_text)

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
        pool_items = [
            (s, f) for s, f in feats.items()
            if skill_role_counts.get(s, 0) <= UBIQUITY_CAP
        ] or list(feats.items())
        ranked = sorted(pool_items, key=lambda kv: -kv[1].get('prevalence', 0.0))[:n]
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
        "limited_data":      limited_data(rc),
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