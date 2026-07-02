# CareerLens — DS Model Implementation Plan

> תוכנית מימוש מלאה למשימות DS.
> **כל הפיצ'רים, הבדיקות, וה-UI מתבססים אך ורק על הדאטה הקיים:**
> 8,486 רשומות ב-`linkedin_translated_skills.jsonl` + `alljobs_translated_skills.jsonl`.
> אין תאריכים, אין סימולציות, אין תכנון לעתיד — רק מה שניתן לחשב עכשיו.

---

## מצב נוכחי

| רכיב | מצב |
|------|-----|
| `ds/model/training.ipynb` | KNN על 5 POC titles, מחשב `role_skill_scores[title][skill] += score` |
| `ds/model/server.py` | מחזיר `top_5 = matched_role[:5]` מרשימה ממוינת |
| `ds/model/model.joblib` | מכיל: `vectorizer`, `knn_model`, `skills`, `titles`, `variant_titles`, `trained_at` |
| JSONL files | אין `scraped_at` — אין אפשרות לחשב פיצ'רי זמן |

---

## מה ניתן לחשב מהדאטה הקיים

| פיצ'ר | חישוב | מקור |
|--------|--------|------|
| `frequency` | מספר הפוסטים שבהם הכישור הופיע לתפקיד | ✅ JSONL |
| `prevalence` | frequency / סה"כ פוסטים לתפקיד | ✅ JSONL |
| `title_specificity` | IDF: כמה הכישור ייחודי לתפקיד זה לעומת כל שאר התפקידים | ✅ JSONL |

## מה **לא** ניתן לחשב — ויוצא מהתוכנית לחלוטין

| פיצ'ר | למה לא |
|--------|--------|
| `recency_score` | דורש `scraped_at` — אין |
| `growth_trend` | דורש ≥2 נקודות זמן — אין |
| `stability_score` | דורש חלוקה חודשית — אין |

**Preference axes שיוצאים:** `trending`, `growth`, `stability`
**נשאר preference אחד:** `title_match` (שולט בחשיבות של `title_specificity`)

---

## נוסחת Ranking

```
score = 0.7 × prevalence  +  0.3 × title_match × title_specificity
```

- `prevalence` = 70% תמיד — עוגן קבוע
- `title_match` = העדפת המשתמש [0,1], **ברירת מחדל 0.0** (backward compatible — זהה למודל הישן)
- עם `title_match=0` → ממוין לפי prevalence בלבד — **זהה למצב היום**
- עם `title_match=1` → כישורים ייחודיים לתפקיד מקבלים בוסט משמעותי

---

## סדר ביצוע

```
מקביל עכשיו:
├── Workstream A: DS-2 → DS-3 → DS-4 → DS-5 → DS-6 → DS-7
└── Workstream B: DS-8

אחרי DS-3 + DS-8:
└── Workstream C: DS-11 → DS-12

אחרי DS-12:
└── Workstream D: UI Changes
```

> DS-1 (backfill scraped_at) הוסר — לא רלוונטי לדאטה הקיים.

---

## Workstream A — Feature Matrix + Personalization

---

### DS-2 · Feature Matrix (3 פיצ'רים)

**מטרה:** להחליף `role_skill_scores[title][skill] += score` במבנה שמחשב 3 פיצ'רים.

**שינוי מבנה הנתונים ב-notebook — חלק ה-Train:**

הלולאה הקיימת נשארת ללא שינוי. מוסיפים מעקב נפרד על count (לעומת sum של scores):

```python
# קיים — לא משנים:
role_skill_scores = {title: defaultdict(float) for title in POC_TITLES}
record_counts     = defaultdict(int)

# חדש — מוסיפים:
role_skill_counts = {title: defaultdict(int) for title in POC_TITLES}

# בלולאה הקיימת, אחרי:
#   role_skill_scores[canonical][skill] += score
# מוסיפים:
    role_skill_counts[canonical][skill] += 1
```

