# Kickoff M15 - Gap Analysis / Skill Deep-Dive

**תאריך:** 2026-07-27 | **בריפינג:** [15-gap-analysis-feature.md](../../15-gap-analysis-feature.md)
| **סטטוס: ✅ מאושר למימוש (המשתמשת, 2026-07-27)**

## 1. שערי כניסה

| שער | סטטוס |
|---|---|
| תלות M13 | אותה חריגה מאושרת של M06/M14 (קומיטים מקומיים, בלי push) |
| תלות M14 (P1-3) | ☑ הושלמה 27/07 - מסלול ה-fallback של הניקוד מוקשח |
| החלטת לבנות/לחתוך | ☑ הוכרעה 14/07: **לבנות** |
| סביבה | ה-stack עוד רץ מאימות M14 (DS:8000, backend:3000, frontend:8080) - אימות חי זמין מיידית |

## 2. רקע - מצב הקוד היום (תחקיר 2026-07-27)

**שרשרת הניקוד מקצה לקצה:**
1. [scoring.agent.ts:20-26](../../../../backend/src/agents/scoring.agent.ts#L20-L26) -
   ה-prompt מבקש `{skill, score}` בלבד. ✓ כמתועד.
2. [scoring.service.ts:64-119](../../../../backend/src/services/scoring.service.ts#L64-L119) -
   `normalizeLlmScoringJson` בונה מחדש את ה-JSON ושומרת **רק** `{skill, score}` (שורה 104) -
   כלומר גם אם ה-LLM יחזיר שדות נוספים, **הצינור הקיים מוחק אותם באופן אקטיבי**.
3. [cvAnalysis.dal.ts:31-56](../../../../backend/src/dal/cvAnalysis.dal.ts#L31-L56) -
   `parseAgentResponse` מוודא string/number, לא זורק על שדות נוספים ✓; אבל
   `parseAndSaveAnalysis` (שורה 90) ו-`parseSkillScoresFromRaw` (שורה 79) ממפים רק skill+score.
4. [cvAnalysis.model.ts:23-26](../../../../backend/src/models/cvAnalysis.model.ts#L23-L26) -
   `SkillScoreSchema = {skill, score}`. ✓ כמתועד.
5. **ארבעה** מסלולי response ממפים scores: `/analyze` (:280), `/rescore` (:357),
   `/skillner` (:425), `/analyze/personalized` (:571) - הבריפינג לא מנה אותם.
   בנוסף `compareSaved.service` ניזון מ-`scoreCvMatchOnly`→`parseSkillScoresFromRaw`,
   ודרכו `bestSavedCv.skills` (כפתור "Switch to this CV" בדשבורד).
6. [SkillsMatchDashboard.tsx](../../../../frontend/src/pages/SkillsMatchDashboard.tsx) -
   `SkillRow` הוא פס-ציון + badge, שום אינטראקציה ✓. mocks כבר בגידור DEV (M14).

### מתועד מול מצוי

| טענת הבריפינג | מצוי |
|---|---|
| הפער = "שדה אחד ב-prompt ופאנל UI" | **אופטימי מדי.** נדרשים גם: העברת השדות דרך normalize (שמוחקת אותם), DAL, סכמה, 4 מסלולי response, וטיפוס ה-frontend |
| "כפתור Improve this skill - החיבור כבר קיים" | **לא קיים.** מסך Improve בוחר אוטומטית את 5 החלשים ([ImproveCVScreen.tsx:331-333](../../../../frontend/src/pages/ImproveCVScreen.tsx#L331-L333)); אין שום מנגנון preselect של סקיל בודד |
| cvImprove מחשב `found` + ציטוט | ✓ (שורות 20, 215) - אבל לא נשתמש בו; ה-evidence יגיע מסוכן הניקוד עצמו |
| - | **ממצא חדש (חוסם):** [llmCall.ts:8](../../../../backend/src/infra/llm/llmCall.ts#L8) - `OPENAI_MAX_TOKENS=500` גלובלי לכל הסוכנים. evidence+missing ל-10 סקילז ≈ 600-900 tokens → **ה-JSON ייחתך באמצע, ייכשל parse, וייפול ל-keyword fallback** - הפיצ'ר ימות בשקט. חובה override פר-קריאה |
| - | ממצא חדש: `normalizeLlmScoringJson` עושה `JSON.parse` ישיר - בלי חילוץ JSON-מוטבע (התיקון של M14 ב-parseJson.ts שייך לסוכן אחר). פלט ארוך יותר מעלה סיכון fences |

## 3. הבעיה והפתרון

**הבעיה:** האפיון מבטיח (שורות 87, 124, 153, 187-189 + mockup `image3.png`) טבלת Gap
Analysis, semantic feedback מסוכן הניקוד, ומסך Skill Deep-Dive עם Strengths / Missing
Elements / Agent Feedback. כלום מזה לא קיים. המנחה יקרא את הספר עם האפיון פתוח לידו.

**הפתרון (הוכרע 14/07 - לבנות):** אותה קריאת LLM אחת מחזירה לכל סקיל גם `evidence`
(מה נמצא בקו"ח) ו-`missing` (מה חסר); הדשבורד מקבל פאנל deep-dive פר-סקיל וטבלת Gap.
ה-mockup הוא ייחוס פונקציונלי - לא מעתיקים אותו, מספקים את אותה פונקציה בשפת העיצוב
הנוכחית (glassmorphism, כרטיסים).

**חלופות שנדחו:** קריאת LLM שנייה פר-סקיל (עלות/זמן דמו - אסור לפי הבריפינג); שימוש
ב-`found`+ציטוט של cvImprove (keyword-בסיסי, לא סמנטי, וממוקם במסך אחר).

## 4. תוכנית מימוש

סדר: backend מלמטה למעלה (כל צעד commit נפרד), ואז frontend, ואז E2E. אפשר לעצור בבטחה
אחרי כל צעד - השדות אופציונליים בכל שכבה.

1. **llmCall - override פר-קריאה:** פרמטר שלישי אופציונלי `opts?: { maxTokens?, timeoutMs? }`
   עם ברירות המחדל הקיימות. אפס שינוי לארבעת הסוכנים האחרים.
   *אימות:* קומפילציה + קריאת ניקוד רגילה עובדת.
2. **scoring.agent - prompt מורחב:** כל שורת סקיל מקבלת
   `"evidence": "<מה נמצא, ≤18 מילים, '' אם אין>"`, `"missing": "<מה חסר לציון גבוה, ≤18 מילים, '' אם מלא>"`;
   הקריאה עוברת `maxTokens: 1600, timeoutMs: 30000`.
   *אימות:* קריאה חיה מול ה-stack הרץ - JSON שלם, לא נחתך.
3. **scoring.service - העברת השדות:** `normalizeLlmScoringJson` שומרת ב-pool את השורה
   המלאה ומחזירה `{skill, score, evidence?, missing?}`; לוגיקת הציון (התאמה, clamp,
   uniform-detection) **לא משתנה בפסיק**. `buildKeywordFallbackJson` מחזיר
   `evidence: '', missing: ''` (שומר אחידות טיפוסים). לפני כישלון parse - ניסיון חילוץ
   JSON-מוטבע (אותו דפוס מ-M14).
   *אימות:* סקריפט קצר משווה matchScore לפני/אחרי על אותו raw - זהה.
4. **DAL + סכמה:** `SkillScore` מקבל `evidence?: string, missing?: string`;
   `parseAndSaveAnalysis` + `parseSkillScoresFromRaw` ממפים אותם (דרך זה גם
   `bestSavedCv.skills` מקבל אותם בחינם).
   *אימות:* ניתוח חדש נשמר במונגו עם השדות; מסמך ישן נטען בלי שגיאה.
5. **4 מסלולי response:** הוספת `evidence`/`missing` למיפוי skills ב-`/analyze`,
   `/rescore`, `/skillner`, `/personalized`.
   *אימות:* curl לכל מסלול.
6. **frontend - טיפוס:** `AnalyzeResponse.skills` מקבל `evidence?`, `missing?` ב-api.ts.
7. **frontend - פאנל Deep-Dive:** שורת סקיל הופכת לחיצה (accordion נפתח מתחתיה):
   ✅ Strengths (evidence) · ⚠️ Missing Elements (missing) · כפתור "Improve this skill".
   כשהשדות ריקים/חסרים (ניתוח ישן, fallback) - השורה פשוט לא לחיצה (degradation שקט).
   שפת עיצוב קיימת: score-card, `[data-tooltip]`, משתני ה-CSS הקיימים.
8. **frontend - טבלת Gap:** כרטיס נוסף מתחת לכרטיסי הסקילז -
   `Skill | Required | In your CV | Gap` (הרכב מדויק לפי שאלה 2).
   זה הצילום שנכנס לפלייר ולספר (M08/M09).
9. **Improve this skill** - לפי שאלה 3.
10. **E2E (Playwright על ה-stack הרץ):** ניתוח אמיתי → לחיצה על סקיל חלש → פאנל עם טקסט
    LLM אמיתי → צילום מסך ל-`outputs/`; בדיקת ניתוח-ישן (sessionStorage בלי השדות) לא שובר.

**Out of scope:** שינוי חישוב ה-Match Score; עיצוב-מחדש של Improve; קריאת LLM נוספת;
trend UI; push.

## 5. סיכונים ומיטיגציות

| סיכון | תרחיש | מיטיגציה |
|---|---|---|
| **חיתוך פלט LLM** | JSON נקטע → parse נכשל → fallback משוערך, הפאנל ריק | maxTokens=1600 + הגבלת ≤18 מילים בפרומפט + חילוץ JSON-מוטבע; במקרה הגרוע - בדיוק התנהגות היום (fallback מסומן Estimated), אין רגרסיה |
| רגרסיה בציונים | שינוי בנרמול משנה matchScore | צעד 3 לא נוגע בלוגיקת הציון; אימות השוואתי מפורש לפני commit |
| ניתוחים ישנים | סשן ישן / מונגו ישן בלי השדות → מסך נשבר | שדות אופציונליים בכל שכבה + degradation שקט ב-UI (צעד 7); בדיקה מפורשת ב-E2E |
| uniform-scores | ה-LLM מחזיר ציון אחיד → הכל מוחלף ב-keyword fallback → הטקסטים אובדים | מקרה נדיר שמסומן ממילא; מתועד כמגבלה, לא מסבכים |
| דמו חצי-גמור | הפיצ'ר באמצע ביום שיפוט | כל צעד additive ו-commitable בנפרד; בלי השדות ה-UI פשוט לא מציג פאנל - המסך הקיים שלם בכל נקודה |
| התנפחות סקופ | "עוד שדה", "עוד ויזואליזציה", redesign ל-Improve | הטריגר לעצור: כל דבר שלא Strengths/Missing/טבלה/כפתור - חוזרים למשתמשת |
| עלות/זמן | פלט גדול פי ~4 לקריאת ניקוד | עדיין קריאה אחת ב-gpt-4o-mini (אגורות); timeout 30s בתוך תקציב ה-90s של ה-frontend |

## 6. החלטות

**שכבר נלקחו:** לבנות ולא לחתוך (המשתמשת, 14/07) · קריאת LLM אחת (בריפינג, סעיף גבולות)
· שפת עיצוב קיימת ולא העתקת ה-mockup (בריפינג).

**שהסקיל לוקח עכשיו:** override של maxTokens פר-קריאה במקום העלאת הגלובלי (לא לשנות
התנהגות 4 סוכנים אחרים) · evidence מסוכן הניקוד ולא מ-cvImprove (סמנטי, באותה קריאה)
· accordion inline ולא מסך נפרד כמו ה-mockup (פחות ניווט, נשאר בשפת הדשבורד; ראו שאלה 1)
· fallback מחזיר מחרוזות ריקות ולא טקסט גנרי מזויף ("No AI analysis available" מזויף
נראה רע בדמו - עדיף להסתיר את הפאנל).

**פתוחות → שאלות למטה:** צורת הפאנל, הרכב הטבלה, אופי כפתור Improve, למי מציגים פאנל.

## 7. שאלות למשתמשת

1. צורת ה-deep-dive: accordion מתחת לשורה (מומלץ) / modal מרכזי בהשראת ה-mockup?
2. הרכב טבלת ה-Gap: טקסטואלית (עם evidence/missing מקוצרים) / קומפקטית-ויזואלית?
3. "Improve this skill": ניווט פשוט ל-/improve / preselect אמיתי (hint קטן ב-sessionStorage)?
4. פאנל לכל הסקילז או רק לחלשים/בינוניים?

## תשובות והכרעות (המשתמשת, 2026-07-27)

1. ✅ **Accordion מתחת לשורה** - הפאנל נגלל בתוך הכרטיס הקיים, בלי ניווט/modal.
2. ✅ **טבלה טקסטואלית** - `Skill | Required | In your CV | Gap` עם ה-evidence/missing
   המקוצרים בתאים; זה הצילום לפלייר ולספר.
3. ✅ **Preselect אמיתי** - hint ב-sessionStorage; Improve פותח את הטאב של הסקיל
   שנלחץ אם הוא בין 5 החלשים.
4. ✅ **פאנל לכל הסקילז** - גם חזקים מציגים Strengths (עקביות + מימוש הבטחת האפיון).

---

## דוח ביצוע (2026-07-27) - הושלם

**4 קומיטים מקומיים** (91987a5 → 5d1fee5, בלי push):

| צעד | קומיט | אימות |
|---|---|---|
| llmCall override + prompt מורחב | 91987a5 | קריאה חיה - JSON שלם, לא נחתך |
| העברת השדות: normalize/fallback/DAL/סכמה/4 מסלולים | 297fecb | הרנס השוואתי: matchScore זהה (5.4=5.4) על raw ישן/חדש; raw ישן נטען בלי שדות |
| פאנל deep-dive + טבלת Gap + טיפוס frontend | ae45a4b | Playwright חי (למטה) |
| תיקון preselect (handleContinue איפס ל-0) | 5d1fee5 | טאב פעיל = node js (אינדקס 1, לא ברירת מחדל) |

**אימות E2E על stack חי:**
- **API:** ניתוח CV-only אמיתי → evidence מצטט שורות מה-CV מילה במילה
  ("Introduced strict TypeScript across the codebase..."), missing ענייני, ציונים מבחינים
  (9/8/7/5/4), isEstimated=False, נשמר במונגו.
- **UI:** לחיצה על סקיל פותחת accordion עם Strengths (ירוק) / Missing Elements (אדום) /
  כפתור Improve; טבלת Gap מלאה `Skill|Required|In your CV|Gap` מתחת לכרטיסים.
  צילום: [m15-gap-deepdive.png](../m15-gap-deepdive.png) - **זה הצילום לפלייר ולספר.**
- **Degradation:** ניתוח ישן (בלי שדות) → 5 שורות רגילות, אפס chevrons, בלי טבלה, בלי שגיאות.
- **Preselect:** דשבורד → "Improve this skill" על node js → מסך Improve נפתח בטאב node js;
  ה-hint חד-פעמי (נמחק אחרי צריכה).
- **Uniform edge (נצפה חי):** CV שלא נוגע באף סקיל ליבה → כל הציונים 0 → הוחלף
  ב-keyword fallback עם שדות ריקים → ה-UI מסתיר את הפאנל. בדיוק ההתנהגות המתוכננת;
  מתועד כמגבלה ידועה (הטקסטים אובדים במקרה uniform).

**באג שנמצא ותוקן תוך כדי:** `handleContinue` תמיד איפס את הטאב הפעיל ל-0, מה שמחק
את ה-preselect - נתפס בבדיקת Playwright שהבחינה בין ברירת מחדל (אינדקס 0) לבחירה
אמיתית (אינדקס 1), ותוקן עם ref חד-פעמי.

**הגדרת Done מהבריפינג:** החלטה מפורשת ✓ (לבנות, 14/07) · evidence+missing חוזרים ✓ ·
פאנל עובד ✓ · טבלת Gap מוצגת ✓ · קו"ח ישן לא שובר ✓ · אימות Playwright עם טקסט LLM
אמיתי + צילום ב-outputs ✓.

**השלכות למשימות אחרות:** M08/M11 יכולות להניח שהמסך קיים (כולל הצילום המוכן);
M05 מודדת את ההתנהגות אחרי השינוי (ה-prompt המורחב לא שינה את סולם הציונים אבל ראוי
לציין בדוח המדדים שהמדידה בוצעה עם ה-prompt הסופי); M03 מלטשת את הניסוחים החדשים
(Strengths / Missing elements / כותרות הטבלה).
