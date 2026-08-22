# איחוד מקורות האימון של מודל 1 לקולקשן `jobs`

**מצב סופי:** קולקשן יחיד `jobs` בתוך DB `jobs`, שמכיל את כל מה שמודל 1 מתאמן עליו.
שדה `source` הוא ציר ההפרדה, הביקורת והמשקל.

| `source` | מסמכים | מה זה | איך נכנס |
|---|---:|---|---|
| `lang-uk` | 41,745 | קורפוס Djinni, 2020-01 → 2023-09 | `migrate_to_jobs.py` — פעם אחת |
| `Linkedin` | גדל כל לילה | סקרייפ LinkedIn, 2026+ | `run_daily.sh` — append |

**אין דאטה סינתטי.** `augmented-2026` (10,800 רשומות) יוצא מהתמונה — הסקרייפ הלילי
מספק את הקצה העדכני בדאטה אמיתי. הקולקשן `augmented-2026` נשאר ב-`careerlens` כארכיון,
ולא מוזרם ל-`jobs`.

**עודכן:** 2026-08-19 · **מאומת מול:** ה-Mongo המקומי, `docker-compose.yaml`, `pipeline/`, `ds/model/`

---

## 0. מה כבר נבנה

| קובץ | סטטוס |
|---|---|
| [`ds/model/migrate_to_jobs.py`](../../ds/model/migrate_to_jobs.py) | ✅ חדש — מיגרטור אידמפוטנטי, dry-run כברירת מחדל |
| [`ds/final/model1_retrain.ipynb`](../../ds/final/model1_retrain.ipynb) | ✅ נכתב מחדש — קורא מ-`jobs`, מפריד לפי `source` |
| `pipeline/Dockerfile` | ❌ **שבור** — ראה §1 |
| `pipeline/run_daily.sh` | ❌ צריך עדכון — ראה §3 |

שניהם נבדקו מקצה לקצה מול DB זמני: המיגרציה הורצה, הורצה **שוב** (3,874 → 3,874,
אידמפוטנטיות מוכחת), והמחברת רצה עליה עד סעיף האימון.

---

## 1. 🔴 תמונת ה-pipeline לא יכולה להריץ את `train.py`

[`pipeline/Dockerfile`](../../pipeline/Dockerfile) מעתיק 6 קבצים מ-`ds/model/`.
`train.py` מייבא **שלושה מודולים שלא ביניהם**:

```
train.py:27   from mongo_env import get_mongo_uri     ❌
train.py:54   from stability import (...)             ❌
train.py:92   from taxonomy import (...)              ❌
```

וגם `extract_skills.py` מייבא `skillner_utils.py` ❌ ו-`mongo_env.py` ❌.

`git log -S"taxonomy.py" -- pipeline/Dockerfile` מחזיר **ריק** — הם מעולם לא היו שם.
`python /app/train.py` נופל על `ModuleNotFoundError` לפני שורת קוד אחת.

> **סייג:** זו קריאה של הריפו בלבד. ההוסט של הדפלוימנט מופעל ע"י חבר צוות אחר —
> ייתכן שהתמונה שם נבנתה אחרת. **בדיקה של 10 שניות:**
> ```bash
> docker exec pipeline python -c "import taxonomy, stability, mongo_env; print('ok')"
> ```

**התיקון:**
```dockerfile
COPY ds/model/taxonomy.py        /app/taxonomy.py
COPY ds/model/stability.py       /app/stability.py
COPY ds/model/mongo_env.py       /app/mongo_env.py
COPY ds/model/skillner_utils.py  /app/skillner_utils.py
COPY ds/model/migrate_to_jobs.py /app/migrate_to_jobs.py
```

---

## 2. 🔴 `run_daily.sh` לא מגדיר `RECENCY_HALF_LIFE_DAYS`

ברירת המחדל ב-`train.py` היא `14` יום. משקל מודעה = `0.5^(age/HALF_LIFE)`.

| slice | תאריך | משקל ב-14 יום | משקל ב-365 יום |
|---|---|---:|---:|
| `lang-uk` | 2023-09 | `0.5^76` ≈ **10⁻²³** | ≈ 0.13 |
| `Linkedin` | 2026-06 | ≈ 0.08 | ≈ 0.91 |

יחס של ~10²¹ לטובת הסקרייפ. ריצה לילית עם ברירות המחדל מאמנת מודל שהוא בפועל
**סקרייפ בלבד**, ושער הקידום מאשר אותה — כי הוא סופר **רשומות, לא משקלים**.