כלומר:
- `role_skill_scores[title][skill]` — שמור ומשמש ל-`prevalence` (זהה למודל הישן)
- `role_skill_counts[title][skill]` — count בינארי חדש, משמש ל-`frequency`

**פונקציית חישוב feature_matrix:**

```python
import numpy as np
from collections import defaultdict

def compute_feature_matrix(
    role_skill_scores: dict,   # sum of weighted scores — קיים
    role_skill_counts: dict,   # count of appearances — חדש
    record_counts: dict,
) -> dict:
    all_titles = list(role_skill_scores.keys())
    n_titles   = len(all_titles)

    # IDF: כמה תפקידים מכילים כל כישור (לפי scores — כל skill שיש לו score > 0)
    skill_title_count = defaultdict(int)
    for skills in role_skill_scores.values():
        for skill in skills:
            skill_title_count[skill] += 1

    feature_matrix = {}
    for title in all_titles:
        n = record_counts[title]
        if n == 0:
            continue
        feature_matrix[title] = {}
        for skill, total_score in role_skill_scores[title].items():
            frequency  = role_skill_counts[title][skill]  # count בינארי
            prevalence = total_score / n                  # weighted — זהה למודל הישן

            # IDF-like: log(n_titles / titles_that_have_this_skill)
            idf = np.log(n_titles / skill_title_count[skill]) if skill_title_count[skill] > 0 else 0
            title_specificity = idf / np.log(max(n_titles, 2))

            feature_matrix[title][skill] = {
                'frequency':         frequency,
                'prevalence':        prevalence,          # עוד לא מנורמל
                'title_specificity': float(np.clip(title_specificity, 0.0, 1.0)),
            }

    # נרמול prevalence ל-[0,1] יחסית לתפקיד (הכישור הנפוץ ביותר = 1.0)
    for title in feature_matrix:
        max_prev = max(f['prevalence'] for f in feature_matrix[title].values())
        if max_prev > 0:
            for skill in feature_matrix[title]:
                feature_matrix[title][skill]['prevalence'] /= max_prev

    return feature_matrix

feature_matrix = compute_feature_matrix(role_skill_scores, role_skill_counts, record_counts)

# בדיקת sanity — מדפיס וקטור לדוגמה
sample_title = 'Software Engineer'
sample_skill = list(feature_matrix[sample_title].keys())[0]
print(f"Sample: ({sample_title}, {sample_skill})")
print(feature_matrix[sample_title][sample_skill])
# ציפייה: {'frequency': N, 'prevalence': [0,1], 'title_specificity': [0,1]}
```

**שמירה ב-model_artifacts:**
```python
model_artifacts = {
    'vectorizer':     vectorizer,
    'knn_model':      knn,
    'skills':         skills_data,       # נשאר לתאימות לאחור
    'titles':         variant_labels,
    'variant_titles': variant_titles,
    'feature_matrix': feature_matrix,   # ← חדש
    'trained_at':     timestamp,
}
```

**DOD:**
- [ ] `feature_matrix['Software Engineer']['python']` מכיל `frequency`, `prevalence`, `title_specificity`
- [ ] כל `prevalence` + `title_specificity` בטווח [0, 1]
- [ ] הכישור הנפוץ ביותר לכל תפקיד מקבל `prevalence = 1.0`
- [ ] `model.joblib` נטען ב-`server.py` ללא שגיאה
- [ ] הדפסת sanity cell מציגה ערכים הגיוניים

---

### DS-3 · עדכון `server.py`

**מטרה:** `/title/skills` קורא מ-`feature_matrix` לפי נוסחת ה-ranking.

**שינויים ב-`ds/model/server.py`:**

