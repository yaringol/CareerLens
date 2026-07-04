# MongoDB - `model_runs` (היסטוריית אימונים)

> **מטרה:** לתעד מה נשמר בכל ריצת `train.py`, איך להשוות בין ריצות, ומה קובע promotion ל-production.
> **DB:** `jobs` | **Collection:** `model_runs` (ברירת מחדל; ניתן לשנות עם `RUNS_COLLECTION`)
> **עודכן:** 2026-07-03 - לפי 3 הרצות live ב-Mongo

---

## למה זה קיים

בכל הרצת אימון, `train.py` שומר מסמך אחד ב-`model_runs` - **יומן ריצה** עם:
- מאיזה מקורות נלקחו נתונים
- כמה רשומות נצברו לכל תפקיד קנוני
- האם המודל **עלה ל-production** (`model.joblib`) או נדחה - ולמה

בנוסף, לכל ריצה נשמרות שורות ב-`role_skill_features` (skill לכל title) - לשאילתות והשוואות מפורטות.

```
train.py  →  model_runs          (מסמך אחד לריצה)
         →  role_skill_features (שורות skill×title)
         →  model.joblib        (רק אם promoted=true)
```

---

## שדות במסמך `model_runs`

| שדה | משמעות |
|-----|--------|
| **`_id`** | מזהה ייחודי: `{מקורות+משקלות}@{timestamp}` - למשל `jobs:1.0+lang-uk-job-skills:0.3@20260703_172348` |
| **`source_collection`** | הקולקציה הראשית לקריאה (בדרך כלל `jobs`) |
| **`source_weights`** | מילון: איזה collection נכלל באימון ובאיזה משקל - למשל `{"jobs": 1.0, "lang-uk-job-skills": 0.3}` |
| **`trained_at`** | חותמת זמן האימון - `YYYYMMDD_HHMMSS` (UTC) |
| **`half_life_days`** | חצי-חיים של decay לפי תאריך פרסום (ברירת מחדל: 14) |
| **`trend_window_days`** | חלון "אחרון" לחישוב trend של skill (ברירת מחדל: 7) |
| **`record_counts`** | כמה רשומות (משוקללות) נצברו **לכל אחד מ-59 התפקידים הקנוניים** |
| **`titles_with_data`** | כמה תפקידים עם `record_counts > 0` |
| **`promoted`** | `true` = `model.joblib` ו-`canonical_titles.json` עודכנו; `false` = נשאר המודל הקודם |
| **`promote_reason`** | הסבר קצר - הצלחה או סיבת דחייה (ראו שער איכות למטה) |

**מה זהה ברוב הריצות:** `source_collection`, `half_life_days`, `trend_window_days` - אלא אם שינית env vars.

**מה משתנה בין ריצות:** `source_weights`, `record_counts`, `titles_with_data`, `promoted`, `promote_reason`.

---

## שער איכות (promotion gate)

מוגדר ב-`promotion_gate.py`. סף ברירת מחדל:

| משתנה | ערך | משמעות |
|--------|-----|--------|
| `MIN_TOTAL_RECORDS` | 200 | סה"כ רשומות מינימום (promote ראשון) |
| `MIN_TITLES_WITH_DATA` | 8 | לפחות 8 תפקידים עם count > 0 |
| `MIN_NON_LOW_TITLES` | 3 | לפחות 3 תפקידים עם ≥50 רשומות |
| `NON_LOW_THRESHOLD` | 50 | סף "non_low" - confidence medium ומעלה |

**Promote ראשון** (אין run קודם עם `promoted: true`): חייב לעבור את שלושת הספים.

**Promote שוטף** (יש baseline): נדחה אם:
- מספר תפקידי non_low **ירד** לעומת baseline
- סה"כ רשומות **ירד ביותר מ-20%**

Baseline נלקח מה-run האחרון עם `promoted: true` ב-`model_runs`.

---

## ההרצות ב-Mongo (נכון ל-2026-07-03)

### סיכום מהיר

