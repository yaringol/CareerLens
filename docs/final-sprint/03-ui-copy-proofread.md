# משימה 03: הגהת כל הטקסטים במערכת + שיפורי הסבר מהפגישה

> בריפינג לאייג'נט עצמאי. **גל 2, סדר 12** - תלוי ב-M14 ו-M15: מגיהים טקסטים רק אחרי
> שהמסכים סופיים (כולל מסך ה-Gap Analysis החדש והודעות השגיאה החדשות של M14).
> כללי הברזל מ-[00-MASTER-PLAN.md](00-MASTER-PLAN.md) מחייבים.

## מטרה

כל טקסט שמשתמש רואה במערכת - נקי, באנגלית תקינה, עקבי במינוח, וברור. בנוסף: מימוש
הערות ה-UX הטקסטואליות מהפגישה האחרונה עם המנחה (05.07.2026), שהן דרישה ישירה להגשה.

## חלק א' - הגהה שיטתית

עברו מסך-מסך על כל ה-copy: כותרות, כפתורים, placeholders, הודעות שגיאה/הצלחה, empty states,
tooltips, badges, טקסטים של loading, מיילים/התראות אם יש.

מוקדי חיפוש בקוד:
- `frontend/src/pages/**` ו-`frontend/src/components/**` - כל מחרוזת קשיחה ב-JSX.
- הודעות שגיאה שמגיעות מה-backend (`backend/src/routes/**`) ומוצגות למשתמש כלשונן.
- מסכים מרכזיים ידועים: Upload (`CvUploadSection.tsx`), Personalization
  (`PersonalizationScreen.tsx`), Results/Dashboard (`SkillsMatchDashboard.tsx`),
  Improve CV (`ImproveCVScreen.tsx`), Account, Admin, Login.

כללי עקביות (לאכוף בכל המסכים):
- מונח אחד לכל מושג: "CV" (לא לסירוגין Resume), "Match Score", "Core Skills" /
  "Dynamic Skills", "Improvement Plan" - כפי שמוגדר באפיון
  ([Final project design.md](../ds-models/Final%20project%20design.md) סעיף 3).
- Capitalization עקבי בכפתורים וכותרות (Title Case או Sentence case - לבחור אחד, ליישר הכל).
- הודעות שגיאה: משפט מלא, בלי סלנג טכני פנימי (לא "DS model returned 500").

## חלק ב' - הערות הפגישה (חובה, מתוך [12-meeting-summary-2026-07-05.md](../ds-models/12-meeting-summary-2026-07-05.md))

1. **מסך Personalization:** כפתור **About** שמסביר בצורה ברורה את אפשרויות ההתאמה האישית
   ומה משמעות כל בחירה (Stable / Balanced / Trending / Custom, בחירת 5 סקילים, משקלים).
2. **מסך Upload:** Tooltip בהובר על כפתורים רלוונטיים.
3. **מסך Results:** ההסברים בולטים יותר - ליד הכותרות או ב-Tooltip בהובר.
4. **כלל-מערכתי:** יש הרבה טקסט קטן/אפור שלא מושך תשומת לב - להגדיל/להבהיר גוון במקומות
   שבהם המשתמש מקבל החלטה; להוסיף Tooltips בכל נקודת התלבטות.

לשמור על שפת העיצוב הקיימת (glassmorphism, פלטת הצבעים הנוכחית) - זה שיפור קריאות,
לא רהעיצוב. אם קיים `docs/brand-brief.md` - לקרוא לפני שינויי גוון/גודל.

## מלכודות

- מחרוזות שמשמשות גם כלוגיקה (השוואות `=== "..."`, מפתחות sessionStorage) - לשנות רק את
  התצוגה, לא ערכים שמושווים בקוד.
- הטקסט "Detected as X ·" במסך Upload מוצג בתנאי (רק כשהטייטל הגולמי שונה מה-canonical) -
  אל תשבור את התנאי.
- הסף `AUTO_MATCH_CONFIDENCE_MIN = 60` וטקסטים של low-confidence כוילו בקפידה
  (ראה [01-model2-cv-title-classifier.md](../ds-models/01-model2-cv-title-classifier.md) סעיף 5) - לשפר ניסוח, לא לוגיקה.

## הגדרת Done

- [ ] נעשה מעבר מתועד על כל מסך (רשימת מסכים + מה תוקן בכל אחד).
- [ ] כפתור About ב-Personalization, tooltips ב-Upload, הסברים בולטים ב-Results - ממומשים.
- [ ] אפס שגיאות כתיב/דקדוק (הרץ בדיקה על כל המחרוזות שחולצו).
- [ ] מינוח עקבי לפי הרשימה למעלה.
- [ ] Build עובר; צילומי מסך לפני/אחרי לכל מסך ששונה (Playwright MCP) שמורים ב-
      `docs/final-sprint/outputs/03-screenshots/`.

## גבולות

- בלי שינויי לוגיקה או זרימה. **חריג מאושר:** כפתור ה-About ב-Personalization מחייב
  קומפוננטת modal/disclosure חדשה - זה בסקופ (זו דרישה מפורשת של המנחה).
- בלי הוספת ספריות UI חדשות; tooltip במנגנון שכבר קיים בפרויקט
  (יש כבר `[data-tooltip]::after` ב-`SkillsMatchDashboard.css` — להשתמש בו).

### חלוקת עבודה מול משימה 14 (חשוב - אל תדרכו זה על זה)

| נושא | מי |
|---|---|
| **ניסוח** הודעות שגיאה/הצלחה/empty state | **03** (כאן) |
| **מנגנון** הצגת שגיאות (`alert()` → toast, ErrorBoundary, timeout) | **14** |
| טקסט של הודעה חדשה שנוצרת בתיקון (למשל "English CVs only") | **14** מייצר, **03** מנסח |

אם 14 כבר רצה - לשמור על ההודעות שהיא הוסיפה ורק לשפר ניסוח. אם 03 רצה קודם - 14 תשתמש
בניסוחים שנקבעו כאן.
