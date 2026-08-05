# Kickoff M14 - תיקוני נכונות מוצר

**תאריך:** 2026-07-23 | **בריפינג:** [14-product-correctness-fixes.md](../../14-product-correctness-fixes.md)
(הוא המפרט המלא - 10 ממצאים עם ראיות, מנגנונים ותיקונים) | **סטטוס: ✅ מאושר למימוש (המשתמשת, 2026-07-23)**

## 1. שערי כניסה

| שער | סטטוס |
|---|---|
| תלות M13 | ⚠️ אותה חריגה שאושרה ל-M06 (קבצי קוד tracked; קומיטים מקומיים בלי push) - מאושררת באישור ההתחלה |
| החלטות פתוחות | P1-4 הוכרעה (LLM גם ב-CV-only, 14/07); נותרה שאלת מימוש אחת (mocks - סעיף 7) |

## 2. תחקיר רעננות (2026-07-23)

**כל 10 הממצאים אומתו זו הפעם השלישית** (14/07 ביקורת → 20/07 אחרי המיזוג → היום אחרי
קומיטי M06): 6 אזכורי Mock ב-App.tsx · `rawText` נעדר · scoring.service:169 מחזיר raw ·
2 אתרי `keywordOnly: cvOnlyMode` · אפס resolve ב-/personalized · אפס פילטר isFavorite ·
personalize.routes:54 בלי headerText · 5 alerts · אפס AbortController. הקומיטים מאז
20/07 - ds בלבד; אפס דריפט בקבצי היעד.

**סביבה - שינוי לטובה:** פורט 3000 פנוי (האפליקציה הזרה ירדה), `backend/.env` עם מפתח
OpenAI, Mongo למעלה → **אימות full-stack + Playwright אפשרי הפעם**, כולל הצעד שנדחה ב-M04.

## 3. תוכנית מימוש

סדר: P0 → P1 → P2, קומיט-לתיקון, אימות לפני התקדמות. עשרת התיקונים כמפורט בבריפינג, עם
הכרעות המימוש הבאות:

1. **P0-1 mocks** - לפי הכרעת שאלה 1 (מחיקה/גידור DEV).
2. **P0-2 rawText** - הוספת `rawText` ל-`processUpload` ול-`CvFile` (שדה אופציונלי -
   backward compatible); ה-Improve/export ניזונים ממנו; **fallback לקו"ח ישנים** שנשמרו
   בלי rawText: ממשיכים על cvText המנורמל (לא שוברים היסטוריה). אימות Playwright:
   upload→improve→export והקובץ קריא עם רישיות ופיסוק.
3. **P1-3 LLM→fallback** - החלפת שורה 169 ב-keyword fallback + חילוץ `{...}` מ-fences
   ב-parseJson לפני קריאת-תיקון. אימות: הזרקת תשובה עטופת-fence בטסט ידני.
4. **P1-4 CV-only LLM** (הוכרע 14/07) - הסרת `keywordOnly: cvOnlyMode` משלושת המסלולים;
   cvOnlyMode נשאר לספירת 5/10. אימות: ציוני CV-only לא-עגולים + סקיל קצר (Go) > 0.
5. **P1-5 URL ב-personalized** - חילוץ resolve למודול משותף + קריאה בשלושת המסלולים.
   אימות Playwright: קישור→Customize→Analyse.
6. **P1-6 מועדפים** - פילטר `isFavorite: { $ne: true }` + ValidationError כשאין מה לפנות.
   אימות: סקריפט על Mongo מקומי.
7. **P2-7 English-only** - בדיקת יחס-לטינית על raw ב-processUpload → 400 ברור. אימות:
   שני קבצי העברית מ-M04 נדחים יפה.
8. **P2-8 role-mismatch** - `/personalize/options` מחזיר את ה-canonicalTitle שהתקבל
   (מחיקת הזיהוי-מחדש). אימות Playwright: אותו תפקיד בשני המסכים.
9. **P2-9 alerts→toast** - חמשת ה-alerts ל-ToastContext/ErrorContext הקיימים + empty-state.
10. **P2-10 timeouts** - עטיפת fetch עם `AbortSignal.timeout` (90s ל-LLM, 20s לשאר) +
    מיפוי TypeError להודעה אנושית; ErrorBoundary מציג משפט קבוע.