```python
# טעינה:
artifacts      = joblib.load(f'{os.path.dirname(__file__)}/model.joblib')
vectorizer     = artifacts['vectorizer']
knn            = artifacts['knn_model']
skills_data    = artifacts['skills']
variant_labels = artifacts['titles']
feature_matrix = artifacts.get('feature_matrix', {})

def rank_skills(canonical_title: str, title_match: float = 0.0, n: int = 5) -> list[str]:
    """
    score = 0.7 × prevalence + 0.3 × title_match × title_specificity
    title_match=0.0 (default) → prevalence בלבד — זהה למודל הישן.
    """
    if canonical_title not in feature_matrix:
        idx = next((i for i, t in enumerate(variant_labels) if t == canonical_title), 0)
        return skills_data[idx][:n]

    scored = [
        (
            skill,
            0.7 * feats['prevalence'] + 0.3 * title_match * feats['title_specificity']
        )
        for skill, feats in feature_matrix[canonical_title].items()
    ]
    scored.sort(key=lambda x: -x[1])
    return [s for s, _ in scored[:n]]

@app.get("/title/skills")
def predict_skills(title: str):
    vec = vectorizer.transform([title])
    _, indices = knn.kneighbors(vec)
    matched_canonical = variant_labels[indices[0][0]]
    return {
        "suggested_skills": rank_skills(matched_canonical),
        "matched_canonical": matched_canonical,
    }
```

**DOD:**
- [ ] POC test suite (`poc_files/ npm run run-poc`) עובר ללא שינוי
- [ ] `/title/skills?title=Software Engineer` מחזיר 5 skills
- [ ] `rank_skills(title, title_match=0)` = תוצאה זהה למודל הישן

---

### DS-4 · Preference Schema (title_match בלבד)

**שינויים ב-`ds/model/server.py`:**

```python
from pydantic import BaseModel, Field

class SkillPreferences(BaseModel):
    title_match: float = Field(default=0.0, ge=0.0, le=1.0)
    # trending / growth / stability הוסרו — אין דאטה לחשב אותם
    # default=0.0: backward compatible — זהה למודל הישן
```

**`ds/model/README.md`** — תחת "Preference API":
```markdown
## Preference API

### title_match (float, 0–1, default 0.0)

Controls how much role-specificity matters vs. general popularity.

- `0.0` → top skills are the most common across all tech roles **(default — backward compatible)**
- `0.5` → balanced
- `1.0` → top skills are the most specific to this role

Note: trending/growth/stability preferences require temporal data
(multiple scraping sessions with distinct dates) and are not
available in the current dataset.
```

**DOD:**
- [ ] `SkillPreferences()` ברירת מחדל = `title_match=0.0`
- [ ] ערך מחוץ ל-[0,1] → `422`
- [ ] README מעודכן עם הסבר ברור

---

### DS-5 · Weighted Ranking

`rank_skills()` כבר כתוב ב-DS-3. מחברים ל-`SkillPreferences`:

```python
def rank_skills(canonical_title: str, prefs: SkillPreferences | None = None, n: int = 5) -> list[str]:
    p = prefs or SkillPreferences()   # default: title_match=0.0
    if canonical_title not in feature_matrix:
        idx = next((i for i, t in enumerate(variant_labels) if t == canonical_title), 0)
        return skills_data[idx][:n]
    scored = [
        (skill, 0.7 * feats['prevalence'] + 0.3 * p.title_match * feats['title_specificity'])
        for skill, feats in feature_matrix[canonical_title].items()
    ]
    scored.sort(key=lambda x: -x[1])
    return [s for s, _ in scored[:n]]
```

**DOD:**
- [ ] `rank_skills('DevOps Engineer', SkillPreferences(title_match=1.0))` ≠ `rank_skills('DevOps Engineer', SkillPreferences(title_match=0.0))` — לפחות 1 skill שונה
- [ ] `rank_skills('DevOps Engineer')` (ברירת מחדל, title_match=0.0) זהה לתוצאת המודל הישן

---

### DS-6 · עדכון `/title/skills` API

```python
@app.get("/title/skills")
def predict_skills(title: str, title_match: float = 0.0):
    prefs = SkillPreferences(title_match=title_match)
    vec = vectorizer.transform([title])
    _, indices = knn.kneighbors(vec)
    matched_canonical = variant_labels[indices[0][0]]
    return {
        "suggested_skills": rank_skills(matched_canonical, prefs),
        "matched_canonical": matched_canonical,
    }
```

