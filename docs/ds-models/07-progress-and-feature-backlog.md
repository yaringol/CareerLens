# CareerLens DS — Progress Summary

> סיכום כל ההתקדמות שנעשתה, מה נשאר, ומה הסקרייפינג צריך לספק כדי לשפר את המודל.

---

## מה בוצע

### מודל — Feature Matrix (DS-2 עד DS-6)

**לפני:** המודל חישב `role_skill_scores[title][skill] += score` — מספר אחד לכל (תפקיד, כישור), מיון לפי prevalence בלבד.

**אחרי:** כל (תפקיד, כישור) מקבל 3 פיצ'רים:

| פיצ'ר | מה הוא מודד |
|--------|------------|
| `frequency` | מספר פוסטים שבהם הכישור הופיע |
| `prevalence` | שכיחות יחסית (weighted score / n_posts), מנורמל ל-[0,1] |
| `title_specificity` | IDF-like: כמה הכישור ייחודי לתפקיד זה לעומת שאר התפקידים |

**נוסחת ranking:**
```
score = 0.7 × prevalence + 0.3 × title_match × title_specificity
```
- `title_match = 0.0` (ברירת מחדל) → תוצאה זהה למודל הישן — backward compatible
- `title_match = 1.0` → כישורים ייחודיים לתפקיד עולים

---

### הרחבת Titles (DS-8)

**לפני:** 5 POC titles בלבד.

**אחרי:** 59 canonical titles מהדאטה הקיים.

| רמה | כמות | תנאי |
|-----|------|------|
| `high` | 23 titles | ≥100 רשומות |
| `medium` | 27 titles | 50–99 רשומות |
| `low` | 9 titles | 20–49 רשומות |

**High confidence (23):** Software Engineer (630), SOC Analyst (449), Product Manager (334), Digital Forensics (326), Backend Developer (326), Detection Engineer (321), Incident Response (313), Security Analyst (289), Cyber Security (238), Embedded Engineer (162), Fullstack Engineer (161), Cloud Security (154), Threat Intelligence (145), Data Scientist (142), Distributed Systems Engineer (141), C++ Developer (134), DevOps Engineer (133), Security Operations (131), Frontend Developer (119), QA Automation Engineer (119), Firmware Engineer (107), Security Architect (105), UX Designer (104)

**Low confidence (9 — דורשים סקרייפינג):** Vulnerability Researcher (48), MLOps Engineer (45), Cryptographer (45), Deep Learning Engineer (34), Kernel Developer (32), Reinforcement Learning Researcher (27), Cloud Native Engineer (27), Technical Product Manager (TPM) (26), Java Developer (24)

---

### Endpoints חדשים ב-DS server

| Endpoint | מה הוא עושה |
|----------|------------|
| `GET /title/skills?title=&title_match=` | skills + `matched_canonical` + `data_confidence` + `records_count` |
| `GET /title/match?title=` | top-3 canonical matches עם confidence score |
| `POST /cv/title` | מחלץ כותרת מ-CV text בregex, ממפה ל-canonical |

---

### Backend Proxy (job.service, dsModel, cv.routes, analyze.routes)

- `dsModel.ts` — נוספו `matchTitle()`, `extractTitleFromCv()`
- `getCoreSkills()` — מקבל עכשיו `titleMatch` param
- `getCoreSkillsById()` — מעביר `titleMatch` ל-DS model
- `POST /api/cv/extract-title` — proxy ל-DS `/cv/title`
- `GET /api/title/match` — proxy ל-DS `/title/match`
- `POST /api/analyze` + `POST /api/analyze/skillner` — מקבלים `titleMatch` מהbody

---

### Frontend (UI-1 + UI-2)

**UI-1 — Auto Title Detection:**
- אחרי העלאת CV → קריאה אוטומטית ל-`/cv/extract-title`
- `cvText` נשמר ב-state → submit לא מעלה פעמיים
- badge "Auto-detected" עם כותרת שזוהתה
- warning אם `low_confidence: true`
- warning נפרד אם `data_confidence: "low"`
- כפתור "Change" → dropdown עם 3 suggestions + confidence%
- CV ללא כותרת → שדה ידני עם debounce autocomplete

**UI-2 — Preference Slider:**
- `<details>` accordion מוסתר כברירת מחדל
- סליידר: **Most common ← Balanced → Role-specific**
- ערך נשלח כ-`titleMatch` עם כל בקשת analyze

---

### Testing & Infrastructure

- `ds/model/test_preferences.py` — unit tests עם MOCK_MATRIX + smoke tests
- `ds/model/train.py` — standalone training script (מחליף את הnotebook לאימון)
- Training: 59 titles, 269 variant titles, `n_neighbors=3`, feature_matrix בmodel.joblib
- `ds/model/canonical_titles.json` — record counts + confidence levels לכל title
- `listJobs()` — הוסר hardcoded check ל-5 jobs

