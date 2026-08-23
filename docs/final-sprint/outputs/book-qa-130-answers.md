# 130 שאלות על הספר — תשובות מהקוד

**נכתב:** 2026-08-18 · **שיטה:** כל תשובה נגזרה מקריאה בקוד/במסמכי המדידה, לא מזיכרון.
כל טענה נושאת הפניה לקובץ:שורה כדי שתוכלי לאמת בעצמך.
**סימון `❓` = שאלה שהיא שלך לענות** (עמדה/העדפה/מי-עשה-מה) — במקומות האלה רשמתי רק את
העובדות שכן ניתן לאמת מהריפו.

---

## מטרת המוצר וה־Match

**1.** השני, ואפילו זה מרוכך: *"עד כמה ה־CV מוכיח 10 כישורים שנבחרו — 5 מהתפקיד, 5 מהמשרה"*.
"בודק התאמה בין CV למשרה" הוא **לא** תיאור נכון של מה שרץ.

**2.** כתוב `Match Score` בפירוש — `SkillsMatchDashboard.tsx:656`. ה־UI **לא** מרכך.
(מסמך ה־copy אף מחזק: `03-ui-copy.md:265` שינה `Overall match` → `Match Score` כ"שם־מוצר").
היחיד שכן רוכך: `% match` → `% confidence` בזיהוי התפקיד (`03-ui-copy.md:187`).

**3.** באופן חלקי בלבד, ופחות ממה שהספר מרמז. ב־`/api/analyze` הרשימה הדינמית נבנית
`[...trending(role), ...llmFromJD]` — **קודם** 5 סקילים של התפקיד מ־DS ורק אחר כך ה־JD
(`analyze.routes.ts:236-243`). הסלוטים 6-10 מתמלאים לפי הסדר הזה, אחרי סינון כפילויות
מול ה־core. בפועל: בדרך כלל **2-4 מתוך 10** נקבעים ע"י ה־JD.

**4.** לא. ה־JD נכנס למערכת בשתי נקודות בלבד: (א) הפרומפט של `extractSkillPool` — טקסט
מלא (`skillExtraction.agent.ts:80-88`); (ב) SkillNer במסך הפרסונליזציה
(`focusSkillPool.service.ts:83-93`). **אין** חילוץ seniority / שנות ניסיון / responsibilities.
מה שנשאר מה־JD אחרי השלב הזה = 5 מחרוזות שמות סקילים.

**5.** ב־`/api/analyze`: ה־core מגיע מ־`/title/skills` לפי ה־title בלבד — **אפס השפעה של JD**
(`analyze.routes.ts:230`, `job.service.ts::getCoreSkillsById`).
ב־`/api/analyze/personalized`: core = `/title/trending-skills` top-10 מסונן לפי
stabilityPreference — גם כאן אפס JD (`analyze.routes.ts:530-536`).

**6.** כן — כמעט זהים לחלוטין. `scoreSkills(cvText, skills)` מקבל **רק** את שני אלה
(`scoring.agent.ts:38-51`), אין `jobDescription` בשום מקום ב־`scoring.service.ts`.
ההפרש היחיד הוא רעש ה־LLM: σ≈0.11 נק' (`official-metrics.md` §2.3).

**7.** ❓ **את צריכה לענות** (זו שאלת עמדה).
עובדות: התיעוד הראשון של הפער הוא `official-metrics.md` §2.5, 2026-08-03 — "A repo-wide
check confirms it". כלומר **נמדד ותועד מאוחר**. האם זה היה design מודע מלכתחילה — אין
בריפו החלטה כתובה שאומרת זאת.

**8.** ❓ **את צריכה לענות**.
עובדות שיעמדו בבסיס כל ניסוח שתבחרי (`official-metrics.md` §2.2): matched 4.50 מול
mismatched 3.84 — מרווח 0.66 נק' מתוך 10; `adjacent` שווה בדיוק ל־`matched`; ציון שיא
7.0 ניתן לזוג *לא* תואם; היפוך אחד מלא; תיקו מלא אחד. המשפט של המסמך עצמו:
*"behaves more like a CV-quality score than a CV-to-job fit score"*.

---

## עשרת הכישורים

**9. 5 ה־core בפרודקשן, שלב אחרי שלב** (`/api/analyze`):
1. הטייטל הקנוני (מסולם הזיהוי) → `getCoreSkillsById` → `GET /title/skills` (`dsModel.ts:330`).
2. DS: char n-gram TF-IDF + KNN ממפה את מחרוזת הטייטל לוריאנט קנוני (`server.py:571-575`).
3. `select_display_skills` על ה־feature matrix של אותו תפקיד (`skill_schema.py:196-250`):
   א. **סינון ubiquity** — סקיל שמופיע ביותר מ־`SKILL_UBIQUITY_CAP` תפקידים (11 בקונפיג הנמדד) נזרק;
   ב. top-10 לפי `prevalence` (משוקלל־רצנסי);
   ג. מתוך העשירייה — top-5 לפי `stability_score`.
4. חוזר כ־`suggested_skills` → סלוטים 1-5.

**10. 5 ה־dynamic בפרודקשן** (`/api/analyze`, `analyze.routes.ts:230-243`):
1. `getTrendingSkills(title, 5)` → `/title/trending-skills` — top-5 לפי prevalence אחרי סינון ubiquity.
2. `extractDynamicSkills(title, jd)` → **LLM agent** `extractSkillPool` (gpt-4o-mini) שמחזיר
   `topFive` + `additional` מתוך ה־JD (`skillExtraction.agent.ts`).
3. `mergeTenSkills` משרשר `[...trending, ...llmTopFive]`, זורק כפילות מדויקת וכל מה
   שדומה ל־core ב־Jaccard ≥ 0.5, וממלא עד 10 (`analyze.routes.ts:100-155`).

> שימי לב לסדר: trending לפני ה־JD. זה הפער בתפיסה שהספר לא מתאר.

**11.** **לא SkillNer** — LLM agent. SkillNer רץ ב־`/api/analyze` **בכלל לא**. הוא מופיע ב:
(א) `/api/analyze/skillner` — מסלול חלופי שה־UI לא קורא לו (`analyze.routes.ts:400+`);
(ב) `fetchFocusSkillPool` במסלול הפרסונליזציה, כמקור שלישי אחרי trending ו־LLM
(`focusSkillPool.service.ts:83-93`); (ג) בפייפליין האימון של מודל 1; (ד) ב־agreement signal.

**12.** ה־agent הזה **הוא** מה שהספר מכנה "skill-pool extraction from postings" — אין שני
רכיבים. מה שהוא עושה ש־SkillNer לא: מדרג לפי חשיבות-לגיוס, מנסח שמות "resume-ready",
מזהה דרישות **משתמעות** (לא רק מחרוזות שקיימות בטקסט), ומחזיר בדיוק 5+5 מדורגים.
SkillNer רק מזהה מחרוזות מתוך EMSI SKILL_DB, בלי דירוג חשיבות.

