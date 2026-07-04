# סכמת skills + מדד יציבות (stability)

> עודכן: 2026-07-03 | קוד: `ds/model/skill_schema.py`

## הבעיה

| Collection | מבנה ישן | בעיה |
|------------|----------|------|
| `jobs`, `lang-uk-job-skills` | `skills: { full_matches[], ngram_matches[] }` | אין תאריך per skill |
| `role_skill_features` | שורה per skill | aggregated בלבד, לא raw |

## הסכמה החדשה (schema_version=2)

### ברמת משרה (`jobs`, `lang-uk-job-skills`)

```json
{
  "schema_version": 2,
  "scraped_at": "2026-07-03T12:00:00Z",
  "skills": { "full_matches": [], "ngram_matches": [] },
  "skill_records": [
    {
      "skill": "kubernetes",
      "score": 1.0,
      "match_type": "full_match",
      "observed_at": "2026-07-03T12:00:00Z"
    }
  ]
}
```

- `observed_at` = `datePosted` > `scraped_at` > `extracted_at`
- `skills` נשמר לתאימות לאחור
- `skill_records` = מקור האמת ל-train

### ברמת אימון (`role_skill_features`)

שדות חדשים per (run, title, skill):

| שדה | משמעות |
|-----|--------|
| `prevalence` | ביקוש (מדד ראשון) |
| `stability_score` | עקביות לאורך שבועות (1 - CV) |
| `observation_count` | כמה פעמים נראה |
| `observation_weeks` | כמה שבועות שונים |
| `time_coverage_reliable` | true אם >= 2 שבועות |

## בחירת Top 5 מתוך Top 10

```
1. top 10 לפי prevalence (ביקוש)
2. top 5 מתוכם לפי stability_score (עקביות בזמן)
```

API: `GET /title/skills` מחזיר `skills[]` עם שני המדדים + `suggested_skills`.

## פייפליין

- `extract_skills.py` - כותב `skill_records` אוטומטית
- `migrate_skill_records.py` - backfill על docs ישנים
- `train.py` - מחשב stability מ-observed_at
- `run_daily.sh` - ללא שינוי (extract כבר מעדכן)

## פקודות

```bash
# backfill jobs + lang-uk-job-skills
cd ds/model
# Set MONGO_URI in ds/model/.env first (see .env.example)
python migrate_skill_records.py

# train מחדש (אחרי lang-uk batch)
SOURCE_WEIGHTS=jobs:1.0,lang-uk-job-skills:0.3 python train.py
```

## Collection מאוחד: `role_skill_observations`

**מטרה:** skill אחד = מסמך Mongo אחד (לא array), מ-LinkedIn + lang-uk.

```json
{
  "_id": "linkedin:abc123:kubernetes",
  "job_id": "abc123",
  "source": "linkedin",
  "canonical_title": "DevOps Engineer",
  "skill": "kubernetes",
  "score": 1.0,
  "match_type": "full_match",
  "datePosted": null,
  "scraped_at": "2026-07-03T11:22:36Z",
  "extracted_at": "2026-07-03T11:29:13Z",
  "observed_at": "2026-07-03T11:22:36Z",
  "schema_version": 2
}
```

| שדה | מקור | שימוש |
|-----|------|--------|
| `datePosted` | תאריך פרסום המשרה | עקביות/stability (null אם אין) |
| `scraped_at` | מתי נסקרה | LinkedIn - יש; lang-uk - בדרך כלל null |
| `extracted_at` | מתי רץ SkillNer | תמיד נשמר כשיש חילוץ |
| `observed_at` | `datePosted` → `scraped_at` → `extracted_at` | train / recency / stability |

### מיגרציה (אחרי extract)

```bash
cd ds/model
# 1) backfill skill_records on job docs (optional if extract already wrote them)
python migrate_skill_records.py

# 2) unify into role_skill_observations
# Set MONGO_URI in ds/model/.env first (see .env.example)
python migrate_unified_skill_observations.py
```

### אימון מה-collection המאוחד

```bash
# Set MONGO_URI in ds/model/.env first (see .env.example)
TRAIN_USE_UNIFIED=1 \
SOURCE_WEIGHTS=linkedin:1.0,lang_uk:0.3 \
UNIFIED_SKILLS_COLLECTION=role_skill_observations \
python train.py
```

`jobs` + `lang-uk-job-skills` נשארים כ-archival; train קורא מ-unified.