---

## מה עדיין נשאר

### פיצ'רים שממתינים לדאטה זמני

שלושת הפיצ'רים הבאים **כתובים בקוד** ב-`train.py` אבל כרגע מחזירים `0.0` כי אין timestamps בדאטה הקיים:

| פיצ'ר | מה צריך |
|--------|---------|
| `recency_score` | `scraped_at` על כל רשומה + ≥3 נקודות זמן שונות |
| `growth_trend` | ≥2 נקודות זמן שונות (עדיף חודשיות) |
| `stability_score` | ≥3 חודשים שונים כדי לחשב coefficient of variation |

ברגע שיהיו timestamps — **אפשר להפעיל** `trending`, `growth`, `stability` כ-preference axes ב-UI.

### Titles עם נתונים לא מספיקים

9 titles ברמת `low` (< 50 רשומות) — התוצאות עבורם פחות אמינות. ב-UI מוצג warning.

### POC test suite

`poc_files/npm run run-poc` — לא רץ בגלל שה-backend ו-DB צריכים לרוץ. צריך לאמת שהPOC עדיין עובר אחרי כל השינויים.

### `dsModel.interface.ts`

הממשק ב-`backend/src/interfaces/dsModel.interface.ts` מיושן — עדיין מתאר מצב POC ישן. לא משפיע על ריצה אבל כדאי לעדכן.

---

## מה הסקרייפינג צריך לספק

### 1. שדה `scraped_at` — הכרחי לפיצ'רי זמן

כל רשומה חייבת לכלול:
```json
{
  "scraped_at": "2026-06-08",
  "scraped_at_source": "real_scrape_time"
}
```

**שינוי בסקרייפר:**
```python
from datetime import datetime, timezone
record["scraped_at"]        = datetime.now(timezone.utc).date().isoformat()
record["scraped_at_source"] = "real_scrape_time"
```

לאחר **≥3 ריצות סקרייפינג עם תאריכים שונים** — `recency_score`, `growth_trend`, `stability_score` הופכים אמינים.
ה-`train.py` כבר כולל את כל חישובי הזמן — הם פשוט מחכים לדאטה.

---

### 2. Titles עם נתונים לא מספיקים — דורשים סקרייפינג ממוקד

9 titles ברמת `low` שצריך לחזק:

| Title | רשומות קיימות | יעד |
|-------|--------------|-----|
| Vulnerability Researcher | 48 | ≥100 |
| MLOps Engineer | 45 | ≥100 |
| Cryptographer | 45 | ≥100 |
| Deep Learning Engineer | 34 | ≥50 |
| Kernel Developer | 32 | ≥50 |
| Reinforcement Learning Researcher | 27 | ≥50 |
| Cloud Native Engineer | 27 | ≥50 |
| Technical Product Manager (TPM) | 26 | ≥50 |
| Java Developer | 24 | ≥50 |

**גישה מומלצת:** סקרייפינג ממוקד — לחפש ישירות לפי שם התפקיד (כמו שנעשה עם שאר הtitles), לאסוף לקובץ `ds/extractor/targeted_skills.jsonl`, ואחר כך להריץ `train.py` מחדש.

---

### 3. Company Context Enrichment (עתידי — DS-14 עד DS-17)

לאחר שיש תאריכים אמינים, ניתן להוסיף:

```json
{
  "company_size": "startup | smb | enterprise",
  "industry":     "tech | finance | healthcare | ...",
  "company_type": "product | service | agency"
}
```

זה יאפשר לתת תוצאות שונות לאותו תפקיד לפי סוג החברה (למשל: "kubernetes" נפוץ יותר ב-DevOps ב-enterprise מאשר ב-startup).

---

## סיכום — מה מפריד בין "עובד" ל"מצוין"

```
עכשיו (עובד):
  ✅ 59 titles, feature matrix, title_specificity
  ✅ preference slider, auto title detection
  ✅ /title/match, /cv/title endpoints

אחרי סקרייפינג עם תאריכים (≥3 ריצות):
  → recency_score, growth_trend, stability_score פעילים
  → preference axes: Trending, Growing, Stable מופעלים ב-UI
  → תמונה מלאה של שוק העבודה לאורך זמן

אחרי סקרייפינג ממוקד ל-9 titles:
  → כל 59 titles ברמת medium לפחות
  → warnings "limited data" נעלמים מה-UI

אחרי company enrichment:
  → skills מותאמים לסוג החברה שהמשתמש מחפש
```

---

---

# משימות חדשות

> מכיל 6 tasks עם DOD מפורט. שאלות פתוחות מסומנות ב-❓.

