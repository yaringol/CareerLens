# titles_model_progress

מסמך onboarding מלא ועצמאי לשדרוג **מסווג התפקידים (CV → job title)**.
כל מי שמושך את branch `model-improvment` ממחשב אחר צריך להצליח, רק מהמסמך הזה,
להבין מה נעשה, להריץ הכול, ולוודא שהקוד החדש פעיל. לא הושמט דבר בכוונה.

- **Branch:** `model-improvment`
- **Commit עיקרי:** `b68122a` - _feat(ds): retrain CV→title classifier and wire calibrated detection to UI_
- **תאריך:** 2026-07-01

---

## תוכן עניינים
1. [מטרה ורקע](#1-מטרה-ורקע)
2. [רשימת כל הקבצים שהשתנו/נוספו](#2-רשימת-כל-הקבצים-שהשתנונוספו)
3. [Setup ממחשב חדש (מאפס)](#3-setup-ממחשב-חדש-מאפס)
4. [ארכיטקטורה - איך הכול מחובר](#4-ארכיטקטורה--איך-הכול-מחובר)
5. [ההחלטות וההנדסה (בפירוט מלא)](#5-ההחלטות-וההנדסה-בפירוט-מלא)
6. [תוצאות ומדדים](#6-תוצאות-ומדדים)
7. [מה בתוך המודל מול מה בקוד (deploy)](#7-מה-בתוך-המודל-מול-מה-בקוד-deploy)
8. [איך לוודא שהקוד החדש פעיל](#8-איך-לוודא-שהקוד-החדש-פעיל)
9. [איך לאמן מחדש (הרצת המחברת)](#9-איך-לאמן-מחדש-הרצת-המחברת)
10. [אזהרות ומגבלות](#10-אזהרות-ומגבלות)
11. [השלבים הבאים](#11-השלבים-הבאים)

---

## 1. מטרה ורקע

היעד: להוכיח שזיהוי התפקיד הוא **למידה אמיתית** ולא רק חיפוש דמיון, ולשלב אותו נכון ב-UI.

- ה-KNN שב-[train.py](train.py) (endpoint `/title/match`) הוא fuzzy-matching על מחרוזות - **לא** למידה.
- המסווג ב-[tfid.ipynb](tfid.ipynb) לומד לסווג תפקיד מתוך גוף הקו"ח (skills/אחריות/טכנולוגיות),
  כשהטייטל מוסתר. הוא נשמר ל-`text_to_job_title_classifier.joblib` ומוגש דרך `GET /cv/role`.

**שני מודלים נפרדים חיים ב-[ds/model/](.):**
| קובץ | מה זה | נבנה ע"י | Endpoint |
|---|---|---|---|
| `model.joblib` | KNN של טייטלים (59 קנוניים) + feature_matrix של skills | [train.py](train.py) | `/title/match`, `/title/skills` |
| `text_to_job_title_classifier.joblib` | **המסווג CV→title (38 מחלקות)** ← נשוא העבודה | [tfid.ipynb](tfid.ipynb) | `/cv/role` |

---

## 2. רשימת כל הקבצים שהשתנו/נוספו

**חדשים (ב-commit `b68122a`):**
- `ds/model/label_map.py` - איחוד לייבלים (65→38) + מיפוי fallback סמנטי (38→59).
- `ds/model/tfid.ipynb` - המחברת שמאמנת את המסווג (רצה מקצה-לקצה עם פלטים).

**שונו (ב-commit `b68122a`):**
- `ds/model/server.py` - endpoint `/cv/role` שוכתב (נרמול confidence + יישור טייטל); הוסף `import label_map`.
- `ds/model/text_to_job_title_classifier.joblib` - המודל המאומן מחדש (38 מחלקות).
- `backend/src/services/dsModel.ts` - טיפוסים + `classifyRoles` + `rolesToSuggestions` מעבירים `canonical_title`.
- `backend/src/routes/cv.routes.ts` - `detectedTitle` = הטייטל הגולמי שזוהה.
- `frontend/src/components/upload/CvUploadSection.tsx` - סף `AUTO_MATCH_CONFIDENCE_MIN` 90→60 + תצוגה.

**מסמכים (אולי לא ב-commit - בדוק `git status`):**
- `ds/model/CV_TITLE_CLASSIFIER.md` - סיכום + שלבים הבאים.
- `ds/model/titles_model_progress.md` - המסמך הזה.

**מחוץ ל-commit בכוונה:**
- `ds/model/master_resumes.jsonl` (**16MB** - דאטת האימון; מומלץ Git LFS. **נדרש רק לאימון מחדש**, לא להרצת האפליקציה).
- גיבוי joblib מתוארך (`text_to_job_title_classifier_YYYYMMDD_HHMMSS.joblib`).
- `HomePage.css`, `ImproveCVScreen.tsx`, `SkillsMatchDashboard.tsx` - WIP קיים שלא קשור לעבודה הזו; **לא לבלבל**.

---

## 3. Setup ממחשב חדש (מאפס)

```bash
git clone <repo> && cd CareerLens
git checkout model-improvment
```

### 3א. DS model service (Python, port 8000)
זה מה שנדרש כדי שהאפליקציה תעבוד (המודל כבר ב-git):
```bash
cd ds/model
pip install -r requirements.txt          # fastapi, uvicorn, sklearn, spacy, skillNer, en_core_web_lg...
python server.py                          # מאזין על http://localhost:8000
```
> ה-server טוען את שני ה-joblibs ואת `label_map.py` בעלייה. `label_map.py` **חייב** להיות לצד `server.py`.
> requirements.txt מכסה את ה-**server בלבד** - לא את המחברת (ראו §9).

### 3ב. Backend (Node, port 3000)
```bash
cd backend && npm install && npm run dev   # משתמש ב-DS_MODEL_URL (ברירת מחדל http://localhost:8000)
```

### 3ג. Frontend (Vite)
```bash
cd frontend && npm install && npm run dev
```

---

## 4. ארכיטקטורה - איך הכול מחובר

זרימת זיהוי התפקיד מהעלאת קו"ח:
```
מסך העלאה (CvUploadSection.tsx: detectRole)
 → detectCvTitle()               frontend/src/services/api.ts
 → POST /api/cv/title            backend/src/routes/cv.routes.ts
 → detectTitleFromCv()           backend/src/services/dsModel.ts   (קורא ל-/cv/role, מוסיף canonicalTitle)
 → GET /cv/role                  ds/model/server.py                (נרמול confidence + to_supported_title)
 → text_to_job_title_classifier.joblib   ← המסווג (predict_proba)
```
בהמשך: ה-`canonicalTitle` נשמר ל-sessionStorage → מסך הפרסונליזציה →
`POST /api/personalize/options` → `getCoreSkills(canonicalTitle)` → `GET /title/skills` (KNN).
**לכן** הטייטל שנשלח הלאה חייב להיות אחד מ-59 הטייטלים שיש להם skills.

---

## 5. ההחלטות וההנדסה (בפירוט מלא)

### 5.1 איחוד לייבלים - [label_map.py](label_map.py) `consolidate()`
הדאטה `master_resumes.jsonl` (4,817 קו"ח) הכיל **65 טייטלים גולמיים** עם סינונימים מפוצלים
וזנב נדיר. מיפוי "מורחב" → **38 מחלקות נקיות**, **99.4% מהדאטה נשמר**, כולן ≥100 דוגמאות.
כלל: שם קנוני היכן שקיים, מיזוג סינונימים אמיתיים, זריקת רעש לא-IC (Operations/Project/Business
Manager/Analyst, Electrical Engineer, SAP, Advocate).

### 5.2 מניעת דליפה (Leakage) - קריטי להוכחת הלמידה
- **77% מהקו"ח מכילים את שם התפקיד מילה-במילה ב-summary** → מודל נאיבי "מעתיק" את הטייטל.
- פתרון בזמן האימון (במחברת):
  1. `idx==0 guard` - מסירים את כותרת התפקיד הנוכחי מבלוק הניסיון שלו.
  2. `scrub` - מסירים את מחרוזת הטייטל הגולמי מכל הטקסט (בעיקר ה-summary).
- מדידה: הסרת הדליפה הורידה CV macro-F1 מ-**0.981 → 0.932** (הפער = הדליפה; 0.932 הוא ההגון).
- **לא** הוספנו את מילות הלייבלים ל-stop-words: `react`, `angular`, `sql` הם כישורים לגיטימיים;
  הסרתם ריסקה תפקידים ממוקדי-פריימוורק (F1 צנח מ-0.89 ל-0.2). ניקוי הדליפה נעשה רק דרך `scrub`.
  > ⚠️ אסימטריה מודעת: `scrub` הוא training-time בלבד (דורש ground-truth של הטייטל). ב-inference
  > הטקסט מוזן כמו שהוא - זה תקין, כי המודל למד להישען על כישורים.

### 5.3 המחברת [tfid.ipynb](tfid.ipynb)
Section B (baselines + שחזור קונפיג ישן) → A1 (איחוד) → A2 (harness: metrics, CV, confusion,
learning curve) → A3 (V1 TF-IDF+LogReg) → Leakage ablation → A4 (V2 embeddings) → A5 (השוואה + שמירה).

### 5.4 נרמול ה-confidence - [server.py `/cv/role`](server.py)
הבעיה: הסתברות גולמית מתפרסת על 38 מחלקות → top-1 טיפוסי 15-40%, אז סף UI ישן (90) אף פעם לא נפתח.
הפתרון: מחזירים `confidence` = **חלק יחסי מנורמל מתוך ה-top-3** (סכום ≈100%). top-1 דומיננטי
~80-100; תיקו אמיתי ~50. (בנוסף `raw_confidence` = softmax גולמי, לדיבוג.)

מבנה תגובת `/cv/role` (מערך top-3):
```json
[{"job_title": "iOS Developer", "canonical_title": "Software Engineer",
  "confidence": 78.4, "raw_confidence": 22.1}, ...]
```

### 5.5 יישור מרחב לייבלים - [label_map.py](label_map.py) `to_supported_title()`
ה-`canonicalTitle` מזין `getCoreSkills → /title/skills`, שמכיר רק את **59 הטייטלים הקנוניים** (מ-train.py).
ה-KNN של char-ngrams הוא fallback **שגוי סמנטית** (`iOS→Kernel`, `JavaScript→Java`, `SQL→Frontend`).
לכן בנינו **מפה סמנטית מאוצרת** `CLASSIFIER_TO_SUPPORTED`: 21 זהות + 17 מיפויים ידניים:

| classifier label | → נתמך | | classifier label | → נתמך |
|---|---|---|---|---|
| AI Engineer | Machine Learning Engineer | | Mobile Developer | Software Engineer |
| Android Developer | Software Engineer | | NoSQL Developer | Data Engineer |
| Angular Developer | Frontend Developer | | React Native Developer | Frontend Developer |
| Automation Engineer | QA Automation Engineer | | SQL Developer | Data Engineer |
| Blockchain Developer | Backend Developer | | Security Engineer | Cyber Security |
| Database Administrator | Data Engineer | | Systems Engineer | DevOps Engineer |
| Database Engineer | Data Engineer | | iOS Developer | Software Engineer |
| Flutter Developer | Software Engineer | | Vue Developer | Frontend Developer |
| JavaScript Developer | Frontend Developer | | | |

(21 האחרים ממופים לעצמם - כבר בסט ה-59. כל היעדים אומתו כקיימים ב-59.)

### 5.6 חיווט backend → frontend
- [dsModel.ts](../../backend/src/services/dsModel.ts): `CVTitleDetectionResponse`/`DetectedRole` קיבלו
  `canonical_title`/`canonicalTitle`; `rolesToSuggestions` שם `suggestion.canonicalTitle = canonical_title`,
  `matchedVariant = jobTitle`.
- [cv.routes.ts](../../backend/src/routes/cv.routes.ts): `detectedTitle = top.matchedVariant` (הגולמי).
- [CvUploadSection.tsx](../../frontend/src/components/upload/CvUploadSection.tsx):
  `AUTO_MATCH_CONFIDENCE_MIN = 60`; מציג "Detected as X ·" רק כשהוא שונה מה-canonical.

---

## 6. תוצאות ומדדים (מרחב 38 מחלקות, holdout)

| מודל | accuracy | macro-F1 | CV macro-F1 |
|---|---|---|---|
| Dummy (most_frequent) | 0.091 | 0.004 | - |
| **V1 - TF-IDF + LogReg** ✅ נבחר | **0.911** | **0.931** | **0.932 ± 0.004** |
| V2 - Embeddings (`all-MiniLM-L6-v2`) + LogReg | 0.844 | 0.869 | 0.861 ± 0.005 |

- פי ~230 מעל baseline + CV יציב מאוד → למידה, לא מקריות.
- Leakage ablation: 0.981 (דולף) → 0.932 (נקי).
- כיול הסף: על holdout, share של ניבוי נכון חציון **95** מול שגוי **41** → סף **60** נותן ~87% auto-accept.

---

## 7. מה בתוך המודל מול מה בקוד (deploy)

**בתוך `text_to_job_title_classifier.joblib`:** אך ורק `sklearn.pipeline.Pipeline` (tfidf + clf, 38 מחלקות,
`predict_proba`). **אין** בו את הנרמול/ה-fallback/ה-scrub/ה-consolidate.

**בקוד (חייב deploy יחד):**
| רכיב | קובץ | זמן |
|---|---|---|
| נרמול confidence + החזרת canonical_title | `server.py` `/cv/role` | inference |
| `to_supported_title` (fallback סמנטי) | `label_map.py` | inference |
| `consolidate`, `scrub` | `label_map.py` / `tfid.ipynb` | **training בלבד** |
| חיווט canonical_title | `dsModel.ts`, `cv.routes.ts` | backend |
| סף 60 + תצוגה | `CvUploadSection.tsx` | frontend |

**מסקנות deploy:**
1. העתקת ה-`.joblib` לבדו **לא מספיקה** - צריך גם `server.py` **וגם `label_map.py`** (ה-server מייבא אותו; בלעדיו קורס).
2. **חובה restart ל-DS service** - המודל והקוד נטענים רק בעלייה.
3. backend ו-frontend צריכים build/deploy נפרד.

---

## 8. איך לוודא שהקוד החדש פעיל

**DS `/cv/role`** (חדש = יש `canonical_title`+`raw_confidence`, ו-`confidence` מסתכם ל-~100):
```bash
curl "http://localhost:8000/cv/role?text=iOS%20developer%20Swift%20Xcode%20UIKit%20CoreData%20native%20iphone%20apps"
# מצופה: job_title="iOS Developer", canonical_title="Software Engineer"
```
**המודל (38 מחלקות):**
```bash
cd ds/model && python -c "import joblib; m=joblib.load('text_to_job_title_classifier.joblib'); print(len(m.classes_))"  # 38
```
**Backend `/api/cv/title`** (detectedTitle גולמי, suggestions[0].canonicalTitle נתמך - יכולים להיות שונים):
```bash
curl -X POST http://localhost:3000/api/cv/title -H "Content-Type: application/json" \
  -d '{"cvText":"iOS developer 5 yrs Swift Xcode UIKit building native apps ...(>50 chars)"}'
```
**Frontend:** הקבוע `AUTO_MATCH_CONFIDENCE_MIN = 60` (לא 90); תפקיד ברור מזוהה אוטומטית.

**כל 59 הטייטלים נתמכים:**
```bash
cd ds/model && python -c "import joblib; a=joblib.load('model.joblib'); c={};
[c.__setitem__(t,max(c.get(t,0),len(s))) for t,s in zip(a['titles'],a['skills'])];
print('empty:',[t for t in c if c[t]==0] or 'none','| total:',len(c))"   # empty: none | total: 59
```

---

## 9. איך לאמן מחדש (הרצת המחברת)

⚠️ **דורש את `master_resumes.jsonl` (16MB) שאינו ב-git** - יש להשיגו ולשים ב-`ds/model/`.
תלויות מעבר ל-requirements.txt (המחברת בלבד):
```bash
pip install pandas matplotlib seaborn scikit-learn joblib sentence-transformers jupyter nbconvert
cd ds/model
python -m nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=1200 tfid.ipynb
```
המחברת שומרת מחדש את `text_to_job_title_classifier.joblib` (+ גיבוי מתוארך). אחר כך **restart ל-DS service**.
> V1 (הנבחר) משתמש רק ב-sklearn; ה-server **אינו** צריך sentence-transformers. הוא נדרש רק ל-V2 במחברת.

---

## 10. אזהרות ומגבלות
- **המספרים אופטימיים:** 0.93 נמדד על דאטה סינתטי מובנה. קו"ח אמיתיים (PDF רועש, מחליפי-קריירה, היברידיים) יתנהגו אחרת.
- **master_resumes.jsonl לא ב-git** - בלי הקובץ אי אפשר לאמן מחדש (אבל האפליקציה עובדת עם המודל המצורף).
- **restart חובה** אחרי כל שינוי ב-DS.
- מחלקות מתבלבלות מטבען: Frontend↔React Native, Database Engineer↔DBA, ML↔Deep/AI Engineer.
- הסף (60) והדיוק כוילו על דאטה סינתטי - טעונים אימות אמיתי (§11).

---

## 11. השלבים הבאים
ראו [CV_TITLE_CLASSIFIER.md](CV_TITLE_CLASSIFIER.md) לפירוט. בקצרה: לבנות test set של 20-40 קו"ח
אמיתיים ומורכבים עם ground-truth, להריץ דרך `/api/cv/title`, ולמדוד Top-1/Top-3 accuracy,
confidence calibration, ו-manual-fallback rate - ואז לכייל מחדש את הסף/המפה לפי המציאות.
