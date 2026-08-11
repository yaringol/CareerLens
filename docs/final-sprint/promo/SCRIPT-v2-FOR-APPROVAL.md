# תסריט v2 — לאישור לפני בנייה

**סטטוס: טיוטה. לא בניתי כלום לפי המסמך הזה.**

---

## למה התסריט הנוכחי לא עובד

הגרסה שבנינו היא **סיור במסכים**: "הנה מסך 1, הנה מה שהוא עושה, הנה מסך 2".
ארבע בעיות:

1. **נפתח ב-"Two ML models"** — התרברבות טכנית לפני שנתנו לצופה סיבה לאכפת לו.
2. **אין מתח.** הכול באותו רגש מההתחלה עד הסוף. אין רגע שבו משהו מתגלה.
3. **הכתוביות מתארות במקום לשכנע.** *"A match score for the role you're targeting"* מסביר תכונה. הוא לא אומר למה זה משנה.
4. **החומר הכי חזק קבור.** הסירוב ל-CV של אחות — הרגע שבונה אמון — יושב בשנייה 18, לפני שהצופה בכלל יודע מה המוצר עושה.

---

## מה קיים במערכת ולא צילמנו

מיפוי מהקוד, לא מהזיכרון:

| # | פיצ'ר | איפה בקוד | למה זה שווה |
|---|---|---|---|
| 1 | **Daily Pipeline** — סטטוס הריצה היומית | `AdminPipelinePanel.tsx` | ⭐⭐⭐ ההוכחה ל-"הדאטה מתעדכן כל יום". הטענה המרכזית של המוצר, ואין לה שום שוט |
| 2 | **Model 1 status** — מודל חי, אימון אחרון, משקלי מקורות, LinkedIn jobs / Raw postings / Unified obs, **Run history עם עמודת Promoted** | `AdminModelStatusPanel.tsx` | ⭐⭐⭐ מראה שיש כאן צינור ML אמיתי ולא קריאה ל-LLM |
| 3 | **מסך הסריקה** (ScanLoader) | `ScanLoader.tsx` | ⭐⭐ יפה ויזואלית — חתכנו אותו כ"זמן מת" בטעות |
| 4 | **About modal** — הכפתור `? About` | `AboutModal.tsx` | ⭐ המוצר מסביר את עצמו למשתמש |
| 5 | **מועדפים + השוואה אוטומטית** — *"Star up to 3 favorites and we'll compare them automatically on your next analysis"* | `FavoriteStarButton.tsx`, `AccountPage` | ⭐⭐ פיצ'ר אמיתי שאף אחד לא יודע עליו |
| 6 | **CV only** — ניתוח בלי מודעת משרה | טאב במסך ההעלאה | ⭐ |
| 7 | **שליפת משרה מ-URL** — *"paste a link, we'll fetch the posting"* | `jobs.routes.ts` | ⭐ |
| 8 | **אזהרת "No knowledge"** — *"was not found in your CV and you marked 'No knowledge'. We recommend not adding it"* | מסך Improve | ⭐⭐ המוצר מונע מהמשתמש לשקר בקו"ח |
| 9 | **Mentions 1/2/3 + הודעת מיזוג** — *"This section is also referenced by... Changes will be merged"* | מסך Rephrase | ⭐ יש בפוטג' הקיים, לא נוצל |
| 10 | **בורר תפקיד ידני** | צולם במקור F | ⭐ קיים, לא בתסריט |

**צריך הקלטה חדשה:** 1, 2 (מסך admin — יש משתמש `admin@careerlens.dev`), ואופציונלית 4, 5, 8.
**כבר קיים בפוטג':** 3, 9, 10.

---

## תסריט v2 — חמש מערכות, ~2:10

הרעיון: **שאלה → מדידה → עבודה → קבלה → אמון.**
כל מערכה מסתיימת ברגע שמצדיק את הבאה אחריה.

### מערכה 1 · השאלה (0:00–0:22)

| # | זמן | מה על המסך | כתובית |
|---|---|---|---|
| 1 | 0:00–0:05 | הלוגו נוצר מענן החלקיקים | — |
| 2 | 0:05–0:12 | דף הנחיתה: *"Does your CV match today's job market?"* | **Everyone asks this.** / **Almost nobody can actually answer it.** |
| 3 | 0:12–0:22 | העלאת PDF → `Frontend Developer` נדלק אוטומטית | **Start here.** / **It reads your CV and names the job you're actually aiming at.** |