---

## FEAT-1 · השוואת קורות חיים שמורים מול משרה נוכחית

**עדיפות:** High
**תלויות:** Auth, CV Library (6.1 ב-TASKS.md)

### תיאור

אחרי שהמשתמש בוחר משרה ומדביק תיאור, המערכת **בודקת בשקט** את כל קורות החיים השמורים שלו מול אותה משרה בדיוק. אם אחד מהם מקבל ציון גבוה יותר מהקו"ח שהועלה עכשיו — מוצגת הודעה:

> "One of your saved CVs scores **X points higher** for this job. Want to see it?"

### הגבלת CV Library ל-10

עם הוספת ה-CV ה-11, הישן ביותר נמחק אוטומטית (או המשתמש מקבל הודעה לפני).

### Flow

```
1. משתמש מעלה CV + בוחר משרה + מדביק JD
2. לאחר ניתוח ראשי → backend מריץ בparallel:
   - שולח את הניתוח העיקרי לFrontend
   - מריץ analyze על כל CV שמור (עד 9 נוספים) מול אותה משרה
3. אם יש CV שמור עם ציון גבוה יותר:
   - banner: "Your saved CV '[filename]' scores X% for this job vs Y% for your current CV"
   - כפתור "View saved result"
4. המשתמש יכול לבחור לראות את תוצאות ה-CV השמור
```

### שינויי Backend

**`CvFile` model** — כבר קיים. אין שינוי.

**endpoint חדש:** `POST /api/analyze/compare-saved`
```typescript
// Body: { jobId, jobDescription, currentMatchScore }
// Returns: { bestSavedCv: { cvId, fileName, matchScore } | null }
```
- טוען את כל ה-CVs השמורים (`CvFile.find`)
- מריץ `analyzeCv` על כל אחד (parallel, אך ללא DB write — ephemeral)
- מחזיר רק את הטוב ביותר (אם גבוה מ-`currentMatchScore`)

**הגבלה ל-10:** ב-`POST /api/upload`:
```typescript
const existingCount = await CvFile.countDocuments({ userId });
if (existingCount >= 10) {
  // מוחק את הישן ביותר לפני שמירה
  const oldest = await CvFile.findOne({ userId }).sort({ uploadedAt: 1 });
  await oldest.deleteOne();
}
```

### שינויי Frontend

- `SkillsMatchDashboard.tsx`: לאחר קבלת תוצאה, שולח request ל-`/analyze/compare-saved` בbackground
- מציג `CompareBanner` עם ציון השוואתי
- `CompareBanner` — קומפוננט חדש עם שם ה-CV, ציון, וכפתור "View"

### DOD

- [ ] `POST /api/analyze/compare-saved` מחזיר ב-<5 שניות גם עם 9 CVs שמורים
- [ ] אם אין CV שמור — response `{ bestSavedCv: null }` ללא שגיאה
- [ ] banner מוצג רק אם הציון השמור **גבוה יותר** מהנוכחי
- [ ] העלאת CV ה-11 → הישן ביותר נמחק אוטומטית
- [ ] `GET /api/cv` מחזיר מקסימום 10 רשומות
- [ ] banner לא חוסם את מסך התוצאות — מוצג מתחת לציון הראשי

### שאלות פתוחות

- ❓ האם ה-compare runs מחשב ניתוח מלא (LLM) לכל CV שמור, או רק keyword-based scoring? LLM לכל CV = איטי ויקר. **המלצה:** להשתמש ב-`skillner` endpoint (ללא LLM) לcompare.
- ❓ האם לשמור את תוצאות ה-compare ב-DB לשימוש עתידי, או חישוב מחדש בכל פעם?

---

## FEAT-2 · הסרת Role Dropdown — גזירה אוטומטית מקו"ח

**עדיפות:** High
**תלויות:** DS-11, DS-12 (כבר ממומשו)

### תיאור

הdropdown "Role" נמחק לחלוטין. הcategory של המשרה נגזרת מהקו"ח בלבד דרך `/cv/title` + `/title/match` שכבר ממומשים.

### שינוי ב-Flow

```
לפני: משתמש בוחר Role מרשימה → jobId נשלח לניתוח
אחרי: CV מועלה → canonical title מזוהה → title נשלח לניתוח (ללא jobId)
```

### שינויי Backend

**`POST /api/analyze`** — מוסיפים מסלול שלישי ללא jobId:
```typescript
// Mode חדש: { cvText, jobDescription, canonicalTitle }
if (canonicalTitle && cvText && jobDescription) {
  // getCoreSkills(canonicalTitle, titleMatch) ישירות — ללא DB lookup
  const coreSkills = await getCoreSkills(canonicalTitle, titleMatchValue);
  // ...rest of flow
}
```

