# Kickoff M02 - ניקיון קוד להגשה

**תאריך:** 2026-08-11 | **רוענן: 2026-08-22** | **בריפינג:** [02-code-cleanup.md](../../02-code-cleanup.md)
| **סטטוס: 🚧 ממתין לאישור המשתמשת**

## 0. רענון תחקיר (22/08) - מה השתנה מאז 11/08

| פריט | מצב היום |
|---|---|
| שער M13 | ✅ **נפתר** - ניקוי ההיסטוריה בוטל (עד 20 קומיטים אושרו, יש 19); ה-`.gitignore` שוכתב. אין יותר צורך בחריגה - **שאלה 1 יורדת** |
| ממצא 7 (notebooks) | ✅ **בוצע** - `training.ipynb`+`tfid.ipynb` ב-`ds/model/archive/` עם README; `.ipynb_checkpoints` הוסר מהמעקב (`9574f30`) |
| `Copy_of_CV_to_title.ipynb` | ✅ **הוכרע** - אורכב יחד עם השאר. **שאלה 2 יורדת** |
| ממצאים 1-6, 8-10 | ⚠️ **כולם עדיין קיימים** - אומתו אחד-אחד ב-22/08 |
| מדיניות ריפו חדשה | `docs/**` ורוב חומרי ההגשה כבר **לא tracked** (`b6380f9`) - ה-README הראשי נשאר בסקופ |
| `ds/final/` | הורחב ב-8 מודולי Python (הכרעת המשתמשת) - **עדיין out of scope לניקוי** |

### ⛔ תיקון מהותי לתוכנית: ממצא 8 שגוי

הבריפינג וה-kickoff טענו ש-`biocatch_site.py`/`example_site.py` "לא בשימוש". **זה לא נכון:**
`scraping/src/main.py:15-20` מייבא את שניהם ב-factory לפי `settings.site`. ארכוב שני
הקבצים בלבד **ישבור את `main.py`** - בדיוק תרחיש "מחיקת מת שחי" מטבלת הסיכונים.

**המצוי:** `scraping/src/` כולה היא פריימוורק ינואר (main, config, driver, extractors,
pipelines, sites, tests) - עצמאית ולא מופעלת ע"י שום דבר. הסקרייפר החי הוא
`scraping/external/linkedin.py`, שאותו ה-pipeline מריץ (`pipeline/run_daily.sh`,
`scraping/external/Dockerfile`). **הפעולה הנכונה: לארכב את `scraping/src/` כיחידה שלמה,
או לא לגעת בכלל** - ראה שאלה 4.

## 1. שערי כניסה - סטטוס