### מערכה 2 · המדידה (0:22–1:05)

| # | זמן | מה על המסך | כתובית |
|---|---|---|---|
| 4 | 0:22–0:28 | הדבקת מודעת המשרה | **Then it reads the job you want.** |
| 5 | 0:28–0:38 | Tailor your recommendations, מעבר בין המצבים | **You choose what counts:** / **skills that have held their value — or the ones the market just started asking for.** |
| 6 | 0:38–0:42 | **מסך הסריקה** ⭐ חדש בתסריט | **Ten skills. Two sources.** |
| 7 | 0:42–0:52 | המחוון נעצר על **69% · GOOD** | **69%. Good.** / **"Good" is not what gets you read.** |
| 8 | 0:52–1:00 | Core Skills מול Dynamic Skills | **Five skills from the market.** / **Five from this exact posting.** |
| 9 | 1:00–1:10 | Gap Analysis, זום על שורות `✗ Not found` | **And here is the part no one tells you.** |

### מערכה 3 · העבודה (1:10–1:38)

| # | זמן | מה על המסך | כתובית |
|---|---|---|---|
| 10 | 1:10–1:17 | Rate your skill levels | **It asks what you actually know.** |
| 11 | 1:17–1:23 | ⭐ **חדש** — אזהרת "No knowledge" | **And if you don't know it, it tells you not to claim it.** |
| 12 | 1:23–1:33 | ORIGINAL מול REPHRASED | **Then it rewrites. Your experience, their language.** / **Every change is yours to approve.** |
| 13 | 1:33–1:38 | מסך התוצאה + לחיצת Export | **Take it.** |

### מערכה 4 · הקבלה (1:38–1:52)

| # | זמן | מה על המסך | כתובית |
|---|---|---|---|
| 14 | 1:38–1:44 | לחיצת Re-analyze | **Then send it back and check.** |
| 15 | 1:44–1:52 | שוט ההשוואה before/after | **Same person. Same experience.** / **javascript 5 → 8.  OOP 4 → 6.  unit testing 5 → 6.** |

### מערכה 5 · האמון (1:52–2:12)

| # | זמן | מה על המסך | כתובית |
|---|---|---|---|
| 16 | 1:52–2:00 | ⭐ CV של אחות → *"We found Registered Nurse"* + 29% ביטחון | **A nurse's CV gets read as a nurse's CV.** / **No role fits — so it asks. It doesn't guess.** |
| 17 | 2:00–2:08 | ⭐ **חדש** — Daily Pipeline + Model 1 status | **Because the market data behind all of this** / **is re-scraped and retrained every day.** |
| 18 | 2:08–2:16 | כרטיס סיום | — |

---

## שלוש החלטות עריכה שמשנות את התחושה

1. **הסירוב עבר מ-0:18 ל-1:52.** בהתחלה הוא סתם עוד מסך; בסוף הוא התשובה לשאלה *"למה שאאמין למספרים שראיתי?"*
2. **הכתוביות מתקצרות.** *"69%. Good. 'Good' is not what gets you read."* במקום *"A match score for the role you're targeting."* משפט קצר על מסך גדול נקרא; משפט ארוך לא.
3. **מסך הסריקה נכנס פנימה.** חתכנו אותו כזמן מת — אבל הוא ארבע שניות שבהן הצופה מבין שמשהו נמדד.

---

## מה שונה מ-v1

| | v1 | v2 |
|---|---|---|
| מבנה | סיור במסכים | חמש מערכות עם קשת |
| פתיחה | "Two ML models" | "Everyone asks this" |
| הסירוב | 0:18, קבור | 1:52, שיא האמון |
| Daily Pipeline | ❌ | ✅ סוגר את הסרטון |
| אזהרת No knowledge | ❌ | ✅ |
| מסך הסריקה | נחתך | נכנס |
| אורך | 1:56 | ~2:16 |

---

## מה שאני צריכה ממך

1. **אישור לתסריט** — או תיקונים.
2. **אישור להקליט את מסך ה-admin.** יש משתמש `admin@careerlens.dev` במונגו; אצטרך להציב לו סיסמה כמו שעשיתי ל-demo.
3. **החלטה על אורך** — 2:16 זה ארוך לעמדה. אם צריך 90 שניות, אני מקצרת את מערכה 2.