**DOD:**
- [ ] `GET /title/skills?title=DevOps Engineer` (ללא params, title_match=0.0) — תוצאה זהה למודל הישן
- [ ] `GET /title/skills?title=DevOps Engineer&title_match=1.0` — תוצאה שונה + `matched_canonical` ב-response
- [ ] `GET /title/skills?title=DevOps Engineer&title_match=2.0` → `422`

---

### DS-7 · Integration Tests

**קובץ:** `ds/model/test_preferences.py`

```python
"""
Unit tests עם feature_matrix מדומה — בוחנים שהלוגיקה עובדת.
Smoke tests עם server אמיתי — בוחנים שה-API מחזיר תגובה תקינה.
"""
import sys, requests
import server
from server import rank_skills, SkillPreferences

# ── MOCK feature_matrix ───────────────────────────────────────────────────────
# python: נפוץ מאוד, לא ייחודי (מופיע בכל תפקיד)
# bash:   נפוץ בינוני, ייחודי מאוד ל-DevOps
# react:  לא נפוץ מאוד, ייחודי מאוד ל-DevOps (לצורכי בדיקה)

MOCK_MATRIX = {
    "DevOps Engineer": {
        "python": {
            "frequency": 200, "prevalence": 1.0, "title_specificity": 0.1,
        },
        "bash": {
            "frequency": 140, "prevalence": 0.7, "title_specificity": 0.9,
        },
        "linux": {
            "frequency": 130, "prevalence": 0.65, "title_specificity": 0.75,
        },
        "kubernetes": {
            "frequency": 120, "prevalence": 0.6, "title_specificity": 0.85,
        },
        "terraform": {
            "frequency": 80, "prevalence": 0.4, "title_specificity": 0.9,
        },
        "communication": {
            "frequency": 30, "prevalence": 0.15, "title_specificity": 0.05,
        },
    }
}

original_fm = server.feature_matrix
server.feature_matrix = MOCK_MATRIX
failures = 0

# בדיקה 1: title_match=1.0 → bash/kubernetes/terraform עולים (specificity גבוה)
high_match = rank_skills("DevOps Engineer", SkillPreferences(title_match=1.0))
low_match  = rank_skills("DevOps Engineer", SkillPreferences(title_match=0.0))
diff = set(high_match) - set(low_match)
if not diff:
    print(f"FAIL unit-1: title_match=1.0 vs 0.0 — no difference\n  high={high_match}\n  low={low_match}")
    failures += 1
else:
    print(f"PASS unit-1: {len(diff)} skills differ: {diff}")

# בדיקה 2: title_match=0 → python (prevalence=1.0) חייב להיות ראשון
if low_match[0] != "python":
    print(f"FAIL unit-2: title_match=0 should rank python first, got {low_match}")
    failures += 1
else:
    print("PASS unit-2: python is #1 with title_match=0 (pure prevalence)")

# בדיקה 3: communication (prevalence=0.15, specificity=0.05) לא בtop-5 בשום הגדרה
for label, prefs in [("default", SkillPreferences()), ("max_match", SkillPreferences(title_match=1.0))]:
    skills = rank_skills("DevOps Engineer", prefs)
    if "communication" in skills:
        print(f"FAIL unit-3 [{label}]: 'communication' (low on both axes) appeared in top-5: {skills}")
        failures += 1
    else:
        print(f"PASS unit-3 [{label}]: 'communication' correctly excluded")

# בדיקה 4: prevalence כעוגן — python חייב בtop-5 גם עם title_match=1.0
if "python" not in high_match:
    print(f"FAIL unit-4: python (prevalence=1.0) missing from top-5 with title_match=1.0: {high_match}")
    failures += 1
else:
    print("PASS unit-4: python (high prevalence) stays in top-5 even with title_match=1.0")

server.feature_matrix = original_fm

# ── Smoke tests ───────────────────────────────────────────────────────────────
BASE = "http://localhost:8000"
POC_TITLES = ['Software Engineer', 'Data Scientist', 'Product Manager',
              'DevOps Engineer', 'Frontend Developer']

try:
    for title in POC_TITLES:
        r = requests.get(f"{BASE}/title/skills", params={"title": title}, timeout=5)
        skills = r.json().get("suggested_skills", [])
        if r.status_code != 200 or len(skills) != 5:
            print(f"FAIL smoke [{title}]: status={r.status_code}, skills={skills}")
            failures += 1
        else:
            print(f"PASS smoke [{title}]: {skills}")

    # ולידציה: matched_canonical קיים ותקין
    r = requests.get(f"{BASE}/title/skills", params={"title": "DevOps Engineer"}, timeout=5)
    canonical = r.json().get("matched_canonical")
    if canonical not in POC_TITLES:
        print(f"FAIL smoke: matched_canonical='{canonical}' not in POC_TITLES")
        failures += 1
    else:
        print(f"PASS smoke: matched_canonical='{canonical}'")

    r = requests.get(f"{BASE}/title/skills",
                     params={"title": "DevOps Engineer", "title_match": 2.0}, timeout=5)
    if r.status_code == 422:
        print("PASS smoke: out-of-range title_match=2.0 → 422")
    else:
        print(f"FAIL smoke: expected 422, got {r.status_code}")
        failures += 1

except requests.ConnectionError:
    print("SKIP smoke: server not running")

print(f"\n{'All tests passed.' if not failures else f'{failures} FAILED'}")
sys.exit(1 if failures else 0)
```