**שינוי ב-`listJobs`** — endpoint זה הופך לoptional / deprecated לאט.

**response** — מחזיר `canonicalTitle` במקום `jobTitle` ממסד הנתונים.

### שינויי Frontend

`UploadScreen.tsx`:
- **מוחקים** את `jobs` state, `jobId` state, `fetchJobs()` call, ו-`<select>` קומפוננט
- **שומרים** את `detectedTitle` (כבר קיים) — זהו ה"role" שנשלח
- אם לא זוהה title → שדה חיפוש פתוח עם autocomplete מ-`/title/match`
- `analyzeCv()` מקבל `canonicalTitle` במקום `jobId`

### DOD

- [ ] `POST /api/analyze` מצליח עם `{ cvText, jobDescription, canonicalTitle }` ללא jobId
- [ ] `UploadScreen` ללא `<select>` לbuild מוצלח
- [ ] CV ללא title שזוהה → שדה חיפוש עם suggestions מ-`/title/match`
- [ ] תוצאת ניתוח מציגה את הtitle שנגזר מהקו"ח
- [ ] backward compat: `POST /api/analyze` עם `jobId` עדיין עובד (5 POC jobs)

### שאלות פתוחות

- ❓ האם למחוק לחלוטין את הjobs collection מה-DB, או להשאיר לאחור-תאימות?
- ❓ מה מוצג כ"שם המשרה" בדשבורד התוצאות — ה-`canonicalTitle` או תיאור חופשי?

---

## FEAT-3 · Navigation Bar קבוע — בית + פרופיל

**עדיפות:** Medium
**תלויות:** Auth (5.1)

### תיאור

בכל מסך, בחלק התחתון, מוצג navigation bar קבוע עם 2 אייקונים.

### מבנה

```
┌─────────────────────────────────┐
│                                 │
│         [page content]          │
│                                 │
├────────────┬────────────────────┤
│   🏠 Home  │    👤 Profile      │
└────────────┴────────────────────┘
```

### קומפוננט חדש: `BottomNav.tsx`

```tsx
// frontend/src/components/ui/BottomNav.tsx
// מוצג בכל route שמחייב auth (לא בLoginPage)
// האייקון הפעיל מקבל highlight לפי ה-route הנוכחי
```

**Routes:**
- 🏠 Home → `/`
- 👤 Profile → `/account`

### שילוב ב-App.tsx

```tsx
// App.tsx — מוסיפים <BottomNav /> לכל route שאינו /login
```

### CSS

- `position: fixed; bottom: 0; width: 100%`
- גובה 56px
- backdrop-filter blur (כמו ה-glassmorphism שיש כבר בפרויקט)
- האייקון הפעיל — צבע accent, לא פעיל — muted

### DOD

- [ ] `BottomNav` מוצג בHome, UploadScreen, Dashboard, AccountPage, AdminPage
- [ ] **לא** מוצג ב-LoginPage
- [ ] לחיצת Home → navigate('/'), לחיצת Profile → navigate('/account')
- [ ] האייקון הפעיל לפי route נוכחי
- [ ] ה-nav לא מסתיר תוכן — גוף הדף מקבל `padding-bottom: 56px`
- [ ] נראה טוב על mobile (375px) ועל desktop (1440px)

---

## FEAT-4 · מסך שיפורי קו"ח

**עדיפות:** High
**תלויות:** FEAT-1 (ניתוח ציונים), Auth

### תיאור

אחרי ניתוח, המשתמש יכול לפתוח מסך "Improve your CV" שמציג:
1. Skills עם ציון נמוך (0–8) — עד 5 בלבד
2. Drag interface לדרגת שליטה בכל skill
3. שיפורים אישיים (שפה, soft skills)
4. הצעות שינוי שניתן לאשר ולשמור

הפלט נשמר בפרופיל תחת טאב **"Improvement Plans"**, ושם הקובץ הוא כותרת תיאור המשרה.

---

### חלק A — Skill Proficiency Drag

**Skills המוצגים:** עד 5 skills עם `score < 8` (מהניתוח הנוכחי), מסודרים בעולה לפי ציון.
Skills עם `score ≥ 8` לא מוצגים — אלא אם המשתמש לוחץ על "Show all skills".

**Drag interface — 3 רמות:**

```
┌─────────────────────────────────────────────────────────┐
│  python          ○──────────────────────  ← drag here   │
│                  [Don't know] [Learning] [Proficient]    │
├─────────────────────────────────────────────────────────┤
│  kubernetes      ○──────────────                         │
│                  [Don't know] [Learning] [Proficient]    │
└─────────────────────────────────────────────────────────┘
```