**13.** לא רלוונטי כמנוסח — **אין לנו טקסונומיית סקילים משלנו**. הטקסונומיה = EMSI SKILL_DB
של SkillNer. באימון מודל 1 יש סינון: אורך<3, `UNIVERSAL_NOISE` (רשימה קשיחה), שם התפקיד
עצמו, ו־ngram score<0.75 (`train.py:132-142`, `skill_schema.py:96-104`).

**14.** **כן, בהחלט.** ה־LLM לא מוגבל לשום רשימה — `extractSkillPool` מקבל מחרוזות חופשיות
ומחזיר מה שהוא רוצה ("Kubernetes", "distributed systems design"). הוולידציה היחידה:
מחרוזת לא ריקה + dedupe (`skillExtraction.agent.ts:56-75`).

**15.** `mergeTenSkills`: (א) התאמה מדויקת lowercase → נזרק; (ב) `isNearDuplicateOfCore` —
Jaccard על טוקנים באורך>2, סף 0.5 → נזרק (`analyze.routes.ts:47-57, 126-134`).
"Python" בשתי הרשימות → יופיע רק ב־core, וה־dynamic מקבל את הבא בתור.

**16.** שלוש שכבות מילוי (`analyze.routes.ts:136-160`):
1. `MERGE_PADDING_BY_TITLE` — 5 ביטויים ידניים, קיים רק ל־**5 תפקידים**
   (Software Engineer, Data Scientist, Product Manager, DevOps, Frontend);
2. אחרת — 8 soft skills גנריים ("Written communication", "Problem solving"...);
3. ואם עדיין חסר — `"Role-specific competency 1 (<title>)"`. ← זו מחרוזת שנשלחת ל־LLM לניקוד.

**17.** כן, ורק על core. `computeStabilityPreference(stable, trending)` → מרחק מ־
`stabilityScore` של כל מועמד (`personalization.service.ts:29-70`).
**ממצא נוסף לספר:** `personalMatch` (הסליידר השלישי) **מתעלמים ממנו לחלוטין** —
הוא נבדק שהסכום=100 ואז לא נכנס לחישוב (`personalization.service.ts:29-33`).

**18.** רק על dynamic. `selectDynamicSkills(pool, selectedSkillIds)` פועל על ה־focus pool
בלבד; ההערה בקוד מסבירה שערבוב שלהם ל־core היה באג קודם שגרם לרשימה להיראות זהה
בכל פרסונליזציה (`analyze.routes.ts:509-521`, `personalization.service.ts:72-113`).

**19.** Custom מאפשר: 3 סליידרים (stable / trending / personalMatch, סכום 100) + עד 5
focus skills. **בפועל משפיע רק:** יחס stable:trending (על core) + הבחירות (על dynamic).
Figure 9 מדויק בכך שיש סליידר `personal` על המסך — אבל הוא **לא מחובר לכלום**.
פרסטים: Stable = 60/15/25 → preference 0.2 · Balanced 33/33/34 → 0.5 · Trending 15/60/25 → 0.8
(`PersonalizationScreen.tsx:56-58`).

---

## Model 1 וה־market model

**20.** הוא לומד **התפלגות שכיחות של סקילים לכל תפקיד לאורך זמן** — לא פונקציית מיפוי.
המרכיבים: aggregation משוקלל־רצנסי (prevalence), רגרסיה ליניארית על שכיחות חודשית
(`stability.py:33-115`), ותווית trend מיחס. יש בו גם רכיב sklearn אמיתי — `TfidfVectorizer`
+ `NearestNeighbors` — אבל **רק** למיפוי מחרוזת־טייטל→תפקיד קנוני, לא לסקילים
(`train.py:487-495`). המלצה לניסוח: "statistical market model with a lexical title-matching index".

**21.** לכל role: `{skill: {frequency, prevalence, recent_prevalence, trend, title_specificity,
growth_trend, stability_score, time_features_reliable, history_months, observation_count,
observation_weeks}}` + `record_counts` + `confidence_level` ב־`canonical_titles.json`
(`train.py:437-500`).

**22.** **מת לגמרי.** `title_specificity` מחושב (`train.py:443-444`) ונשמר, אבל
`select_display_skills` מדרג לפי prevalence ואז stability בלבד (`skill_schema.py:236-244`).
ה־ubiquity filter הוא **מנגנון נפרד** — `compute_role_counts` סופר בכמה roles הסקיל עובר
רף prevalence (`skill_schema.py:170-194`). קונספטואלית קרוב ל־IDF, אבל **לא משתמש**
ב־`title_specificity` ואפילו לא קורא אותו. `official-metrics.md` מאשר במפורש.

**23.** ❓ **את צריכה לענות**.

**24.** `stability.py::compute_stability_features`: לכל (role, skill) — שכיחות חודשית
מנורמלת → `np.polyfit` דרגה 1 → **percentile-rank של השיפוע בתוך אותו תפקיד**.
0 = השיפוע הכי שלילי בתפקיד, 1 = הכי חיובי. דורש ≥3 חודשים עם נתון, אחרת 0.5 + `reliable=false`.
⚠️ **מלכודת שמות:** הערך נקרא `stability_score` אבל 1 = **הכי טרנדי**, לא הכי יציב
(הערה בקוד: "0 = flat/stable, 1 = steep/trendy"). יש גם `compute_stability_score` שני
ב־`skill_schema.py:139-176` (1−CV של פיזור שבועי) — הוא מחושב, נשמר, ואז **נדרס**
ע"י הראשון ב־`train.py:471-482`.