**DOD:**
- [ ] Unit tests עוברים ללא server
- [ ] Smoke tests עוברים כשה-server רץ
- [ ] `exit(0)`

---

## Workstream B — Title Coverage Expansion

---

### DS-8 · Define Canonical Title Set (~35 Roles)

**מטרה:** להחליף 5 POC titles ב-30–40 titles מהדאטה הקיים.

**תא ניתוח ב-notebook:**
```python
title_counts = df['query_title'].value_counts()
eligible     = title_counts[title_counts >= 20].sort_values(ascending=False)

def confidence_level(n: int) -> str:
    if n >= 100: return 'high'
    if n >= 50:  return 'medium'
    return 'low'

print(f"Eligible titles (≥20 records): {len(eligible)}")
for title, count in eligible.items():
    print(f"  [{confidence_level(count):6}] {title}: {count} records")
```

**שמירת canonical_titles.json:**
```python
import json

canonical_data = {
    'canonical_titles':  list(eligible.index),
    'record_counts':     eligible.to_dict(),
    'confidence_levels': {t: confidence_level(n) for t, n in eligible.items()},
    'generated_at':      timestamp,
}
with open(r'c:\Git\CareerLens\ds\model\canonical_titles.json', 'w', encoding='utf-8') as f:
    json.dump(canonical_data, f, indent=2, ensure_ascii=False)

print(f"Saved {len(canonical_data['canonical_titles'])} canonical titles")
```

**עדכון `/title/skills` — מחזיר data_confidence:**
```python
# בתחילת server.py — מוסיפים את הפונקציה ואת הטעינה:
def confidence_level(n: int) -> str:
    if n >= 100: return 'high'
    if n >= 50:  return 'medium'
    return 'low'

# טעינה עם fallback — אם הקובץ עוד לא נוצר, ה-server לא קורס:
_canonical_json = os.path.join(os.path.dirname(__file__), 'canonical_titles.json')
try:
    with open(_canonical_json, encoding='utf-8') as f:
        canonical_data = json.load(f)
except FileNotFoundError:
    canonical_data = {'record_counts': {}, 'confidence_levels': {}}

@app.get("/title/skills")
def predict_skills(title: str, title_match: float = 0.5):
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
```

