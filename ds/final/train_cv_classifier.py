"""
Train the CV->title classifier (Model 2) directly on the 59-title canonical space.

Replaces tfid.ipynb as the trainer. The artifact is a neural network — a TF-IDF +
MLPClassifier sklearn Pipeline saved to text_to_job_title_classifier.joblib — plus
an explicit rejection class (taxonomy.OTHER_LABEL) trained from real non-engineering
CVs so out-of-scope resumes are not forced into an engineering title.

Data sources (all projected onto the same label space via taxonomy.py):
  - master_resumes.jsonl        (~4.8K structured resumes, MASTER_RAW_TO_CANONICAL)
  - careerlens.lang-uk-cv       (~105K real short CVs w/ Highlights, PRIMARY_KEYWORD_TO_CANONICAL)
  - careerlens.lang-uk-job      (~142K job descriptions — vocabulary enrichment, train-only)

Honest evaluation: val/test are drawn from CV-format text only (never JDs), leakage
is scrubbed (Position/title string removed from the text, skill words kept), exact
duplicates are removed before splitting, and a TF-IDF+LogReg baseline is trained
side-by-side as a quality gate — the network is only saved if it holds up.

Usage:
    python train_cv_classifier.py                # full run
    python train_cv_classifier.py --quick        # subsampled smoke run (no save)
    python train_cv_classifier.py --skip-ablation
    python train_cv_classifier.py --no-save
"""
import argparse
import copy
import hashlib
import json
import os
import random
import re
import shutil
import sys
import warnings
from collections import Counter, defaultdict
from datetime import datetime, timezone

import joblib
import numpy as np
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline

from taxonomy import CANONICAL_TITLES, OTHER_LABEL, lang_uk_label, master_label

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_OUT  = os.getenv('MODEL_OUT_DIR', BASE_DIR)
MODEL_PATH = os.path.join(MODEL_OUT, 'text_to_job_title_classifier.joblib')
SPLIT_PATH = os.path.join(MODEL_OUT, 'cv_classifier_split_ids.json')

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
LANG_UK_DB = os.getenv('LANG_UK_DB', 'careerlens')
MASTER_PATH = os.path.join(BASE_DIR, 'master_resumes.jsonl')
SYNTHETIC_TITLES_PATH = os.path.join(BASE_DIR, 'synthetic_titles.csv')

RANDOM_STATE = 42

# Per-class caps keep the wildly imbalanced sources (JavaScript: 34K CVs vs
# Rust: 160) from dominating the decision surface. JDs are vocabulary
# enrichment only, capped below the CV cap so they never set the distribution.
CV_CAP_PER_CLASS = 2000
JD_CAP_PER_CLASS = 1200
MIN_CV_PER_CLASS = 50     # classes below this have no honest holdout -> LLM fallback territory
TRAIN_OVERSAMPLE_FLOOR = 400  # duplicate minority-class train rows up to this count (MLP has no class_weight)

# OTHER_LABEL is a merger of many unrelated non-engineering keywords (Marketing,
# HR, Sales, Recruiter, ...). Left uncapped like a normal class it becomes the
# single largest bucket and starts absorbing genuinely-engineering minority
# classes (observed: Product Manager -> __other__ in most test errors). Cap it
# well below the normal per-class cap so its size reflects its role (rejection
# background, not a class to dominate on).
OTHER_CAP_PER_CLASS = 800

# ── Text cleaning / leakage scrub ──────────────────────────────────────────────

_RE_EMAIL = re.compile(r'\S+@\S+\.\S+')
_RE_URL   = re.compile(r'https?://\S+|www\.\S+')
_RE_PHONE = re.compile(r'\+?\d[\d\-\s()]{7,}\d')
_RE_WS    = re.compile(r'\s+')


def clean_text(text):
    """Normalise whitespace and strip PII-ish noise (emails/urls/phones)."""
    text = _RE_EMAIL.sub(' ', text)
    text = _RE_URL.sub(' ', text)
    text = _RE_PHONE.sub(' ', text)
    return _RE_WS.sub(' ', text).strip()


def scrub(text, *phrases):
    """Remove title phrases verbatim (case-insensitive) — kills label leakage.
    Deliberately does NOT touch individual skill words (react/sql/python):
    removing those was measured to crash framework-role F1 to ~0.2."""
    for phrase in phrases:
        if phrase and len(phrase.strip()) >= 3:
            text = re.sub(re.escape(phrase.strip()), ' ', text, flags=re.IGNORECASE)
    return text


# ── Loaders — every row: {id, text, label, source} ─────────────────────────────

