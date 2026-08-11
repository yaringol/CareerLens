# משימה 14: תיקוני נכונות מוצר - הבאגים שהשופט ייתקל בהם

> בריפינג לאייג'נט עצמאי. תלוי במשימה 13. **זו המשימה היחידה שמותר לה לשנות התנהגות**
> (משימות 02 ו-03 אוסרות זאת במפורש — לכן הבאגים האלה נפלו בין הכיסאות).
> כללי הברזל מ-[00-MASTER-PLAN.md](00-MASTER-PLAN.md) מחייבים.

## מטרה

לסגור באגים אמיתיים שכל אחד מהם נראה לשופט או פוגע בנתונים. **כל הממצאים אומתו ידנית
ב-2026-07-14 מול הקוד הנוכחי** (אחרי היישור מול main) — הם פתוחים, לא היסטוריים.

עבוד לפי סדר העדיפות. כל תיקון = קומיט נפרד + אימות עצמאי ב-Playwright MCP.

---

## P0-1: מסכי Mock חיים ב-router של הפרודקשן

**ראיה:** [App.tsx:15-17](../../frontend/src/App.tsx#L15-L17) מייבא `PersonalizationMock`,
`MockUploadScreen`, `MockHub`; שורות 65-88 רושמות אותם כ-routes אמיתיים תחת `RequireAuth`:
`/personalize-mock`, `/upload-mock`, `/mock`. בנוסף, **בתוך המסכים האמיתיים**:
`SkillsMatchDashboard.tsx` מכיל טבלת `MOCK_DATA` (~240 שורות) שנדלקת עם `?mock=`, ו-
`ImproveCVScreen.tsx` מכיל `MOCK_CV_DEVOPS`/`MOCK_CV_DS` (אנשים בדויים "John Smith") שנדלקים
עם `?mock=devops`.

**למה זה P0:** שופט שנוחת ב-URL עם `?mock=` יראה ציון 8.5/10 **מפוברק** לקו"ח שמעולם לא
נותח. `MockHub` אפילו מציג badge "QA · Mock" וכיתוב שמסביר שזה "the live 501 fallback".

**תיקון:** למחוק את שלושת עמודי ה-Mock + ה-Routes, ולהסיר את בלוקי `MOCK_*` ואת ענפי
`params.get('mock')`/`?phase=` מהמסכים האמיתיים. (חלופה אם רוצים לשמור לפיתוח: לגדר הכל
מאחורי `import.meta.env.DEV` כך שייעלם מה-build — אבל **מחיקה עדיפה** לקוד מוגש.)

## P0-2: הקו"ח המשופר מיוצא כטקסט lowercase בלי פיסוק

**ראיה:** [cv.service.ts:5-11](../../backend/src/services/cv.service.ts#L5-L11):
```ts
function normalizeCvText(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/[\n\r\t]/g, ' ');      // ← מוחק כל ירידת שורה
  t = t.replace(/[^a-z0-9\s]/g, ' ');   // ← מוחק כל פיסוק, @, נקודות
  ...
}
```
זה מה שמוחזר ללקוח, **וזה מה שנשמר ב-`CvFile.cvText`**. מכיוון שאין ירידות שורה,
`cvImprove.service.ts:107` (שמפצל sections על `/\n\s*\n+/`) מקבל את **כל הקו"ח כ-section אחד**.

**למה זה P0:** זהו השלב הסוגר של הדמו. השופט לוחץ "Improve your CV" → Export, ומקבל פסקה
אחת ארוכה, כולה אותיות קטנות, עם כתובת מייל שבורה — מוצגת כ"קורות החיים המשופרים שלך".
האפיון מבטיח במפורש "an improved version optimized to pass ATS" — הקובץ הזה ייפסל בכל ATS.

**תיקון:** להחזיר ולשמור את הטקסט הגולמי לצד המנורמל:
`processUpload → { rawText, cvText, headerText }`, להוסיף `rawText` ל-`CvFile`, ולהזין
**ממנו** את `/cv-improve/prepare`, את מסך Improve ואת הייצוא. `normalizeCvText` נשאר רק
במסלולי הניקוד/keyword שנבנו סביבו. שים לב לקו"ח שכבר שמורים ב-DB (בלי `rawText`) — fallback.

## P1-3: תגובת LLM פגומה מפילה את כל הניתוח ב-500

**ראיה:** [scoring.service.ts:167-169](../../backend/src/services/scoring.service.ts#L167-L169) —
כש-`normalizeLlmScoringJson` זורק (כלומר ה-JSON לא נפרס), הקוד מחזיר
`{ rawAgentOutput: raw, isEstimated: false }` — כלומר **מעביר את המחרוזת הלא-תקינה הלאה**,
במקום ליפול ל-keyword fallback שקיים בדיוק בשביל זה (בענף ה-catch החיצוני). התוצאה:
`parseAndSaveAnalysis` נשבר → 500 → toast "Agent response is not valid JSON".

gpt-4o-mini עוטף JSON ב-```` ```json ```` באופן קבוע, במיוחד תחת עומס.

**תיקון:** להחליף את השורה ב-`buildKeywordFallbackJson(validatedSkills, cvText)` עם
`isEstimated: true`. בנוסף: ב-[parseJson.ts:13-25](../../backend/src/infra/llm/parseJson.ts#L13-L25)
לנסות `raw.match(/\{[\s\S]*\}/)` **לפני** שמבזבזים קריאת LLM שנייה לתיקון ה-JSON.

## P1-4: מצב CV-only לא קורא ל-LLM בכלל

**ראיה:** ה-tab "CV only" ב-Upload שולח `skipGibberish: true` → הבקאנד ממפה אותו ל-
`keywordOnly: cvOnlyMode` ([analyze.routes.ts:274](../../backend/src/routes/analyze.routes.ts#L274),
וגם 563 במסלול ה-personalized) → [scoring.service.ts:146](../../backend/src/services/scoring.service.ts#L146)
`if (keywordOnly) return buildKeywordFallbackJson(...)` — **ה-LLM לא נקרא**.
הניקוד בפועל הוא `overlapScoreForSkill`: `cv.includes(token)` על טוקנים באורך > 2 בלבד —
כלומר `Go`, `R`, `C` **תמיד מקבלים 0**, לכמה מ-59 התפקידים.

**למה זה חשוב:** שופט ישאל "איך ניקדתם?" והתשובה במסלול הזה היא "ספרנו substrings" —
בפרויקט שכל טענתו היא pipeline של אגנטי LLM.

**✅ הוחלט (המשתמש, 2026-07-14): אופציה (א) — להריץ את ה-LLM גם ב-CV-only.**
להסיר `keywordOnly: cvOnlyMode` משלושת מסלולי הקריאה (`/analyze`, `/rescore`,
`/analyze/personalized`); `cvOnlyMode` נשאר אך ורק לקביעת ספירת הסקילז (5 מול 10).
ה-keyword scorer נשאר כ-fallback לכשל LLM בלבד. לאמת: ניתוח CV-only מחזיר ציונים
לא-עגולים-חשודים, וסקיל קצר (Go/R/C#) שמופיע בקו"ח מקבל ציון > 0.

## P1-5: קישור משרה שובר את מסלול ה-Personalization

**ראיה:** `resolveJobDescriptionInput` מוגדר ונקרא ב-`POST /api/analyze`
([analyze.routes.ts:166,209](../../backend/src/routes/analyze.routes.ts#L166)) וב-
`POST /api/personalize/options` ([personalize.routes.ts:18,63](../../backend/src/routes/personalize.routes.ts#L18)) —
אבל **לא** ב-`POST /api/analyze/personalized`. שם ה-JD הגולמי (שהוא URL) נבדק ישירות ע"י
`isGibberish` ונופל.

**המסלול שנשבר:** מדביקים קישור למשרה → "Customize recommendations" → המסך נטען נכון
(ה-endpoint הזה כן מפענח) → "Analyse with preferences" → שגיאה "The job description does
not look like readable English".

**תיקון:** להוציא את `resolveJobDescriptionInput` למודול משותף ולקרוא לו בשלושת המקומות.

## P1-6: העלאת CV מספר 11 מוחקת CV שסומן בכוכב

**ראיה:** [compareSaved.service.ts:254-268](../../backend/src/services/compareSaved.service.ts#L254-L268) —
`enforceSavedCvLimit` מוחק את הישן ביותר לפי `uploadedAt` **בלי לסנן `isFavorite`**.
זה נקרא בכל `POST /api/upload` ששומר.

**התוצאה:** אובדן דאטה בלי אזהרה ובלי undo, וכיבוי שקט של פיצ'ר ההשוואה (אין מועמדים →
`bestSavedCv: null` → הבאנר פשוט מפסיק להופיע). בדמו שבו מעלים כמה קו"ח ברצף — זה קורה.

**תיקון:** `CvFile.find({ userId, isFavorite: { $ne: true } })`, ואם לא נשאר מה למחוק —
לזרוק ValidationError ברורה במקום למחוק מועדף.

## P2-7: אין אכיפת English-only על ה-CV

**ראיה:** `isGibberish` מופעל על ה-JD בלבד (3 מקומות). על ה-CV — כלום.
`normalizeCvText` מוחק כל תו לא-לטיני, כך שקו"ח בעברית שורד רק דרך שברי הלטינית שלו
(מיילים, "Python", מספרים) — ואז מנוקד כאילו היה קו"ח באנגלית.

**למה זה חשוב:** השופטים ישראלים. קו"ח בעברית הוא הדבר הכי סביר שינסו מחוץ לתסריט.
האפיון מצהיר במפורש "English-language CVs only" — אז הכשל צריך להיות **מכוון ומנוסח**,
לא שקט.

**תיקון:** בדיקת יחס תווים לטיניים על הטקסט **הגולמי** (לפני הנרמול) ב-`processUpload`,
והחזרת 400 ברורה: "CareerLens analyzes English CVs only. Please upload an English version."
לתאם עם משימה 04 שתפיק קו"ח בעברית לבדיקה.

## P2-8: באג ה-role-mismatch (מ-QA 2026-07-03) — עדיין פתוח

**ראיה:** [personalize.routes.ts:54](../../backend/src/routes/personalize.routes.ts#L54):
`extractTitleFromCv(cvText)` — **בלי `headerText`**, בעוד ש-endpoint האח עושה זאת נכון
([cv.routes.ts:155](../../backend/src/routes/cv.routes.ts#L155)). ואז התפקיד שזוהה-מחדש
(ופחות טוב) **מועדף** על ה-`canonicalTitle` שכבר אושר.

**התוצאה על המסך:** Upload אומר "Software Engineer 92%", והמסך הבא אומר "Detected role:
Backend Developer". הניקוד לא נפגע (הוא משתמש ב-`canonicalTitle`), אבל זה **בדיוק המסך
שהמנחה ביקש לשפר**, ורגע לפני שהשופטים רואים תוצאה. יש על זה צילום מסך בריפו:
`rx-02-BUG-personalize-role-mismatch-backend-developer.png`.

**תיקון (הזול והנכון):** למחוק את הזיהוי-מחדש ב-`/personalize/options` ולהחזיר את
`canonicalTitle` שהגיע מהקורא — הוא כבר אושר במסך הקודם.

## P2-9: 5 קריאות `alert()` נייטיב במסך Improve

**ראיה:** [ImproveCVScreen.tsx:640,643,649,655,695](../../frontend/src/pages/ImproveCVScreen.tsx#L640) —
והאחרונה (695) מדפיסה **הודעת שגיאה גולמית** (`err.message`) בתוך דיאלוג של הדפדפן
("localhost:5173 says…"), בתוך ה-catch של `handleReanalyze` — הכפתור שמייצר את הציון המשופר.

**תיקון:** להשתמש ב-`ToastContext`/`ErrorContext` שכבר קיימים ומשמשים בכל שאר המסכים.
שלושת מקרי ה-guard (אין title / אין תוצאה / אין סקילז) → empty-state עם כפתור חזרה.

## P2-10: אין timeout/abort בשכבת ה-API + ErrorBoundary חושף שגיאה גולמית

**ראיה:** [api.ts](../../frontend/src/services/api.ts) — 796 שורות, אפס `AbortController`,
אפס `signal:`, אפס timeout. `fetch` לא עטוף ב-try/catch, כך ש-`TypeError: Failed to fetch`
מגיע כלשונו ל-toast. בנוסף `ErrorBoundary.tsx:30-32` מרנדר `{this.state.error.message}`
במסך מלא.

**תיקון:** helper שעוטף `fetch` עם `AbortSignal.timeout()` (נדיב — 90s למסלולי LLM) ועם
try/catch שממפה כשל רשת להודעה אנושית. ב-ErrorBoundary: משפט קבוע למשתמש, והשגיאה ל-console.

---

## הגדרת Done

- [ ] כל 10 הפריטים: תוקנו-ואומתו, או נדחו במפורש עם החלטת משתמש מתועדת.
- [ ] `grep -rn "alert(" frontend/src` → 0 | `grep -rn "MOCK_" frontend/src/pages` → 0.
- [ ] `npx tsc --noEmit` (backend) + `npm run build` (frontend) עוברים.
- [ ] אימות E2E ב-Playwright: (1) העלאת PDF → Improve → Export → **הקובץ קריא, עם פיסוק
      ואותיות גדולות**; (2) קישור משרה → Customize → Analyse → עובד; (3) Upload ו-Personalize
      מציגים את **אותו** תפקיד; (4) `/mock` מחזיר 404.
- [ ] דיווח סיום עם לפני/אחרי לכל פריט.

## גבולות

- לא לגעת בדירוג הסקילז / בטרנד / במודלים — זו משימה 06.
- לא לבנות את מסך ה-Gap Analysis — זו משימה 15.
- שינויי **ניסוח** של טקסטים נשארים במשימה 03; כאן משנים **מנגנון** (alert→toast) ומוסיפים
  הודעות חדשות שנדרשות לתיקון. לתאם: אם 03 כבר רצה, לשמור על הניסוחים שנקבעו שם.