`365/365` הם חובה, והמחברת והלילי **חייבים לשאת את אותם ערכים**, אחרת הם מייצרים
שני מודלים שונים מאותו דאטה.

---

## 3. השינויים בקוד

### 3.1 `pipeline/run_daily.sh`

```sh
# 2a) LinkedIn: raw_postings -> jobs (append-only upsert, unchanged)
SOURCE_COLLECTION=raw_postings TARGET_COLLECTION=jobs python /app/extract_skills.py

# 2b/2c נמחקים:
#   - אין extract לילי של lang-uk (הקורפוס ההיסטורי כבר בתוך jobs, פעם אחת)
#   - אין migrate_unified_skill_observations (role_skill_observations מת)

# 3) Retrain from the unified collection
SOURCE_WEIGHTS="jobs:1.0" \
RECENCY_HALF_LIFE_DAYS=365 \
TREND_WINDOW_DAYS=365 \
  python /app/train.py
```

`TRAIN_USE_UNIFIED` יורד ל-0. `role_skill_observations` הופך למת (0 מסמכים ממילא) —
להשאיר בקוד ולסמן deprecated.

### 3.2 `train.py` — **אפס שינויים**

`parse_source_weights()` כבר תומך ב-`jobs:1.0`, ו-`_parse_dt` כבר מטפל ב-`datePosted`
כמחרוזת. שום פאטץ' לא נדרש.

> **אם אי פעם יידרשו משקלים שונים לשני ה-slices** — `SOURCE_WEIGHTS` כבר לא יוכל
> לבטא את זה (הוא ממפה שמות קולקשנים, ויש עכשיו אחד). זה ידרוש תוספת אדיטיבית קטנה:
> env בשם `SOURCE_FIELD_WEIGHTS` שנפתר מול שדה `source` של המסמך, בתוך
> `accumulate_from_collection`. **לא מחווט היום** כי שני ה-slices ב-1.0.

### 3.3 `extract_skills.py` — **אפס שינויים**

אין צורך ב-`ID_PREFIX`. מזהי LinkedIn הם hex בן 12 תווים; מזהי lang-uk הם
`languk:<uuid>`. התנגשות בלתי אפשרית.

### 3.4 `docker-compose.yaml` — **אפס שינויים**

`ds` ו-`pipeline` כבר מצביעים על `.../jobs` (שורות 69, 102).
`MODEL_OUT_DIR=/models` + volume `model_data` + `docker restart careerlens-ds` — הכל במקום.

---

## 4. סדר ההרצה

| # | שלב | פקודה |
|---|---|---|
| 1 | **גיבוי** | `mongodump --uri=... --db=jobs --out=backup-$(date +%F)` |
| 2 | snapshot של המודל | `cp /models/model.joblib /models/model.joblib.pre-unify` |
| 3 | לאשר/להפריך את §1 | `docker exec pipeline python -c "import taxonomy, stability, mongo_env"` |
| 4 | ספירת בסיס | `db.jobs.countDocuments({})` — לרשום |
| 5 | **dry-run** | ↓ |
| 6 | **מיגרציה** | ↓ |
| 7 | **מיגרציה שנית** | אותה פקודה — הספירה חייבת לא לזוז |
| 8 | בדיקות | §5 במלואו |
| 9 | מחברת §1–4 | read-only, לקרוא את שני המספרים ב-§1 |
| 10 | מחברת §5 | האימון |
| 11 | מחברת §6 | דיף מול הבייסליין |
| 12 | לתקן Dockerfile + run_daily.sh, להריץ ידנית | `docker compose --profile batch run --rm pipeline` |
| 13 | אימות אחרי הלילה הראשון | §6 |

```bash
# 5) dry-run - ברירת המחדל, לא כותב כלום
MONGO_URI="mongodb://root:<pw>@<host>:27017/jobs?authSource=admin" \
SOURCE_URI="mongodb://root:<pw>@<host>:27017/careerlens?authSource=admin" \
  python migrate_to_jobs.py

# 6) הרצה אמיתית + נרמול תאריכי המחרוזת שכבר בקולקשן
MONGO_URI="..." SOURCE_URI="..." DRY_RUN=0 NORMALIZE_TARGET_DATES=1 \
  python migrate_to_jobs.py
```