def load_master(path):
    """master_resumes.jsonl — same build_text logic proven in tfid.ipynb."""
    rows = []
    if not os.path.exists(path):
        print(f'WARNING: {path} not found — training without master_resumes.')
        return rows
    with open(path, encoding='utf-8') as f:
        for i, line in enumerate(f):
            if not line.strip():
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            exp = d.get('experience', [])
            if not exp or not isinstance(exp, list):
                continue
            raw_title = exp[0].get('title') if isinstance(exp[0], dict) else None
            if raw_title in ('Unknown', 'Not Provided', '', None):
                continue
            label = master_label(raw_title)
            if label is None:
                continue
            blocks = []
            for idx, e in enumerate(exp):
                if not isinstance(e, dict):
                    continue
                past = '' if idx == 0 else e.get('title', '')     # leakage guard #1
                resp = e.get('responsibilities', [])
                resp = ' '.join(resp) if isinstance(resp, list) else ''
                te = e.get('technical_environment', {})
                techs = ' '.join(te.get('technologies', [])) if isinstance(te, dict) else ''
                tools = ' '.join(te.get('tools', [])) if isinstance(te, dict) else ''
                blocks.append(f'{past} {resp} {techs} {tools}')
            summary = d.get('personal_info', {}).get('summary', '') or ''
            ts = d.get('skills', {}).get('technical', {})
            skills = []
            for cat in ('programming_languages', 'frameworks', 'databases', 'cloud'):
                skills += [s.get('name', '') for s in ts.get(cat, []) if isinstance(s, dict)]
            text = f"{summary} {' '.join(skills)} {' | '.join(blocks)}"
            text = clean_text(scrub(text, raw_title, label))      # leakage guard #2
            if len(text) < 100:
                continue
            rows.append({'id': f'master:{i}', 'text': text, 'label': label, 'source': 'master'})
    return rows


def load_lang_uk_cv(db, limit=None):
    """lang-uk candidate profiles — uses the curated `Highlights` field (a short,
    human-written summary of the candidate's most relevant role/experience),
    not the longer raw `CV` field. Position is scrubbed as leakage."""
    rows = []
    cursor = db['lang-uk-cv'].find(
        {'Highlights': {'$ne': None}},
        {'Highlights': 1, 'Position': 1, 'Primary Keyword': 1},
    )
    if limit:
        cursor = cursor.limit(limit)
    for d in cursor:
        label = lang_uk_label(d.get('Primary Keyword'))
        if label is None:
            continue
        text = d.get('Highlights') or ''
        text = clean_text(scrub(text, d.get('Position') or '', label))
        if len(text) < 20:      # Highlights is a short curated sentence, not a full CV
            continue
        rows.append({'id': f"cv:{d['_id']}", 'text': text, 'label': label, 'source': 'languk_cv'})
    return rows


def load_lang_uk_jd(db, limit=None):
    """lang-uk job descriptions — requirements language for each role, train-only."""
    rows = []
    cursor = db['lang-uk-job'].find(
        {}, {'Long Description': 1, 'Position': 1, 'Primary Keyword': 1},
    )
    if limit:
        cursor = cursor.limit(limit)
    for d in cursor:
        label = lang_uk_label(d.get('Primary Keyword'))
        if label is None:
            continue
        text = d.get('Long Description') or ''
        text = clean_text(scrub(text, d.get('Position') or '', label))
        if len(text) < 200:
            continue
        rows.append({'id': f"jd:{d['_id']}", 'text': text, 'label': label, 'source': 'jd'})
    return rows


def load_synthetic_titles(csv_path=SYNTHETIC_TITLES_PATH):
    """LLM-generated realistic title strings (generate_synthetic_titles.py),
    one canonical label each. Train-only, like JDs: it's short title text, not
    a real CV body, so it can't honestly be part of val/test — but it's real
    labeled data for the ~33 canonical titles that have ZERO CV-format
    examples in master_resumes/lang-uk-cv, letting the classifier learn to
    recognize them directly instead of relying solely on the LLM fallback."""
    if not os.path.exists(csv_path):
        return []
    import csv as csv_module
    rows = []
    with open(csv_path, encoding='utf-8', newline='') as f:
        for i, row in enumerate(csv_module.DictReader(f)):
            title = (row.get('title') or '').strip()
            label = (row.get('canonical_title') or '').strip()
            if not title or label not in CANONICAL_TITLES:
                continue
            rows.append({'id': f'synthetic:{i}', 'text': title, 'label': label, 'source': 'synthetic'})
    return rows


def dedupe(rows):
    """Exact-duplicate removal on cleaned text — duplicates straddling the split
    would silently inflate holdout scores."""
    seen, out = set(), []
    for r in rows:
        h = hashlib.md5(r['text'].lower().encode('utf-8')).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        out.append(r)
    return out


def cap_per_class(rows, cap, rng):
    by_label = defaultdict(list)
    for r in rows:
        by_label[r['label']].append(r)
    out = []
    for label, group in by_label.items():
        rng.shuffle(group)                 # mixes the sub-keywords inside merged classes
        out.extend(group[:cap])
    return out