**3 רמות:**
- `dont_know` — לא יודע כלל
- `learning` — מכיר בסיסים
- `proficient` — שולט ברמה גבוהה

**"לא יכול לשקר"** — המשמעות: ה-CV Score הנוכחי כבר מראה מה יש בפועל. הsystem לא "מאמין" לרמת שליטה שהמשתמש הצהיר — הוא משתמש בזה רק כדי להתאים את ה-**המלצות הלמידה**, לא לשנות את הציון.

### חלק B — הצעות שינוי

לכל skill בcoלומן ימין:
```
python: [Don't know]
→ "Add 'Python basics' course to your CV summary"
→ "List Python projects in experience section"
   [Apply] [Skip]
```

ה"הצעות" הן template-based (לא LLM) בשלב ראשון — per skill per proficiency level.

### חלק C — שיפורים אישיים (Personal)

סקשן נפרד מתחת לskills:

```
Language
  ○──────  [Native] [Fluent] [Basic]

Soft Skills Self-Assessment
  □ Leadership
  □ Presentation
  □ Mentoring
  □ Cross-team collaboration

Note to self (free text)
  [                           ]
```

### שמירה בפרופיל

**Model חדש:** `ImprovementPlan`
```typescript
{
  userId:         ObjectId,
  planName:       string,          // כותרת תיאור המשרה
  jobDescription: string,
  createdAt:      Date,
  skillPlans: [{
    skill:       string,
    score:       number,           // הציון מהניתוח
    proficiency: 'dont_know' | 'learning' | 'proficient',
    suggestions: string[],         // אילו הצעות אושרו
  }],
  personalPlan: {
    language: 'native' | 'fluent' | 'basic' | null,
    softSkills: string[],
    note: string,
  }
}
```

**Backend:** `POST /api/improvement-plans` + `GET /api/improvement-plans`

**Frontend — טאב חדש ב-AccountPage:**
- טאב "Improvement Plans" ברשימה
- כל plan מציג שם (כותרת JD) + תאריך + כמה skills + progress bar
- לחיצה → פותח את המסך המלא

### DOD

- [ ] `ImprovementPlan` model + endpoints (`POST`, `GET`, `DELETE`)
- [ ] מסך "Improve your CV" נפתח מ-`SkillsMatchDashboard` בלחיצת כפתור
- [ ] מוצגים עד 5 skills עם `score < 8`, מסודרים עולה
- [ ] Skills עם `score ≥ 8` מוסתרים, כפתור "Show all" מציג אותם
- [ ] Drag/slider לכל skill עם 3 רמות ברורות
- [ ] הצעות שינוי מוצגות לפי (skill × proficiency) — template-based
- [ ] כפתור "Apply" על כל הצעה → מסמן אותה כ"מאושרת"
- [ ] חלק "Personal" עם שפה + checkboxes + free text
- [ ] כפתור "Save Plan" → שומר ב-DB עם שם = כותרת JD
- [ ] טאב "Improvement Plans" ב-AccountPage מציג את כל ה-plans
- [ ] מחיקת plan זמינה

### שאלות פתוחות

- ❓ מה מקור ה"הצעות" — template קבוע או LLM בעתיד?
- ❓ האם הplan מתעדכן כשמריצים ניתוח חדש על אותה משרה, או נשמר כsnapshot?

---

## FEAT-5 · Scraping Pipeline אוטומטי יומי

**עדיפות:** High
**תלויות:** DS server, train.py

### תיאור

Pipeline מלא שרץ כל יום אוטומטית:
```
Cron (daily) → Scraper → JSONL append → train.py → DS server reload
```

### רכיבים

#### 5.1 — הוספת `scraped_at` לסקרייפר

**שינוי ב-scraping code:**
```python
from datetime import datetime, timezone
record["scraped_at"]        = datetime.now(timezone.utc).date().isoformat()
record["scraped_at_source"] = "real_scrape_time"
```

כל ריצה **מוסיפה** לקובץ הקיים (append mode), לא מחליפה אותו.

#### 5.2 — Cron Job

**אפשרות A — Linux/Mac (crontab):**
```bash
0 3 * * * cd /path/to/CareerLens && python ds/scraping/run_daily.py >> logs/scrape.log 2>&1
```

**אפשרות B — Windows Task Scheduler:**
```
Task: CareerLens Daily Scrape
Trigger: Daily 03:00
Action: python ds/scraping/run_daily.py
```

#### 5.3 — `run_daily.py`

