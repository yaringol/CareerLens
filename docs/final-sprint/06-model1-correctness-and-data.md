# משימה 06: מודל 1 - נכונות ההגשה + הדאטה שמאחוריה

> בריפינג לאייג'נט עצמאי. תלוי במשימה 13. **מחליף את `06-db-skills-enrichment.md` הישן,
> שהיה בנוי על הנחות שגויות** (ראה "מה השתנה" בסוף).
> כללי הברזל מ-[00-MASTER-PLAN.md](00-MASTER-PLAN.md) מחייבים.

## מטרה

מודל 1 (title→skills) מחזיר **תוצאות שגויות ניתנות-לצפייה**, ושלושה מהם ייצפו על המסך
מול השופטים. הבעיה **אינה בעיקרה חוסר דאטה — היא באגים בקוד ההגשה**. לכן הסדר הפוך ממה
שחשבנו: **קודם מתקנים את החישוב, ורק אחר כך מזינים דאטה.**

כל הממצאים למטה **אומתו ידנית ב-2026-07-14** מול `model.joblib` החי
(`trained_at=20260704_185757`) — לא השערות.

---

## שלב 0 - שלושת באגי הנכונות (P0, לפני כל דאטה)

### 0.1 - `title_specificity` מחושב, נשמר, מתועד... ולא נקרא לעולם

```
Frontend Developer top-5:  ['backend', 'react', 'typescript', 'javascript', 'web application']
                            ^^^^^^^^^  ← הסקיל מספר 1 של מפתח frontend
```

**השורש:** `train.py` מחשב `title_specificity` (IDF — עד כמה סקיל ייחודי לתפקיד) ושומר אותו
ב-feature matrix. גם `ds/model/README.md` וגם `SKILLS_MODEL.md` מתעדים את נוסחת הדירוג:
`score = 0.7 × prevalence + 0.3 × title_match × title_specificity`.