def oversample_per_class(rows, floor, rng):
    """Duplicate (with replacement) minority-class rows up to `floor` examples.

    MLPClassifier has no class_weight/sample_weight knob (unlike LogisticRegression),
    so without this the giant classes (__other__, Frontend, QA...) simply dominate
    the loss and starve small classes like Cyber Security or Go Developer. Applied
    to TRAIN only — never to val/test, which must stay a clean sample of reality.
    """
    by_label = defaultdict(list)
    for r in rows:
        by_label[r['label']].append(r)
    out = []
    for label, group in by_label.items():
        out.extend(group)
        deficit = floor - len(group)
        if deficit > 0:
            out.extend(rng.choices(group, k=deficit))
    return out


# ── Serving-confidence replica (must mirror server.py /cv/role exactly) ────────

def serving_confidences(pipeline, texts, batch=4096):
    """For each text: (top1_label, top1_confidence) using the serving rule —
    rank classes, drop OTHER_LABEL from the shortlist, renormalise the top-3
    while keeping OTHER_LABEL's mass in the denominator (so a confident
    "not engineering" prediction deflates every returned share — that's the
    rejection signal). Must mirror server.py /cv/role exactly."""
    classes = list(pipeline.classes_)
    other_idx = classes.index(OTHER_LABEL) if OTHER_LABEL in classes else None
    labels_out, confs_out = [], []
    for i in range(0, len(texts), batch):
        proba = pipeline.predict_proba(texts[i:i + batch])
        for p in proba:
            order = np.argsort(-p)
            ranked = [(classes[j], p[j]) for j in order if classes[j] != OTHER_LABEL][:3]
            total = sum(v for _, v in ranked) or 1.0
            if other_idx is not None:
                total += float(p[other_idx])
            labels_out.append(ranked[0][0])
            confs_out.append(round(ranked[0][1] / total * 100, 2))
    return np.array(labels_out), np.array(confs_out)


# ── Evaluation helpers ─────────────────────────────────────────────────────────

def eval_split(name, y_true, y_pred):
    acc = accuracy_score(y_true, y_pred)
    mf1 = f1_score(y_true, y_pred, average='macro')
    print(f'  {name:<28} acc={acc:.3f}  macro-F1={mf1:.3f}  (n={len(y_true)})')
    return {'accuracy': round(acc, 4), 'macro_f1': round(mf1, 4), 'n': len(y_true)}


def top_confused_pairs(y_true, y_pred, labels, k=10):
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    pairs = []
    for i, a in enumerate(labels):
        row_total = cm[i].sum()
        if row_total == 0:
            continue
        for j, b in enumerate(labels):
            if i != j and cm[i][j] > 0:
                pairs.append((a, b, int(cm[i][j]), cm[i][j] / row_total))
    pairs.sort(key=lambda t: -t[3])
    return [p for p in pairs if p[2] >= 5][:k]


SMOKE_SNIPPETS = [
    ('SOC Analyst (no training data)',
     'Monitoring SIEM alerts in Splunk and QRadar, triaging security incidents, tier 1 SOC. '
     'Escalation of phishing and malware alerts, writing incident tickets, MITRE ATT&CK mapping.'),
    ('Marketing (out of scope)',
     'Planned and executed digital marketing campaigns, managed social media accounts, SEO and '
     'content strategy, email funnels, brand awareness, Google Ads budgets and A/B tested creatives.'),
    ('iOS developer',
     'Built native iPhone apps in Swift with Xcode, UIKit and SwiftUI, CoreData persistence, '
     'App Store releases, push notifications, in-app purchases and unit tests with XCTest.'),
    ('Frontend React',
     'Developing SPA interfaces with React, Redux and TypeScript, responsive CSS, webpack builds, '
     'component libraries and Jest testing. Migrated legacy jQuery screens to React hooks.'),
    ('DevOps / K8s',
     'Maintained AWS infrastructure with Terraform, Kubernetes clusters and Helm charts, CI/CD in '
     'Jenkins and GitLab, Prometheus and Grafana monitoring, Docker images, on-call production support.'),
    ('Data Scientist',
     'Built churn prediction models with scikit-learn and XGBoost, feature engineering on customer '
     'data in pandas, A/B test analysis, dashboards, presented insights to stakeholders in Python notebooks.'),
    ('Java backend',
     'Developed microservices in Java 17 with Spring Boot, REST APIs, Hibernate and PostgreSQL, '
     'Kafka messaging, JUnit and Mockito tests, deployed to Kubernetes.'),
    ('QA automation',
     'Automated regression suites with Selenium WebDriver and Python pytest, API testing with Postman '
     'and REST Assured, test plans, bug reports in Jira, CI integration of nightly test runs.'),
    ('Product manager',
     'Owned product roadmap and backlog, wrote PRDs and user stories, prioritized features with '
     'stakeholders, ran discovery interviews, tracked KPIs and funnel metrics, led sprint planning.'),
    ('Embedded firmware',
     'Wrote bare-metal C firmware for STM32 microcontrollers, I2C SPI UART drivers, RTOS tasks, '
     'debugging with JTAG and oscilloscope, power optimization for battery devices.'),
]