| # | `_id` (קצר) | מקורות | סה"כ רשומות | titles עם דאטה | promoted | סיבה |
|---|-------------|--------|-------------:|---------------:|:--------:|------|
| 1 | `jobs:1.0@…143400` | jobs בלבד | 17 | 1 | ❌ | non_low ירד 50→0 (baseline ישן) |
| 2 | `jobs:1.0@…143851` | jobs בלבד | 202 | 4 | ❌ | promote ראשון: רק 4 titles (< 8) |
| 3 | `jobs:1.0+lang-uk…@…172348` | jobs + lang-uk (0.3) | 2,706 | 50 | ✅ | promote ראשון - עבר את כל הספים |

### הרצה 1 - `jobs:1.0@20260703_143400`

- **מתי:** 14:34
- **מקור:** LinkedIn בלבד (`jobs`, משקל 1.0)
- **כיסוי:** רק **SOC Analyst** (17 רשומות); שאר 58 התפקידים - 0
- **תוצאה:** לא promoted - `"non_low titles dropped 50->0"`
- **פרשנות:** baseline ישן (מ-`canonical_titles.json` או run קודם) ציפה ל-~50 תפקידים ברמת non_low. אחרי scrape דל - כמעט הכל נפל, ולכן נחסם.

### הרצה 2 - `jobs:1.0@20260703_143851`

- **מתי:** 14:38 (4 דקות אחרי הרצה 1)
- **מקור:** שוב LinkedIn בלבד
- **כיסוי:** 4 תפקידי security בלבד:

  | תפקיד | רשומות |
  |--------|-------:|
  | Cyber Security | 54 |
  | Security Analyst | 52 |
  | SOC Analyst | 50 |
  | Threat Analyst | 46 |

- **תוצאה:** לא promoted - `"first promote blocked: titles with data 4 < 8"`
- **פרשנות:** יותר נתונים מסקראפינג, אבל עדיין צר מדי - לא עבר promote ראשון.

### הרצה 3 - `jobs:1.0+lang-uk-job-skills:0.3@20260703_172348` ✅

- **מתי:** 17:23
- **מקור:** `jobs:1.0` + `lang-uk-job-skills:0.3`
- **כיסוי:** 50 מתוך 59 תפקידים עם דאטה; 40 ברמת non_low (≥50)
- **תוצאה:** **promoted** - `"first promote (no prior promoted run)"`
- **פרשנות:** הוספת lang-uk (גם batch קטן של 100) מילאה כמעט את כל התפקידים. **זו ההרצה שמייצגת את המודל החי** - `model.joblib` + `canonical_titles.json`.

---

## איך לשאול את Mongo

```bash
# Set MONGO_URI in ds/model/.env or export it, then:
# כל הריצות, מהישנה לחדשה
mongosh "$MONGO_URI" --eval '
  db.model_runs.find().sort({trained_at: 1}).forEach(r => {
    const total = Object.values(r.record_counts).reduce((a,b)=>a+b, 0);
    print(r._id, "| promoted:", r.promoted, "| total:", total,
          "| titles:", r.titles_with_data, "|", r.promote_reason);
  });
'

# הריצה האחרונה שעברה promote
mongosh "$MONGO_URI" --eval '
  db.model_runs.findOne({promoted: true}, {sort: {trained_at: -1}})
'
```

---

## קישור ל-`role_skill_features`

לכל run_id יש שורות עם: `title`, `skill`, `prevalence`, `recent_prevalence`, `trend`, `frequency`, `title_specificity`.

```bash
# Set MONGO_URI in ds/model/.env or export it, then:
mongosh "$MONGO_URI" --eval '
  db.role_skill_features.countDocuments({
    run_id: "jobs:1.0+lang-uk-job-skills:0.3@20260703_172348"
  })
'
```

---

## קישורים

- [09-pipeline-fix-plan.md](09-pipeline-fix-plan.md) - סטטוס פייפליין ו-promote אחרון
- [03-model1-skills-model.md](03-model1-skills-model.md) - איך train.py בונה את המודל
- `ds/model/promotion_gate.py` - לוגיקת promotion
- `ds/model/train.py` - כתיבה ל-Mongo (סוף הקובץ)
