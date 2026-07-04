# אינדקס - מסמכי 2 מודלי ה-DS

תיקייה זו מרכזת (עותקים, לא מקור) את כל קבצי ה-MD שמסבירים את שני המודלים בפרויקט,
כדי שיהיה מקום אחד לקרוא בו את כל הרקע. **המקור החי נשאר במקומו המקורי** (ליד הקוד /
ה-notebook שהוא מתאר) - אל תערכו כאן, ערכו במקור ותריצו את סקריפט ההעתקה מחדש אם צריך.

| קובץ | מקור | מה זה מסביר |
|---|---|---|
| [01-model2-cv-title-classifier.md](01-model2-cv-title-classifier.md) | `ds/model/CV_TITLE_CLASSIFIER.md` | **מודל 2** (CV→title): מה נעשה, תוצאות, ואזהרה שהמספרים סינתטיים + תוכנית לאימות אמיתי |
| [02-model2-onboarding.md](02-model2-onboarding.md) | `ds/model/titles_model_progress.md` | **מודל 2**: onboarding מלא - ארכיטקטורה, setup, deploy, איך לאמן מחדש |
| [03-model1-skills-model.md](03-model1-skills-model.md) | `ds/model/SKILLS_MODEL.md` | **מודל 1** (title→skills): הפייפליין המלא A→E, מקורות דאטה, מה 142K רשומות היו תורמות |
| [04-model1-ds-server-readme.md](04-model1-ds-server-readme.md) | `ds/model/README.md` | **מודל 1**: README טכני של ה-DS server - endpoints, model.joblib. ⚠️ חלקים ממנו לא תואמים את `server.py` הנוכחי (ראו סעיף חוסרים) |
| [05-external-dataset-eval.md](05-external-dataset-eval.md) | `ds/model/lang_uk_dataset_report.md` | הערכת 2 דאטהסטים חיצוניים (lang-uk, 210K/142K רשומות) כתוספת אפשרית לשני המודלים |
| [06-model1-original-plan-historical.md](06-model1-original-plan-historical.md) | `docs/ds_model_plan.md` | **היסטורי** - התוכנית המקורית ל-feature matrix של מודל 1 (DS-2 עד DS-12) |
| [07-progress-and-feature-backlog.md](07-progress-and-feature-backlog.md) | `docs/ds_progress.md` | סיכום התקדמות + backlog פיצ'רים (FEAT-1 עד FEAT-6), כולל סעיף הסקרייפינג היומי |
| [08-implementation-plan-track-a-b.md](08-implementation-plan-track-a-b.md) | תוכנן ע"י Claude (חדש) | **תוכנית יישום** (טרם מומשה) לתיקון פייפליין מודל 1 + הרחבת מודל 2 ל-59 כותרות + LLM fallback סגור |
| [09-missing-tasks-checklist.md](09-missing-tasks-checklist.md) | תוכנן ע"י Claude (חדש) | **צ'קליסט משימות חסרות** מזוקק מ-08, ממוין תחת 2 אבני דרך בלבד (Model 1: skill→title→trend, Model 2: CV→title), כולל כפתורי "הרץ עכשיו" נפרדים לכל ג'וב |
| [09-pipeline-fix-plan.md](09-pipeline-fix-plan.md) | מסמך עבודה חי (2026-07) | **תוכנית תיקון + סטטוס מימוש** - פערים, A1-A4, קונטרקט API, יומן שלבים |
| [10-model-runs-mongo.md](10-model-runs-mongo.md) | מסמך עבודה חי (2026-07) | **`model_runs` ב-Mongo** - שדות, שער promotion, והשוואת 3 הרצות live |

---

## תקציר - 2 המודלים בקצרה

- **מודל 1 - Title → Skills** (`ds/model/train.py` → `model.joblib`): לא רשת נוירונים.
  צבירה סטטיסטית משוקללת של סקילים שכבר חולצו (SkillNer) לכל אחד מ-**59 תפקידים קנוניים**,
  פלוס KNN של תווי-תווים (char n-gram) שממפה טקסט חופשי → אחד מ-59 התפקידים.
  Endpoints: `/title/skills`, `/title/match`, `/title/trending-skills`, `/text/skills`.

- **מודל 2 - CV → Title Classifier** (`ds/model/tfid.ipynb` → `text_to_job_title_classifier.joblib`):
  למידה אמיתית (TF-IDF + Logistic Regression) שמסווגת **38 מחלקות** מתוך גוף קורות-החיים
  (לא רק חיפוש דמיון). מאומן על `master_resumes.jsonl` (4,817 קו״ח, לא ב-git).
  Endpoint: `/cv/role`. תוצאת הסיווג ממופה החוצה ל-59 התפקידים של מודל 1 דרך מפה מאוצרת
  ידנית ב-`ds/model/label_map.py` (`CLASSIFIER_TO_SUPPORTED`) - **לא** למידה, מיפוי קבוע בקוד.

מסמך זה נוצר אוטומטית ע"י Claude ב-2026-07-02 בעקבות סקירת branch `model-improvment`.