# ── Main ───────────────────────────────────────────────────────────────────────

DATASET_CSV_PATH = os.path.join(BASE_DIR, 'cv_classifier_dataset.csv')
CSV_FIELDS = ['id', 'text', 'label', 'source']


def materialize_rows(mongo_limit=None, load_jd=True):
    """Load + clean + scrub + label the CV sources (master_resumes + lang-uk-cv
    Highlights), deduped, BEFORE per-class capping. This is the expensive part
    (a full Mongo scan takes a couple minutes) — cached to CSV by
    build_dataset_csv.py so repeat runs don't pay it again.
    Job descriptions (lang-uk-job) are candidate-text-free noise for a
    CV->title classifier — load_jd=False (the CSV builder's default) skips
    them entirely. Returns (cv_rows, jd_rows) — jd_rows is [] when skipped."""
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    db = client[LANG_UK_DB]

    print('Loading sources...')
    master = load_master(MASTER_PATH)
    languk_cv = load_lang_uk_cv(db, limit=mongo_limit)
    jd = load_lang_uk_jd(db, limit=mongo_limit) if load_jd else []
    print(f'  master_resumes: {len(master)}  lang-uk-cv: {len(languk_cv)}  lang-uk-job: {len(jd)}')

    cv_rows = dedupe(master + languk_cv)
    jd_rows = dedupe(jd)
    print(f'  after dedupe: cv={len(cv_rows)}  jd={len(jd_rows)}')
    return cv_rows, jd_rows


def load_rows_from_csv(csv_path):
    """Fast path: read the materialized dataset back from CSV instead of Mongo.
    Splits back into (cv_rows, jd_rows) by the 'source' column."""
    import csv as csv_module
    cv_rows, jd_rows = [], []
    with open(csv_path, encoding='utf-8', newline='') as f:
        for row in csv_module.DictReader(f):
            (jd_rows if row['source'] == 'jd' else cv_rows).append(row)
    print(f'Loaded cached dataset from {os.path.basename(csv_path)}: '
          f'cv={len(cv_rows)}  jd={len(jd_rows)}')
    return cv_rows, jd_rows


def build_dataset(quick=False, csv_path=None, sample_frac=None, synthetic_csv_path=SYNTHETIC_TITLES_PATH):
    rng = random.Random(RANDOM_STATE)

    if csv_path and os.path.exists(csv_path):
        cv_rows, jd_rows = load_rows_from_csv(csv_path)
    else:
        # --quick exists to prove the code path works end-to-end, not to pick
        # an architecture — limit the Mongo scan itself so a smoke run takes
        # ~1-2 minutes instead of first reading ~250K documents and discarding most.
        # Job descriptions are excluded by default (see materialize_rows) —
        # candidate CV text only.
        mongo_limit = 15000 if quick else None
        cv_rows, jd_rows = materialize_rows(mongo_limit=mongo_limit, load_jd=False)

    synthetic_rows = load_synthetic_titles(synthetic_csv_path) if synthetic_csv_path else []
    if synthetic_rows:
        print(f'  synthetic titles: {len(synthetic_rows)} rows across '
              f'{len(set(r["label"] for r in synthetic_rows))} canonical titles')

    if sample_frac and 0 < sample_frac < 1:
        rng.shuffle(cv_rows); rng.shuffle(jd_rows)
        cv_rows = cv_rows[:int(len(cv_rows) * sample_frac)]
        jd_rows = jd_rows[:int(len(jd_rows) * sample_frac)]
        print(f'  sample_frac={sample_frac}: cv={len(cv_rows)}  jd={len(jd_rows)}')

    # keep master uncapped (rich full-resume format, small), cap lang-uk.
    # OTHER_LABEL gets its own lower cap (see OTHER_CAP_PER_CLASS) so the
    # merged rejection bucket can't outsize genuine engineering classes.
    master_rows = [r for r in cv_rows if r['source'] == 'master']
    languk_other = [r for r in cv_rows if r['source'] == 'languk_cv' and r['label'] == OTHER_LABEL]
    languk_eng = [r for r in cv_rows if r['source'] == 'languk_cv' and r['label'] != OTHER_LABEL]
    languk_rows = (cap_per_class(languk_eng, CV_CAP_PER_CLASS, rng)
                   + cap_per_class(languk_other, OTHER_CAP_PER_CLASS, rng))
    cv_rows = master_rows + languk_rows
    jd_rows = cap_per_class(jd_rows, JD_CAP_PER_CLASS, rng)

    # A class needs real CV-format data to get an honest held-out val/test —
    # that gate stays as-is. But a class with ZERO real data can still be
    # *trained* (not evaluated) via synthetic title strings, so it's not
    # permanently invisible to the model — kept_for_training is the union.
    cv_counts = Counter(r['label'] for r in cv_rows)
    kept_real = {lbl for lbl, n in cv_counts.items() if n >= MIN_CV_PER_CLASS}
    synthetic_labels = {r['label'] for r in synthetic_rows}
    kept_for_training = kept_real | synthetic_labels
    dropped = {lbl: n for lbl, n in cv_counts.items() if lbl not in kept_real}
    synthetic_only = sorted(synthetic_labels - kept_real)
    if dropped:
        print(f'  below {MIN_CV_PER_CLASS} real CV examples (no honest holdout): {dropped}')
    if synthetic_only:
        print(f'  trained via synthetic titles only (no real CV data at all): {synthetic_only}')
    cv_rows = [r for r in cv_rows if r['label'] in kept_real]
    jd_rows = [r for r in jd_rows if r['label'] in kept_for_training]
    synthetic_rows = [r for r in synthetic_rows if r['label'] in kept_for_training]

    print(f'  final: cv={len(cv_rows)}  jd={len(jd_rows)}  synthetic={len(synthetic_rows)}  '
          f'classes={len(kept_for_training)} ({len(kept_real)} with real holdout)')
    print('  per-class CV counts:')
    for lbl, n in sorted(Counter(r['label'] for r in cv_rows).items(), key=lambda t: -t[1]):
        print(f'    {lbl:<38} {n}')
    return cv_rows, jd_rows, synthetic_rows