```python
# ds/scraping/run_daily.py
import subprocess, logging, requests, time
from datetime import datetime

log = logging.getLogger(__name__)

def run_scraper():
    subprocess.run(["python", "ds/scraping/scraper.py", "--append"], check=True)

def run_training():
    subprocess.run(["python", "ds/model/train.py"], check=True)

def reload_ds_server():
    # Option A: graceful restart via signal
    # Option B: /reload endpoint (see 5.4)
    requests.post("http://localhost:8000/admin/reload", timeout=60)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    log.info(f"Daily pipeline started: {datetime.now().isoformat()}")
    run_scraper()
    log.info("Scraping done")
    run_training()
    log.info("Training done")
    reload_ds_server()
    log.info("Server reloaded. Pipeline complete.")
```

#### 5.4 — `/admin/reload` endpoint ב-DS server

```python
@app.post("/admin/reload")
def reload_model():
    global artifacts, vectorizer, knn, skills_data, variant_labels, variant_titles, feature_matrix, canonical_data
    artifacts      = joblib.load(f'{os.path.dirname(__file__)}/model.joblib')
    vectorizer     = artifacts['vectorizer']
    knn            = artifacts['knn_model']
    skills_data    = artifacts['skills']
    variant_labels = artifacts['titles']
    variant_titles = artifacts['variant_titles']
    feature_matrix = artifacts.get('feature_matrix', {})
    # reload canonical_titles.json
    try:
        with open(_canonical_json, encoding='utf-8') as f:
            canonical_data = json.load(f)
    except FileNotFoundError:
        pass
    return {"reloaded_at": datetime.now().isoformat(), "titles": len(set(variant_labels))}
```

> **אבטחה:** ה-endpoint מוגן בסביבת production עם API key או bind ל-localhost בלבד.

#### 5.5 — Monitoring

קובץ `logs/scrape_YYYY-MM-DD.log` לכל ריצה עם:
- כמה רשומות נוספו
- כמה titles אומנו
- זמן ריצה כולל
- שגיאות אם יש

### DOD

- [ ] `scraped_at` + `scraped_at_source` מוצמד לכל רשומה בסקרייפינג חדש
- [ ] הסקרייפר עובד ב-append mode (לא overwrite)
- [ ] `run_daily.py` מריץ את כל ה-pipeline ומסיים ב-exit 0 כשהכל עבר
- [ ] `/admin/reload` טוען מחדש את המודל ללא restart של התהליך
- [ ] Cron מוגדר (OS-dependent) + הוראות ב-README
- [ ] log נוצר לכל ריצה עם summary
- [ ] אם הסקרייפינג נכשל — training לא רץ (subprocess `check=True`)
- [ ] אחרי 3 ריצות עם תאריכים שונים → `recency_score`, `growth_trend`, `stability_score` מופעלים בmodel

### שאלות פתוחות

- ❓ אילו אתרים לסקרייפ? (LinkedIn, AllJobs, אחרים?)
- ❓ כמה משרות לאסוף בכל ריצה יומית?
- ❓ rate limiting — האם יש delay בין requests?
- ❓ האם ה-pipeline ירוץ ב-cloud (GitHub Actions? VPS?) או רק locally?

---

## FEAT-6 · שיפורי מודל + UI — Vibe Selection