**DOD:**
- [ ] `canonical_titles.json` עם ≥30 titles
- [ ] כל title עם ≥20 רשומות בדאטה
- [ ] 5 ה-POC titles קיימים ב-canonical_titles
- [ ] API מחזיר `data_confidence` + `records_count`
- [ ] KNN מאומן מחדש על variant_titles המורחב
- [ ] `GET /title/skills?title=Software Engineer` עדיין מחזיר אותם top-5 (regression)

---

## Workstream C — Auto Title Extraction

> תלוי ב-DS-3 + DS-8

---

### DS-11 · CV Title Extraction (Regex + Keyword Fallback)

**קובץ:** `ds/src/pipeline/cv_pipeline.py`

```python
import re
from typing import Optional

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
    # שלב 1: regex על תבניות קלאסיות
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

    # שלב 2: fallback — שורה קצרה עם מילת מפתח
    for line in cv_text.splitlines():
        line = line.strip()
        if 2 <= len(line.split()) <= 5 and _looks_like_title(line):
            return line.title()

    return None
```

**endpoint ב-`server.py`:**
```python
# בראש server.py — import נכון: server.py נמצא ב-ds/model/, מוסיפים ds/ ל-path:
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.pipeline.cv_pipeline import extract_title_from_cv

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
```

**DOD:**
- [ ] `"Software Engineer | Google | 2022–2024"` → `"Software Engineer"`
- [ ] `"Current Role: Senior Data Scientist"` → `"Senior Data Scientist"`
- [ ] שורה עם "backend developer" בלבד → fallback מחזיר `"Backend Developer"`
- [ ] CV ללא כותרת → `None`
- [ ] `POST /cv/title` מחזיר `canonical_title + confidence + low_confidence`
- [ ] `confidence < 0.4` → `low_confidence: true`

---

### DS-12 · Top-3 Matches

**שינוי ב-`training.ipynb` — שורה אחת:**
```python
knn = NearestNeighbors(n_neighbors=3, metric='cosine')  # היה 1
```

**endpoint חדש ב-`server.py`:**
```python
@app.get("/title/match")
def match_title(title: str):
    vec = vectorizer.transform([title])
    distances, indices = knn.kneighbors(vec)
    matches = [
        {"canonical": variant_labels[idx], "confidence": round(float(1 - dist), 2)}
        for dist, idx in zip(distances[0], indices[0])
    ]
    return {"matches": matches, "low_confidence": matches[0]["confidence"] < 0.4}
```

**DOD:**
- [ ] שינוי `n_neighbors=3` ב-notebook → הרצת תא האימון מחדש → שמירת `model.joblib` → הפעלת server מחדש
- [ ] `/title/match?title=Data Analyst` → 3 matches
- [ ] top match של `"Senior Software Engineer"` → `"Software Engineer"`
- [ ] `/title/skills` ממשיך לעבוד זהה (לוקח `indices[0][0]` = top-1 בלבד)
- [ ] POC tests עוברים

---

## Workstream D — UI Changes

> תלוי ב-DS-12 + DS-6

---

### UI-1 · Auto Title Display

**Flow:**
```
PDF uploaded → POST /api/cv/upload → cvText
→ POST /cv/title → {canonical_title, confidence, low_confidence}
→ שדה jobTitle מתמלא אוטומטית עם canonical_title
→ badge "Auto-detected"
→ אם low_confidence → warning
→ כפתור "Change" → GET /title/match → dropdown 3 options
```

**DOD:**
- [ ] שדה הכותרת מתמלא אוטומטית אחרי העלאת CV
- [ ] badge "Auto-detected" מוצג
- [ ] `low_confidence: true` → `"We're not sure we recognize this title — results may be less accurate"`
- [ ] "Change" → dropdown עם 3 options + confidence %
- [ ] CV ללא כותרת → שדה ריק + typing → debounce 300ms → `/title/match`
- [ ] `canonical_title` (לא raw text) נשלח עם הניתוח

---

### UI-2 · Title Match Preference Slider

