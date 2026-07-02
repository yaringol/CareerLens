# תוכנית יישום — Model 1 (title↔skills) ו-Model 2 (CV→title)

> מסמך תכנון (טרם מומש). נכתב ע"י Claude ב-2026-07-02 בעקבות סקירת branch `model-improvment`
> ודיון עם המשתמש שפיצל לשני מסלולי עבודה מקבילים. כל הרפרנסים לקוד מצביעים על המצב בפועל
> בעת הכתיבה — לפני מימוש הפריטים במסמך זה.

## Context

סריקה מלאה של branch `model-improvment` העלתה שתי בעיות ליבה:

1. **מודל 1** (title→skills, [ds/model/train.py](../../ds/model/train.py)): הפייפליין היומי-אוטומטי
   (ofelia → docker container → [scraping/external/linkedin.py](../../scraping/external/linkedin.py) →
   `train.py` → restart DS) **שבור בפועל** — הסקרייפר כותב לקובץ JSONL מקומי במצב `"w"` (נדרס בכל ריצה)
   ולא ל-MongoDB, ולא מריץ SkillNer בכלל. `train.py` תמיד קורא מ-`jobs.jobs` ב-Mongo — קולקציה שאף אחד
   לא מעדכן. גם התשתית ([pipeline/Dockerfile](../../pipeline/Dockerfile)) חסרה את מודל ה-spaCy הדרוש ל-SkillNer.

2. **מודל 2** (CV→title, [ds/model/tfid.ipynb](../../ds/model/tfid.ipynb) →
   `text_to_job_title_classifier.joblib`): מסווג ל-38 מחלקות מתוך `master_resumes.jsonl`, שממופות דרך
   מפה קשיחה ([label_map.py](../../ds/model/label_map.py)) לתוך 59 הכותרות הקנוניות של מודל 1. מיפוי כל
   היעדים גילה ש**רק 21/59 כותרות נגישות בפועל** — כל תחום הסייבר/חומרה/מחקר בלתי-נגיש מבנית כי אין להן
   ייצוג ב-`master_resumes.jsonl`.

המשתמש ביקש לפצל לשני מסלולי עבודה מקבילים ולפרט את מה שדיברנו עליו בסשן. הוחלט (בדיון עם המשתמש):
- **דאטה למודל 2**: להשתמש בקולקציית Mongo `careerlens.lang-uk-cv` (210K קורות-חיים אמיתיים,
  `Highlights != null`) כמקור עיקרי להרחבת הדאטה.
- **טריגר "הרץ עכשיו" באדמין**: sidecar ייעודי קטן עם גישת docker.sock מוגבלת (לא בבקאנד הראשי).

---

## Track A — Model 1: פייפליין title→skills

### A1. תיקון שרשרת האיסוף (root cause)

- **קולקציה חדשה `jobs.raw_postings`** (append-only, לא נדרסת): מסמך גולמי טרם חילוץ —
  `{_id (מ-generate_job_id הקיים), source, title, og_title, description, company, location, url,
  datePosted, scraped_at, extracted: false}`.