אבל [skill_schema.py:197-205](../../ds/model/skill_schema.py#L197-L205) — הקוד שבאמת מגיש —
ממיין `key=lambda kv: -prevalence` ואז לפי `stability_score`. `grep title_specificity`
על `skill_schema.py` ו-`server.py` → **אפס תוצאות**. הפיצ'ר שנועד למנוע בדיוק את
`Frontend → backend` מחושב ונזרק.

**תיקון:** להשתמש בו בדירוג. הנוסחה המתועדת היא הבחירה הטבעית
(`0.7·prevalence + 0.3·title_specificity`), או `prevalence × title_specificity`.
**לאמת אחרי התיקון:** להריץ את הדירוג על כל 59 התפקידים ולסקור את ה-top-5 — במיוחד
Frontend, Backend, DevOps, Data Scientist.

### 0.2 - פיצ'ר ה-Trend מת מתמטית (0 rising, 0 falling מתוך 60,334)

```
TREND DISTRIBUTION: {'stable': 60334}
```

**השורש — לא כמות דאטה, אלא אריתמטיקה:** `trend_label()` מחזיר `rising` רק ביחס ≥ 1.25
ו-`falling` רק ביחס ≤ 0.80, כאשר `ratio = recent_prevalence / prevalence`. טווח היחסים
**בפועל** במודל החי הוא [0.84, 1.22] — **כולו בתוך הרצועה הניטרלית**. אף רשומה לא יכולה
לחצות את הסף, בשום כמות דאטה שהיא, כל עוד החלון והספים כאלה.

**המשמעות:** `/title/trending-skills` לא יכול להחזיר טרנד. הטענה "אנחנו מזהים מגמות שוק
לאורך זמן" — שתופיע בספר, בפלייר ובדמו — אינה נתמכת ע"י המערכת.

**תיקון:** לכייל מחדש, לא רק להוסיף דאטה:
- להגדיל את חלון ה-recent ביחס לקורפוס (`TREND_WINDOW_DAYS` ~90), או להגדיר "recent"
  כאחוזון העליון של התפלגות `datePosted` במקום חלון קיר-שעון שמעוגן ל-NOW.
- לכייל את הספים לפי ההתפלגות האמיתית (למשל אחוזון 80/20 של היחסים, במקום 1.25/0.80 קשיחים).
- **אחרי התיקון: לבדוק שההתפלגות אינה מנוונת בכיוון ההפוך** (לא הכל rising).

### 0.3 - דגל האמינות קורא מפתח שאינו קיים

[skill_schema.py:214](../../ds/model/skill_schema.py#L214) קורא `f.get('time_coverage_reliable', False)` —
אבל המפתח שהמודל **באמת שומר** הוא `time_features_reliable`:
```
per-skill keys: ['frequency','growth_trend','history_months','prevalence',
                 'recent_prevalence','stability_score','time_features_reliable',
                 'title_specificity','trend']
```
כלומר `/title/skills` מדווח `false` ל-**100%** מהסקילז, כולל אלה שיש להם דאטת זמן אמיתית.
מנגנון היושרה שהצוות בנה — מושבת.

**תיקון:** שורה אחת (`time_features_reliable`, עם fallback ל-legacy). ואז למחוק את
מימוש-הצל של week-buckets ב-`skill_schema.py:142-180` כדי שיישאר מקור אמת אחד (`stability.py`).

### 0.4 - התפקידים הדלים מגישים ג'יבריש

```
Technical Product Manager (TPM) top-5:
  ['planning execution', 'processes manage', 'validation data',
   'electrical engineering', 'products combining']
```
ל-TPM יש **2 רשומות** בקורפוס. אלה שברי n-gram, לא סקילז. 8 תפקידים ב-`data_confidence: low`.

**תיקון:** רצפה קשיחה — תפקיד מתחת ל-N רשומות (או `data_confidence == 'low'`) **לא מגיש
top-5 מפוברק**. או fallback לרשימה מאוצרת, או שה-UI אומר "limited market data for this role"
ונשען על מסלול ה-LLM. `data_confidence` כבר מוחזר מה-server — צריך רק להשתמש בו.

### 0.5 - הסליידר Stable/Trending הוא no-op ברוב התפקידים

`stability_score` הוא 0.5 (ברירת המחדל) ב-**52,248 מתוך 60,334** רשומות (86.6%).
`personalization.service.ts:65` ממיין לפי `abs(stability - preference)` — וכשכל המועמדים
שווים 0.5, **הסליידר לא משנה ולו שורה אחת**. רק 12 מ-59 התפקידים כוללים סקיל אחד לפחות
עם דאטת זמן אמינה.

זה נגזרת של 0.2/0.3 + חוסר דאטה. **אחרי** תיקון 0.2-0.3 — למדוד שוב כמה תפקידים מקבלים
שונות אמיתית, ולהחליט: לתקן בדאטה (שלב 1), או להצמיד את הדמו לתפקידים שעובדים (ולתעד).

---

## שלב 1 - הקורפוס: לאתר או לשחזר (⚠️ ההנחה הקודמת הייתה שגויה)

**מה חשבנו:** `jobs` מכיל ~3,140 רשומות, `lang-uk-job-skills` חולץ חלקית.

**מה נמצא בפועל (2026-07-14):** ה-Mongo הנגיש (לפי `mongo_env.py`) מכיל ב-DB `jobs`
**רק** `model_runs` (מסמך אחד, מריצה שבורה) ו-`role_skill_features` (0 מסמכים).
**אין** קולקציית `jobs`, **אין** `lang-uk-job-skills`, **אין** `role_skill_observations`.
המודל החי אומן על 12,485 רשומות ש**אינן נמצאות באף מקום נגיש**.

**המשמעות:** המודל עובד, אבל **אינו ניתן לשחזור או לאימון-מחדש**. זו פגיעה ב-reproducibility
שהמנחה עשוי לשאול עליה, וזה חוסם כל העשרת דאטה.

**שלבי הפעולה:**
1. **לאתר** — האם הקורפוס חי ב-Mongo אחר (Atlas? URI אחר ב-`backend/.env`?). לבדוק לפני שמשחזרים.
2. אם לא נמצא — **לשחזר:** `import_lang_uk.py` (ייבוא מ-HuggingFace) → `extract_skills.py`
   (SkillNer, עם checkpoint `extracted: true` — **לעולם לא להריץ פעמיים על אותו מסמך**) →
   `migrate_unified_skill_observations.py`.
3. **סקרייפינג ממוקד** ל-9 התפקידים הדלים דרך `scraping/external/linkedin.py`
   (`search_all_jobs()` + `process_raw_jobs()` — כותב ל-Mongo עם SkillNer ו-`scraped_at`).
   ריצות בימים שונים = גם דאטה וגם נקודות זמן אמיתיות.
4. **סקילז של 2026** — לוודא שתפקידי ML מציגים LLM/RAG/agents, DevOps מציג K8s/IaC וכו'.
   אם השוק בקורפוס ישן (lang-uk הוא 2020-2023) — **לדווח למשתמש**, זו מגבלה שצריכה לעבור לספר.

**אם נשארים חורים שפוגעים בדמו — לעצור ולשאול.** אם מסונתז דאטה: לתעד מה בדיוק, לסמן
(`scraped_at_source`), ולספר על כך בספר. **לא לזייף דאטה בשקט.**

## שלב 2 - אימון, promote, אימות

- `train.py` עם `SOURCE_WEIGHTS`; שער ה-promotion חייב לעבור. כל ריצה נכתבת ל-`model_runs`.
- **הפייפליין היומי שבור מהקופסה:** `ofelia/config.ini` מרכיב `secrets/mongo.env` שלא קיים
  (יש רק `.example`) → Docker יוצר **תיקייה** במקומו → `run_daily.sh` לא מוצא קובץ →
  `MONGO_URI` לא נטען → ה-cron נכשל בשקט כל לילה. ליצור את הקובץ (gitignored!) ולהוכיח
  ריצה אחת מלאה.
- **מוקש בדמו:** ה-volume `model_data` (שם קבוע, שורד `docker compose down`) יכול להגיש
  מודל ישן ושבור גם כשה-checkout מושלם — `docker-entrypoint.sh` מזריע אותו **רק אם הקובץ
  חסר**. לפני הדמו: `docker volume rm model_data`. עדיף: להוסיף השוואת `trained_at` ב-entrypoint.
- restart ל-DS server אחרי promote; לוודא שהמודל החדש **באמת** מוגש.

## הגדרת Done

- [ ] **דירוג:** `Frontend Developer` לא מחזיר `backend` כסקיל #1; סקירה ידנית של top-5
      ל-10 תפקידים מרכזיים — כולם הגיוניים.
- [ ] **טרנד:** התפלגות `trend` אינה מנוונת (יש rising **וגם** falling **וגם** stable).
- [ ] **אמינות:** `/title/skills` מחזיר `true` לסקילז שיש להם דאטת זמן.
- [ ] **תפקידים דלים:** אף תפקיד לא מגיש שברי n-gram; יש רצפה או הודעת "limited data".
- [ ] **סליידר:** משנה בפועל את הרשימה עבור תפקידי הדמו (בדיקת Playwright).
- [ ] **קורפוס:** אותר או שוחזר; `train.py` רץ מקצה-לקצה ועבר promote.
- [ ] הפייפליין היומי הורץ בהצלחה **פעם אחת** בפועל (לא רק "אמור לעבוד").
- [ ] דוח `outputs/06-model1-report.md` (אנגלית) — לפני/אחרי לכל תיקון. נכנס לספר.

## גבולות

- לא לגעת במודל 2 (המסווג) — זו משימה 05.
- שינוי בקבצי `ds/model/*.py` → **חובה restart ל-DS server**.
- כל שינוי בנוסחת הדירוג — לשמור backward compatibility של ברירות המחדל ב-API.
- **בספק לגבי סינתוז דאטה — לשאול, לא להמציא.**

## מה השתנה מהגרסה הקודמת של משימה זו

הגרסה הישנה (`06-db-skills-enrichment.md`) הניחה שהבעיה היא **דאטה** ושהקורפוס קיים ב-Mongo.
שתי ההנחות שגויות: (1) שלושה באגים בקוד ההגשה מייצרים תוצאות שגויות גם עם דאטה מושלם;
(2) הקורפוס אינו ב-Mongo הנגיש. בנוסף, פריט A4 (time-features API) הועבר לכאן ממשימה 07 —
הוא אותו קוד בדיוק.
