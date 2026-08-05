# CareerLens — מאגר טקסטי המוצר

> **מה זה:** כל מחרוזת שמשתמש רואה, במקום אחד, בסדר המסע. נבנה ל-M03 כדי שאפשר יהיה
> לקרוא את כל הטקסט של המוצר **ברצף** — חוסר עקביות כמו חמישה שמות לאותו מושג או שני
> איותים באותו כפתור אינו נראה כשעוברים מסך-מסך.
>
> **איך קוראים את זה:** עמודת "מוצע" מלאה רק היכן שנדרש שינוי. עמודת 🔒 מסמנת מחרוזת
> ש**נושאת לוגיקה** — מפתח אחסון, ערך API, מפתח enum, נתיב, או מחרוזת שמשווים אליה.
> **מחרוזות 🔒 לא משנים** גם אם הניסוח שלהן צורם.
>
> **סטטוס:** 🚧 בבנייה (צעד 1 של [03-kickoff.md](kickoffs/03-kickoff.md)) · **נבנה:** 2026-08-03

---

## כללי ההגהה שנקבעו (מאושרים 03/08)

| נושא | הכלל |
|---|---|
| **איות** | **US בכל המוצר** — `Analyze`, `Customize`, `Personalized`, `favorites`. תאריכים נשארים `en-GB` (פורמט, לא copy) |
| **Capitalization** | **Sentence case** לכפתורים, רמזים והודעות. **Title Case** רק לשמות-מוצר: `Core Skills`, `Dynamic Skills`, `Gap Analysis`, `Improvement Plans`, `Match Score` |
| **מסמך = קו"ח** | `CV` בלבד. `Resume` לא מופיע בשום מקום גלוי |
| **הסקילז** | שני שמות בלבד: **`Core Skills`** (מהמודל, לפי התפקיד) ו-**`Dynamic Skills`** (מתיאור המשרה). מבוטלים: `Global skills`, `Your job skills`, `Focus Skills`, `Role core` |
| **סולם הציון** | אוצר מילים אחד. מבוטלים הכפילים ב-`HalfCircleGauge` וב-`SkillBar` |
| **התפקיד** | `role` בטקסט למשתמש. `job title` רק במסכי Admin |
| **הודעות שגיאה** | משפט מלא, בלי ז'רגון פנימי. אין `DS model`, אין `SkillNer`, אין `Internal error` |

---

## חלק א' — הודעות שמגיעות מהבקאנד