def make_tfidf():
    return TfidfVectorizer(
        sublinear_tf=True, ngram_range=(1, 2), min_df=5,
        max_features=50_000, lowercase=True,
        token_pattern=r'(?u)\b[a-zA-Z0-9][a-zA-Z0-9+#.\-]*\b',  # keeps c++, c#, .net, node.js
    )


MAX_EPOCHS = 40
PATIENCE   = 5


def set_quick_budget():
    """--quick exists to catch code bugs fast, not to pick an architecture —
    shrink the epoch budget so a smoke run finishes in ~1-2 minutes, not tens."""
    global MAX_EPOCHS, PATIENCE
    MAX_EPOCHS = 8
    PATIENCE = 2


def fit_mlp_early_stopping(Xt_train, y_train, Xt_val, y_val, alpha, hidden=(256,), tag=''):
    """Train an MLP one epoch at a time (warm_start) and stop on val macro-F1.

    sklearn's built-in early_stopping breaks on string labels (isnan on the
    predicted label array) and would score on a random inner split anyway —
    monitoring our own CV-format val set is both a fix and better methodology.
    Prints one flushed line per epoch — live progress, not a black box.
    Returns (best_mlp, best_epoch, best_val_f1).
    """
    mlp = MLPClassifier(
        hidden_layer_sizes=hidden, alpha=alpha, solver='adam',
        max_iter=1, warm_start=True, early_stopping=False,
        random_state=RANDOM_STATE, verbose=False,
    )
    best_f1, best_epoch, best_state, stale = -1.0, 0, None, 0
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')          # per-epoch ConvergenceWarning is expected
        for epoch in range(1, MAX_EPOCHS + 1):
            t0 = datetime.now()
            mlp.fit(Xt_train, y_train)
            val_f1 = f1_score(y_val, mlp.predict(Xt_val), average='macro')
            dt = (datetime.now() - t0).total_seconds()
            improved = val_f1 > best_f1 + 1e-4
            if improved:
                best_f1, best_epoch, stale = val_f1, epoch, 0
                best_state = copy.deepcopy(mlp)
            else:
                stale += 1
            print(f'    [{tag}] epoch {epoch:>2}  val macro-F1={val_f1:.4f}  '
                  f'({dt:.1f}s){"  *best*" if improved else f"  (stale {stale}/{PATIENCE})"}',
                  flush=True)
            if stale >= PATIENCE:
                break
    return best_state, best_epoch, best_f1


