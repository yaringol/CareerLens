# משימה 01: ייצוב ה-branch - קונפליקטים, קומיטים, אימות מקצה-לקצה

> בריפינג לאייג'נט עצמאי. קרא את כל הקובץ לפני שאתה נוגע בקוד.
> כללי הברזל מ-[00-MASTER-PLAN.md](00-MASTER-PLAN.md) (סעיף "החלטות שהתקבלו") מחייבים.

## מטרה

להביא את branch `last_fix` למצב נקי ויציב: אפס קונפליקטים, אפס שינויים לא-מקומטים,
build עובר בכל הרכיבים, והזרימה המרכזית (upload → analyze → results) עובדת בפועל.
זהו תנאי מקדים לכל שאר משימות הספרינט.

## ✅ עודכן 2026-07-14: המיזוג הושלם - רוב המשימה הזו כבר בוצעה

הענף יושר מול `main`. **אומת ידנית:**
- Branch: `final-submission-prep`, מקדים את `main` ב-64 קומיטים, `behind: 0`.
- **אפס קונפליקטים** (`git diff --diff-filter=U` ריק), אין `.git/MERGE_HEAD`.
- **`npx tsc --noEmit` בבקאנד יוצא 0.** `npm run build` ב-frontend עובר.
- שבירת החוזה הנסתרת נסגרה: `focusSkillPool.service.ts:87` כבר קורא `r.pool`,
  ו-`job.service.ts` מייצא `pool`/`topFive`.

**מה שנשאר מהמשימה הזו:** רק סעיף האימות מקצה-לקצה למטה. כל השאר — בוצע.

> ⚠️ באג ה-role-mismatch במסך Personalize **לא תוקן** (אומת: `personalize.routes.ts:54`
> עדיין קורא `extractTitleFromCv(cvText)` בלי `headerText`). הוא **עבר למשימה 14** —
> אל תתקן אותו כאן, המשימה הזו לא משנה התנהגות.

## הקשר שחשוב להכיר לפני פתרון הקונפליקטים

- שלושת הקבצים המסוכסכים הם לב זרימת ה-analyze/personalize. ההיסטוריה הקרובה שלהם עסקה ב:
  פיצול בחירת סקילים core/dynamic לפילטרים בלתי-תלויים, שמירת recommendation balance
  (mode + weights), ו-rescore בלי SkillNer. בדוק `git log --oneline -15 -- <file>` לכל אחד
  ו-`git log --merge` כדי להבין מה כל צד של הקונפליקט מנסה להשיג לפני שאתה בוחר צד או ממזג ידנית.
- ה-frontend מדבר רק עם ה-backend (`/api/*`); ה-backend מדבר עם DS server בפורט 8000 דרך
  `backend/src/services/dsModel.ts`. אל תשבור את הקונטרקטים האלה.
- מסמך הזרימה המלא: [docs/ds-models/02-model2-onboarding.md](../ds-models/02-model2-onboarding.md) סעיף 4.

## צעדים

1. `git status` + `git diff` מלאים - למפות בדיוק מה staged, מה unstaged, מה conflicted.
2. לפתור את שלושת הקונפליקטים תוכן-אחר-תוכן (לא "לקחת צד" אוטומטית) - המטרה: לשמר גם את
   תיקוני ה-personalize balance וגם את תיקון ה-rescore. אחרי כל קובץ: `npx tsc --noEmit` בתיקיית backend.
3. לעבור על כל ה-staged changes ולוודא שאין שם דברים שאסור לקמט (קבצי `.env*`, קבצים
   בינאריים גדולים, סודות ב-`secrets/`). אם `git status` מציג קובץ כזה - להוציא מה-staging ולעדכן `.gitignore`.
4. לחלק לקומיטים לוגיים (לא קומיט-ענק אחד): לפי נושא - conflict resolution, admin indexes,
   skill dedup, docs וכו'. הודעות קומיט באנגלית, בסגנון הקיים (`fix(scope): ...`), בלי שום זכר ל-AI.
5. אימות מקצה-לקצה (ראה "אימות" למטה).

## מלכודות ידועות

- **תקרית ה-`model.joblib` הריק (QA 2026-07-03) - נפתרה.** אומת ידנית: 59/59 תפקידים מלאים,
  0 שורות ריקות (`trained_at=20260704_185757`). אין צורך לבדוק שוב.
- שינוי בקבצי `ds/model/*.py` מחייב restart ל-DS server - המודל והקוד נטענים רק בעליית התהליך.
- **אל תריץ `git clean -fdx`** - התוכנית הזו, האפיון המקורי ו-`poc_files/` הם עדיין
  untracked (ראה משימה 13); ניקוי כזה ימחק אותם.

## הגדרת Done

- [ ] `git status` נקי לחלוטין (או נשארים בכוונה רק קבצים שאינם להגשה, מתועדים כאן).
- [ ] `npx tsc --noEmit` עובר ב-backend; `npm run build` עובר ב-frontend.
- [ ] backend + frontend + DS server עולים יחד, והזרימה upload CV → detect title →
      personalize → analyze → results screen עובדת בדפדפן על קובץ PDF אמיתי אחד לפחות.
- [ ] בדיקת 59 הטייטלים מחזירה `empty: none | total: 59`.
- [ ] הקומיטים דחופים ל-remote (`git push`), בלי אף קובץ אסור.

## אימות

- הרצה מלאה: `python server.py` ב-`ds/model` (פורט 8000), `npm run dev` ב-backend (3000),
  `npm run dev` ב-frontend. יש Playwright MCP - השתמש בו לעבור את הזרימה בדפדפן ולצלם מסך.
- אם יש suite: `poc_files/` מכיל טסט ניקוד על 15 קו"ח (ראה memory/פרויקט: `npm run run-poc`
  מתוך `poc_files`, דורש backend+DB חיים). הרץ אם הסביבה מאפשרת; אם לא - תעד שלא רץ ולמה.

## גבולות

- לא לעשות ריפקטורים, שיפורי סגנון או מחיקת קוד "מכוער" - זה משימה 02.
- לא לשנות טקסטים של UI - זה משימה 03.
- לא לאמן מודלים ולא לגעת בדאטה ב-Mongo - זה משימה 06.
- אם קונפליקט לא ניתן להכרעה בוודאות (שני הצדדים נראים נכונים וסותרים) - לעצור ולשאול את
  המשתמש עם הסבר קצר של שתי האפשרויות, לא לנחש.