- לתקן את [scraping/external/linkedin.py](../../scraping/external/linkedin.py): להחליף את הכתיבה
  ל-JSONL (`search_all_jobs`, [שורה 133](../../scraping/external/linkedin.py#L133)) בכתיבת Mongo
  `update_one({_id}, {$set: doc, $setOnInsert:{extracted:false}}, upsert=True)` לתוך `raw_postings` —
  idempotent, לא דורס היסטוריה. להוסיף `scraped_at` (עכשיו, UTC) — `datePosted` אין ב-LinkedIn card,
  אז `scraped_at` הוא ציר הזמן הראשי (כמו שכבר קורה ב-[generate_example_jobs.py](../../ds/model/generate_example_jobs.py)).
  ה-JSONL המקומי יכול להישאר כגיבוי best-effort, לא כמקור אמת.

### A2. שלב חילוץ (SkillNer) כשלב עצמאי וניתן-להרצה-מחדש

- סקריפט חדש `ds/model/extract_skills.py`: קורא מ-collection **ניתנת-להגדרה** (`SOURCE_COLLECTION`
  env var — יכולה להיות `raw_postings`, אבל גם `lang-uk-job` הקיימת כבר ב-Mongo (142K, טרם חולצה, לפי
  [03-model1-skills-model.md](03-model1-skills-model.md)), או כל batch עתידי). לכל מסמך שטרם חולץ
  (`extracted != true` / חסר `skills`): מריץ `SkillExtractor(nlp, SKILL_DB, PhraseMatcher).annotate(description)`
  (בדיוק כמו `/text/skills` ב-[server.py:102-112](../../ds/model/server.py#L102-L112)), כותב
  `skills.full_matches`/`ngram_matches` ל-collection **יעד** (`TARGET_COLLECTION`, למשל `jobs.jobs`
  לדאטה שוטף, או `lang-uk-job-skills` לדאטה חיצוני — בדיוק כפי ש-03-model1-skills-model.md כבר ממליץ),
  ומסמן `extracted: true` במקור כדי שריצות הבאות ידלגו עליו (checkpoint/resume — קריטי כי SkillNer
  איטי, "לעולם לא להריץ SkillNer מחדש על מה שכבר חולץ").
- לתקן את [pipeline/Dockerfile](../../pipeline/Dockerfile): להוסיף את התקנת spaCy `en_core_web_lg` +
  skillNer (להעתיק את השלב הקיים כבר ב-[ds/Dockerfile](../../ds/Dockerfile) — אין צורך להמציא מחדש).
- לעדכן [pipeline/run_daily.sh](../../pipeline/run_daily.sh): scrape (→raw_postings) → **extract**
  (→jobs.jobs) → train → restart DS. שלב ה-train לא משתנה — `train.py` כבר קורא נכון מ-`MONGO_COLLECTION`
  ([train.py:31](../../ds/model/train.py#L31)).

### A2.5. הרצת הלמידה עצמה (Execute) — מה שקורה בין "יש סקילים" ל"יש מודל מעודכן"

A1+A2 פותרים רק את קלט האימון (דאטה גולמי + סקילים מחולצים). זה עדיין לא אומר שהלמידה עצמה
רצה נכון. שלושה דברים חסרים היום וצריך להוסיף במפורש:

- **מי בפועל מפעיל את `train.py`, ועל אילו קולקציות.** היום זה קורה רק כחלק מ-
  [pipeline/run_daily.sh](../../pipeline/run_daily.sh) (scrape → extract → **train** → restart), כלומר
  ריצה **מלאה מאפס** בכל לילה — `train.py` קורא את **כל** ה-collection מ-0 בכל פעם
  ([train.py:409](../../ds/model/train.py#L409), `jobs_collection.find({})`), לא אינקרמנטלי. זו החלטה
  מכוונת ולא באג: האימון הוא אגרגציה סטטיסטית זולה (לא deep learning), אז ריצה מלאה יומית זולה יותר
  מלבנות לוגיקת incremental-update עם הסיכון לדריפט. **להשאיר כך**, רק לתעד את זה במפורש כדי שלא
  ייראה כמו חוסר.
- **ריבוי מקורות דאטה — `train.py` היום תומך ב-collection יחיד בלבד** (`MONGO_COLLECTION`,
  [train.py:31](../../ds/model/train.py#L31)). אחרי A2, יהיו בפועל כמה מקורות אפשריים: `jobs.jobs`
  (סקרייפ חי, on-market) ו-`lang-uk-job-skills` (חיצוני, אחרי חילוץ). לפי ההמלצה הקיימת כבר ב-
  [03-model1-skills-model.md](03-model1-skills-model.md) ("train on UA data alone, or merge with
  jobs.jobs... weighting is a tuning choice") — להרחיב את `train.py` שיקבל **רשימת** מקורות עם משקל
  per source (`SOURCE_WEIGHTS=jobs:1.0,lang-uk-job-skills:0.3` וכו'), ולצבור `role_skill_scores`/
  `role_record_weight` על פני כולם יחד (המבנה כבר צובר per-role ב-defaultdict — הרחבה טבעית, לא
  ריפקטור). **המודל שה-DS server בפועל מגיש** (`model.joblib`) הוא תמיד תוצאה של ריצת ה-merge הזו;
  ריצות single-source (למשל אימון נפרד רק על lang-uk לצורך benchmark) נשמרות ל-`model_runs` להשוואה
  אבל לא בהכרח הופכות לגרסת production.
- **אין שער איכות לפני שמחליפים את המודל החי.** כרגע `train.py` **תמיד** דורס את `model.joblib`
  ([train.py:549-551](../../ds/model/train.py#L549-L551)) בלי שום בדיקה מול הריצה הקודמת — ריצה גרועה
  (סקרייפינג שנכשל חלקית, נניח) יכולה לדרוס מודל טוב יותר בלי אזהרה, ואז `docker restart` ב-
  [run_daily.sh:23-25](../../pipeline/run_daily.sh#L23-L25) יגיש אותו למשתמשים מיד. להוסיף בסוף
  `train.py`: לפני הכתיבה ל-`model.joblib` (לא ל-versioned snapshot — זה תמיד נשמר), להשוות את
  `canonical_data['record_counts']`/`titles_with_data` של הריצה החדשה מול הריצה הקודמת שכבר בפרודקשן
  (מה-`model_runs` המתועד), ולדרוש: לא פחות כותרות עם `data_confidence != low`, ולא ירידה חדה
  (למשל >20%) במספר הרשומות הכולל. אם נכשל — לא לדרוס את `model.joblib` (versioned snapshot עדיין
  נשמר לבדיקה ידנית), לסמן ב-`model_runs` `promoted: false` + סיבה, ו-`run_daily.sh` **לא** מריץ
  `docker restart` במקרה הזה (המודל הישן ממשיך לשרת). זה גם מה שהופך את "הרץ עכשיו" ב-A3 לבטוח —
  משתמש אדמין שלוחץ על זה לא יכול בטעות להוריד את איכות המודל החי.

### A3. דשבורד "מצב הלמידה" באדמין

- `train.py` **כבר** כותב `model_runs` + `role_skill_features` ל-Mongo
  ([train.py:579-612](../../ds/model/train.py#L579-L612)) — לבנות על זה, לא להמציא מחדש.
- Backend: `GET /api/admin/model-status` (חדש, ב-[admin.routes.ts](../../backend/src/routes/admin.routes.ts)
  לצד ה-route הקיים, `requireRole('admin')` — ראה תבנית קיימת ב-[admin.routes.ts:8-12](../../backend/src/routes/admin.routes.ts#L8-L12)) —
  מחזיר:
  - `model_runs` אחרון per source (`trained_at`, `record_counts`, `titles_with_data`, ו-`promoted`/
    reason מ-A2.5) — "הריצה האחרונה הייתה ב:" + האם היא בפועל הגרסה שמוגשת כרגע או שנדחתה בשער האיכות.
  - היסטוריית `model_runs` (לאורך ימים, ברגע שהפייפליין באמת רץ) → סדרת זמן ל"התפלגות לאורך זמן".
  - אגרגציה על `role_skill_features` של הריצה האחרונה: מספר סקילים per כותרת + כמה `rising/stable/falling`.
- Frontend: טאב/סקשן חדש ב-[AdminPage.tsx](../../frontend/src/pages/AdminPage.tsx) (יש כבר תבנית טבלה
  + פילטרים לשימוש חוזר, [AdminPage.tsx:120-150](../../frontend/src/pages/AdminPage.tsx#L120-L150)) —
  טבלת כותרות עם ספירת סקילים + badge טרנד, timestamp ריצה אחרונה, וכפתור **"הרץ עכשיו"**.
- **טריגר "הרץ עכשיו"**: sidecar חדש קטן `pipeline-trigger` (docker-compose service נפרד, image קל —
  Python/Flask או Node קטן) עם `volumes: /var/run/docker.sock` **רק הוא**, בדומה למבנה הקיים כבר של
  ה-`pipeline` וה-`ofelia` services ב-[docker-compose.yaml:75-108](../../docker-compose.yaml#L75-L108).
  חושף `POST /run` יחיד שמריץ `docker compose --profile batch run --rm pipeline` (או `docker run` ישיר
  על ה-image). הבקאנד הראשי קורא ל-sidecar דרך רשת `app-network` הפנימית
  (`http://pipeline-trigger:PORT/run`) — **לא** מקבל גישת docker.sock בעצמו. Endpoint חדש בבקאנד:
  `POST /api/admin/model-status/run` (proxy ל-sidecar, `requireRole('admin')`).

### A4. API-ים חדשים לפיצ'רי זמן (time features)

A1+A2+A2.5 הופכים את הדאטה המתוארך (`model_runs`/`role_skill_features`, כבר נכתבים ע"י `train.py`
[:579-612](../../ds/model/train.py#L579-L612)) לדאטה **אמיתי ורציף** (הרצה יומית מוצלחת = נקודת זמן
נוספת), במקום ריצה בודדת. זה בדיוק מה שחסם את `trending`/`growth`/`stability` כ-preference axes ב-UI
לפי [07-progress-and-feature-backlog.md](07-progress-and-feature-backlog.md) ("`recency_score`,
`growth_trend`, `stability_score` ... מחכים ל-≥3 ריצות סקרייפינג עם תאריכים שונים"). עכשיו שיש את זה —
צריך לחשוף אותו כ-API. שינוי בגישה: **DS (`server.py`) הוא הבעלים היחיד של DB `jobs`** (עקרון קיים כבר —
הבקאנד אף פעם לא מתחבר ישירות ל-DB הזו, רק דרך [dsModel.ts](../../backend/src/services/dsModel.ts)),
אז ה-endpoints החדשים גם הם ב-`server.py`, לא Mongo client חדש בצד Node.

**DS layer — endpoints חדשים/מורחבים (`ds/model/server.py`):**

- **מורחב** `GET /title/trending-skills?title=&n=` (כבר קיים,
  [server.py:199-236](../../ds/model/server.py#L199-L236)) — מוסיף לכל skill שני שדות חדשים ושדה גלובלי:
  ```json
  {
    "matched_canonical": "DevOps Engineer",
    "data_confidence": "high",
    "records_count": 133,
    "time_features_reliable": true,
    "history_days": 12,
    "skills": [
      { "skill": "kubernetes", "prevalence": 0.82, "recent_prevalence": 0.91,
        "trend": "rising", "growth_trend": 0.14, "stability_score": 0.77 }
    ],
    "trained_at": "20260702_030000"
  }
  ```
  - `growth_trend` (‑1..1): שיפוע (slope) של prevalence יומי על פני `role_skill_features` ההיסטוריים
    (query על Mongo, לא רק ה-`feature_matrix` הטעון בזיכרון) — במקום היחס החד-נקודתי הקיים
    `recent_prevalence/prevalence` ב-[train.py:458-467](../../ds/model/train.py#L458-L467).
  - `stability_score` (0..1): `1 - coefficient_of_variation` של prevalence יומי על פני אותו חלון.
  - `time_features_reliable`: `true` רק אם יש **≥3 ריצות `promoted: true` נפרדות** (מ-A2.5) בטווח —
    אותו שם/מוסכמה בדיוק שכבר מתועדת ב-DOD של FEAT-6
    ([07-progress-and-feature-backlog.md](07-progress-and-feature-backlog.md), "`time_features_reliable`
    מ-feature_matrix שולט אם vibe buttons פעילים"). מתחת ל-3 נקודות — שני השדות `null`, לא מזויפים.

- **מורחב** `GET /title/skills?title=&top_n=&vibe=` (כבר קיים,
  [server.py:114-131](../../ds/model/server.py#L114-L131)) — פרמטר `vibe` חדש, אופציונלי:
  `stable | trending | balanced` (ברירת מחדל `balanced` = ההתנהגות הנוכחית, backward compatible —
  זה בדיוק ה-VIBE_PRESETS שתוכנן ב-FEAT-6 אבל היה חסום על דאטה). `stable` מדרג לפי `stability_score`,
  `trending` לפי `growth_trend`, בדיוק כמו נוסחת ה-`title_match` הקיימת אבל על ציר הזמן ולא על
  title-specificity. תשובה מוסיפה `"vibe_applied"` (יכול להיות שונה מ-`vibe` המבוקש אם
  `time_features_reliable=false` — או-אז נופל בחזרה ל-`balanced` בלי לזרוק שגיאה) ו-`"time_features_reliable"`.

- **חדש** `GET /admin/model-runs?source=jobs&days=30` — history ישיר מ-`model_runs`
  (Mongo query, לא מה-joblib הטעון) — `[{trained_at, promoted, reason?, titles_with_data,
  record_counts_total}, ...]`. מוגן ל-internal network בלבד (לא חשוף דרך frontend/nginx, רק הבקאנד
  קורא אליו — כמו כל שאר endpoints ה-DS היום).

- **חדש** `GET /admin/skill-features?title=&source=jobs` — שורות `role_skill_features` אחרונות לכותרת
  (סקילים + prevalence/trend/growth_trend/stability_score) — ישירות מ-Mongo, טרי יותר מה-joblib
  הטעון בזיכרון (זמין ברגע שהאימון נגמר, גם לפני restart של ה-DS).

**Backend layer — [dsModel.ts](../../backend/src/services/dsModel.ts):**

- להרחיב `TrendingSkill`/`getTrendingSkills()` ([dsModel.ts:167-204](../../backend/src/services/dsModel.ts#L167-L204))
  עם `growthTrend`, `stabilityScore`, `timeFeaturesReliable`.
- שני proxies חדשים, אותו דפוס בדיוק כמו `matchTitle`/`extractTitleFromCv` הקיימים
  ([dsModel.ts:218-253](../../backend/src/services/dsModel.ts#L218-L253)): `getModelRunHistory(source, days)`
  ו-`getSkillFeatures(title, source)` — קוראים ל-`/admin/model-runs`/`/admin/skill-features`.
- `getCoreSkills()` ([dsModel.ts:135-165](../../backend/src/services/dsModel.ts#L135-L165)) מקבל פרמטר
  `vibe` אופציונלי חדש (לצד `titleMatch` הקיים), מועבר מ-[analyze.routes.ts](../../backend/src/routes/analyze.routes.ts)/
  `job.service.ts` — בלי לשבור קריאות קיימות שלא שולחות אותו.
- `GET /api/admin/model-status` (מ-A3) עכשיו עם contract קונקרטי:
  ```json
  {
    "model1": {
      "lastRun": { "trainedAt": "...", "promoted": true, "titlesWithData": 55, "source": "jobs" },
      "history": [ { "trainedAt": "...", "promoted": true, "titlesWithData": 55 } ],
      "titles": [ { "title": "DevOps Engineer", "skillCount": 42, "recordsCount": 133,
        "dataConfidence": "high", "trendBreakdown": { "rising": 6, "stable": 30, "falling": 6 },
        "timeFeaturesReliable": true } ]
    },
    "model2": { "lastRun": { "trainedAt": "...", "classesCount": 47, "holdoutMacroF1": 0.88 } }
  }
  ```

**Frontend:** ה-Personalization slider שכבר מתועד כרעיון ב-FEAT-6 (Stable/Balanced/Trending, טרם
מומש בקוד — [PersonalizationScreen.tsx](../../frontend/src/pages/PersonalizationScreen.tsx) קיים אבל
בלי החיווט הזה) שולח `vibe` בבקשת analyze/personalize; מוצג disabled+tooltip אם `timeFeaturesReliable=false`
(בדיוק כפי שתוכנן ב-DOD של FEAT-6).

---

## Track B — Model 2: סיווג סגור ל-59 כותרות

### B1. טקסונומיה משותפת (מבטל את שכבת ה-fallback הבעייתית)

- הבעיה הנוכחית: מודל 2 לומד 38 מחלקות משלו ([label_map.py:26-99](../../ds/model/label_map.py#L26-L99)),
  וממופה ל-59 דרך `CLASSIFIER_TO_SUPPORTED` ([label_map.py:126-167](../../ds/model/label_map.py#L126-L167))
  — מיפוי קשיח שמצטמצם בפועל ל-21 יעדים ייחודיים. הפתרון: לאמן ישירות על **מרחב ה-59** של
  `CANONICAL_TITLES` ([train.py:73-313](../../ds/model/train.py#L73-L313)) — במקום
  `label_map.consolidate()` העצמאי. לחלץ `CANONICAL_TITLES`/`VARIANT_TO_CANONICAL` למודול משותף
  (`ds/model/taxonomy.py`) שגם `train.py` וגם סקריפט האימון החדש של מודל 2 מייבאים — כתובת אחת
  אחראית יחידה לכל המערכת, לא שני מרחבים שדורשים גישור.

### B2.0 — ייבוא lang-uk ל-Mongo (תשתית חסרה — נדרש למי שמתחיל בלי דאטה)

**⚠️ נמצא בבדיקה:** `careerlens.lang-uk-cv`/`lang-uk-job` (המשמשות ב-B2 ובדוח
[05-external-dataset-eval.md](05-external-dataset-eval.md)) **אינן מיוצרות ע"י שום סקריפט בריפו** —
`grep` מלא על `lang-uk|huggingface|load_dataset` מוצא רק אזכור בהערה ב-
[train.py:574](../../ds/model/train.py#L574) ("lang-uk-job ..." כדוגמה עתידית), לא קוד שמייבא בפועל.
כלומר הקולקציות האלה קיימות היום רק אצל מי שהריץ ידנית משהו לא-מתועד (כנראה notebook/session חד-פעמי
שהפיק את הדוח). **מי שמשכפל את הסביבה מאפס לא ימצא את הדאטה הזו.** צריך סקריפט ייבוא חדש:

- `ds/model/import_lang_uk.py` — טוען את שני הדאטהסטים מ-Hugging Face (`datasets.load_dataset`):
  - `lang-uk/recruitment-dataset-candidate-profiles-english` (210,250 שורות; שדות:
    `Position, Moreinfo, Looking For, Highlights, Primary Keyword, English Level, Experience Years,
    CV, id` — ראה [05-external-dataset-eval.md §1](05-external-dataset-eval.md)) → כותב ל-
    `careerlens.lang-uk-cv`.
  - `lang-uk/recruitment-dataset-job-descriptions-english` (141,897 שורות; שדות:
    `Position, Long Description, Company Name, Exp Years, Primary Keyword, English Level, Published,
    id` — ראה [05-external-dataset-eval.md §2](05-external-dataset-eval.md)) → כותב ל-
    `careerlens.lang-uk-job`.
  - כתיבה ב-`bulk_write`/`update_one(..., upsert=True)` לפי `id` המקורי מה-dataset — כדי שריצה חוזרת
    (או המשך אחרי ניתוק) לא תיצור כפילויות. `MONGO_URI` נלקח מאותו env var שכל שאר הסקריפטים כבר
    משתמשים בו ([train.py:25-28](../../ds/model/train.py#L25-L28)).
  - **תלות חדשה, לא קיימת היום:** `datasets` + `huggingface_hub` — לא מופיעים היום ב-
    [ds/model/requirements.txt](../../ds/model/requirements.txt) ולא ב-[ds/requirements.txt](../../ds/requirements.txt)
    (בדקתי את שניהם — אין). להוסיף שתי השורות לשני הקבצים (רק לסביבת ייבוא/אימון, לא נדרש ל-DS server
    עצמו בזמן ריצה — אפשר `ds/model/requirements-import.txt` נפרד אם רוצים למנוע את המשקל הזה מה-
    production image).
  - הרצה חד-פעמית: `MONGO_URI=... python ds/model/import_lang_uk.py` (מוריד מ-HF בפעם הראשונה,
    שומר לוקאלית ב-cache של הספרייה כך שריצות חוזרות מהירות). להוסיף הוראה מקבילה ב-
    [ds/README.md](../../ds/model/README.md) תחת סעיף Setup, כדי שזה לא יאבד שוב.
  - אין דרישת רשת ל-DS server/pipeline בזמן production — זו פעולה חד-פעמית של מי שמכין את סביבת
    האימון, לא חלק מ-`run_daily.sh`.

### B2. דאטה — הרחבה ל-59 (לפי ההחלטה: `lang-uk-cv`)

- מקור: `careerlens.lang-uk-cv` (210,250 מסמכים, ראו [05-external-dataset-eval.md](05-external-dataset-eval.md)) —
  מיובאת ע"י B2.0 לעיל אם עוד לא קיימת,
  עם `Highlights != null` (מסנן ~105K עם הפרופיל העשיר יותר). שדות: `CV` (הטקסט להזנה), `Primary Keyword`
  (התווית הגולמית), `Position`.
- **מפת מיפוי חדשה** `PRIMARY_KEYWORD_TO_CANONICAL` (ב-`taxonomy.py`): ל-42 ה-`Primary Keyword` הקיימים
  ב-lang-uk → אחת מ-59 (reuse את ההגיון של [03-model1-skills-model.md §"Recommended plan"](03-model1-skills-model.md));
  לזרוק לא-הנדסי (Marketing/Sales/HR/Recruiter/Artist).
- **⚠️ מגבלה שקופה שיש לתעד גם למשתמש:** לפי [05-external-dataset-eval.md](05-external-dataset-eval.md)
  שכבר נבדק — 41/59 מהכותרות הקנוניות (כמעט כל סייבר/חומרה/מחקר) **לא מיוצגות כלל** ב-lang-uk גם אחרי
  הסינון. השלב הזה צפוי להביא כותרות מיינסטרים (~18-20) מ"רק 21 נגישות" ל**כיסוי-לימוד אמיתי טוב יותר
  ויציב יותר** (יותר CVs לכל אחת), אבל **לא** יסגור את הפער לכל 59. לכן B3 (LLM fallback סגור) הוא לא
  "רשת ביטחון" משנית אלא **חלק מובנה בתכנון** לכיסוי הכותרות המתמחות — זה בדיוק מה שהבקשה השנייה של
  המשתמש ("אם אין התאמה לפנות ל-LLM יחד עם הרשימה הסגורה") נועדה לפתור.
- מניעת דליפה: להשתמש באותה טכניקת `scrub` שכבר קיימת ב-[tfid.ipynb](../../ds/model/tfid.ipynb) (הסרת
  `Position`/מילות הכותרת הגולמית מ-`CV`/`Highlights` לפני אימון) — מוכחת בקוד הזה, יורדת F1 ב-~0.05
  אבל זה המספר ההגון (ראו [01-model2-cv-title-classifier.md §2](01-model2-cv-title-classifier.md)).

### B3. סיווג + LLM fallback בתוך הסקופ הסגור

- **סף ביטחון**: לשמור את מנגנון הנרמול הקיים ב-`/cv/role`
  ([server.py:133-154](../../ds/model/server.py#L133-L154)) (top-3, renormalized share). לכייל מחדש
  threshold על holdout אחרי אימון מחדש (הבסיס הקיים: חציון 95 נכון / 41 שגוי → ~60, ראו
  [01-model2-cv-title-classifier.md](01-model2-cv-title-classifier.md)).
- כש-top-1 מתחת לסף (או top-3 שטוח מדי → אמביגואיות אמיתית): הבקאנד קורא ל-agent LLM חדש
  `titleClassification.agent.ts` (חדש, תחת `backend/src/agents/`) — **אותו דפוס בדיוק** כמו
  [skillExtraction.agent.ts](../../backend/src/agents/skillExtraction.agent.ts): `llmCall`
  ([llmCall.ts](../../backend/src/infra/llm/llmCall.ts)) + `parseJsonSafe`
  ([parseJson.ts](../../backend/src/infra/llm/parseJson.ts)), עם system prompt שמטמיע את **רשימת 59
  הכותרות המדויקת** (נשלפת מ-`/titles` הקיים, [server.py:181-197](../../ds/model/server.py#L181-L197))
  ומורה ל-LLM לבחור **בדיוק אחת מהרשימה** (או "none" אם שום דבר לא מתאים סבירות) — JSON בלבד, ולידציה
  שהערך המוחזר קיים פיזית ברשימה (guard נגד הזיה).
- חיווט: [dsModel.ts](../../backend/src/services/dsModel.ts) `classifyRoles()`/`detectTitleFromCv()`
  ([dsModel.ts:39-71](../../backend/src/services/dsModel.ts#L39-L71)) — אם `confidence < threshold`
  לכל 3 המועמדים, לצרף/להחליף עם תוצאת ה-LLM fallback, ולתייג מקור
  (`source: 'classifier' | 'llm_fallback'`) — בדיוק כמו ש-`DynamicSkillsSource` כבר עושה עבור
  `extractDynamicSkills` ([job.service.ts:95](../../backend/src/services/job.service.ts#L95)). כך
  המערכת תמיד מחזירה כותרת מתוך הסקופ הסגור, בין אם ע"י המודל ובין אם ע"י ה-LLM.

### B4. "לשמור את הרשת בצורה טובה" — persistence

- להפוך את `tfid.ipynb` לסקריפט standalone `ds/model/train_cv_classifier.py` — **אותו תבנית בדיוק**
  שכבר קרתה למודל 1 (notebook→script, ראו [07-progress-and-feature-backlog.md](07-progress-and-feature-backlog.md)).
  שומר `text_to_job_title_classifier.joblib` + עותק מתוארך (זהה לתבנית ב-
  [train.py:547-551](../../ds/model/train.py#L547-L551)). כולל שדה `classes_` = 59 (או תת-קבוצה שיש
  לה דאטה בפועל אחרי B2), ומטא-דאטה של per-class support.
- collection Mongo חדשה `cv_title_model_runs` (מראה ל-`model_runs` הקיים) — trained_at, class list,
  per-class holdout F1/support, threshold. נחשף גם הוא דרך `GET /api/admin/model-status` (A3) —
  דשבורד אחד לשני המודלים.
- תזמון: job נפרד ב-[ofelia/config.ini](../../ofelia/config.ini) בתדירות נמוכה יותר (למשל שבועי) שמריץ
  `train_cv_classifier.py` אחרי ריענון periodic של `lang-uk-cv`-derived training data — לא צריך לרוץ
  יומי כמו מודל 1.

---

## Verification (כשהמימוש יתחיל)

- **A1/A2**: אחרי הרצת `extract_skills.py` על `raw_postings` — לוודא `jobs.jobs` מקבל מסמכים חדשים
  עם `skills.full_matches` לא ריק, ו-`raw_postings` המקוריים מסומנים `extracted: true`. להריץ
  `docker compose --profile batch run --rm pipeline` ידנית ולוודא שלוש השלבים רצים בסדר (לוגים).
- **A2.5**: להריץ `train.py` פעמיים ברצף על אותה דאטה (ריצה יציבה) ולוודא ש-`promoted: true` בשתיהן;
  לדמות ריצה גרועה (לחתוך ידנית חלק גדול מ-`jobs.jobs` בסביבת טסט) ולוודא ש-`model.joblib` **לא**
  משתנה, ש-`model_runs` מסמן `promoted: false` עם סיבה, ושה-`docker restart` בסוף `run_daily.sh`
  לא מתבצע.
- **A3**: לקרוא ל-`GET /api/admin/model-status` אחרי ריצת pipeline ולוודא שה-timestamp מתעדכן; ללחוץ
  "הרץ עכשיו" ולוודא ש-sidecar מפעיל container חדש (`docker ps`) ושה-DS מתאתחל בסופו.
- **A4**: אחרי ≥3 ריצות `promoted: true` — `GET /title/trending-skills?title=DevOps Engineer` מחזיר
  `time_features_reliable: true` + `growth_trend`/`stability_score` לא-null; עם פחות מ-3 ריצות —
  `false` + `null`. `GET /title/skills?title=...&vibe=trending` מחזיר סדר סקילים שונה מ-`vibe=stable`
  לאותה כותרת (כמו שכבר נבדק ל-`title_match` ב-[test_preferences.py](../../ds/model/test_preferences.py)).
- **B2.0**: על מכונה נקייה בלי `careerlens.lang-uk-cv`/`lang-uk-job` — להריץ `import_lang_uk.py` ולוודא
  ששתי הקולקציות נוצרות עם המספרים המצופים (210,250 / 141,897), ושהרצה חוזרת לא מכפילה מסמכים
  (`countDocuments` זהה לפני/אחרי ריצה שנייה).
- **B2**: לספור כמה מ-59 הכותרות מקבלות ≥50 רשומות אחרי מיפוי lang-uk-cv (סקריפט sanity, כמו
  ב-[06-model1-original-plan-historical.md](06-model1-original-plan-historical.md) DS-8).
- **B3**: לבדוק `POST /api/cv/title` עם קו"ח של תפקיד "מתמחה" (כמו SOC Analyst) ולוודא שה-response
  מגיע עם `source: 'llm_fallback'` וכותרת שנמצאת פיזית ברשימת ה-59 (לא הזיה).
- **B4**: `python -c "import joblib; m=joblib.load('text_to_job_title_classifier.joblib'); print(len(m.classes_))"`
  ולוודא מספר קרוב יותר ל-59 מאשר ל-38 הקיים היום.