**מה לא עושים:** לא מוחקים את `lang-uk-job-skills` ולא את `augmented-2026`. הם מקור
האמת לביקורת ולשחזור. `jobs` הוא נגזרת שאפשר לבנות מחדש — בדיוק בגלל זה המיגרציה
אידמפוטנטית.

---

## 5. בדיקות אחרי המיגרציה

```javascript
// 1. שלמות - שני ה-slices, עם טווחי הזמן שלהם
db.jobs.aggregate([{$group: {_id: {$toLower: "$source"}, n: {$sum: 1},
                             lo: {$min: "$datePosted"}, hi: {$max: "$datePosted"}}}])
// צפוי:  lang-uk  41,745  2020-01..2023-09   |   linkedin  N  2026-01..
```

```javascript
// 2. אין כפילויות - כל מסמך ממקור אחד בדיוק
db.jobs.countDocuments({_id: /^languk:/})     // ⇒ 41,745
db.jobs.countDocuments({_id: {$not: /^languk:/}})  // ⇒ רק LinkedIn
```

```javascript
// 3. טיפוסים - datePosted כמחרוזת עובר בשקט דרך _parse_dt אבל נופל
//    ב-_bucket_month, וה-stability slope של אותה רשומה נעלם בלי שגיאה
db.jobs.countDocuments({datePosted: {$not: {$type: "date"}}})   // ⇒ 0 אחרי NORMALIZE
db.jobs.countDocuments({og_title: {$exists: false}})            // ⇒ 0
db.jobs.countDocuments({"skills.full_matches": {$exists: false}}) // ⇒ 0
```

```javascript
// 4. og_title לא-קנוניים - כל אחד כזה נזרק בשקט ע"י resolve_canonical
db.jobs.aggregate([{$group: {_id: {t: "$og_title", s: {$toLower: "$source"}},
                             n: {$sum: 1}}}, {$sort: {n: -1}}])
```

```python
# 5. כמה ישרוד את סף חמשת ההתאמות (train.py, hard-coded)
db.jobs.count_documents({"$expr": {"$lt": [
  {"$add": [{"$size": {"$ifNull": ["$skills.full_matches", []]}},
            {"$size": {"$ifNull": ["$skills.ngram_matches", []]}}]}, 5]}})
# צפוי ~1,195 מצד lang-uk (הערך שנמדד ב-data-pipeline-metrics.md שלב 6)
```

בדיקות 1, 3, 4 ו-5 רצות **אוטומטית בסעיפים 1–4 של המחברת** — אין צורך להריץ ידנית
אם מריצים את המחברת.

---

## 6. אימות אחרי הלילה הראשון

```javascript
db.jobs.countDocuments({source: {$regex: "^linkedin$", $options: "i"}})  // גדל
db.jobs.countDocuments({source: "lang-uk"})                             // ⇒ 41,745 ללא שינוי
db.model_runs.find().sort({_id: -1}).limit(1)                           // promoted: true
```

השורה האמצעית היא ההגדרה של append-only. אם היא זזה — משהו כותב איפה שאסור לו.

---

## 7. סיכונים פתוחים

| סיכון | חומרה | טיפול |
|---|---|---|
| תמונת ה-pipeline חסרה מודולים (§1) | 🔴 | הבדיקה בשלב 4 |
| `run_daily.sh` בלי `365/365` (§2) | 🔴 | §3.1 |
| `og_title` לא-קנוני בסקרייפ ⇒ נזרק בשקט | 🟠 | המחברת §1 סופרת; ייתכן שיידרש `SEARCH_KEYWORD_TO_CANONICAL` |
| `SKILL_UBIQUITY_CAP=11` מכויל ל-12 תפקידים | 🟠 | המחברת §6 מחשבת את הערך המקביל (יחס 0.92) |
| תפקידים שיש להם רק דאטה מהסקרייפ — **אין אות טרנד** | 🟠 | recent == all-time ⇒ הכל `stable`. המחברת §6 מפרטת אותם |
| רעש ngram נכנס ישירות לאימון | 🟡 | `build_skill_records` מחזיר `skill_records` as-is ⇒ `is_valid_skill` לא רץ. בסיס אמיתי שנמדד על lang-uk: **0.79%**. התיקון שייך ל-`extract_skills.py` |
| הריטריין הלילי מקדם מודל גרוע יותר | 🟠 | השער סופר רשומות בלבד. לשקול: `top-5 overlap < 0.6` מול הקודם → חסימה |
| `ds/final/README.md` מתאר סינתטי שכבר לא קיים | 🟡 | לעדכן לפני ההגשה |