**עדיפות:** Medium
**תלויות:** FEAT-5 (צריך temporal data לחלק מהפיצ'רים)

### תיאור

**"ווב" = שאלת כוונות**: האם המשתמש מחפש תפקיד **יציב ומוכר** או **תפקיד בצמיחה / טרנדי**?

זה ממפה ישירות לפיצ'רי הזמן שכבר כתובים בקוד ומחכים לdata:

| ווב | מה הוא מדגיש |
|-----|-------------|
| Stable | `stability_score` גבוה — skills שנדרשים בצורה עקבית לאורך זמן |
| Trending | `recency_score` + `growth_trend` גבוהים — skills שעולים לאחרונה |
| Balanced | ברירת מחדל (מה שיש היום) |

### שינוי ב-API (אחרי FEAT-5 יש temporal data)

```
GET /title/skills?title=DevOps Engineer&vibe=stable
GET /title/skills?title=DevOps Engineer&vibe=trending
GET /title/skills?title=DevOps Engineer&vibe=balanced
```

Backend ממיר `vibe` ל-`SkillPreferences`:
```python
VIBE_PRESETS = {
    "stable":   SkillPreferences(title_match=0.3, stability=0.9, trending=0.1, growth=0.1),
    "trending": SkillPreferences(title_match=0.3, stability=0.1, trending=0.9, growth=0.8),
    "balanced": SkillPreferences(),  # defaults
}
```

### UI — Vibe Selector

מחליף את הסליידר הנוכחי "Most common ↔ Role-specific":

```
┌──────────────────────────────────────────┐
│  What kind of role are you targeting?    │
│                                          │
│  [ Stable ]  [ Balanced ]  [ Trending ]  │
│  ─────────   ═══════════   ─────────     │
│  Consistent  Best of both  Hot skills    │
│  demand      worlds        right now     │
└──────────────────────────────────────────┘
```

### שיפורי מודל נוספים (אחרי temporal data)

| שיפור | מה זה | מתי זמין |
|-------|--------|---------|
| `recency_score` פעיל | Skills חמים עכשיו | אחרי ≥3 ריצות scraping |
| `growth_trend` פעיל | Skills בעלייה | אחרי ≥2 חודשים data |
| `stability_score` פעיל | Skills עקביים | אחרי ≥3 חודשים data |
| Vibe presets | stable/trending/balanced | תלוי בשלושת הנ"ל |
| Company context | startup vs enterprise | אחרי DS-14 (company enrichment) |

### DOD

- [ ] `vibe` param מתקבל ב-`GET /title/skills` ומומר ל-`SkillPreferences` פנימית
- [ ] `vibe=balanced` זהה לתוצאה הנוכחית (regression guard)
- [ ] UI: 3 כפתורי toggle (Stable / Balanced / Trending) מחליפים את הסליידר
- [ ] כפתור active מודגש, שאר greyed-out
- [ ] כשאין temporal data → Stable + Trending מסומנים עם tooltip "Available after data update"
- [ ] `time_features_reliable` מ-feature_matrix שולט אם vibe buttons פעילים

### שאלות פתוחות

- ❓ האם "ווב" גם משפיע על ה-personal improvement suggestions (FEAT-4)?
- ❓ האם לאפשר vibe customization מתקדם (סליידרים ידניים) בנוסף לpresets?

---

## טבלת סיכום — כל המשימות

| Task | תיאור | עדיפות | תלויות | ממתין ל |
|------|--------|--------|--------|---------|
| FEAT-1 | Compare saved CVs | High | Auth, CV Library | — |
| FEAT-2 | Remove role dropdown | High | DS-11, DS-12 ✅ | — |
| FEAT-3 | Bottom navigation | Medium | Auth | — |
| FEAT-4 | CV Improvement screen | High | FEAT-1 | — |
| FEAT-5 | Auto daily scraping | High | Scraper code | — |
| FEAT-6 | Vibe selector + model | Medium | FEAT-5 | temporal data |

---

## אבני דרך — תכנון מפורט

---

### אבן דרך 1 — שיפורי UI: ניווט, חשבון ומסכי ניתוח

**1.1 ניווט קבוע**
להוסיף כפתורי Home ו-Profile קבועים בתחתית כל מסך, כדי שהמשתמש יוכל לחזור בקלות למסך הבית או לחשבון מכל מקום באפליקציה.

**1.2 מסך חשבון**
לעדכן את מסך החשבון כך שיכלול:
- היסטוריית ניתוחים, כולל תאריך, CV שנותח, ציון ותפקיד.
- תוכניות שיפור שנשמרו למשתמש תחת Improvement Plans.

**1.3 החלפת הסליידר**
להוסיף סליידר בהתאם לשיפור של המודל שהמשתמש יוכל לתת יותר משקל ל-Stable, Balanced, Trending.

**1.4 חיבור למסך שיפור CV**
מתוך מסך התוצאות להוסיף כפתור "Improve your CV", שפותח את מסך שיפור קורות החיים שמוגדר באבן דרך 4.

*FEATs: FEAT-3, FEAT-6 (UI)*

---

### אבן דרך 2 — Pipeline סקרייפינג אוטומטי יומי

**2.1 עדכון הסקרייפר**
להוסיף לכל רשומת משרה שדה `scraped_at` עם תאריך ושעת הסקרייפינג.

**2.2 עבודה ב-append mode**
הסקרייפר לא מוחק דאטה קיים, אלא מוסיף רשומות חדשות כדי לבנות היסטוריה לאורך זמן.

**2.3 יצירת `run_daily.py`**
ליצור pipeline יומי שמריץ אוטומטית: scrape → train → reload model.

**2.4 לוגים**
לשמור לוג לכל ריצה עם: זמן התחלה, זמן סיום, מספר רשומות שנסרקו, סטטוס אימון, סטטוס טעינת מודל ושגיאות אם היו.

**2.5 הפעלת פיצ'רי זמן**
אחרי לפחות 3 ריצות תקינות, להפעיל במודל את: `recency`, `growth`, `stability`.

*FEAT: FEAT-5*

---

### אבן דרך 3 — השוואת קורות חיים שמורים ברקע

**3.1 מגבלת CVs שמורים**
כל משתמש יכול לשמור עד 10 קורות חיים. בהעלאת CV מספר 11, הישן ביותר נמחק אוטומטית.

**3.2 סימון מועדפים**
המשתמש יכול לסמן עד 3 קורות חיים בכוכב כמועדפים — אלו הם שיחושבו ברקע בכל ניתוח. אם יש תוצאה טובה יותר, יוצג popup במסך התוצאות.

**3.3 השוואה ברקע**
לאחר ניתוח CV מול משרה, הbackend מריץ במקביל את אותה משרה גם מול עד 3 קורות החיים המועדפים.

**3.4 לא להשוות מול כל ה-10**
כדי לשמור על ביצועים, לא מריצים השוואה על כל קורות החיים השמורים, אלא רק על המועדפים.

**3.5 הודעה בדשבורד**
אם CV שמור מקבל ציון גבוה יותר מה-CV הנוכחי, מוצגת הודעה בדשבורד, למשל: "יש לך CV שמור שמתאים יותר למשרה הזו."

*FEAT: FEAT-1 (עם שינוי: 3 starred במקום כל 10)*

---

### אבן דרך 4 — מסך שיפור CV לפי נקודות חלשות

> ⚠️ דורש איפיון מלא — לפי מה נציע את השיפורים? איך הם יישמרו? האם המשתמש יוכל לשנות את מה שהצענו?

**4.2 פתיחת המסך**
מסך "Improve your CV" נפתח מתוך הדשבורד או מסך התוצאות.

**4.3 הצגת כישורים חלשים**
המסך מציג עד 5 כישורים עם ציון נמוך מתוך הניתוח, כולל הציון והסיבה שהם פוגעים בהתאמה.

**4.4 רמת שליטה לכל כישור**
לכל כישור המשתמש בוחר רמת שליטה: Don't know / Learning / Proficient.

**4.5 המלצות לפי רמה**
המערכת מציגה הצעות שיפור שונות לפי רמת השליטה. למשל — אם המשתמש לא מכיר את הכישור, לא להציג אותו כחוזקה. אם הוא Proficient, להציע ניסוח חזק יותר ל-CV.

**4.6 שמירה בפרופיל**
הפלט נשמר בפרופיל תחת Improvement Plans, כולל התפקיד, הכישורים, הרמות שנבחרו וההמלצות.

*FEAT: FEAT-4*

---

### אבן דרך 5 — שיפור המודל: דאטה, פיצ'רים ו-Vibe

**5.1 צבירת דאטה**
לאחר שה-pipeline היומי צובר לפחות 3 חודשי נתונים, ניתן להפעיל את פיצ'רי הזמן בצורה מלאה.

**5.2 פיצ'רי זמן**
להוסיף למודל:
- `recency` — כמה הכישור מופיע לאחרונה.
- `growth` — האם הביקוש לכישור עולה.
- `stability` — האם הכישור יציב לאורך זמן.

**5.3 חיבור בורר Vibe**
לחבר את הבורר Stable / Balanced / Trending לפיצ'רי הזמן.

**5.4 משמעות המצבים**
- Stable — יעדיף כישורים יציבים.
- Balanced — ישלב בין יציבים לטרנדיים.
- Trending — יעדיף כישורים שהביקוש אליהם עולה.

**5.5 סקרייפינג ממוקד**
לבצע סקרייפינג ממוקד ל-9 titles עם מעט דאטה (כמו Kernel Developer ו-MLOps Engineer), כדי להעלות אותם לרמת דאטה medium לפחות.

**5.6 אימון ובדיקה**
לאחר הוספת הדאטה, לאמן מחדש את המודל ולבדוק שהתוצאות לתפקידים החלשים השתפרו.

*FEATs: FEAT-6 (model), FEAT-5 (data)*

---

### אבן דרך 6 — הסרת dropdown והמרה לזיהוי אוטומטי

**6.1 הסרת בחירת תפקיד ידנית**
להסיר את הdropdown של בחירת תפקיד, כדי שהמשתמש לא יצטרך לבחור title בעצמו.

**6.2 זיהוי title מה-CV**
`/cv/title` — endpoint שמזהה את התפקיד המרכזי מתוך קורות החיים (כבר קיים).

**6.3 מיפוי ל-canonical title**
את ה-title שזוהה ממפים ל-title קיים במודל באמצעות KNN על ה-vector space הקיים.

**6.4 שליחה אוטומטית לניתוח**
אם הזיהוי ברור, המערכת שולחת את ה-CV לניתוח ישירות לפי ה-canonical title שנבחר.

**6.5 טיפול בחוסר ודאות**
אם הזיהוי לא ברור, מציגים למשתמש 3 הצעות עם אחוז ביטחון והמשתמש בוחר.

**6.6 בחירת משתמש**
המשתמש בוחר את אחת ההצעות, ואז המערכת ממשיכה לניתוח לפי התפקיד שנבחר.

*FEAT: FEAT-2*