**25.** שתי שכבות:
1. **באימון**: `trend_label(recent_prev, prev)` — יחס ≥1.25 rising, ≤0.80 falling (`train.py:404-414`).
2. **בטעינת השרת**: `recalibrate_trend_labels` — כי בפועל כל 60,334 הסקילים יצאו `stable`
   (טווח היחסים היה [0.84,1.22]). מחשב מחדש לפי **חמישונים**: rising = top 20% (ומינ' +5%),
   falling = bottom 20% (`server.py:61-100`). ה־joblib לא משתנה.

**26.** **הפרסט "Trending" לא נוגע בתווית `trend` בכלל.** הוא מתרגם ל־
stabilityPreference=0.8 ובוחר סקילים שה־`stability_score` **הפרצנטילי** שלהם הכי קרוב
ל־0.8. התוויות rising/falling מוצגות רק כחץ בדשבורד (`SkillsMatchDashboard.tsx:136`).
⚠️ `06-model1-report.md` מתעד: על הקורפוס הזה ה־stability מתכווץ ל־0.97-1.0, ולכן הפרסט
Trending מחזיר **בדיוק את אותה רשימה** כמו Stable; רק Custom 0/100/0 מגיע ל־1.0 ומייצר
רשימה שונה. לא תוקן (החלטה מודעת, מחוץ לסקופ M06).

**27.** **נבחר ידנית, לא נמדד.** `RECENCY_HALF_LIFE_DAYS` default 14 (`train.py:41`) — כוון
לקורפוס שנגרד ברציפות. **המודל שמוגש היום אומן ב־365, לא 14** (`06-model1-report.md`),
כי 14 יום על קורפוס בן 6 שנים נותן משקל 0.5^75 ≈ 10⁻²³ לפוסט מ־2023. אין ניסוי שהשווה
ערכים. **אם 14 מופיע בספר כמספר של המערכת — זה שגוי לגבי המודל המוגש.**

**28.** ❓ תלוי בתיבת הדמו, אבל: **סביר שלא.** הקוד קיים (`ofelia/config.ini`, `0 0 3 * * *`),
אבל הוא דורש `secrets/mongo.env` שהוא gitignored, ו־`06-model1-report.md` מציין ש"תיקון
הפייפליין הלילי (`secrets/mongo.env`) נדחה". חשוב מזה: המודל **המוגש** (`20260728_005411`)
אומן ידנית מ־lang-uk+augmented — **לא** דרך המסלול הלילי.

**29.** במסלול המתוכנן — כן, בדיוק זה (`pipeline/run_daily.sh`): scrape → SkillNer×2 →
migrate → train → **restart רק אם הקוד יצא 0** (כלומר promoted; `train.py:630` מחזיר 2 אם לא).
בפועל — ראי 28.

**30.** רשימת הקריטריונים **המלאה** (`promotion_gate.py:59-92`). אין שום מדד איכות:
- **ריצה ראשונה** (אין baseline): סה"כ רשומות ≥200 · roles עם דאטה ≥8 · roles עם ≥50 רשומות ≥3.
- **ריצה רגילה** (מול הריצה המקודמת האחרונה): מספר ה־roles עם ≥50 רשומות **לא ירד**;
  סה"כ הרשומות לא ירד ביותר מ־20%.

זהו. **הכל ספירת שורות.**

**31.** **כן, בוודאות.** `train.py` לא מייבא כלום מ־`sklearn.metrics`, אין split, אין
holdout. precision@10 יכול לצנוח מ־97% ל־10% והשער יעביר, כל עוד הספירות שמורות.
זה מנוסח מפורשות ב־`official-metrics.md` §3.1.

**32.** ✅ מדויק כפי שניסחת. `train.py` תמיד שומר snapshot מתוארך; רק
`model.joblib` מוחלף אם השער עבר (`train.py:520-527`). כלומר **retrained nightly, promoted
conditionally**. הניסוח "nightly-retrained market model" תקין; הניסוח "המודל מתעדכן כל
לילה" — לא.

---

## הדאטה של Model 1

**33.** מה שנכנס למודל **המוגש** (`06-model1-report.md`, "Training"):

```
SOURCE_WEIGHTS=lang-uk-job-skills:1.0,augmented-2026:1.0
```

- **Djinni/lang-uk job postings** — 41,745 מודעות אמיתיות (2020-01 → 2023-09). ✅
- **augmented-2026** — 10,800 רשומות סינתטיות מסומנות (2023H2 → 2026H1). ✅
- **LinkedIn** — ❌ **לא נכנס למודל המוגש.** הוא המקור של המסלול הלילי
  (`SOURCE_WEIGHTS=linkedin:1.0,lang_uk:0.3` ב־`run_daily.sh`) שלא רץ.

**34.** **לא משמשים את market model בכלל.** `06-model1-report.md` אומר במפורש:
`lang-uk-cv` (210,250) = "used by M18, not by this training". הם משמשים את **מודל 2**
(ה־CV classifier) ואת **מודל ה־agreement**.

**35.** אין להם מה לחפש שם. אם הם מוזכרים ליד ה־market model בספר — **זה תיאור שגוי**
ואחד הדברים הכי קלים לגלית לתפוס. מקומם הנכון: פרק מודל 2.

**36.** כן, 100% מיוצר בקוד — אבל **לא ע"י LLM**. `augment_2026.py` הוא גנרטור
דטרמיניסטי (seed=42): דוגם סקילי בסיס מההתפלגות **האמיתית** של אותו תפקיד, ומזריק
סקילים מרשימה **שנכתבה ידנית** ע"י הצוות (`market_2026_skills.py`) לפי ramp הסתברותי לינארי.
LLM לא היה מעורב.

**37.** לכל record נוצר: קבוצת סקילים (8-14 בסיסיים + emerging לפי ramp) + `datePosted`
אקראי בתוך חצי-השנה + `skill_records` מוכן. **לא נכתב JD** — אין טקסט מודעה בכלל, רק
(role, skills[], timestamp). מסומן `source='augmented-2026'`, `augmented=True`,
`augmentation_method='curated-list-ramp-v1'`.

**38.** במונחי רשומות: **10,800 / 52,545 = 20.6%**. אבל זה מספר מטעה, ושווה שהספר יגיד
את הגרסה המדויקת:
- **100% מההיסטוריה שאחרי 2023H2 היא סינתטית** (הקורפוס האמיתי נגמר 2023-09).
- כל האותות של "טרנדים 2024-2026" — llm, rag, playwright, gitops — מגיעים **אך ורק** משם.
- עם half-life של 365 יום, החלון הסינתטי מקבל את המשקל הגבוה ביותר ב־prevalence.

**39.** ❓ **את צריכה לענות** (זו שאלת נוחות/כנות, לא עובדה).
העובדה היחידה שאני יכולה להוסיף: הריפו מקיים את הכלל שלו — הסימון קיים בכל record,
המתודולוגיה מתועדת, וזו נקודת חוזק אם היא **מוצהרת** בספר ולא מתגלה ע"י גלית.

**40.** **שניהם, וזה החלק היחיד שהוא באמת אמפירי.** ה־buckets החודשיים 2020-2023 מזינים את
רגרסיית ה־slope (`train.py:340-348` → `stability.py`), ו־`06-model1-report.md` מתעד
"significant risers/fallers within 2020-2023" ב־EDA. אבל כל **תווית** trend שמוצגת היום
מחושבת מחדש בטעינת השרת מיחס recent/overall — כלומר מהחלון הסינתטי.

**41.** publication date אמיתי. השדה המקורי ב־Djinni הוא `Published`, ממופה ל־`datePosted`
ב־import; `resolve_observed_at` מעדיף `datePosted` → `scraped_at` → `extracted_at`
(`skill_schema.py:55-62`). כלומר לרשומות lang-uk זה תאריך פרסום, לא inferred.

---

## Model 2 — CV classifier

**42.** לא "כל הטקסט". מדויק: `clean_text(scrub(text, raw_title, canonical_label))` —
מסירים אימיילים/URL/טלפונים, מנרמלים רווחים, ומוחקים את **מחרוזת הטייטל** (גולמי + קנוני),
case-insensitive (`train_cv_classifier.py:88-107`). וגם: מקור lang-uk משתמש בשדה
`Highlights` (פסקת תמצית), **לא** בגוף ה־CV המלא.

**43.** **רק ב־training.** אין שום `scrub` ב־`server.py::classify_cv_role` — הטקסט נכנס
כמו שהוא ל־`predict_proba` (`server.py:608-611`).

**44.** **כן, יראה אותו במלואו.** אין סינון בזמן inference.

**45.** **כן — train/serve mismatch אמיתי.** באימון המודל לעולם לא ראה את שם התפקיד;
ב־inference הוא כן. הכיוון: הפער **מטיב** עם ה־inference (רמז חינם), ולכן לא גורם
לכישלון גלוי — אבל הוא אומר שהמדד 62.3% נמדד בתנאי קשה יותר ממה שקורה בפרודקשן, וזו
נקודה שראוי לומר בספר ולא להסתיר.

**46.** **קו"ח אמיתיים, לא סינתטיים.** רשומות `lang-uk-cv` שה־Primary Keyword שלהן ממופה
ל־`OTHER_LABEL` — Marketing / HR / Sales / Recruiter / Lead-Gen / Support / Artist.
Cap 800 לכיתה (`train_cv_classifier.py:72-80`), נמוך במכוון כדי ש־`__other__` לא יבלע
כיתות הנדסיות מיעוטיות.

**47.** כן — 59 + `__other__` = **60 מחלקות פלט**. `__other__` **לעולם לא מוחזר** לקורא:
הוא מסונן מה־top-3, אבל המסה שלו נשארת במכנה כדי לדכא את הביטחון (`server.py:608-640`).

**48.** דוגמת אימון = **מחרוזת טייטל קצרה בלבד**, למשל `"FPGA Engineer"`, `"Sr. FPGA Design Eng."`.
מקור: `synthetic_titles.csv`, ~**25 וריאציות לטייטל**, נוצרו ע"י gpt-4o-mini
(`generate_synthetic_titles.py`; 1,455 שורות ל־59 טייטלים). **train-only** — לעולם לא
ב־val/test.

**49.** **נכון בדיוק.** וזה נמדד: הקו"ח של FPGA ושל malware research שניהם מסווגים
`C++ Developer` (`official-metrics.md` §1.5). התיעוד עצמו כותב: "סביר שהמודל מזהה
מילת-מפתח עבורם ולא מבין תפקיד מתוך גוף טקסט" (`TITLE_DETECTION_METHODOLOGY.md` §6.2).

**50.** ❓ **את צריכה לענות** — אבל ההמלצה שלי חד־משמעית: **synthetic label-presence
examples** (או "title-string-only examples"). "Synthetic bridge" מרמז שהמודל למד לגשר
מתיאור־תפקיד לתפקיד; הוא לא. הוא למד ש־12 מחרוזות מסוימות שייכות לתווית מסוימת.

---

## Role Detection Ladder

**51.** ✅ הסדר שלך נכון — עם הבהרה חשובה. הסולם **בפועל** בפרודקשן חי ב־backend
(`dsModel.ts::extractTitleFromCv` + `detectTitleFromCv`), לא ב־DS:
1. LLM מחלץ טייטל מוצהר verbatim מ־headerText (`titleExtraction.agent.ts`);
2. אם נמצא → `GET /title/normalize` — SBERT nearest-centroid מול 59;
3. אם ה־LLM החזיר `NONE` (או שהחילוץ קרס) → `GET /cv/role` — TF-IDF+MLP על גוף ה־CV;
4. אם **כל** המועמדים < 55 → LLM סגור ל־59 (`titleClassification.agent.ts`).

⚠️ `POST /cv/title` ב־`server.py` (עם `best_title_candidate`/veto/regex) הוא סולם **ישן
ומקביל שהמוצר לא קורא לו**. אם הספר מתאר אותו — הוא מתאר קוד מת.

**52.** **לא.** זו טעות נפוצה. `getTitleMatches` מחזיר תמיד top-3 בלי סף; הסף 0.55 חי
ב־`server.py:120` ומשמש רק את הסולם הישן. במסלול האמיתי: דמיון נמוך → מוחזר עם
`low_confidence=true` → `detectTitleFromCv` רואה שכולם <55 → **LLM fallback**, לא classifier.
ל־classifier מגיעים **רק** אם לא נמצא טייטל מוצהר בכלל.

**53.** כן — `{"title": "NONE"}` היא תשובה תקינה ומטופלת (`titleExtraction.agent.ts:52-56`).
נבדל במפורש מכשל LLM, שזורק `AgentError`.

**54.** regex/היוריסטיקות **לא רצים לפניו** במסלול הפרודקשן — ה־LLM החליף אותם לגמרי
(ההערה ב־`titleExtraction.agent.ts:22-37` מפרטת מדוע: collision של substring "cloud"
בתוך "Cloudscale", טייטלים כמו Cryptographer שלא חלקו מילה עם הרשימה, ו־false positives
אחרי הרחבה נאיבית). ההיוריסטיקות עדיין קיימות ב־`server.py` — בקוד שלא נקרא.
למה בכלל LLM: הכותרת "שורה ברורה" רק בחלק מהקו"ח; ב־PDF דו-עמודתי/sidebar/עטיפת שורות
היא לא.

**55.** **centroid מכמה דוגמאות** לכל תפקיד — לא embedding של הטייטל הקנוני לבדו.
1,620 דוגמאות סה"כ, 24-33 לכל מחלקה (`TITLE_DETECTION_METHODOLOGY.md` §5.7).

**56.** שני מקורות: **1,455 סינתטיות** מ־gpt-4o-mini (`synthetic_titles.csv`) + **269
וריאציות מתויגות ידנית** מרשימת הוריאנטים ב־`taxonomy.py`.
(השחזור ב־M19/W2 בנה 834 מחרוזות דטרמיניסטיות מ־`taxonomy.py` בלבד והגיע ל־0.934 —
כלומר ה־centroids לא באמת תלויים בסינתטי.)

**57.** **מתאר נכון.** 24-33 דוגמאות למחלקה זה few-shot אמיתי לפי כל הגדרה. זה **לא**
רציונליזציה בדיעבד. אבל שימי לב מה זה כן אומר: המשטר הזה תקף למודל **3** בלבד — לא
למודל 2 ולא למודל 1.

**58.** על **split מוחזק של אותן 1,620 מחרוזות טייטל** — n=405 val. כלומר **בעיקר
מחרוזות שנוצרו ע"י LLM**, לא job titles שנגרדו ולא כותרות מקו"ח.
שתי מדידות נוספות, יותר מייצגות, קיימות ב־M19/W2 ושוות ציטוט לצידו:
82.2% על 269 הוריאנטים המתויגים ידנית, ו־**23/28 על כותרות קו"ח אותנטיים**.

**59.** ✅ כן — אותו split בדיוק, n=405, המשתנה היחיד הוא השיטה
(`TITLE_DETECTION_METHODOLOGY.md` §5.7). זו השוואה הוגנת.

**60.** **רק CV text (עד 6,000 תו) + רשימת 59 הטייטלים.** אין העברה של מועמדי ה־classifier
(`titleClassification.agent.ts:67-72`). יש hallucination guard: תשובה שלא קיימת ברשימה
verbatim → `AgentError`.

**61.** לא מחזיר confidence. מקבל ערך **קבוע 70** (`dsModel.ts:31`) — מעל סף ה־auto-accept
של ה־UI (60), מתחת ל"פגיעה ודאית".

**62.** כן — חיפוש ידני זמין תמיד; הוא קורא ל־`/title/normalize` ישירות
(`dsModel.ts::getTitleMatches`). ה־picker נפתח אוטומטית כשה־confidence < 60.

---

## Agreement signal

**63.** כן — `skills_to_24_plus_other.joblib`: multi-hot של סקילי SkillNer → תפקיד
(`server.py:172-213`).

**64.** קבוצות סקילים מ־`lang-uk-cv-skills` (10,651 קו"ח עם ≥3 סקילים) + `master_resumes`
בסבב 2, תוויות מ־`Primary Keyword`; `__other__` מ־**1,750 קו"ח לא-הנדסיים אמיתיים**
(M19/W3). Held-out: acc 0.828, macro-F1 0.887, top-3 0.945.

**65.** **IDs בלבד — set, לא weights.** `vectorizer.transform([skills])` על קבוצת מחרוזות
(`server.py:191-193`). ה־score של SkillNer משמש רק כסף קבלה (ngram ≥0.9) לפני הכניסה לקבוצה.

**66.** **24 מתוך 59** (+`__other__` = 25 מחלקות). ה־35 הנותרים מחוץ למרחב התוויות — לפי
החלטת משתמש, בלי דאטה סינתטי. תפקיד שלא מכוסה → סטטוס `not_covered` → נייטרלי לגמרי.

**67.** `agree` = התשובה של הסולם נמצאת ב־**top-3** של ה־router (כלל רך; top-1 בלבד העניש
משפחות סמוכות כמו DS/MLE). התוצאה: `confidence = max(base, 87)` (`server.py:232-237`).

**68.** `disagree` או `rejects` → `confidence = min(base, 50)`, **ורק אם** `base < 85`
(שומר: כותרת מוצהרת בטוחה לעולם לא נדרסת). כל המועמדים נחתכים ל־50, וה־pick של ה־router
מצטרף לרשימה ל־UI (`server.py:239-253`).

**69.** **לא ל־picker — ל־LLM.** 50 < 55 → `detectTitleFromCv` מפעיל את ה־LLM הסגור.
אם ה־LLM מחזיר טייטל → confidence 70 → **auto-accept** (מעל 60). ה־picker הידני נפתח רק
אם ה־LLM החזיר `none` או נכשל.

**70.** **לא ממש independent, וזו נקודת תורפה אמיתית בניסוח.** שניהם נלמדים מ־lang-uk;
שניהם ממופים דרך אותה `PRIMARY_KEYWORD_TO_CANONICAL`. מה שכן שונה: (א) ייצוג — טקסט גולמי
TF-IDF מול multi-hot של סקילים; (ב) שדה מקור — `Highlights` מול קבוצת סקילים מכל המסמך;
(ג) אלגוריתם — MLP מול LogReg; (ד) מרחב תוויות — 59+other מול 24+other.
ניסוח בטוח יותר: **"two views of the same corpus"** / "two differently-featurised
classifiers", לא "two independently trained witnesses".

**71.** ❓ **את צריכה לענות**.
כל המספרים שקיימים (`official-metrics.md` §1.4): טווח = 5 agree / 2 disagree / **22 מדולגים**;
דיוק 16/29 → 17/29; **1 עזר, 0 הזיק**; והנגד-אפקט המוצהר — בשני קו"ח ה־`agree` הרים
מ־37.1 ו־54.3 ל־87 והפך "מתחת לסף→LLM" ל"auto-accept" כשהתשובה **שגויה** בשניהם.
המספר 87% מגיע מ־M18 על n=20 (15 הסכמות), לא מהמערכת המוגשת.

---

## LLM scoring

**72.** **בדיוק זה ותו לא:** `cvText` המנורמל המלא + 10 שמות סקילים ממוספרים
(`scoring.agent.ts:44-50`).

**73.** רק השם. `"1. Python\n2. Docker\n..."`. אין הגדרה, אין הקשר, אין מקור (core/dynamic).

**74.** **לא.** `jobTitle` מועבר ל־`buildScoringRawOutput` — ומשמש **רק ללוגים**
(`scoring.service.ts:160-200`). לא נכנס לפרומפט.

**75.** **לא.** ה־proficiency קיים רק בזרימת השיפור (`suggestions.agent.ts`), אחרי הניקוד.

**76.** מחזיר **ארבעה** שדות לכל סקיל: `skill`, `score`, `evidence` (≤18 מילים),
`missing` (≤18 מילים) — `scoring.agent.ts:20-32`.

**77.** ה־contract האמיתי **הוא זה עם evidence/missing**. אם בספר מופיע חוזה של
`{skill, score}` בלבד — הוא מיושן. שני מקומות שכן מחזירים ריק, ושווה לציין:
(א) keyword fallback — `evidence: ''`, `missing: ''` במכוון, וה־UI מסתיר את פאנל ה־Deep
Dive במקום להציג ניתוח מומצא (`scoring.service.ts:45-58`);
(ב) אנליזות ישנות שנשמרו לפני הפיצ'ר.

**78.** rubric מפורש בן 5 רמות (`scoring.agent.ts:13-18`):
`0` לא קיים · `1-3` אזכור מילת-מפתח בלי ביסוס · `4-6` אזכור עם הקשר/ראיה מוגבלת ·
`7-9` ראיה קונקרטית עם דוגמאות/תוצאות · `10` נרחב, בולט, חוזר, עמוק.
+ הוראות: לנקד רק לפי ראיות, לא להסיק מטייטלים/שמות חברות, אנטי-אינפלציה מפורשת.

**79.** קריאה **אחת** עם כל 10 הסקילים; הפרומפט מורה "Judge each skill independently"
ו"include every supplied skill exactly once, in the order given". כלומר:
**independent by instruction, joint by construction.** זהו ניסוח מדויק לספר.

**80.** `overlapScoreForSkill` (`scoring.service.ts:19-32`): מפרק את שם הסקיל לטוקנים
באורך>2, סופר כמה מהם מופיעים כ־substring ב־CV (lowercase, **בלי גבולות מילה**),
`score = round(hits/tokens × 10)`. סקאלה 0-10 מלאה. "Python" → 0 או 10 בלבד.

**81.** כן. יישור לפי שם (exact → substring דו-כיווני), וכל סקיל שלא נמצא בתשובת ה־LLM
מקבל keyword בנפרד; היתר נשמרים (`scoring.service.ts:110-130`).

**82.** ✅ נכון. `detectUniformScores` → אם כל 10 זהים, **כל העשירייה** מוחלפת
ב־`buildKeywordFallbackJson` (`scoring.service.ts:60-63, 134-140`), ונרשם
`logLlmScoringUniformReplaced`.

**83.** **לא מתועד אף מקרה בפרודקשן.** הלוג הייעודי קיים, אבל אין ממצא כזה במסמכי המדידה.
המקרה שכן נמדד — CV של QA שקיבל 3.8 מול שלוש מודעות (`official-metrics.md` §2.2) — הוא
אחידות **בין** מודעות, לא בין סקילים, ולכן לא מפעיל את המנגנון. **אל תטעני בספר שראיתם
את זה קורה** בלי לבדוק לוגים.

---

## CV improvement

**84.** **כן, מוגזם — ומדויק ההפך.** אין rewrite של ה־CV. הזרימה:
`/prepare` מפצל לסקשנים ומקשר כל סקיל חלש לפסקה → המשתמש בוחר proficiency לכל סקיל →
`/suggest` מחזיר **סקשן אחד מעודכן** → המשתמש עורך/מאשר/מדלג → `/merge` מרכיב את הסקשנים
בסדר. וחשוב: `/merge` היום הוא **שרשור מחרוזות דטרמיניסטי**
(`composeCvFromSections`, `cvImprove.routes.ts:157-173`) — **אין LLM ברמת ה־CV המלא**.
פונקציית `mergeCv` הישנה ב־`suggestions.agent.ts` מסומנת legacy ולא נקראת.

**85.** 6 סוגים: `summary` · `skills` · `experience` · `education` · `projects` · `other`
(`cvImprove.service.ts:7-13, 118-133`).

**86.** **היוריסטיקות/regex בלבד — אין LLM.** שלושה סימנים לכותרת (`isHeading`, שורות 85-99):
ALL CAPS · שורה שמסתיימת בנקודתיים · התאמה למילון של ~40 כותרות מקובלות. המילון מושווה
מול הצורה **חסרת-הרווחים** של השורה, כך שגם `"E x p e r i e n c e"` (letter-spacing
בתבניות CV) נתפס. חוצץ נוסף: `isPageMarker` מסיר `-- 1 of 1 --` של pdf-parse.
(LLM כן משמש ב־`/structure` — אבל רק לייצוא PDF מעוצב, לא לפיצול.)

**87.** ה־CV כולו הופך ל**סקשן אחד** (`if (blocks.length === 0) blocks.push(normalized)`,
`cvImprove.service.ts:187`), ואז כל סקיל חלש מצביע על כל המסמך. יעד ברירת מחדל להוספה:
skills → summary → הסקשן הראשון (`pickDefaultSectionId:200-207`).

**88.** **שם הסקיל בלבד.** `tokenize(skill)` מול `tokenize(paragraph)`
(`cvImprove.service.ts:266-274`). ה־evidence/missing מהניקוד לא נכנסים לחישוב.
ניואנס: הגילוי (found/not found) נעשה ב־regex עם גבולות מילה על טוקנים באורך ≥2,
וה־Jaccard משמש **רק לדירוג** איזו פסקה היא הראשית.

**89.** 5 רמות: `no_knowledge` · `beginner` · `intermediate` · `proficient` · `expert`
(`suggestions.agent.ts:8`). המשתמש בוחר לכל סקיל חלש בנפרד.

**90.** תלוי אם הסקיל **קיים** ב־CV:
- לא קיים + `no_knowledge` → `addSkillSentence` מחזיר `''` — **אין הצעה** (שורה 84).
- קיים + `no_knowledge` → `rephraseSkill` כן רץ, עם ההנחיה "subtle mention only; do NOT
  imply hands-on experience".

**91.** **רשאי לכתוב משפט** — לא שואל את המשתמש להוסיף ראיה אמיתית. `addSkillSentence`
מייצר משפט יחיד ברמה המוצהרת, עם איסור מפורש להמציא פרויקטים/חברות/הישגים.
כלומר: המערכת כן מוסיפה טענת-כישור שאין לה ביסוס ב־CV — **מרוסנת ברמת הניסוח, לא ברמת
הקיום.** זו נקודה שראוי שהספר יגיד בגלוי.

**92.** **סכנה אמיתית, ואין ולידציה — רק כללי prompt.** שלושה איסורים חוזרים
(`suggestions.agent.ts:11-20, 27-30, 94-97`), אבל אין שום בדיקה תוכניתית שהטקסט החוזר לא
מכיל מספר/מדד/תאריך חדש. השומר האמיתי היחיד: **המשתמש רואה ומאשר כל סקשן** לפני המיזוג.

**93.** שלוש אפשרויות (`ImproveCVScreen.tsx:1176-1210`):
1. **Styled PDF** — react-pdf, בחירה מבין מספר תבניות עיצוב;
2. **Plain text (.txt)** — Blob download;
3. **Copy** ללוח.

**אין `.docx`.**

---

## Privacy ו־data handling

**94.** **רק טקסט.** ה־Buffer של ה־PDF לא נשמר בשום מקום. `CvFile` מכיל:
`cvText` (מנורמל), `rawText` (מקורי), `headerText` (25 שורות), `fileName`,
`fileSizeBytes`, `isFavorite`, `userId` (`cvFile.model.ts:5-14`).
בנוסף `CvAnalysis` שומר עותק נוסף — `cvTextExtracted` + `rawAgentOutput`.

**95.** **כן — הטקסט המלא, בכל קריאת ניקוד, בלי חיתוך.** `scoring.agent.ts:47` שם את
`cvText` ישירות בהודעת ה־user; אין `.slice()`. (להשוואה: `titleExtraction` חותך ל־4,000,
`titleClassification` ל־6,000 — הניקוד היחיד בלי תקרה.)

**96.** כמעט. הוא מקבל `headerText` = **25 השורות הלא-ריקות הראשונות** (`cv.service.ts:27-35`),
ואז נחתך ל־**4,000 תו** בתוך ה־agent (`titleExtraction.agent.ts:6, 47`).
אם `headerText` חסר (CV ישן) — נשלח `cvText` המלא, חתוך ל־4,000.

**97.** **סקשן אחד בלבד** לכל קריאה (`rephraseSkill(skill, prof, currentSectionText, ...)`),
אופציונלית גם `originalSectionText` של אותו סקשן.
**חריג אחד:** `/cv-improve/structure` שולח את ה־CV המשופר **המלא** ל־LLM כדי לבנות את
מבנה ה־PDF המעוצב (`cvImprove.routes.ts:179-198`).

**98.** **כן, מלא.** `extractSkillPool(jobDescription)` — בלי חיתוך (`skillExtraction.agent.ts:80-88`).
ואם המשתמש הדביק **קישור**, ה־backend מוריד את הדף ושולח את הטקסט שחולץ ממנו
(`jobPostingFetcher.service.ts` דרך `resolveJobDescriptionInput`).

**99.** **לא. אין cascade.** `DELETE /api/cv/:id` מוחק **רק** את מסמך ה־`CvFile`
(`cv.routes.ts:140`). `CvAnalysis` (שמכיל עותק מלא של `cvTextExtracted`)
ו־`ImprovementSession` (שמכיל `originalCvText` + `finalCvText`) **נשארים**.
⚠️ אם הספר טוען "המשתמש יכול למחוק את הנתונים שלו" — זה לא מדויק היום.

**100.** ❓ **את צריכה לענות**.
המלצתי, בהתחשב ב־99: לתאר **data flow טכני** ולהוסיף סעיף "מגבלות פרטיות ידועות" —
לא להתחייב להתחייבויות שהקוד לא מקיים.

---

## Evaluation

**101.** נכון — נכתבו/נוצרו עבור הפרויקט. שמות, טלפונים, אימיילים בדויים לחלוטין;
חברות "מציאותיות-למראה אבל לא אמיתיות" (`04-authentic-cv-pdfs.md`).

**102.** לפי הבריף: 6-8 תבניות עיצוב **שונות מהותית** (עמודה אחת/שתיים, sidebar, טבלאות,
serif/sans, עם/בלי צבע) · **מגוון איכות כתיבה** מכוון (חלק מלוטשים, חלק בינוניים,
inconsistency קלה בתאריכים) · ביוגרפיות קוהרנטיות עם רצף תעסוקתי הגיוני · אורכים 1-2
עמודים · **לא ATS-friendly במכוון** · סקילים עדכניים ל-2026 במינון טבעי.
אימות טכני חוסם: `pdf-parse` על כל קובץ, עבר 32/32.

**103.** לפי הבריף — **agent (LLM)**: כתיבת HTML לכל CV + רינדור ב־
`msedge --headless --print-to-pdf`, לפי מטריצת תרחישים שהצוות הגדיר ואישר.
❓ **אם הייתה עריכה/כתיבה ידנית משמעותית מעבר לזה — את צריכה לומר.**

**104.** ❓ **את צריכה לענות (חלקית).**
מה שמתועד: **May היא המתייגת היחידה** של ה־ground truth (`05-kickoff.md:279`).
לגבי תוויות ה־CV: `true_title`/`acceptable_titles` נכתבו ל־`manifest.json` **יחד עם
הקו"ח, ע"י אותו agent**, עם ולידציה אוטומטית מול `taxonomy.py`.
**מי אימת את התוויות האלה כבן-אדם, ומתי — צריך לבוא ממך.**

**105.** ❓ **את צריכה לענות.**
עובדתית זה הסיכון הכי גדול בפרק ההערכה: אם אותו גורם גם כתב את הקו"ח וגם קבע את התווית,
ה"ground truth" הוא הגדרה עצמית ולא מדידה עצמאית.

**106.** ❓ **את צריכה לענות.** לא מצאתי בריפו רשומת review של התוויות.

**107.** ❓ **את צריכה לענות.**
⚠️ **דגל אדום מבוסס-ראיה:** `official-metrics.md` §5.4 כותב "The CVs are realistic and
**independently reviewed**". לא מצאתי בריפו שום תיעוד של ה־review הזה — מי, מתי, איך.
אם אין — או שמתעדים אותו עכשיו, או שמורידים את המילה. זו בדיוק שאלה שגלית תשאל.

**108.** ❓ **את צריכה לענות** — המלצתי: **reference labels**. "Ground truth" בקורפוס
authored הוא מונח שמזמין את השאלה; "reference labels" מדויק ולא מחליש שום מסקנה.

**109.** כי ה־UI **באמת מציג top-3**: `rolesToSuggestions` מחזיר 3 מועמדים
(`dsModel.ts:409-416`), וה־picker הידני מציג אותם כשה־confidence מתחת ל־60.
כלומר Top-3 מודד את "האם התשובה הנכונה נמצאת ברשימה שהמשתמש רואה" — שאלה מוצרית לגיטימית,
לא קישוט אקדמי.

**110.** **כן — נחשב correct.** `02-title-metrics.js:36`: `acceptable.includes(predicted)`.
כלומר Top-1 נמדד מול `acceptable_titles`, לא מול `true_title` בלבד.

**111.** **כרגע לא מבדילים.** שתי המדידות מקופלות לאותו מספר. אם רוצים להבדיל — צריך
לדווח שני מספרים: "exact-match accuracy" מול `true_title`, ו"acceptable-match accuracy"
מול הרשימה. הדאטה קיים במניפסט; זו הרצה של הסקריפט עם שינוי שורה אחת.

**112.** **לפי `acceptable_titles`.** ה־89.7% הוא acceptable-match. זה **חייב** להיאמר
בספר ליד המספר, אחרת המספר מוצג כמחמיר יותר ממה שהוא.

**113.** **כן, נכללים.** המכנה 29 = 32 fixtures − 3 negatives (2 עברית + 1 סרוק).
שני ה־`none` **בפנים**, ותרומתם 1/2 (`official-metrics.md` §1.1, `06-signal-verdict.js:5`).

**114.** זה **לא** מודד class — זה מודד **החלטת מערכת**. הקריטריון בקוד:
"correct" = המערכת **לא ביצעה auto-accept** (כלומר confidence סופי < 60 והמשתמש נשלח
ל־picker). `__other__` לא מוחזר לעולם ולא נבדק כאן כלל.
⚠️ **המשמעות המתודולוגית:** ב־29 המקרים מעורבבות שתי משימות שונות — 27 מקרי סיווג
(top-1 נכון?) ו־2 מקרי הימנעות (הימנעת נכון?). זה **פוגם בעקביות המכנה**, וזו שאלה
לגיטימית של גלית. הפתרון הנקי: לדווח 26/27 לסיווג ו־1/2 לדחייה בנפרד, ואת 89.7% כמספר
משולב מוצהר.

---

## Model 1 evaluation

**115.** כי במודל **המוגש** רק 12 roles מכילים רשומות בכלל. הקורפוס lang-uk ממופה ל־12
תפקידים קנוניים בלבד (Backend, Frontend, SWE, QA, DevOps, Java, PM, UX, C++, Data
Engineer, Data Scientist, Cyber Security); ל־47 הנותרים `record_counts=0`.
לא היה מה למדוד — לא בחירה מתודולוגית.

**116.** לא "עברו floor" — **פשוט זה כל מה שקיים**. ה־floor (`SKILL_MIN_RECORDS=25`)
משפיע רק על דגל `limited_data` בזמן serving, לא על ההערכה.

**117.** **May** (`05-kickoff.md:279`), 191 סקילים על פני 12 תפקידים, 100% כיסוי.

**118.** ❓ **את צריכה לענות.**
מה שמתועד: התיוג היה **עיוור** — רשימות שני המודלים מוזגו, נוקו מכפילויות וערבבו, כך
שהמתייגת לא יכלה לדעת איזה מודל הציע מה, **ולא ידעה שקיימים שני מודלים** בכלל
(`official-metrics.md` §3.1). היכרות כללית עם המערכת — כן, בוודאי.

**119.** הפרוטוקול הורה במפורש: **סקיל גנרי אבל אמיתי — `software development`, `git` —
נספר כרלוונטי** (`official-metrics.md` §3.3). בפועל המתייגת דחתה `computer science`
עבור Cyber Security ו־`writing` עבור Software Engineer — כלומר יושם שיקול "האם זה סקיל
בכלל", לא רק "האם זה שייך לתפקיד".

**120.** לא, וזה כתוב במסמך עצמו: *"the instrument is structurally insensitive to what
M06 changed"* (§3.3). ה־ubiquity filter מסיר סקילים רלוונטיים-אך-לא-אינפורמטיביים, ולכן
תחת הפרוטוקול הזה הוא יכול **רק להפסיד** נקודות precision. המדד מודד רלוונטיות; המטרה
הייתה אינפורמטיביות.

**121.** ❓ **את צריכה לענות** — המלצתי: **כן, relevance@10**. הנימוק חזק ופשוט: precision
מחייב קבוצת ground-truth מלאה של הסקילים הרלוונטיים לתפקיד, ואין לכם כזו. מדדתם את
הצד השני — כמה מתוך העשרה שהוצעו נשפטו כרלוונטיים. זה relevance@10 בדיוק, וההגנה על
זה מול גלית **קלה יותר**, לא קשה יותר.

---

## Literature / framing

**122.** ❓ **את צריכה לענות** (דרישה אקדמית שאני לא יכולה לדעת).
מה שאני יכולה לומר על הדוסייה שבניתם (`literature-dossier.md`): המבנה שלה הוא "9 נושאים,
15 מקורות מאומתים" + סעיף **"Red flags / contradicting findings"** — כלומר היא נבנתה
כתשתית ל־Discussion, לא רק כרשימת מקורות.

**123.** ❓ **את צריכה לענות.**

**124.** **לא — ואין.** הדוסייה מכילה [3] Gaur על parsing של סקשן ההשכלה,
[13] Senger survey על skill extraction, ו־[7] fastText כבייסליין לסיווג טקסט —
אבל **אין מקור שעוסק ספציפית ב־CV → job-title classification**. זה פער אמיתי.
הניסוח הבטוח: "we found no directly comparable published benchmark for CV-to-title
classification over a 59-title taxonomy" — וזו טענת תרומה לגיטימית, לא חולשה.

**125.** [9] Prototypical Networks נבחר **כהשראה מוצהרת**, לא כמקור ישיר.
מקור ישיר יותר ל־nearest-centroid עם embeddings קפואים הוא SetFit (Tunstall et al. 2022) —
ו־`TITLE_DETECTION_METHODOLOGY.md` §3.1 אכן מתאר את השיטה כ"SetFit-style", אבל SetFit
**לא נמצא בדוסייה**. אם רוצים את המקור המדויק — צריך להוסיף אותו.
(הערה: אצלכם ה־encoder קפוא לגמרי, בלי fine-tuning — כלומר אפילו לא SetFit מלא.)

**126.** ❓ **את צריכה לענות** — אבל הראיות בריפו נוטות בבירור לכיוון אחד:
`official-metrics.md` הוא מסמך **הנדסי-אמפירי** (מגבלות מוצהרות, "must not be cited",
מה לא נמדד ולמה). ספר שמנוסח כ־thesis יאלץ אותך ל"we show/we prove" שהמדידות שלך לא
תומכות בהן. **engineering project book עם evaluation מחמיר** הוא הניסוח שהחומר שלך
באמת מכסה.

**127.** ❓ **את צריכה לענות** — המלצתי חד־משמעית: **להבחין**. הצעה לשלוש מחלקות עקביות:

| סוג | במערכת שלכם |
|---|---|
| **Learned model** | מודל 2 (TF-IDF+MLP), מודל ה־agreement (LogReg על סקילים) |
| **Statistical / index model** | מודל 1 (aggregation + KNN לקסיקלי על טייטלים) |
| **Embedding prototype model** | מודל 3 (nearest-centroid, encoder קפוא) |
| **LLM agent** | title extraction · skill-pool extraction · scoring · closed-list fallback · CV editor |

לקרוא לחמישה הדברים האלה "model" באותו משפט זו ההזמנה הכי ישירה לשאלה "אז מה בעצם למדתם".

**128.** ❓ **את צריכה לענות** — זו שאלת שיפוט שלך על הפרויקט שלך.

**129.** ❓ **את צריכה לענות.**
אם זה עוזר, אלה חמשת המקומות שבהם **הראיות בקוד הכי מרוחקות מהניסוח הצפוי בספר**
(לפי סדר החומרה, בלי לענות בשמך):
1. Match Score לא רואה את המשרה, ומרווח ההפרדה 0.66/10 (§2.2, §2.5);
2. "nightly-retrained market model" — המודל המוגש אומן ידנית, לא דרך הפייפליין הלילי;
3. כל ההיסטוריה שאחרי 2023H2 סינתטית, וכל אותות ה־2026 מגיעים משם;
4. 33/59 טייטלים ללא שום קו"ח אמיתי — נלמדים ממחרוזות טייטל בלבד;
5. promotion gate שלא בודק שום מדד איכות.

**130.** ❓ **את צריכה לענות** — אבל זו השאלה שהכי כדאי שאענה עליה בעובדות, אז הנה
**רשימת "נשמע מרשים, מדויק חלקית"** מהקוד, ממוינת לפי כמה ההפרש גדול:

| הניסוח שנשמע מרשים | מה באמת קורה | ראיה |
|---|---|---|
| "Match Score — התאמה בין קו״ח למשרה" | ניקוד ראיות ל־10 סקילים; המשרה בחרה 2-4 מהם ואז נעלמה | `scoring.agent.ts:38` · §2.5 |
| "nightly-retrained labour-market model" | המודל המוגש אומן ידנית 28/07; ה־cron דורש קובץ סוד שלא קיים | `06-model1-report.md` · `ofelia/config.ini` |
| "מודל שלומד מגמות שוק" | 20.6% מהרשומות סינתטיות, אבל **100% מ־2023H2 ואילך**; כל אות 2026 משם | `augment_2026.py` |
| "promotion gate מבטיח איכות" | ספירת שורות בלבד; אין שום מדד | `promotion_gate.py:59-92` |
| "two independently trained witnesses" | שני featurizations של אותו קורפוס lang-uk | §70 לעיל |
| "59 supported roles" | 12 עם דאטת שוק, 26 עם קו״ח אמיתיים, 33 ממחרוזות טייטל בלבד | §1.5 · §4.2 |
| "the system rewrites your CV" | עריכה לפי סקשן, המשתמש מאשר כל אחת; המיזוג הוא concat | `cvImprove.routes.ts:157` |
| "specificity / IDF ranking" | מחושב, נשמר, **לא נקרא** בזמן serving | `skill_schema.py:236` |
| "89.7% Top-1 accuracy" | acceptable-match, ומכנה שמערבב סיווג עם הימנעות | `02-title-metrics.js:36` · §113-114 |
| "המשתמש יכול למחוק את הקו״ח שלו" | נמחק `CvFile` בלבד; אנליזות וסשנים נשארים עם הטקסט המלא | `cv.routes.ts:140` |
| "half-life של 14 יום" | ברירת מחדל בקוד; המודל המוגש אומן ב־365 | `train.py:41` · `06-model1-report.md` |
| "personalization על 3 צירים" | `personalMatch` לא נכנס לשום חישוב | `personalization.service.ts:29` |

---

## נספח — 8 תיקונים קונקרטיים שאפשר לעשות בספר בלי לגעת בקוד

1. Match Score → לתאר כ־**skill-evidence score**, ולומר במפורש שהמשרה בוחרת סקילים ולא מנקדת.
2. Dynamic skills → לומר "trending-first, JD fills the remainder", לא "extracted from the posting".
3. Model 1 → "statistical market model", ולהפריד את ה־KNN הלקסיקלי כרכיב נפרד.
4. להסיר את 14 הימים או להצמיד לו "(default; the served model was trained at 365)".
5. להסיר את Djinni CVs מכל הקשר של market model.
6. "synthetic bridge" → "synthetic label-presence examples".
7. precision@10 → relevance@10, עם משפט הנימוק מ־121.
8. "independently reviewed" → או לתעד את ה־review, או להוריד את המילה.
