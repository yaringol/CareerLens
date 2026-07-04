# רשימת משימות חסרות - 2 אבני דרך (סשן 2026-07-02)

> צ'קליסט מזוקק מתוך [08-implementation-plan-track-a-b.md](08-implementation-plan-track-a-b.md) -
> אותה סקירה, אותם רפרנסי קוד, אבל כאן **רק** מה שחסר בפועל, ממוין לפי 2 אבני הדרך שסוכמו בשיחה,
> בלי הפירוט/הנימוקים המלאים (לאלה - ראו מסמך 08). כל הרשומות תחת "שפה" סגורה של **59 הכותרות
> הקנוניות** בלבד ([train.py CANONICAL_TITLES](../../ds/model/train.py#L73-L313)) - שום משימה כאן
> לא מוסיפה כותרת חדשה מחוץ לרשימה.
>
> נבדק ישירות בקוד (2026-07-02): **אף פריט כאן עדיין לא קיים** - `admin.routes.ts` מכיל רק
> `GET /analyses`, `AdminPage.tsx` הוא טבלת ניתוחים בלבד (אין `model-status`/`run`), אין
> `taxonomy.py`/`import_lang_uk.py`/`extract_skills.py`/`titleClassification.agent.ts`/
> `train_cv_classifier.py` בריפו, ואין `vibe` באף קובץ frontend/backend.

---

## אבן דרך 1 - Model 1: skill → title → טרנד זמן

| # | משימה | קובץ/מיקום |
|---|---|---|
| 1.1 | לייבא `process_raw_jobs()` מ-`origin/yarin/deploy` ל-[scraping/external/linkedin.py](../../scraping/external/linkedin.py) - סוגר את הפער שהסקרייפר כותב JSONL מקומי ולא Mongo, ולא מריץ SkillNer | `scraping/external/linkedin.py` |
| 1.2 | לחלץ ליבת SkillNer (`get_skills()` + upsert לפי `_id`/`scraped_at`) למודול משותף `ds/model/skill_extraction.py` | חדש |
| 1.3 | **סקריפט חילוץ גנרי** `ds/model/extract_skills.py` עם `SOURCE_COLLECTION`/`TARGET_COLLECTION` קונפיגורביליים - מריץ את אותה לוגיקת SkillNer על **כל** דאטהסט שכבר יושב ב-Mongo (למשל `lang-uk-job`, 142K רשומות, טרם חולץ) **בלי לגעת בקוד הסקרייפר**. זה בדיוק המנגנון שמאפשר "הרצת ג'וב מקצה לקצה על מקורות מידע שאינם סקרייפינג ספציפי" | חדש |
| 1.4 | סימון `extracted: true` על מסמכי מקור (checkpoint/resume - לא להריץ SkillNer פעמיים על אותו מסמך) | חלק מ-1.3 |
| 1.5 | לתקן [pipeline/Dockerfile](../../pipeline/Dockerfile): להתקין `en_core_web_lg` + skillNer (חסר היום) | `pipeline/Dockerfile` |
| 1.6 | לעדכן [pipeline/run_daily.sh](../../pipeline/run_daily.sh): scrape+extract → train → restart, ברצף אחד תקין | `pipeline/run_daily.sh` |
| 1.7 | `train.py` יתמוך ב**רשימת** source collections עם משקל per-source (`SOURCE_WEIGHTS=jobs:1.0,lang-uk-job-skills:0.3`) | `ds/model/train.py` |
| 1.8 | **שער איכות** לפני דריסת `model.joblib`: להשוות `titles_with_data`/`record_counts` מול הריצה הקודמת שבפרודקשן; ריצה גרועה → `promoted:false`, לא דורסת, `run_daily.sh` לא מפעיל restart | `ds/model/train.py` (סוף) |
| 1.9 | להעביר הודעה ליריב שהלוגיקה שביקש (trend על `training.ipynb`) **כבר קיימת** ב-`train.py` (recency_weight/trend_label) - לא לכתוב פעמיים; לשקול להעביר `training.ipynb` ל-`archive/` או לתייג SUPERSEDED | תיאום צוותי, לא קוד |
| 1.10 | `GET /title/trending-skills` - להוסיף `growth_trend` (slope על היסטוריה), `stability_score` (1 − CV), `time_features_reliable` (≥3 ריצות `promoted:true`) | `ds/model/server.py` (מורחב, שורות 199-236) |
| 1.11 | `GET /title/skills` - פרמטר `vibe=stable\|trending\|balanced` (ברירת מחדל balanced, backward compatible), עם `vibe_applied` בתשובה | `ds/model/server.py` (מורחב, שורות 114-131) |
| 1.12 | `GET /admin/model-runs?source=&days=` - היסטוריית `model_runs` ישירות מ-Mongo | חדש ב-`server.py` |
| 1.13 | `GET /admin/skill-features?title=&source=` - `role_skill_features` אחרונים לכותרת | חדש ב-`server.py` |
| 1.14 | `dsModel.ts`: להרחיב `getTrendingSkills()` עם `growthTrend`/`stabilityScore`/`timeFeaturesReliable`; proxies חדשים `getModelRunHistory()`/`getSkillFeatures()`; `getCoreSkills()` מקבל `vibe` אופציונלי | `backend/src/services/dsModel.ts` |
| 1.15 | `GET /api/admin/model-status` - contract מלא (model1 + model2 לאותו endpoint) | `backend/src/routes/admin.routes.ts` (חדש, לצד ה-route הקיים) |
| 1.16 | Frontend: טאב "מצב הלמידה" ב-`AdminPage.tsx` - טבלת כותרות + ספירת סקילים + badge טרנד + timestamp | `frontend/src/pages/AdminPage.tsx` |
| 1.17 | Frontend: לחבר בפועל את ה-vibe selector (Stable/Balanced/Trending) ב-`PersonalizationScreen.tsx` ל-API - כרגע אין שום `vibe` בקוד frontend בכלל, גם לא mock-wiring | `frontend/src/pages/PersonalizationScreen.tsx` |

### 1.18 - כפתורי "הרץ עכשיו" נפרדים וברורים לכל ג'וב (לא כפתור גנרי אחד)

באדמין, לכל אחד מהג'ובים הבאים כפתור ייעודי משלו (label ברור + endpoint נפרד), לא כפתור "run pipeline" יחיד:

- **"הרץ סקרייפינג + חילוץ (LinkedIn)"** → מפעיל את זרימת 1.1 (`search_all_jobs()`+`process_raw_jobs()`)
- **"הרץ חילוץ סקילים על מקור קיים"** → dropdown לבחירת collection מקור (`jobs.jobs` / `lang-uk-job` / כל דאטהסט חדש) → קורא ל-1.3 (`extract_skills.py --source=...`) - **זה הכפתור שמממש "הרצת הג'וב על מקורות מידע שאינם סקרייפינג ספציפי"**
- **"אמן מודל 1 מחדש"** → מריץ רק `train.py` (בנפרד מסקרייפינג, לצורך בדיקה ידנית אחרי שינוי דאטה)

כל כפתור → endpoint נפרד ב-sidecar (`POST /run/scrape`, `POST /run/extract?source=`, `POST /run/train`), לא endpoint גנרי `/run` יחיד - כדי שהמשתמש יידע בדיוק מה רץ, ולוג/סטטוס נפרדים לכל ג'וב.

### 1.19 - Sidecar `pipeline-trigger`

Service חדש ב-`docker-compose.yaml`, image קל (Python/Flask או Node), עם גישת `docker.sock` **מוגבלת ורק הוא** (לא בבקאנד הראשי) - חושף את 3 ה-endpoints מ-1.18. הבקאנד קורא אליו דרך `app-network` פנימית בלבד.

---

## אבן דרך 2 - Model 2: זיהוי טייטל מתוך קורות חיים (סגור ל-59 כותרות)

| # | משימה | קובץ/מיקום |
|---|---|---|
| 2.1 | מודול משותף `ds/model/taxonomy.py` - `CANONICAL_TITLES`/`VARIANT_TO_CANONICAL` מיוצא ממקום אחד יחיד; גם `train.py` וגם אימון מודל 2 מייבאים ממנו | חדש |
| 2.2 | לאמן מודל 2 ישירות על מרחב **59** הכותרות - לבטל את `label_map.consolidate()` (38 מחלקות → מיפוי קשיח שמצטמצם בפועל ל-21 יעדים בלבד) | מחליף `ds/model/label_map.py` |
| 2.3 | **סקריפט ייבוא** `ds/model/import_lang_uk.py` - מוריד מ-HuggingFace את `lang-uk-cv` (210,250) ו-`lang-uk-job` (141,897), כותב ל-Mongo (`bulk_write`/`upsert` לפי `id` מקורי - לא יוצר כפילויות בהרצה חוזרת). **קולקציות אלה לא נוצרות היום ע"י שום סקריפט בריפו** - תשתית חסרה לגמרי, לא רק שיפור | חדש |
| 2.4 | תלויות חדשות `datasets`+`huggingface_hub` ב-`ds/model/requirements.txt` (או `requirements-import.txt` נפרד) | `ds/model/requirements.txt` |
| 2.5 | מפת מיפוי חדשה `PRIMARY_KEYWORD_TO_CANONICAL` (ב-`taxonomy.py`) - 42 ה-Primary Keyword של lang-uk → אחת מ-59; לזרוק תפקידים לא-הנדסיים | `ds/model/taxonomy.py` |
| 2.6 | טכניקת `scrub` (הסרת `Position`/מילות כותרת מה-`CV`/`Highlights` לפני אימון) - למנוע דליפת מידע | סקריפט אימון חדש |
| 2.7 | **⚠️ לתעד למשתמש**: גם אחרי B2, 41/59 כותרות (כמעט כל סייבר/חומרה/מחקר) לא יהיו מיוצגות ב-lang-uk - LLM fallback (2.8-2.9) הוא חלק מובנה בתכנון, לא רשת ביטחון משנית | תיעוד |
| 2.8 | Agent LLM חדש `titleClassification.agent.ts` (אותו דפוס כמו `skillExtraction.agent.ts`) - system prompt עם רשימת 59 הכותרות המדויקת מ-`/titles`, כופה בחירה מתוך הרשימה בדיוק (או "none"), עם ולידציה שהתוצאה קיימת פיזית ברשימה | `backend/src/agents/titleClassification.agent.ts` |
| 2.9 | חיווט ב-`dsModel.ts`: אם confidence מתחת לסף לכל 3 המועמדים → LLM fallback, לתייג `source: 'classifier' \| 'llm_fallback'` | `backend/src/services/dsModel.ts` |
| 2.10 | `tfid.ipynb` → סקריפט standalone `ds/model/train_cv_classifier.py` (אותה תבנית שכבר קרתה למודל 1) - שומר `.joblib` + עותק מתוארך + `classes_`=59 + per-class support | חדש, מחליף notebook |
| 2.11 | קולקציית Mongo חדשה `cv_title_model_runs` (trained_at, class list, per-class F1/support, threshold) - נחשפת גם היא דרך `GET /api/admin/model-status` (אותו דשבורד לשני המודלים) | חדש |
| 2.12 | תזמון ב-[ofelia/config.ini](../../ofelia/config.ini) - job נפרד לאימון מודל 2 (שבועי, לא יומי כמו מודל 1) | `ofelia/config.ini` |

### 2.13 - כפתורים נפרדים באדמין לג'ובים של מודל 2

- **"ייבא lang-uk (CV + Job)"** → מריץ 2.3 (`import_lang_uk.py`) - **חד-פעמי/ידני**, לא חלק מ-`run_daily.sh` - זה בדיוק "הרצת ג'וב על מקור מידע שאינו סקרייפינג" (ייבוא dataset חיצוני מוכן, לא סריקה)
- **"אמן מודל 2 מחדש"** → מריץ 2.10 (`train_cv_classifier.py`)

אותו sidecar `pipeline-trigger` (1.19) מארח גם את שני ה-endpoints האלה (`POST /run/import-lang-uk`, `POST /run/train-model2`).

---

## Verification - מתי כל אבן דרך "נגמרה"

**אבן דרך 1:**
- `extract_skills.py` על מקור חדש (`lang-uk-job`) → `jobs.jobs`/collection יעד מקבל מסמכים עם `skills.full_matches` לא ריק, מקור מסומן `extracted:true`.
- ריצה כפולה של `train.py` על אותה דאטה → `promoted:true` בשתיהן; ריצה עם דאטה חתוכה → `promoted:false`, `model.joblib` לא משתנה, אין `docker restart`.
- אחרי ≥3 ריצות `promoted:true` → `time_features_reliable:true`, `growth_trend`/`stability_score` לא null.
- לחיצה על כל אחד מ-3 הכפתורים (1.18) → container נפרד רץ (`docker ps`), לוג/סטטוס נפרד לכל אחד.

**אבן דרך 2:**
- `import_lang_uk.py` על מכונה נקייה → שתי הקולקציות עם המספרים המצופים; הרצה חוזרת לא מכפילה (`countDocuments` זהה).
- לספור כמה מ-59 הכותרות מקבלות ≥50 רשומות אחרי מיפוי lang-uk.
- `POST /api/cv/title` על קו"ח של תפקיד נישתי (למשל SOC Analyst) → `source:'llm_fallback'` עם כותרת שקיימת פיזית ברשימת ה-59.
- `len(model.classes_)` קרוב ל-59 (לא 38).