**חיווט limited_data מ-M06** (החוט שנשאר): badge קטן ב-Personalization/Results כשהשדה
true - נכנס כאן כתיקון 11 (קטן, משלים את D של M06).
**Out of scope:** Gap Analysis (M15), ניסוחים (M03 תלטש), push.

## 4. סיכונים

| סיכון | מיטיגציה |
|---|---|
| רגרסיה בזרימת הניתוח (P1-3/4/5 נוגעים בליבה) | קומיט-לתיקון + Playwright E2E אחרי כל אחד; revert נקודתי זמין |
| סכמת CvFile משתנה (rawText) | שדה אופציונלי בלבד; קו"ח ישנים ממשיכים לעבוד ב-fallback |
| עלות LLM עולה (CV-only) | הוכרע מודעת ב-14/07; ה-keyword נשאר כ-fallback לכשל |
| מחיקת mocks תשבור flow פיתוח | הכרעת שאלה 1; ה-git history שומר אותם בכל מקרה |

## 5. שאלות

1. **גורל ה-mocks (P0-1):** מחיקה מלאה (מומלץ לקוד מוגש) או גידור `import.meta.env.DEV`
   (נעלמים מה-build, נשארים לפיתוח)?

## תשובות והכרעות (המשתמשת, 2026-07-23)

1. ✅ **mocks: גידור DEV** - שלושת ה-routes ובלוקי ה-MOCK_* נעטפים ב-`import.meta.env.DEV`
   (נעלמים לחלוטין מ-build הפרודקשן דרך tree-shaking, נשארים זמינים ב-`npm run dev`
   ל-QA ידני). אימות: `npm run build` + חיפוש בקבצי ה-dist ש-MOCK_DATA ו-MockHub אינם;
   Playwright על ה-preview build: `/mock` → NotFound.

---

## דוח ביצוע (2026-07-23/27) - הושלם: 11/11 תיקונים, אומתו על stack חי

**10 קומיטים מקומיים** (bb6bb8b→e05ba42, בלי push):
| תיקון | קומיט | אימות |
|---|---|---|
| P0-1 mocks→DEV | bb6bb8b | build פרודקשן נסרק - אפס עקבות mock |
| P0-2 rawText | d04ee85 | **חי:** upload מחזיר rawText עם רישיות+שורות; מסך Improve מציג "SKILLS Python, Django..." מפוצל-סקשנים; הטקסט המרוסק איננו |
| P1-3 LLM→fallback | 658c472 | code-review + fence-extraction ב-parseJson |
| P1-4 CV-only LLM | d2a2b35 | **חי:** isEstimated=False, ציונים שיפוטיים (postgresql 8, react 0) |
| P1-5 URL ב-personalized | d2a2b35 | resolver משותף בשלושת המסלולים |
| P1-6 מועדפים | dbd534b | פילטר isFavorite + שגיאה אקציונבילית |
| P2-7 English-only | 408d48f | **חי:** שני קבצי העברית של M04 נדחים עם ההודעה הברורה |
| P2-8 role-mismatch | f16a666 | **חי:** options מחזיר בדיוק את ה-canonicalTitle שנשלח |
| P2-9 alerts→toast | e4198df | אפס alert() בקוד |
| P2-10 timeouts | 60190a7 | ceiling 90s/20s; משפחת cv-improve הומרה מ-fetch גולמי ל-apiFetch (בונוס: קיבלה גם error/auth handling) |
| 14.11 limited_data | e05ba42 | **חי:** TPM→roleDataLimited:true, SE→false; הערה ב-UI |

**ממצאי-לוואי מהאימות:** (1) `backend/.env` מכיל PORT=3001 בעוד ה-Vite proxy מצפה ל-3000
(שריד מתקופת הפורט התפוס) - ה-stack הורם עם override; **ליישר ב-M11** (env או proxy).
(2) ה-frontend רץ על 8080, לא 5173. (3) אינטגרציה מוצלבת נצפתה חיה: רשימת הסקילז
ב-CV-only היא כבר ה-top-5 המתוקן של M06.

**סטטוס סביבה:** ה-stack נשאר רץ (DS:8000, backend:3000-override, frontend:8080) -
זמין לבדיקה ידנית שלך.