**שינויים ב-Frontend:**
- `<details>` accordion: `"Customize skill priorities (optional)"`
- סליידר אחד בלבד: **Most common** ← Balanced → **Role-specific** (default: 0.0 = Most common)
- הערך עובר כ-`title_match` param ל-`/title/skills`
- אם `data_confidence === 'low'` → warning קטן מתחת לסליידר: `"Limited data for this role — results may vary"`

**DOD:**
- [ ] הסקשן מוסתר כברירת מחדל
- [ ] שינוי הסליידר מעדכן את ה-skills המוצגים
- [ ] ללא שינוי → תוצאה זהה לפני
- [ ] `data_confidence=low` → warning מוצג

---

## סיכום DOD כולל

| שלב | Done כאשר |
|-----|-----------|
| DS-2 | `feature_matrix` ב-joblib עם 3 פיצ'רים, כולם [0,1], sanity cell תקין |
| DS-3 | POC tests עוברים, נוסחת 70/30, fallback לרשימה ישנה |
| DS-4 | `SkillPreferences(title_match)`, `422` על out-of-range, README |
| DS-5 | `title_match=1.0` ≠ `title_match=0.0`, regression guard |
| DS-6 | backwards compat, `422` לcorrect |
| DS-7 | unit tests עם MOCK + smoke tests → exit 0 |
| DS-8 | `canonical_titles.json`, confidence levels, API מחזיר `data_confidence` |
| DS-11 | regex + fallback, `/cv/title` עם confidence |
| DS-12 | `/title/match` 3 results, `/title/skills` backwards compat |
| UI-1 | auto-detect, warning, change dropdown |
| UI-2 | סליידר role-specific, warning על low confidence |

---

## שאלות פתוחות

> סימן ✅ = נענה. ממתינות לתשובה לפני שממשיכים במימוש.

---

### ✅ Q1 — DS-8: אילו titles קיימים בדאטה עם ≥20 רשומות?

**הקשר:** תא הניתוח ב-notebook (DS-8) מוכן ומחכה להרצה.
**מה צריך:** להריץ את תא הניתוח בnotebook ולדווח על הפלט.
**חסום:** את `CANONICAL_TITLE_VARIANTS` אי אפשר למלא עד לקבלת הרשימה.

---

### ✅ Q2 — UI-1 / UI-2: דרך הגישה לDS model מה-Frontend

**הקשר:** ה-Frontend מדבר עם הbackend בלבד (`/api`, port 3000). ה-DS model רץ על port 8000 ולא נגיש ישירות מה-browser.

**שתי אפשרויות:**

| אפשרות | יתרון | חיסרון |
|--------|--------|---------|
| **A — Backend proxy routes** | Frontend לא משתנה, אבטחה טובה | צריך להוסיף routes לbackend (`POST /api/cv/extract-title`, `GET /api/title/match`) |
| **B — Frontend קורא ל-DS ישירות** | פשוט יותר | צריך CORS בDS model, URL נוסף בclient config |

**חסום:** UI-1 ו-UI-2 לא ממומשים עד לתשובה.

---

### ✅ Q3 — DS-12: הרצת אימון מחדש

**הקשר:** שיניתי `n_neighbors=3` בnotebook. כדי שה-server יטען את הmodel החדש צריך:
1. להריץ את כל תאי Train בnotebook
2. לשמור model.joblib (תא ה-Save)
3. להפעיל את ה-DS server מחדש

**מה צריך:** אישור שהאימון רץ מחדש לפני שמריצים בדיקות.

---

## מה מחכה לאחר סקרייפינג נוסף

רק לאחר מספר ריצות סקרייפינג עם תאריכים אמיתיים ושונים (≥3 נקודות זמן) ניתן יהיה להוסיף:

- `recency_score`, `growth_trend`, `stability_score` לfeature_matrix
- Preference axes: `trending`, `growth`, `stability` ל-API וl-UI
- DS-9 — data for new titles
- DS-14–DS-17 — company context enrichment