def make_logreg():
    return Pipeline([
        ('tfidf', make_tfidf()),
        ('clf', LogisticRegression(max_iter=2000, class_weight='balanced', n_jobs=-1)),
    ])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quick', action='store_true', help='subsampled smoke run (implies --no-save)')
    ap.add_argument('--skip-ablation', action='store_true')
    ap.add_argument('--no-save', action='store_true')
    ap.add_argument('--dataset-csv', default=DATASET_CSV_PATH,
                     help='cached materialized dataset (build with build_dataset_csv.py); '
                          'falls back to a live Mongo scan if the file does not exist')
    ap.add_argument('--no-cache', action='store_true', help='ignore --dataset-csv, always hit Mongo')
    ap.add_argument('--sample-frac', type=float, default=None,
                     help='train on a random fraction (0-1) of the materialized rows, for fast iteration')
    ap.add_argument('--synthetic-csv', default=SYNTHETIC_TITLES_PATH,
                     help='LLM-generated title strings (generate_synthetic_titles.py); '
                          'train-only, covers canonical titles with zero real CV data')
    ap.add_argument('--no-synthetic', action='store_true', help='disable synthetic title rows')
    args = ap.parse_args()
    if args.quick:
        args.no_save = True
        set_quick_budget()

    np.random.seed(RANDOM_STATE)
    csv_path = None if args.no_cache else args.dataset_csv
    synthetic_path = None if args.no_synthetic else args.synthetic_csv
    cv_rows, jd_rows, synthetic_rows = build_dataset(
        quick=args.quick, csv_path=csv_path, sample_frac=args.sample_frac,
        synthetic_csv_path=synthetic_path)

    # ── split: CV-format rows only in val/test; JDs are train-only ────────────
    labels = [r['label'] for r in cv_rows]
    train_cv, valtest = train_test_split(
        cv_rows, test_size=0.2, stratify=labels, random_state=RANDOM_STATE)
    val, test = train_test_split(
        valtest, test_size=0.5, stratify=[r['label'] for r in valtest],
        random_state=RANDOM_STATE)
    train = train_cv + jd_rows + synthetic_rows
    print(f'\nSplit: train={len(train)} (cv {len(train_cv)} + jd {len(jd_rows)} + '
          f'synthetic {len(synthetic_rows)})  val={len(val)}  test={len(test)}')

    # MLPClassifier has no class_weight/sample_weight — oversample minority
    # classes for its training pool only. LogReg keeps the unmodified pool and
    # its own class_weight='balanced', so each model gets its best-effort
    # imbalance handling; the quality gate then compares them on equal footing
    # (same untouched val/test).
    rng = random.Random(RANDOM_STATE)
    train_cv_over = oversample_per_class(train_cv, TRAIN_OVERSAMPLE_FLOOR, rng)
    added = len(train_cv_over) - len(train_cv)
    print(f'  oversampled train_cv for MLP: {len(train_cv)} -> {len(train_cv_over)} (+{added} duplicated)')
    train_mlp = train_cv_over + jd_rows + synthetic_rows

    X_train = [r['text'] for r in train]; y_train = [r['label'] for r in train]
    X_train_mlp = [r['text'] for r in train_mlp]; y_train_mlp = [r['label'] for r in train_mlp]
    X_val   = [r['text'] for r in val];   y_val   = [r['label'] for r in val]
    X_test  = [r['text'] for r in test];  y_test  = [r['label'] for r in test]

    # ── candidates: small honest grid, early stopping + selection on val ──────
    print('\nTraining candidates (early stopping + selection on val)...')
    tfidf = make_tfidf().fit(X_train_mlp)
    Xt_train, Xt_val = tfidf.transform(X_train_mlp), tfidf.transform(X_val)

    # alpha=1e-3 consistently lost to alpha=1e-4 across repeated smoke runs —
    # dropped from the grid to keep the full run's wall-clock reasonable. Kept:
    # the proven (256,) config and a wider/deeper (512,128) candidate (single
    # hidden layers plateaued after just 2-3 epochs in smoke runs, a sign of a
    # capacity ceiling against the strong sparse-linear signal). --quick only
    # needs to prove the code path works, so it skips the expensive wide net.
    grid = [((256,), 1e-4)] if args.quick else [((256,), 1e-4), ((512, 128), 1e-4)]
    candidates = {}
    for hidden, alpha in grid:
        name = f"mlp_h{'x'.join(map(str, hidden))}_a{alpha:g}"
        mlp, epochs, val_f1 = fit_mlp_early_stopping(Xt_train, y_train_mlp, Xt_val, y_val, alpha,
                                                      hidden=hidden, tag=name)
        candidates[name] = {'mlp': mlp, 'alpha': alpha, 'hidden': hidden, 'epochs': epochs, 'val_f1': val_f1}
        print(f'  {name:<20} val macro-F1 = {val_f1:.4f}  (best epoch {epochs})')

    best_name = max(candidates, key=lambda n: candidates[n]['val_f1'])
    best = candidates[best_name]
    best_mlp = Pipeline([('tfidf', tfidf), ('mlp', best['mlp'])])
    print(f'  -> selected {best_name}')

    logreg = make_logreg()
    logreg.fit(X_train, y_train)
    logreg_val = f1_score(y_val, logreg.predict(X_val), average='macro')
    print(f'  logreg baseline val macro-F1 = {logreg_val:.4f}')

    # ── JD ablation: does requirements text help the CV holdout? ──────────────
    # Meaningless (and skipped) when there are no JD rows to begin with — the
    # default now, since job descriptions were dropped as candidate-text-free noise.
    use_jd = bool(jd_rows)
    if jd_rows and not args.skip_ablation:
        print('\nJD ablation (same config, CV-only training)...')
        X_cv_only = [r['text'] for r in train_cv_over]
        y_cv_only = [r['label'] for r in train_cv_over]
        tfidf_no_jd = make_tfidf().fit(X_cv_only)
        mlp_no_jd, epochs_no_jd, mf1_no_jd = fit_mlp_early_stopping(
            tfidf_no_jd.transform(X_cv_only), y_cv_only,
            tfidf_no_jd.transform(X_val), y_val, best['alpha'], hidden=best['hidden'], tag='no_jd')
        print(f"  with JDs:    {best['val_f1']:.4f}")
        print(f'  without JDs: {mf1_no_jd:.4f}')
        if mf1_no_jd > best['val_f1'] + 0.005:
            print('  -> JDs hurt; dropping them from the final fit.')
            use_jd = False
            best_mlp = Pipeline([('tfidf', tfidf_no_jd), ('mlp', mlp_no_jd)])
            best = {'mlp': mlp_no_jd, 'alpha': best['alpha'], 'hidden': best['hidden'],
                    'epochs': epochs_no_jd, 'val_f1': mf1_no_jd}

    # ── threshold calibration on val (serving-confidence units) ───────────────
    print('\nConfidence calibration (val, serving top-3 renormalised units):')
    v_labels, v_confs = serving_confidences(best_mlp, X_val)
    v_correct = (v_labels == np.array(y_val))
    bins = [(35, 50), (50, 60), (60, 70), (70, 80), (80, 90), (90, 101)]
    calibration = []
    for lo, hi in bins:
        mask = (v_confs >= lo) & (v_confs < hi)
        if mask.sum() == 0:
            continue
        acc = v_correct[mask].mean()
        calibration.append({'bin': f'{lo}-{hi}', 'n': int(mask.sum()), 'accuracy': round(float(acc), 3)})
        print(f'  conf {lo:>3}-{hi:<3}  n={mask.sum():<6} accuracy={acc:.3f}')

    # auto-accept: lowest threshold whose >=bucket precision reaches 0.90
    auto_accept = None
    for t in range(50, 96, 5):
        mask = v_confs >= t
        if mask.sum() >= 30 and v_correct[mask].mean() >= 0.90:
            auto_accept = t
            break
    # LLM fallback: below this, top-1 is wrong more often than ~40% of the time
    llm_fallback = None
    for t in range(35, 96, 5):
        mask = v_confs < t
        if mask.sum() >= 30 and v_correct[mask].mean() < 0.60:
            llm_fallback = t
    print(f'  -> recommended AUTO_MATCH_CONFIDENCE_MIN = {auto_accept}')
    print(f'  -> recommended TITLE_LLM_FALLBACK_THRESHOLD = {llm_fallback}')

    # ── test: opened once ──────────────────────────────────────────────────────
    print('\nFinal test evaluation (opened once):')
    test_pred_mlp = best_mlp.predict(X_test)
    test_pred_lr  = logreg.predict(X_test)
    metrics_mlp = eval_split('MLP (selected)', y_test, test_pred_mlp)
    metrics_lr  = eval_split('LogReg baseline', y_test, test_pred_lr)

    # per-source generalisation: full resumes vs short profiles
    per_source = {}
    for src in ('master', 'languk_cv'):
        idx = [i for i, r in enumerate(test) if r['source'] == src]
        if not idx:
            continue
        per_source[src] = eval_split(f'MLP on {src} holdout',
                                     [y_test[i] for i in idx],
                                     [test_pred_mlp[i] for i in idx])

    print('\nTop confused pairs (test, MLP):')
    label_set = sorted(set(y_test))
    confused = top_confused_pairs(y_test, test_pred_mlp, label_set)
    for a, b, n, frac in confused:
        print(f'  {a:<30} -> {b:<30} {n:>4}  ({frac:.0%} of {a})')

    # __other__ behaviour: non-engineering test rows must not look confident-engineering
    other_idx = [i for i, y in enumerate(y_test) if y == OTHER_LABEL]
    if other_idx:
        t_labels, t_confs = serving_confidences(best_mlp, [X_test[i] for i in other_idx])
        raw_pred_other = np.array([test_pred_mlp[i] for i in other_idx])
        caught = (raw_pred_other == OTHER_LABEL).mean()
        leaked_confident = float(((raw_pred_other != OTHER_LABEL) & (t_confs >= (auto_accept or 90))).mean())
        print(f'\n__other__ on test: caught={caught:.2%}, '
              f'escaped-with-auto-accept-confidence={leaked_confident:.2%}')

    print('\nSmoke snippets (manual sanity, not from the datasets):')
    s_labels, s_confs = serving_confidences(best_mlp, [t for _, t in SMOKE_SNIPPETS])
    raw_top = best_mlp.predict([t for _, t in SMOKE_SNIPPETS])
    for (name, _), lbl, conf, raw in zip(SMOKE_SNIPPETS, s_labels, s_confs, raw_top):
        flag = ' [raw=__other__]' if raw == OTHER_LABEL else ''
        print(f'  {name:<35} -> {lbl:<30} conf={conf:>6.1f}{flag}')

    # ── quality gate ───────────────────────────────────────────────────────────
    gate_ok = metrics_mlp['macro_f1'] >= metrics_lr['macro_f1'] - 0.01
    if not gate_ok:
        print(f"\nQUALITY GATE FAILED: MLP macro-F1 {metrics_mlp['macro_f1']} < "
              f"LogReg {metrics_lr['macro_f1']} - 0.01. Not saving. Investigate before shipping.")
        sys.exit(1)
    print('\nQuality gate passed: the network holds up against the linear baseline.')

    if args.no_save:
        print('(--no-save / --quick) skipping artifact save.')
        return

    # ── ship: retrain selected config on train+val (test stays unseen) ─────────
    # No val left for early stopping — reuse the epoch budget the val run found.
    # Oversample train_cv+val together so the shipped model gets the same
    # minority-class treatment the selected candidate was validated with.
    print('\nRetraining selected config on train+val for the shipped artifact...')
    ship_cv_over = oversample_per_class(train_cv + val, TRAIN_OVERSAMPLE_FLOOR, rng)
    ship_rows = ship_cv_over + (jd_rows if use_jd else []) + synthetic_rows
    X_ship = [r['text'] for r in ship_rows]
    y_ship = [r['label'] for r in ship_rows]
    ship_tfidf = make_tfidf().fit(X_ship)
    ship_mlp = MLPClassifier(
        hidden_layer_sizes=best['hidden'], alpha=best['alpha'], solver='adam',
        max_iter=best['epochs'], early_stopping=False,
        random_state=RANDOM_STATE, verbose=False,
    )
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        ship_mlp.fit(ship_tfidf.transform(X_ship), y_ship)
    ship = Pipeline([('tfidf', ship_tfidf), ('mlp', ship_mlp)])

    if os.path.exists(MODEL_PATH):
        stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup = os.path.join(MODEL_OUT, f'text_to_job_title_classifier_{stamp}.joblib')
        shutil.copy2(MODEL_PATH, backup)
        print(f'  previous model backed up to {os.path.basename(backup)}')
    joblib.dump(ship, MODEL_PATH)
    print(f'  saved {MODEL_PATH}  (classes={len(ship.classes_)})')

    with open(SPLIT_PATH, 'w', encoding='utf-8') as f:
        json.dump({
            'random_state': RANDOM_STATE,
            'train': [r['id'] for r in train_cv],
            'val':   [r['id'] for r in val],
            'test':  [r['id'] for r in test],
            'jd_used': use_jd,
        }, f)
    print(f'  split ids saved to {os.path.basename(SPLIT_PATH)}')

    # per-class support/F1 on test for the run record
    per_class_f1 = {}
    f1s = f1_score(y_test, test_pred_mlp, average=None, labels=label_set)
    support = Counter(y_test)
    for lbl, s in zip(label_set, f1s):
        per_class_f1[lbl] = {'f1': round(float(s), 3), 'test_support': support[lbl]}

    run_doc = {
        'trained_at': datetime.now(timezone.utc).isoformat(),
        'model': 'tfidf+mlp',
        'selected_config': best_name,
        'classes': [str(c) for c in ship.classes_],
        'n_classes': len(ship.classes_),
        'jd_used': use_jd,
        'synthetic_titles_used': len(synthetic_rows),
        'caps': {'cv': CV_CAP_PER_CLASS, 'jd': JD_CAP_PER_CLASS, 'other': OTHER_CAP_PER_CLASS,
                 'min_cv': MIN_CV_PER_CLASS, 'train_oversample_floor': TRAIN_OVERSAMPLE_FLOOR},
        'test_metrics': {'mlp': metrics_mlp, 'logreg_baseline': metrics_lr},
        'per_source': per_source,
        'per_class': per_class_f1,
        'calibration': calibration,
        'thresholds': {'auto_accept': auto_accept, 'llm_fallback': llm_fallback},
        'confused_pairs': [{'true': a, 'pred': b, 'n': n, 'frac': round(frac, 3)}
                           for a, b, n, frac in confused],
        'random_state': RANDOM_STATE,
    }
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    client[LANG_UK_DB]['cv_title_model_runs'].insert_one(run_doc)
    print('  run metadata written to careerlens.cv_title_model_runs')
    print('\nDone. Restart the DS service to serve the new model.')


if __name__ == '__main__':
    main()
