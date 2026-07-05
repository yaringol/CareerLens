# דו"ח בדיקת דאטהסטים - lang-uk recruitment (Djinni)

נבדקו שני דאטהסטים מ־Hugging Face מול נתוני האימון הקיימים (`master_resumes.jsonl`,
59 כותרות קנוניות). שניהם הותקנו ונטענו בהצלחה, אנגלית 100%.

---

## 1. Candidate Profiles - `lang-uk/recruitment-dataset-candidate-profiles-english`

| מטריקה | ערך |
|---|---|
| שורות | **210,250** (פי ~44 מ־master_resumes = 4,817) |
| שפה (CV_lang) | en - 100% |
| שדות | Position, Moreinfo, Looking For, Highlights, Primary Keyword, English Level, Experience Years, CV, id |
| קטגוריות תפקיד (Primary Keyword) | 42 distinct |
| אורך CV (תווים) | חציון **751**, ממוצע 944, p25=454, p75=1235, max 7372 |
| שנות ניסיון | חציון 3, ממוצע 3.84, טווח 0-11 (חתוך לאנונימיזציה) |
| רמת אנגלית | upper 37% · intermediate 31% · fluent 20% · pre/basic 11% |
| שדות חסרים | Looking For 51.5% · Highlights 49.8% · Experience Years 10.2% · Primary Keyword ~0% |

**התפלגות תפקידים (top):** JavaScript 16% · QA 12% · Design 7% · Project Manager 6% ·
Java 5.5% · .NET 4.5% · Marketing 4.3% · Python 3.6% · PHP 3.3% · QA Automation 2.7% ...

---

## 2. Job Descriptions - `lang-uk/recruitment-dataset-job-descriptions-english`

| מטריקה | ערך |
|---|---|
| שורות | **141,897** |
| שפה | en - 100% |
| שדות | Position, Long Description, Company Name, Exp Years, Primary Keyword, English Level, Published, id |
| קטגוריות תפקיד | 45 distinct |
| אורך תיאור (תווים) | חציון **1,629**, ממוצע 1,801, p25=1109, p75=2284, max 12,578 |
| שנות ניסיון | חציון 3, טווח 1-5 |
| רמת אנגלית | upper 47% · intermediate 39% · fluent 7.5% |
| שדות חסרים | English Level 5.3% בלבד - נקי מאוד |

**התפלגות תפקידים (top):** JavaScript 12.6% · Java 6% · DevOps 5.6% · .NET 5.5% ·
QA Automation 5% · Marketing 5% · QA 4.8% · Node.js 4.5% · Python/PHP 4% ...

---

## 3. התאמה למודל הקיים

הכותרות הקנוניות של המודל (59) ממוקדות בעיקר ב־**סייבר / אבטחה, חומרה/אמבדד, ML-research**
(SOC Analyst, Detection Engineer, Malware Researcher, FPGA/VLSI, Kernel/Driver Developer,
Exploit Developer...). הטקסונומיה של lang-uk היא **IT מיינסטרים רחב** (JavaScript, QA, PHP, .NET)
+ תפקידים לא־הנדסיים (Marketing, HR, Sales, Recruiter, Artist).

| בדיקה | Candidate Profiles | Job Descriptions |
|---|---|---|
| התאמה מדויקת של keyword לכותרת קנונית | 2 (data engineer, product manager) | 2 |
| התאמה **סמנטית** (JS→Frontend, Python→SWE, DevOps→DevOps...) בתוך ה־scope | ~155K (~74%) | ~104K (~73%) |
| תפקידים out-of-scope (Marketing/HR/Sales/Recruiter) | ~54K (~25%) | ~36K (~25%) |
| כותרות קנוניות של המודל ללא כיסוי כלל ב־lang-uk | **41 מתוך 59** | 41 מתוך 59 |

---

## 4. מסקנות והמלצה

**Candidate Profiles - מתאים כתוספת, לא כתחליף.**
- ✅ יתרון עצום בנפח (פי 44), אנגלית אמיתית, שדות מובנים, שנות ניסיון + keyword מוכנים כ־labels.
- ⚠️ ה־CV הם **בלורבים קצרים** (חציון 751 תווים) של פרופיל Djinni - התפלגות שונה מאוד
  מ־resume מלא ומובנה של `master_resumes`. אימון ישיר עליהם ידחוף את המודל לפורמט אחר.
- ⚠️ **41/59 מהכותרות (כל התמחות הסייבר/חומרה/מחקר) לא מיוצגות** - הוא לא יכסה את הליבה של המודל.
- **שימוש מומלץ:** להעשיר את ~18 התפקידים המיינסטרים (Frontend/Backend/DevOps/Mobile/Data/PM),
  וכמקור ל־hard-negatives ולתפקידים לא־הנדסיים. **לא** להחליף את הדאטה הקיים.

**Job Descriptions - כן, מעניין; ולדעתי בעל הערך הגבוה יותר לפרויקט.**
- ✅ תיאורי משרה אמיתיים באורך מלא (חציון 1,629), נקיים (5% חסרים בלבד), מיפוי ישיר ל־use cases
  של CareerLens: `/title/skills`, חילוץ סקילים, והתאמת CV↔משרה.
- ✅ מתאים לבניית קורפוס title→skills, co-occurrence של סקילים, ו־job-matching אמיתי.
- ⚠️ אותה מגבלת טקסונומיה (בלי התמחויות סייבר/חומרה) - משלים את המיינסטרים, לא את הליבה המתמחה.

**שורה תחתונה:** שני הדאטהסטים איכותיים וגדולים ושווים אינטגרציה, אבל **אף אחד אינו "טוב יותר"
כתחליף** - הם מכסים IT מיינסטרים בעוד שהמודל בנוי סביב התמחויות סייבר/חומרה/מחקר.
הכי כדאי: לשלב את שניהם כ־augmentation לתפקידים המיינסטרים, ולנצל את ה־Job Descriptions
לבניית שכבת התאמת משרות.
