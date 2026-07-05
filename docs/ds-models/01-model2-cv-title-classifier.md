# CV → Job Title Classifier - סיכום עבודה ושלבים הבאים

מסמך זה מסביר בדיוק מה נעשה בשדרוג מסווג התפקידים (CV → job title), ואת השלבים
הבאים שמטרתם לאמוד את **האחוזים האמיתיים** של המודל על קורות-חיים מגוונים ומורכבים.

---

## רקע ומטרה

היעד: להוכיח שהמיפוי של תפקיד אינו רק חיפוש דמיון (KNN / vector-DB) אלא **למידה
אמיתית** - מודל שמסווג את התפקיד מתוך גוף הקו"ח (כישורים, אחריות, טכנולוגיות),
גם כשהטייטל עצמו מוסתר.

- ה-KNN שב-[train.py](train.py) (`/title/match`) הוא fuzzy-matching על מחרוזות - לא למידה.
- מה שמוכיח למידה הוא **המסווג** ב-[tfid.ipynb](tfid.ipynb) → נשמר ל-`text_to_job_title_classifier.joblib`,
  שאותו טוען ה-DS server ב-[server.py](server.py) ומגיש דרך `GET /cv/role`.

---

## מה נעשה (בפירוט)

### 1. איחוד לייבלים - [label_map.py](label_map.py)
הדאטה `master_resumes.jsonl` (4,817 קו"ח) הכיל **65 טייטלים גולמיים** עם שתי בעיות:
סינונימים מפוצלים (React / Web / Frontend כמחלקות נפרדות) וזנב ארוך של מחלקות
נדירות (עד דוגמה בודדת). מיפוי "מורחב" (`consolidate()`) מאחד ל-**38 מחלקות נקיות**:
- שמות קנוניים היכן שקיים, מיזוג סינונימים אמיתיים, וזריקת רעש לא-IC.
- **99.4% מהדאטה נשמר**, וכל 38 המחלקות ≥100 דוגמאות.

### 2. מניעת דליפה (Leakage)
התגלה ש-**77% מהקו"ח מכילים את שם התפקיד מילה-במילה ב-summary** → מודל נאיבי פשוט
"מעתיק" את הטייטל במקום ללמוד. הפתרון: `scrub` - הסרת מחרוזת הטייטל הגולמי מהטקסט
בזמן הטעינה (בנוסף להסרת כותרת התפקיד הנוכחי מבלוק הניסיון). מדידה: הסרת הדליפה
הורידה את ה-CV macro-F1 מ-**0.981 → 0.932** - הפער (~0.05) הוא הדליפה, וה-0.932 הוא
המספר ההגון.
> הערה: **לא** הוספנו את מילות הלייבלים ל-stop-words, כי `react`, `angular`, `sql`
> הם כישורים לגיטימיים; הסרתם ריסקה את התפקידים ממוקדי-הפריימוורק (F1 צנח ל-~0.2).

### 3. המחברת [tfid.ipynb](tfid.ipynb)
מחברת מלאה שרצה מקצה-לקצה:
- **Section B (diagnostic):** baselines (Dummy) מול שחזור הקונפיג הישן - להראות את הרצפה ואת המספר המנופח מדליפה.
- **A1:** איחוד לייבלים + התפלגות.
- **A2:** harness הערכה משותף - metrics, classification_report, confusion matrix, 5-fold CV, ו-**learning curve**.
- **A3 (V1):** TF-IDF + Logistic Regression.
- **Leakage ablation:** מדידת הדליפה ישירות (0.981 מול 0.932).
- **A4 (V2):** Sentence-embeddings (`all-MiniLM-L6-v2`) + Logistic Regression.
- **A5:** טבלת השוואה, בחירת מנצח, ושמירת המודל.

### 4. תוצאות (מרחב 38 מחלקות)

| מודל | accuracy | macro-F1 | CV macro-F1 |
|---|---|---|---|
| Dummy (most_frequent) | 0.091 | 0.004 | - |
| **V1 - TF-IDF + LogReg** ✅ | **0.911** | **0.931** | **0.932 ± 0.004** |
| V2 - Embeddings + LogReg | 0.844 | 0.869 | 0.861 ± 0.005 |

- פי ~230 מעל baseline + CV יציב מאוד (±0.004) = למידה, לא מקריות.
- **V1 ניצח** - פשוט, מהיר, פרשני, מדויק יותר כאן.

### 5. נרמול confidence + כיול סף ה-UI
הבעיה: הסתברות גולמית מתפרסת על 38 מחלקות → top-1 טיפוסי 15-40%, אז סף ה-UI הישן
(90) אף פעם לא נפתח.
- [server.py `/cv/role`](server.py): מחזיר `confidence` = **חלק יחסי מנורמל מתוך ה-top-3**
  (סכום ≈100%). top-1 דומיננטי ~80-100; תיקו אמיתי ~50. (גם `raw_confidence` לדיבוג.)
- [CvUploadSection.tsx](../../frontend/src/components/upload/CvUploadSection.tsx):
  סף `AUTO_MATCH_CONFIDENCE_MIN` ירד **90 → 60** (מבוסס-נתונים: על holdout, share של ניבוי
  נכון חציון 95 מול שגוי 41).

### 6. יישור מרחב לייבלים - fallback סמנטי (לא KNN של תווים)
ה-`canonicalTitle` שנשלח הלאה **מזין שליפת focus-skills** דרך `getCoreSkills` →
`/title/skills`. ה-KNN של char-ngrams הוא fallback **שגוי סמנטית** (ממפה לפי איות:
`iOS→Kernel`, `JavaScript→Java`, `SQL→Frontend`). לכן:
- ב-[label_map.py](label_map.py) - מפה מאוצרת `CLASSIFIER_TO_SUPPORTED` /
  `to_supported_title()` שממפה כל אחת מ-38 המחלקות לאחד מ-**59 הטייטלים הנתמכים**
  (זהות ל-21 הקיימים, מיפוי ידני ל-17 החדשים).
- [server.py](server.py) מחזיר `job_title` (מה שזוהה, לתצוגה) + `canonical_title` (הנתמך, לזרימה).

### 7. חיווט backend → frontend
- [dsModel.ts](../../backend/src/services/dsModel.ts): הטיפוסים ו-`rolesToSuggestions`
  מעבירים את `canonical_title` → `suggestion.canonicalTitle`; `matchedVariant` = הטייטל הגולמי.
- [cv.routes.ts](../../backend/src/routes/cv.routes.ts): `detectedTitle` = הטייטל הגולמי שזוהה.
- [CvUploadSection.tsx](../../frontend/src/components/upload/CvUploadSection.tsx):
  מציג "Detected as X ·" רק כשהוא שונה מה-canonical.

### 8. אימות: כל 59 הטייטלים נתמכים
נבדק מול `model.joblib`: אף טייטל לא ריק, כל 59 ב-feature_matrix, מינימום skills = 182.
כל 17 יעדי ה-fallback נמצאים בתוך ה-59 → כל תפקיד שמזוהה ממופה לטייטל עם skills אמיתיים.

---

## קבצים שהשתנו (commit `b68122a`, branch `model-improvment`)
- **חדש:** `ds/model/label_map.py`, `ds/model/tfid.ipynb`
- **שונה:** `ds/model/server.py`, `ds/model/text_to_job_title_classifier.joblib`,
  `backend/src/services/dsModel.ts`, `backend/src/routes/cv.routes.ts`,
  `frontend/src/components/upload/CvUploadSection.tsx`
- **מחוץ ל-commit:** `master_resumes.jsonl` (16MB - מומלץ Git LFS או מקומי בלבד),
  וגיבוי ה-joblib המתוארך.

> להפעלת המודל החדש: הפעלה מחדש של שירות ה-DS (טוען את ה-joblib + הקוד בעליית התהליך).

---

## ⚠️ הערה חשובה: למה המספרים הנוכחיים אופטימיים

ה-0.93 נמדד על `master_resumes.jsonl`, שהוא דאטה **מובנה ונקי** (קו"ח שנוצרו
באופן שיטתי: שדות summary/skills/experience מסודרים, ~100 דוגמאות מאוזנות לכל תפקיד).
קו"ח אמיתיים שונים מהותית:
- טקסט שחולץ מ-PDF (רועש, סדר שדות משתנה, פורמט חופשי).
- תפקידים היברידיים / מחליפי-קריירה / שמות תפקיד לא-סטנדרטיים.
- מקרים עמומים אמיתיים (Fullstack מול Frontend+Backend, DevOps מול SRE מול Platform).

לכן **אסור להסתמך על 0.93 כמספר "אמיתי"**. הסף שכוילנו (60) והדיוק צריכים אימות על
קו"ח אמיתיים ומורכבים - זה תוכן השלב הבא.

---

## 🎯 השלבים הבאים - אימות האחוזים האמיתיים

**המטרה:** למדוד את הביצועים האמיתיים של המסווג על קו"ח מגוונים ומורכבים, ולכייל
את הסף לפי מציאות ולא לפי דאטה סינתטי.

### שלב 1 - לבנות test set מגוון ומורכב (ground-truth)
לאסוף/לחבר **20-40 קו"ח**, כל אחד עם "טייטל אמיתי" מתויג ידנית (מתוך 38 המחלקות
או "none/other"). לכסות במכוון מקרים קשים:

| קטגוריה | דוגמה | מה בודקים |
|---|---|---|
| ברור וחד-משמעי | Backend + Django + Postgres מובהק | top-1 גבוה + auto-accept |
| עמום/גבולי | Fullstack מול Frontend מול Backend | האם נופל ל-manual בצדק |
| מחליף קריירה | QA שעבר ל-Automation/Dev | top-3 סביר |
| היברידי | ML Engineer שגם עושה Data Engineering | top-3 מכיל את שתיהן |
| ג'וניור / אינטרן | ניסיון דל, בעיקר לימודים | לא מתבלבל לרעש |
| תפקיד לא נתמך | Game Developer / DBA נדיר | נופל לטייטל נתמך הגיוני |
| רועש (PDF אמיתי) | קו"ח סרוק/מיובא | עמידות לטקסט לא נקי |
| דו-לשוני / עברית | קו"ח עם עברית | התנהגות הוגנת (או fallback) |

מומלץ להשתמש ב-PDF אמיתיים ולהזרים אותם דרך `POST /api/upload?save=false` כדי
לבדוק את **הצינור המלא** (חילוץ PDF → מסווג), לא רק את המודל.

### שלב 2 - הרנס אוטומטי ל-`/cv/role`
לבנות סקריפט (בסגנון [poc_files/test_poc.js](../../poc_files/) הקיים לניקוד) שעבור כל קו"ח:
1. מריץ `POST /api/cv/title` (או `GET /cv/role` ישירות ב-DS).
2. משווה `detectedTitle` / `suggestions` מול ה-ground-truth.
3. אוסף `confidence` (המנורמל) ו-`canonical_title`.