**למה הן ראשונות:** אלה המחרוזות שהכי קל לשכוח שהן copy מוצרי. מסלול ההצגה אומת —
`{ error }` → `parseErrorResponse` ([api.ts:36-56](../../../frontend/src/services/api.ts#L36-L56),
לוקח `body.error` verbatim) → `ErrorToast.tsx:29` מדפיס גולמי. **אין שכבת תרגום.**

**הכרעה (ש4, 03/08): לא נוגעים בבקאנד.** הניסוח מחדש נעשה ב**מיפוי בצד הפרונט**, כי
[CvUploadSection.tsx:74-80](../../../frontend/src/components/upload/CvUploadSection.tsx#L74-L80)
מתאים הודעות מול המילים `pdf` / `extract` / `parse` — שינוי בבקאנד היה שובר טיפול בשגיאות
בשקט. לכן כל השורות כאן מסומנות 🔒, והעמודה "מוצע" מתארת את **הטקסט שהמשתמש יראה אחרי המיפוי**.

### א.1 ז'רגון פנימי שדולף למשתמש (עדיפות עליונה)

| מיקום | הטקסט היום | מוצע (מיפוי בפרונט) | 🔒 |
|---|---|---|---|
| `services/dsModel.ts:115,236,268,336,495` | `DS model service is unavailable` | The analysis service is temporarily unavailable. Please try again in a moment. | 🔒 |
| `services/dsModel.ts:229` | `SkillNer returned no skills for the given text` | We could not identify any skills in this text. | 🔒 |
| `routes/analyze.routes.ts:106` | `Internal error: expected exactly 5 core skills` | Something went wrong preparing this analysis. Please try again. | 🔒 |
| `routes/analyze.routes.ts:115` | `Invalid core skills: duplicates or empty entries` | Something went wrong preparing this analysis. Please try again. | 🔒 |
| `services/jobPostingFetcher.service.ts:79` | `Could not read position id from Comeet link` | We could not read this job link. Paste the description text instead. | 🔒 |
| `services/jobPostingFetcher.service.ts:90` | `Could not read Comeet careers token from the job page` | We could not read this job link. Paste the description text instead. | 🔒 |
| `services/jobPostingFetcher.service.ts:104` | `Comeet job page did not contain enough description text` | This job page did not contain enough text. Paste the description instead. | 🔒 |
| `services/scoring.service.ts:78` | `LLM scoring response is not valid JSON` | Scoring failed. Please try again. | 🔒 |
| `services/scoring.service.ts:95` | `Invalid LLM scoring shape` | Scoring failed. Please try again. | 🔒 |
| `services/job.service.ts:32,199`, `scoring.service.ts:218,245` | `Invalid job ID format` | Something went wrong. Please start a new analysis. | 🔒 |

### א.2 הודעות תקינות — נשארות, אולי בליטוש

| מיקום | הטקסט | הערה | 🔒 |
|---|---|---|---|
| `services/cv.service.ts:68` | `CareerLens analyzes English CVs only. Please upload an English version of your CV.` | טובה כמו שהיא | 🔒 |
| `services/cv.service.ts:76` | `Extracted CV text is too short to analyze` | ✎ `We could not read enough text from this CV.` | 🔒 |
| `services/cv.service.ts:49` | `Could not parse PDF file` | ⚠️ **המילה `parse` נבדקת ב-`isCvExtractFailure`** | 🔒🔒 |
| `services/cv.service.ts:55` | `No extractable text from PDF` | ⚠️ **המילה `extract` נבדקת שם** | 🔒🔒 |
| `analyze.routes.ts:230,536`, `personalize.routes.ts:71` | `The job description does not look like readable English.` | טובה | 🔒 |
| `compareSaved.service.ts:270` | `Your CV library is full (10) and the remaining files are starred. Unstar or delete a CV, or upload without saving.` | ארוכה אך מדויקת ומעשית | 🔒 |
| `compareSaved.service.ts:296` | `` You can star at most ${MAX_FAVORITE_CVS} CVs `` | טובה | 🔒 |
| `jobPostingFetcher.service.ts:178` | `Could not extract a job description from this page. Paste the text manually instead.` | טובה | 🔒 |
| `jobPostingFetcher.service.ts:187` | `Could not fetch the job posting link. Check the URL or paste the description manually.` | טובה | 🔒 |
| `utils/urlSafety.ts:30` | `Invalid job posting URL` | ✎ `This job link is not valid.` | 🔒 |
| `utils/urlSafety.ts:34` | `Only http and https job links are supported` | טובה | 🔒 |
| `utils/urlSafety.ts:39` | `Job link host is not allowed` | ✎ `We cannot open links from this site.` | 🔒 |

### א.3 אימות קלט — ז'רגון של שמות שדות

כל אלה חושפים שמות שדות API למשתמש. הם מופיעים רק כשהפרונט שולח בקשה לא תקינה — כלומר
נדירים בשימוש רגיל — ולכן **בעדיפות נמוכה**, ומכוסים ממילא ע"י מיפוי `VALIDATION` כללי.

| מיקום | הטקסט | 🔒 |
|---|---|---|
| `analyze.routes.ts:206` | `jobDescription is required - paste the job posting text or a link` | 🔒 |
| `analyze.routes.ts:211` | `` jobDescription is required (at least ${MIN} characters) - paste the job posting for skill extraction `` | 🔒 |
| `analyze.routes.ts:221` | `Provide canonicalTitle or jobId with cvText and jobDescription, or jobTitle, jobDescription, and cvText` | 🔒 |
| `analyze.routes.ts:317,624`, `compareSaved.service.ts:185`, `job.service.ts:164` | `jobTitle is required` / `Job title is required` | 🔒 |
| `analyze.routes.ts:320,487`, `cv.routes.ts:156`, `personalize.routes.ts:45` | `cvText is required (min 10 chars)` | 🔒 |
| `analyze.routes.ts:323,627` | `skills must be a non-empty array` | 🔒 |
| `analyze.routes.ts:333` | `skills must contain exactly 5 or 10 skill names from the prior analysis` | 🔒 |
| `analyze.routes.ts:484`, `personalize.routes.ts:42` | `canonicalTitle is required` | 🔒 |
| `analyze.routes.ts:490` | `personalization is required` | 🔒 |
| `analyze.routes.ts:506` | `personalization.weights must be numbers (stable, trending, personalMatch)` | 🔒 |
| `analyze.routes.ts:509`, `personalize.routes.ts:142` | `personalization.weights must sum to 100` / `weights must sum to 100` | 🔒 |
| `analyze.routes.ts:513` | `personalization.selectedSkillIds must be an array` | 🔒 |
| `analyze.routes.ts:516` | `You can select up to 5 skills only` | ⚠️ **כפול** — קיים גם ב-`PersonalizationScreen.tsx:355` | 🔒 |
| `analyze.routes.ts:621` | `jobId is required` | 🔒 |
| `analyze.routes.ts:630` | `currentMatchScore is required` / `compareSaved.service.ts:182` `currentMatchScore must be a number` | 🔒 |
| `cv.routes.ts:23` | `cvText must contain at least 50 characters` | 🔒 |
| `cv.routes.ts:45` | `No file uploaded` | 🔒 |
| `cv.routes.ts:108` | `favorite must be a boolean` | 🔒 |
| `cv.routes.ts:122,142`, `compareSaved.service.ts:286` | `CV not found` | 🔒 |
| `cvImprove.routes.ts:65` | `cvText is required (min 50 chars)` | 🔒 |
| `cvImprove.routes.ts:68` | `weakSkills array is required` | 🔒 |
| `cvImprove.routes.ts:119` | `skill, proficiency, sectionId, and jobTitle are required` | 🔒 |
| `cvImprove.routes.ts:124` | `` proficiency must be one of: ${...} `` | 🔒 |
| `cvImprove.routes.ts:135` | `currentSectionText is required` | 🔒 |
| `cvImprove.routes.ts:161,164` | `sections array is required` / `sections must contain valid CV section objects` | 🔒 |
| `cvImprove.routes.ts:200` | `jobTitle, analysisId, originalCvText, finalCvText are required` | 🔒 |
| `cvImprove.routes.ts:297` | `Session not found` | 🔒 |
| `jobs.routes.ts:26,44` | `url is required` / `jobTitle and jobDescription are required` | 🔒 |
| `personalize.routes.ts:60` | `jobDescription is required for focus skills` | 🔒 |
| `personalize.routes.ts:133` | `` mode must be one of: ${...} `` | 🔒 |
| `personalize.routes.ts:139` | `weights.{stable,trending,personalMatch} must be numbers between 0 and 100` | 🔒 |
| `title.routes.ts:14` | `title is required` | 🔒 |
| `admin.routes.ts:132` | `runId is required` | 🔒 (Admin בלבד) |

### א.4 אימות והרשאות

| מיקום | הטקסט | הערה | 🔒 |
|---|---|---|---|
| `auth.routes.ts:18,47` | `Email and password are required` | טובה | 🔒 |
| `auth.routes.ts:22` | `Password must be at least 6 characters` | ⚠️ **6 כאן, 4 בשינוי סיסמה** — פער לוגי, M02 | 🔒 |
| `auth.routes.ts:28` | `Email already registered` | טובה | 🔒 |
| `auth.routes.ts:53,98` | `User not found` | ✎ `Invalid email or password.` (גם אבטחתית — לא לחשוף אילו מיילים רשומים) | 🔒 |
| `auth.routes.ts:59` | `Invalid credentials` | ✎ `Invalid email or password.` | 🔒 |
| `auth.routes.ts:88` | `currentPassword and newPassword are required` | ✎ `Enter your current and new password.` | 🔒 |
| `auth.routes.ts:92` | `New password must be at least 4 characters` | ⚠️ ראה למעלה | 🔒 |
| `auth.routes.ts:104` | `Current password is incorrect` | טובה | 🔒 |
| `auth.middleware.ts:21` | `Authentication required` | ✎ `Please sign in to continue.` | 🔒 |
| `auth.middleware.ts:28` | `Server misconfiguration` | ✎ `Something went wrong on our side.` | 🔒 |
| `auth.middleware.ts:37` | `Invalid or expired token` | ✎ `Your session expired. Please sign in again.` | 🔒 |
| `auth.middleware.ts:44` | `Forbidden` | ✎ `You do not have access to this page.` | 🔒 |
| `app.ts:35` | `Not found` | טובה | 🔒 |

---

## חלק ב' — מסכי הפרונט (בסדר המסע)

סימון: **✎** = שינוי מוצע · **🔒** = נושא לוגיקה, לא לגעת · שורה בלי סימון = תקינה כמו שהיא.

### ב.1 Login / Register — `pages/LoginPage.tsx`

| שורה | הטקסט היום | מוצע | סיבה |
|---|---|---|---|
| 20 | `Email and password are required` | ✎ `Enter your email and password.` | משפט מלא |
| 38 | `Something went wrong` | ✎ `Something went wrong. Please try again.` | חסר מוצא |
| 64 | `Career` + `Lens` | ✎ `Career` + ` Lens` | **חוסר עקביות במותג** — ב-HomePage:52 יש רווח מוביל, כאן אין |
| 67 | `Score your CV against any job posting` | — | טובה |
| 71, 86 | `Email` / `Password` | — | |
| 78 | `you@example.com` | — | |
| 93 | `Min. 6 characters` | ✎ `At least 6 characters` | ה-`.` אחרי `Min` נקרא כסוף משפט |
| 102 | `Signing in…` / `Login` | ✎ `Sign in` | הכפתור בשם פעולה, לא שם עצם |
| 110 | `Creating account…` / `Register` | ✎ `Create account` | אותו נימוק |

**ממצא:** ה-placeholder מבטיח מינימום 6 תווים, אבל `handleAction:19` בודק רק שהשדה לא ריק —
המסך **לא אוכף** את מה שהוא מבטיח, ואין הודעת שגיאה תואמת. הבקאנד כן אוכף (`auth.routes.ts:22`).
→ פער לוגי, מדווח ל-M02.

### ב.2 Home — `pages/HomePage.tsx`

| שורה | הטקסט היום | מוצע | סיבה |
|---|---|---|---|
| 40 | `DS-Powered Resume Analysis` | ✎ `Data-Science-Powered CV Analysis` | `Resume`→`CV`; `DS` לא מוסבר בשום מקום לפני כן |
| 52 | `Career` + ` Lens` | — | זו הגרסה הנכונה |
| 55 | `Does your CV match today's job market?` | — | טובה |
| 57-58 | `CareerLens uses a data-science model to extract the key skills from any job posting` + `and score your CV against them, so you know exactly what to improve.` | — | טובה |
| 63 | `Start Analyzing` | — | US ✓ |
| 68, 70 | `My Account` / `Sign out` | — | |
| 76 | `Global skills` | ✎ `Core Skills` | **איחוד מינוח** — זה בדיוק Core Skills |
| 81 | `Your job skills` | ✎ `Dynamic Skills` | **איחוד מינוח** |
| 86 | `Powered` (מתחת ל-`DS`) | ✎ להסיר את האריח | "DS / Powered" אינו מדד ולא שייך לשורת סטטיסטיקות |
| 91 | `Signed in as ` | — | |
| 95 | `Scroll to upload form` (aria) | ✎ `Analyze your CV` | **השם הנגיש חייב להכיל את הטקסט הנראה** (WCAG 2.5.3) |
| 107 | `How It Works` | — | Title Case לשם-מוצר ✓ |
| 114-115 | `Upload CV` / `Drop your resume PDF. We extract the text and build your skill profile.` | ✎ `Drop your CV PDF.` | `resume`→`CV` |
| 123-124 | `Paste Job Posting` / `Copy the full job description…` | — | |
| 132-133 | `Get Score` / `See your match percentage per skill…` | ✎ `See your Match Score per skill…` | שם המוצר |
| 140 | `Why CareerLens` | — | |
| 143-152 | שלושת זוגות הכאב/פתרון | ✎ `prioritise` → `prioritize` (152) | **US** |

### ב.3 Upload — `components/upload/CvUploadSection.tsx`

| שורה | הטקסט היום | מוצע | סיבה |
|---|---|---|---|
| 36 | `Could not extract text from this PDF` | — | טובה |
| 64 | `Paste a job description or posting link` | — | |
| 67 | `` Minimum ${MIN} characters required `` | — | |
| **90** | `en-GB` | 🔒 | פורמט תאריך — לוגיקה |
| 301, 772 | `AI matched this from your CV (no similarity score to show)` | ✎ `Selected by AI from your CV. No similarity score applies here.` | הסוגריים מסבירים פנימיות |
| 302, 773 | `AI matched` | — | |
| 305, 776 | `` ${confidence}% match `` | ✎ `` ${confidence}% confidence `` | ⚠️ **המילה `match` כאן היא ביטחון הזיהוי, לא ה-Match Score** — שני מושגים, מילה אחת |
| 348, 367 | `Please upload a PDF file` | — | כפול, לשמור מסונכרן |
| 444, 1007 | `Upload or select a CV to continue` | — | כפול |
| 604, 608 | `Home` / `Account` | — | |
| 616, 620, 625 | `Upload` / `Results` / `Improve` | — | תואם את המסע |
| **636** | `Resume *` | ✎ `CV *` | **המונח היחיד שחורג במסך** |
| 645, 652 | `Upload New CV` / `My CVs` | ✎ `Upload new CV` | Sentence case |
| 667 | `Change file` | — | |
| 677 | `Save to My CV library` | ✎ `Save to my CV library` | Sentence case |
| 694-695 | `Drop your CV here` / `or browse to upload · PDF only` | — | |
| 707, 813, 861 | `Loading...` / `Searching...` | ✎ `Loading…` / `Searching…` | **אליפסיס אחיד** (U+2026) |
| 709 | `No saved CVs yet. Upload one first.` | — | |
| 752, 756 | `Job` / `Detected role` | — | |
| 758, 761 | `Choose a CV to detect your role.` / `Detecting role from your CV...` | ✎ אליפסיס | |
| 769 | `` Detected as ${title} ·  `` | — | |
| 784 | `We found {title}. Choose the closest supported role.` | — | טובה — זו דלת המילוט |
| 804 | `We could not identify a role in this CV. Search for the closest supported role.` | — | |
| 810, 857 | `Search a role` / `e.g. Software Engineer` | — | |
| 833 | `Role detection is unavailable. Please try another CV.` | — | |
| 847, 851 | `Not the right role? Choose it manually` / `Type your role and pick the closest supported match.` | — | |
| 888 | `Cancel` | — | |
| 896, 905, 915 | `Job analysis mode` / `Job description or URL` / `CV only` | — | |
| 923 | `Your Dream Job Posting *` | ✎ `Job posting *` | **חריגת רגיסטר** — כל שאר התוויות עניניות |
| 926 | `Paste the full description or a job link. The backend fetches the posting when you analyze.` | ✎ `Paste the full description, or a link — we'll fetch the posting for you.` | **"the backend" חושף פנימיות** |
| 947 | `Paste job description text, or a link like https://www.comeet.com/jobs/company/...` | — | |
| **962** | `Job link  will import on analyze` | ✎ `Job link · will import on analyze` | 🐛 **רווח כפול** — מפריד אבד (אומת בייטים) |
| 973, 975 | `This description looks unreadable.` / `Please replace it with a readable English job posting before analyzing.` | — | |
| 983 | `Score your CV against 5 core skills for the selected role. No job posting needed.` | ✎ `5 Core Skills` | שם-מוצר |
| **992** | `Analyzing…` / `Analyse Match` | ✎ `Analyze Match` | 🐛 **שני איותים באותו כפתור** |
| 1001 | `Customize recommendations` | — | US ✓ |
| 1010-1017 | חמשת רמזי ה-CTA | ✎ 1013 `A detected role is required to continue` → `Choose a role to continue` | הניסוח הפסיבי הכי עמום מבין החמישה |

### ב.4 Personalize — `pages/PersonalizationScreen.tsx`

| שורה | הטקסט היום | מוצע | סיבה |
|---|---|---|---|
| 61-64 | `Stable` / `Balanced` / `Trending` / `Custom` | — | תוויות תצוגה. **המפתחות** באותה שורה 🔒 |
| 68-71 | ארבעת ה-`MODE_HINTS` | ✎ 71 `Set your own balance with the sliders below.` → `Set your own balance with the sliders.` | הסליידרים מופיעים רק במצב אחד מארבעה; "below" נכון ברבע מהמקרים |
| 75-77 | `Stable` / `Trending` / `Personal Match` | — | תוויות; המפתחות 🔒 |
| 355 | `` You can select up to ${MAX} skills only `` | — | ⚠️ **כפול מול `analyze.routes.ts:516`** |
| 372 | `Restored your saved recommendation balance` | ✎ `Restored your saved balance` | אחידות עם 545/549 |
| 485, 489 | `← Back to results` / `← Back to upload` | — | |
| 500 | `Tailor your recommendations` | — | |
| 502-503 | `Detected role: ` + ` · optional step, skip anytime with standard results` | — | |
| 506 | `· limited market data for this role - skill recommendations may be less reliable` | ✎ להחליף את ה-`-` ב-`—` | מקף ASCII כמפריד משפט מול `·` בשורה מעליה |
| 514 | `Recommendation Balance` | — | שם-מוצר |
| 516-519 | פסקת ההסבר | ✎ להוסיף משפט על `Balanced` ו-`Custom` | **מסבירה 3 מתוך 4 הכפתורים** שהמשתמש רואה |
| 545, 549 | `Remember this balance for next time` / `Restore saved balance` | — | |
| 574 | `Total: {n}%` | — | |
| **581** | `Focus Skills` | ✎ `Dynamic Skills` | **איחוד מינוח** — זה אותו מאגר |
| 583-584 | `Top skills extracted from this job posting (up to 10). Pick 5 to focus on…` | ✎ `(up to 10)` → אינטרפולציה מ-`SKILL_POOL_SIZE` | מספר קשיח שיסטה אם הקבוע ישתנה |
| 589 | `Loading skills…` | — | |
| 609 | `No dynamic skills available for this posting.` | ✎ `No Dynamic Skills available for this posting.` | אחרי איחוד המינוח |
| 618 | `Personalized recommendations are coming soon. You can continue with standard results for now.` | — | |
| 628, 648 | `Back to upload` | ✎ `← Back to upload` | אחידות עם 489 |
| 635, 663 | `Analyzing…` / `Continue to standard results` / `Skip and use standard results` | — | |
| **655** | `Submitting…` / `Analyse with preferences` | ✎ `Analyze with preferences` | 🐛 **GB** |

**ממצא רוחבי:** ארבעה שמות למצב טעינה אחד — `Analyzing…`, `Submitting…`, `Loading skills…`,
`Searching...`. מבחינת המשתמש זו אותה המתנה.

### ב.5 Results / Dashboard — `pages/SkillsMatchDashboard.tsx`

_(שורות 233-472 הן `MOCK_DATA` מאחורי `import.meta.env.DEV` — מחוץ להגהה, M02 מוחקת)_

| שורה | הטקסט היום | מוצע | סיבה |
|---|---|---|---|
| 108 | `Excellent` / `Good` / `Poor` / `-` | — | תוויות; המפתחות `strong`/`moderate`/`weak`/`none` 🔒 |
| 156, 165 | `Strengths` / `Missing elements` | — | |
| 173 | `Improve this skill →` | — | |
| 191 | `Gap Analysis` | — | שם-מוצר ✓ |
| 197-200 | `Skill` / `Required` / `In your CV` / `Gap` | — | |
| 212 | `Role core` | ✎ `Core Skill` | **איחוד מינוח** |
| 213 | `Job posting` | ✎ `Dynamic Skill` | **איחוד מינוח** — מקור הסקיל, לא סוגו |
| 216 | `✗ Not found` | — | |
| 227 | `Each requirement compared against what the analysis actually found in your CV.` | — | **צעד 8 יעלה אותה ליד הכותרת** |
| 513 | `Invalid results data` | ✎ `We could not load these results. Please analyze again.` | ז'רגון |
| 588 | `← Back` | — | |
| 670 | `Overall match` | ✎ `Match Score` | **שם-מוצר** — היום המסך לא אומר את שם המדד המרכזי אף פעם |
| 672 | `CV-only analysis (5 skills)` | — | |
| 677 | `Scores were computed with keyword matching because the AI service was unavailable` | — | טובה ומדויקת |
| 680 | `Estimated score (AI unavailable)` | — | **צעד 9 יגדיל אותה מ-11px** |
| 691-692 | `Your CV matches {jobTitle} requirements based on {n} analyzed skills.` | — | |
| 703, 723 | `Better match in your library` / `Switch to this CV` | — | |
| 733, 759 | `Core Skills` / `Dynamic Skills` | — | ✅ **זה המקור הקנוני** |
| 751 | `Based on continuously scraped job market data for this role.` | — | |
| **767** | `← personalize` | ✎ `← Personalize` | אות קטנה חריגה |
| 786 | `Extracted from the job description you provided.` | — | |
| 799, 805 | `← Back to upload` / `Improve your CV →` | — | |

### ב.6 Improve — `pages/ImproveCVScreen.tsx`

_(שורות 114-229 ו-296-314 הן mock מאחורי DEV — מחוץ להגהה)_

| שורה | הטקסט היום | מוצע | סיבה |
|---|---|---|---|
| 105-109 | `No knowledge` / `Beginner` / `Intermediate` / `Proficient` / `Expert` | — | תוויות; המפתחות 🔒 |
| 638 | `Merge failed` | ✎ `Could not merge your changes. Please try again.` | משפט מלא |
| 663 | `Job title not found - please analyze a CV first.` | ✎ `No role found — please analyze a CV first.` | `job title`→`role`; מקף |
| 666, 672 | `Analysis result not found. Please analyze from the home screen.` | — | כפול, לשמור מסונכרן |
| 678 | `No skills found from prior analysis.` | — | |
| 718 | `Re-analysis failed` | ✎ `Re-analysis failed. Please try again.` | |
| 726 | `Leave the improvement flow? Your progress will be lost.` | — | |
| 737-739 | `Rate your skill levels` / `Skill {n} of {m}` / `Your improved CV is ready` | — | |
| 786, 1094-1095 | `Analyzing your CV…` / `Analyzing your improved CV` / `Scoring skills for the selected role…` | — | |
| 801 | `We found {n} skills to work on. Tell us your actual level for each.` | — | |
| 832, 1035, 1043 | `Continue →` / `← Previous` / `Next →` | — | |
| 854 | `Back to skill levels` | — | |
| 867 | `skip` | ✎ `Skipped` | תג באות קטנה; גם מתאר מצב ולא פעולה |
| 877, 879, 881 | `Score: {n}/10` / `Level:` / `Change` | — | |
| 890 | `{skill} was not found in your CV and you marked "No knowledge". We recommend not adding it.` | — | טובה |
| 892-893 | `Change proficiency` / `Skip this skill` | — | |
| 899-900 | `This skill has been skipped and will not affect your CV.` / `Undo` | — | |
| 907 | `This section is also referenced by: {list}. Changes will be merged into one paragraph at submit.` | — | |
| 943, 954 | `Current section (saved)` / `Original` / `Show original section` | — | |
| 961-963 | `No mention of {skill} found in your CV.` + ` The improvement will be added to your Skills section.` | — | |
| 972-983 | `Rephrased` / `Generating suggestion…` / `Could not generate suggestion.` / `Retry` | — | |
| 998, 1006-1013 | `Rephrase Again` / `Edit` / `Save` / `Saved` | ✎ `Rephrase again` | Sentence case |
| 1047 | `Merging…` / `Submit changes` | — | |
| 1068 | `Review the changes below. You can copy, export, or send it for re-analysis.` | — | |
| 1074-1085 | `Copied!` / `Copy` / `Export` / `Scoring…` / `Re-analyze →` | — | |

### ב.7 Account — `pages/AccountPage.tsx`

| שורה | הטקסט היום | מוצע | סיבה |
|---|---|---|---|
| 53, 70, 86, 100, 121 | `Could not load CVs` / `Could not delete CV` / `Could not update favorite` / `Could not delete plan` / `Could not download improvement` | ✎ להוסיף `Please try again.` לכולן | חמש הודעות בלי מוצא |
| 63, 93 | `Delete this CV from your library?` / `Delete this improvement plan?` | — | |
| 68, 98, 138 | `CV deleted` / `Plan deleted` / `Password changed successfully` | — | |
| 84 | `Added to favorites` / `Removed from favorites` | — | US ✓ |
| 128 | `New passwords do not match` | — | |
| 132 | `New password must be at least 4 characters` | ⚠️ | **4 כאן, 6 בהרשמה** — פער לוגי, M02 |
| 143 | `Password change failed` | ✎ `Password change failed. Please try again.` | |
| 167, 179, 187, 195 | `Sign out` / `CV Library` / `Improvement Plans` / `Security` | — | |
| 201-202 | `My CV Library` / `CVs you've saved while analyzing. Star up to 3 favorites for background job-fit comparisons.` | ✎ להסיר "background job-fit comparisons" | ז'רגון פנימי; ✎ `…to compare them automatically on your next analysis.` |
| **207** | `No CVs saved yet. Upload a CV with "Save to library" enabled.` | ✎ `…with "Save to my CV library" enabled.` | 🐛 **מפנה לתווית שלא קיימת** |
| 228, 269, 277 | `Delete CV` / `Download final CV` / `Delete plan` | — | |
| 245-246 | `Improvement Plans` / `CV improvement sessions based on your analysis results.` | ✎ `Improvement plans based on your analysis results.` | `sessions` הוא מונח פנימי |
| 251 | `No improvement plans yet. Analyze a CV and click "Improve your CV" to get started.` | — | |
| 295-296 | `Change Password` / `Choose a new password for your account.` | — | |
| 300-330 | `Current password` / `New password` / `Confirm new password` | — | |
| 337 | `Saving…` / `Update password` | — | |

### ב.8 Admin — `pages/AdminPage.tsx` + פאנלים

מסך פנימי, לא נצפה ע"י שופט. **עדיפות נמוכה**, למעט תיקון אחד חובה:

| מיקום | הטקסט | מוצע |
|---|---|---|
| **`AdminModelStatusPanel.tsx:46,247,347`** | `'�'`, `'�'`, `'Loading�'` | ✎ 🐛 **מוג'יבייק U+FFFD** — `'—'`, `'—'`, `'Loading…'` |
| `AdminPage.tsx:147,154,233` | `Model Status` / `Analyses` / `Match Score` | — |
| `AdminPipelinePanel.tsx:97,122-124` | `Daily Pipeline` / `Automatic trigger is not configured on this server. Run manually:` | — |

### ב.9 Chrome גלובלי

| מיקום | הטקסט | מוצע | סיבה |
|---|---|---|---|
| `ErrorToast.tsx:28` | `Something went wrong` | — | |
| `ErrorBoundary.tsx:32,37,52` | `Something went wrong` / `An unexpected error occurred. Reloading usually fixes it.` / `Reload` | — | |
| `ErrorContext.tsx:59` | `Something went wrong. Please try again.` | — | ⚠️ **שלושה מקומות עם אותו טקסט** — לשמור מסונכרן |
| `ScanLoader.tsx:4` | `Analyzing your CV…` (aria) | ✎ להשוות ל-38 | ה-aria עם אליפסיס, הנראה בלי |
| `ScanLoader.tsx:38-39` | `Analyzing your CV` / `Scoring skills for the selected role…` | — | |
| `SplashScreen.tsx:105` | `Data-driven skill insights` | — | |
| `ToastContext.tsx:38` | `Dismiss` | — | |
| `FavoriteStarButton.tsx:26-27` | `Add to favorites` / `Remove from favorites` | — | |
| **`HalfCircleGauge.tsx:114`** | `{strength}` → מציג `weak` / `moderate` / `strong` | ✎ למפות ל-`Poor` / `Good` / `Excellent` | 🐛 **המקום היחיד במוצר שבו מפתח enum דולף כטקסט למשתמש** — ועל אותו מסך שבו השורות מציגות `Excellent/Good/Poor` |

---

## סיכום ההגהה

**41 שינויים מוצעים** — מעל טריגר העצירה של 40 שנקבע ב-kickoff, ולכן הם מוצגים לאישור
לפני כל נגיעה בקוד (צעד 3).

| קטגוריה | מספר | דוגמה |
|---|---|---|
| 🐛 **באגים** | 5 | רווח כפול, מוג'יבייק ×3, תווית שלא קיימת, enum שדולף |
| **איחוד מינוח** | 8 | `Global skills`→`Core Skills`, `Focus Skills`→`Dynamic Skills`, `Role core`→`Core Skill` |
| **איות US** | 3 | `Analyse Match`, `Analyse with preferences`, `prioritise` |
| **ז'רגון פנימי** | 7 | `the backend fetches`, `background job-fit comparisons`, `Invalid results data` |
| **הודעות בלי מוצא** | 8 | `Merge failed`, `Could not delete CV` |
| **Capitalization** | 5 | `← personalize`, `skip`, `Rephrase Again` |
| **נגישות** | 1 | ה-aria ב-HomePage:95 לא מכיל את הטקסט הנראה |
| **דיוק** | 4 | `% match`→`% confidence`, `Overall match`→`Match Score` |

**מחוץ להגהה, מדווח:** מינימום סיסמה 4 מול 6 · `SkillBar.tsx` קוד מת עם אוצר מילים רביעי
(לא מיובא בשום מקום — M02 תמחק) · `LoginPage` מבטיח מינימום שהוא לא אוכף.