| שער | סטטוס |
|---|---|
| M14, M15, M07 | ✅ ☑ |
| **M13** | ⚠️ 🚧 פורמלית לא הושלמה - אבל החלק החוסם עבור ניקיון (ה-`.gitignore` הבולע) תוקן בפועל (`681dc13`); הנותר בה (ניקוי היסטוריה) לא נוגע לקומיטים חדשים. **נדרש אישור חריגה** (תקדים: M06/M14) |
| קיפאון קוד | ✅ המיזוג ל-main (PR #104) בוצע; אין עבודת קוד פתוחה מלבד M02 |
| החלטות פתוחות | ⚠️ 2 שאלות בסעיף 7 |

## 2. רקע - מצב הקוד היום (תחקיר 11/08)

**חדשות טובות - הרשימה קצרה מהבריפינג.** רוב "מאפייני ה-AI" כבר לא קיימים:

| בדיקה | תוצאה |
|---|---|
| אימוג'ים ב-src (backend/frontend/ds) | **0** ✅ |
| TODO/FIXME/XXX | **0** ✅ |
| console.log ב-frontend/src | **0** ✅ |
| console.log ב-backend | 32, **כולם** ב: `config/db.ts`, `index.ts` (הודעות עלייה), `scripts/` (כלי CLI), `logger.ts` (המימוש עצמו) - אף אחד בנתיב בקשה |
| מסכי Mock | טופלו ב-M14: רישום dev-only עם הערת הסבר ב-`App.tsx:15` - out of scope ✅ |

**מה כן נשאר (מאומת):**

| # | ממצא | ראיה |
|---|---|---|
| 1 | **README:82 שבור** - `pip install -r requirements-server.txt`, קובץ שלא קיים; הנכון: `ds/requirements.txt` | אומת grep |
| 2 | **11 פקודות macOS-only ב-README** (brew/lsof/source .venv) + תיאור מיושן | אומת |
| 3 | **`dsModel.interface.ts` מת** - אפס imports בכל backend/src | אומת grep |
| 4 | **שרשרת ה-titleMatch היתומה** (DS-7): `dsModel.ts:246` שולח `title_match` שה-DS מתעלם ממנו; `job.service.ts:26,38` מגלגל. פרמטר-רפאים של הפיצ'ר שהתאדה | אומת |
| 5 | **`ds/model/test_preferences.py` יתום** - מייבא `rank_skills` שלא קיים, נכשל ב-import | ידוע + אומת קיום |
| 6 | **`ds/model/README.md:102`** מתאר את rank_skills/SkillPreferences כאילו קיימים | אומת |
| 7 | **notebooks היסטוריים ב-`ds/model/`**: `training.ipynb` (מודל-זירו!), `tfid.ipynb` (מסווג 38 הישן), `.ipynb_checkpoints/` | אומתו |
| 8 | **פריימוורק הסקרייפינג של ינואר**: `scraping/src/sites/biocatch_site.py`, `example_site.py` - לא בשימוש | אומת |
| 9 | `backend/src/scripts/`: `seed.ts` (לגיטימי), `checkCvsMatchScores.ts`, `testPersonalization.ts` (חד-פעמיים) | אומת |
| 10 | 105 `print(` ב-ds - רובם בסקריפטי אימון/כלי CLI (לגיטימי); לבדוק רק את `server.py` | לטריאז' |

**שינוי מבני חדש שהבריפינג לא הכיר:** `ds/final/` (קומיט `afd1b93`) - snapshot מאוצר של
4 מודלי הפרודקשן + notebooks שהועברו לשם (עם chdir חזרה ל-ds/model). **לא נוגעים** -
זו אצירה מכוונת של הצוות. גם `Copy_of_CV_to_title.ipynb` קומם בכוונה ב-`2a96aad` - שאלה 2.

### מתועד מול מצוי
הבריפינג (נכתב 14/07) צפה ציד גדול של הערות-AI/אימוג'ים/TODO - **בפועל כמעט הכל כבר נקי**
(סבבי M14/M03 והרגלי הקומיטים). מה שנשאר הוא בעיקר **קוד מת מזוהה-בשם** ו-README.

## 3. הבעיה והפתרון

**הבעיה:** שופט שמשוטט בריפו יפגוש: פקודת התקנה שנכשלת (README:82), טסט שנכשל ב-import,
interface שמתאר מערכת שלא קיימת, ופרמטר שנשלח לשרת שמתעלם ממנו - כולם מסגירים "שאריות".

**הפתרון:** ניקוי כירורגי של הרשימה המאומתת בלבד, קומיט-לתחום, אפס דלתא התנהגותית,
build+בדיקה אחרי כל תחום. **חלופה שנדחתה:** סריקה סגנונית רחבה (יישור quotes/imports) -
הקוד כבר עקבי-מספיק, וסיכון הרגרסיה עולה על התועלת.

## 4. תוכנית מימוש

1. **README ראשי**: תיקון שורה 82 → `pip install -r ds/requirements.txt`; החלפת פקודות
   macOS במקבילות חוצות-פלטפורמה; עדכון התיאור ל-3 שירותים. *אימות:* הרצת פקודות
   ההתקנה על clone נקי לוגית (dry-read), קריאה מלאה.
2. **backend מת**: מחיקת `dsModel.interface.ts`; הסרת שרשרת `titleMatch` (פרמטר +
   העברה + ברירת מחדל) מ-`dsModel.ts`/`job.service.ts` וכל קורא. *אימות:*
   `npx tsc --noEmit` נקי + `npm run build` + עליית backend.
3. **ds יתומים**: מחיקת `test_preferences.py` + `.ipynb_checkpoints/`; העברת
   `training.ipynb`+`tfid.ipynb` ל-`ds/model/archive/` עם README קצר (הם מוזכרים בספר
   כהיסטוריה - ארכוב, לא מחיקה); תיקון `ds/model/README.md` (סעיף rank_skills → ניסוח
   עבר-היסטורי או הסרה). *אימות:* `python -c "import server"` ב-ds/model + עליית DS server.
4. **scraping**: העברת `biocatch_site.py`+`example_site.py` ל-`scraping/archive/` עם
   שורת הקשר (הסקרייפר הראשון - מסופר בספר §3.1). *אימות:* הסקרייפר הפעיל
   (`linkedin.py`) לא מייבא מהם (grep) + pipeline build.
5. **scripts/**: לפי הכרעת שאלה 3.
6. **סריקה אחרונה**: grep סופי לפי הגדרת ה-Done (אימוג'ים/console.log/TODO), טריאז'
   `print(` ב-`server.py` בלבד (המרה ל-logging או השארה מנומקת).
7. **אימות סיום**: build שני הצדדים + DS עולה + זרימה מלאה אחת ידנית (upload→detect→
   personalize→analyze→improve) ב-Playwright + דוח החלטות-מחיקה.

**נקודות עצירה בטוחות:** אחרי כל צעד (קומיט לתחום). **Out of scope:** docs/**, טקסטי UI
(M03), mock screens (M14), ריפקטור, `ds/final/`, notebooks של M18/M19, קבצי root
(`rx-*.png` וכו' - M13).

## 5. סיכונים ומיטיגציות

| סיכון | תרחיש | מיטיגציה |
|---|---|---|
| מחיקת "מת" שחי | קובץ שנטען דינמית/דרך Docker (למשל ds path ב-Dockerfile) | לפני כל מחיקה: grep מלא כולל Dockerfiles/compose; ארכוב עדיף על מחיקה בספק |
| שרשרת titleMatch | קורא שמעביר ערך לא-דיפולטי | grep כל הקוראים לפני; אם קיים כזה - עצירה ושאלה |
| רגרסיית build | tsc עובר אבל runtime נשבר | עליית שירותים אחרי כל תחום + זרימה מלאה בסוף |
| דמו | שבירה יום לפני חומרי M08/M11 | קומיטים אטומיים לתחום - revert נקודתי זמין; אפס נגיעה במודלים |
| התנפחות סקופ | "עוד קצת סגנון" בלי סוף | הרשימה סגורה לטבלת הממצאים; כל תוספת = שאלה |

## 6. החלטות

**מהבריפינג:** אפס שינוי התנהגות; ארכוב מתועד עדיף על מחיקה; ספק = לא מוחקים.
**נלקחות עכשיו:** (א) ארכוב ולא מחיקה ל-notebooks ולסקרייפרים ההיסטוריים - הם
מוזכרים בספר; (ב) הסרת שרשרת titleMatch - פרמטר שהשרת מתעלם ממנו, אפס התנהגות
(בכפוף לאימות הקוראים); (ג) לא נוגעים ב-console.log של scripts/ ו-startup - לגיטימיים;
(ד) `ds/final/` ו-`Copy_of_CV_to_title.ipynb` מחוץ לתחום אלא אם תוחלט אחרת (שאלה 2).
**פתוחות → סעיף 7.**

## 7. שאלות למשתמשת

~~1. אישור חריגת M13~~ - **התייתרה** (M13 סגור, ראה סעיף 0).
~~2. `Copy_of_CV_to_title.ipynb`~~ - **התייתרה** (אורכב ב-`9574f30`).

3. **סקריפטי העזר** `checkCvsMatchScores.ts`, `testPersonalization.ts`.
4. **`scraping/src/`** - הפריימוורק מינואר (חדשה, מהתיקון בסעיף 0).

## 8. תשובות והכרעות (המשתמשת, 2026-08-22)

| # | שאלה | הכרעה |
|---|---|---|
| 3 | סקריפטי עזר בבקאנד | **להשאיר + הערת שימוש** בראש כל קובץ (מה עושה, איך מריצים). `seed.ts` לא נוגעים |
| 4 | `scraping/src/` | **לארכב את כל התיקייה** → `scraping/archive/src/` עם README. הסקרייפר החי (`external/linkedin.py`) לא נוגע |
| - | שרשרת `titleMatch` | **להסיר** - אומת שה-DS מתעלם לגמרי (`server.py` ללא אזכור) וכל 4 הקוראים מעבירים 0.0 |
| - | README | **תיקון מלא** - שורה 82, 11 פקודות macOS → חוצות-פלטפורמה (Windows ראשון), תיאור 3 שירותים במקום "POC" |

## 9. תוכנית מימוש מאושרת (מעודכנת אחרי ההכרעות)

1. **README** - שורה 82 → `ds/requirements.txt`; פקודות `brew`/`lsof`/`source .venv`
   (שורות 9, 36-38, 81, 121, 142, 153-155, 158) → מקבילות Windows/חוצות-פלטפורמה;
   תיאור "POC" (שורות 68, 172) → 3 השירותים האמיתיים.
   *אימות:* קריאה מלאה + הרצת פקודת ההתקנה של ה-DS.
2. **backend מת** - מחיקת `src/interfaces/dsModel.interface.ts`; הסרת `titleMatch`
   מ-`dsModel.ts:244-253` ומ-`job.service.ts:26,38`.
   *אימות:* `npx tsc --noEmit` + `npm run build` + עליית backend.
3. **סקריפטי עזר** - הערת שימוש בראש `checkCvsMatchScores.ts` ו-`testPersonalization.ts`.
4. **ds יתומים** - מחיקת `test_preferences.py` (נכשל ב-import); תיקון
   `ds/model/README.md:101-102` + סעיף `title_match` (26, 31-40) לניסוח עבר-היסטורי.
   *אימות:* `python -c "import server"` + עליית DS server.
5. **scraping** - `scraping/src/` → `scraping/archive/src/` + README הקשר.
   *אימות:* `pipeline/run_daily.sh` ו-`external/Dockerfile` לא מפנים לשם (grep).
6. **סריקה סופית** - grep אימוג'ים/console.log/TODO; טריאז' 5 `print(` ב-`server.py`.
7. **אימות סיום** - builds + DS עולה + זרימה מלאה ב-Playwright.

**סטטוס: ✅ מאושר למימוש (המשתמשת, 2026-08-22)**

## 10. דוח מימוש (2026-08-22)

| צעד | תוצאה | קומיט |
|---|---|---|
| 1. README | ☑ שורה 82 → `ds/requirements.txt`; 11 פקודות macOS → Docker/Windows; "5 POC jobs" → seed מושך 59 טייטלים מה-DS (+ הערת סדר הרצה); layout מעודכן; **נוסף** צעד `git lfs pull` | `d3da967` |
| 2. backend מת | ☑ `dsModel.interface.ts` נמחק; `titleMatch` הוסר מ-3 קבצים (`dsModel.ts`, `job.service.ts`, `personalize.routes.ts`) | `322e9d4` |
| 3. סקריפטי עזר | ☑ **כבר היו** הערות שימוש בשניהם - תוקנה רק הפניה ל-`test_preferences.py` שנמחק | `322e9d4` |
| 4. ds יתומים | ☑ `test_preferences.py` נמחק; `ds/model/README.md` - סעיף `title_match` הוסר מה-API ונרשם ב-task log כניסוי שנזנח; הפניות הבדיקות → `test_stability.py`/`test_skill_schema.py` | `8f6a86d` |
| 5. scraping | ☑ `src/` + README + requirements + tests → `archive/`; נכתב `scraping/README.md` חדש שמסביר מי חי (`external/linkedin.py`) ומי היסטוריה | `3301bf5` |
| 6. סריקה סופית | ☑ 0 TODO/FIXME, 0 `console.log` בפרונט, 0 אימוג'י-לוג. ה-✓/✕ שנמצאו הם תוכן UI לגיטימי. `server.py`: 4 מ-5 ה-`print` הם הודעות עלייה - הושארו; החמישי (נתיב בקשה) קיבל תג `[server]` |
| 7. אימות סיום | ☑ `tsc --noEmit` נקי, `npm run build` עובר בשני הצדדים, DS עולה ומחזיר 59 טייטלים, `/title/skills` עובד **בלי** הפרמטר שהוסר, ו-`/api/personalize/options` מחזיר 10 סקילז דרך החתימה החדשה של `getCoreSkills` |

**חריגה מהתוכנית:** אימות ה-Playwright לא רץ - הדפדפן היה תפוס ע"י סשן מקביל. במקומו
בוצע אימות API מלא של הנתיב שהשתנה (רישום → jobs → personalize/options), כולל הקריאה
היחידה שבה **הזזתי ארגומנטים** (`personalize.routes.ts:76`). **נותר ל-M12:** מעבר UI.

## 11. ממצאים מחוץ לסקופ (לא בוצעו - דורשים הכרעה)

**שני controllers מתים** (מעבר לרשימה המאושרת, ולכן לא נגעתי):
`backend/src/controllers/jobs.controller.ts` ו-`cv.controller.ts` - אף route לא מייבא
אותם (אומת ב-grep; `results.controller.ts` ו-`score.controller.ts` **כן** בשימוש).
`jobs.controller.ts` אף מכיל `getCoreSkills` שמדמה endpoint שלא קיים. המלצה: למחוק.