### שלב 3 - מדדים למדוד
- **Top-1 accuracy** ו-**Top-3 accuracy** (האם הטייטל הנכון בשלישייה).
- **Confidence calibration:** בטווח 60-70 עד 90-100 - האם ביטחון גבוה = דיוק גבוה?
  (bin את ה-confidence וחשב דיוק לכל bin.)
- **Manual-fallback rate:** כמה קו"ח נפלו מתחת לסף 60. האם אלה באמת העמומים?
- **Skills relevance:** לתפקידים שמופו דרך ה-fallback - האם ה-focus-skills שחזרו הגיוניים?
- **Per-scenario:** דיוק לפי הקטגוריות בטבלה (איפה המודל נשבר?).

### שלב 4 - כיול מחדש לפי הממצאים
- אם ביטחון גבוה עדיין שגוי לעיתים → להעלות את הסף (למשל 60 → 65/70).
- אם קו"ח ברורים נופלים ל-manual → להוריד/לכייל.
- אם fallback סמנטי ממפה לא-נכון תפקיד מסוים → לתקן ב-`CLASSIFIER_TO_SUPPORTED`.
- אם מחלקות מסוימות מתבלבלות שיטתית (Frontend↔React Native, DBA↔Data Engineer) →
  לשקול מיזוגן, או להוסיף **top-3 accuracy** כמדד הרשמי במקום top-1.

### קריטריון הצלחה (הצעה)
- **Top-3 accuracy ≥ 85%** על ה-test set המורכב.
- **Top-1 accuracy ≥ 70%** על המקרים הלא-עמומים.
- **Confidence calibration:** ב-bin ≥80% הדיוק בפועל ≥90%.
- אפס מקרים שבהם תפקיד מזוהה ממופה לטייטל **ללא skills** (כבר מובטח ע"י אימות ה-59).

> כשהמספרים האמיתיים בידיים - לעדכן את `tfid.ipynb` / מסמך זה עם ה-benchmark האמיתי,
> ולהחליף את ה-0.93 (הסינתטי) כמדד הרשמי.
