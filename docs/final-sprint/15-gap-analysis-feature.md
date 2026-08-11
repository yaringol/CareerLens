# משימה 15: Gap Analysis / Skill Deep-Dive - דרישת האפיון שנזנחה

> בריפינג לאייג'נט עצמאי. תלוי במשימות 13 ו-14 (P1-3 — תיקון ה-JSON של סוכן הניקוד).
> **חייבת להיות מוכרעת לפני משימות 08 ו-11** — שתיהן כותבות תסריטים סביב המסך הזה.
> כללי הברזל מ-[00-MASTER-PLAN.md](00-MASTER-PLAN.md) מחייבים.

## מטרה

האפיון המקורי מבטיח שלושה דברים שאינם קיימים בקוד. המנחה יקרא את הספר **עם האפיון פתוח
לידו**. המשימה: לבנות את הפיצ'ר, או להחליט מודעת לחתוך אותו ולהסביר — **לא להשאיר את זה
לגלות בדמו**.

## מה בדיוק הובטח (מתוך [Final project design.md](../ds-models/Final%20project%20design.md))

| מקום באפיון | ההבטחה |
|---|---|
| שורה 87 (Functional Requirements) | "**Gap Analysis:** A comparison table showing the gap between the requirement and the current CV status" |
| שורה 124 (DS Model & NLP Agent) | "Scoring Agent ... outputs a JSON containing scores (1-10) **and semantic feedback**" |
| שורה 153 (Work Plan) | "Gap Analysis Logic — identify missing or weak skills relative to job requirements — Reut, Week 5" |
| שורות 187-189 + `image3.png` | **מסך "Results Visualization"** — mockup מלא: Skill Deep Dive עם מד 5/10, השוואת דרישות-המשרה מול אזכורים-בקו"ח, ופאנל Gap Analysis עם **Strengths / Missing Elements / Agent Feedback** |

## מה קיים בפועל (אומת בקוד, 2026-07-14)

- [scoring.agent.ts:20-26](../../backend/src/agents/scoring.agent.ts#L20-L26): ה-prompt מבקש
  מה-LLM **רק** `{"skill", "score"}`. אין `feedback`, אין `evidence`, אין `missing`.
- [cvAnalysis.model.ts](../../backend/src/models/cvAnalysis.model.ts): הסכמה שומרת רק
  `{skill, score}`.
- `SkillsMatchDashboard.tsx`: מרנדר מד + שתי רשימות של פסי-ציון. **אין** תצוגת deep-dive
  per-skill, אין טבלת דרישה-מול-CV, אין טקסט הסבר, ואין שום דבר לחיצה על סקיל.
- **חלקית קיים:** `cvImprove.service.ts` **כן** מחשב `found: boolean` לכל סקיל חלש +
  ציטוט מהקו"ח — אבל רק בתוך מסך ה-Improve, לא בדשבורד.

**המסקנה:** הפער האמיתי קטן ממה שנראה. רוב התשתית קיימת; חסר שדה אחד ב-prompt ופאנל UI.

## ✅ הוחלט (המשתמש, 2026-07-14): לבנות

ההחלטה התקבלה — סעיף "אם המשתמש בוחר לחתוך" בהמשך אינו רלוונטי עוד, ומשימות 08/11
יכולות להניח שהמסך קיים. התוכנית:

### שלב 1 - סוכן הניקוד מחזיר יותר (קריאה אחת, שדה נוסף)
לשנות את ה-prompt ב-`scoring.agent.ts` כך שיחזיר לכל סקיל:
```json
{ "skill": "kubernetes", "score": 4,
  "evidence": "Mentioned once under 'DevOps course', no production use shown",
  "missing": "No evidence of managing clusters, Helm, or CI/CD integration" }
```
**זו אותה קריאת LLM** — רק פלט עשיר יותר. לעדכן בהתאם:
- `SkillScoreSchema` ב-`cvAnalysis.model.ts` (שדות חדשים, אופציונליים — backward compatible).
- `normalizeLlmScoringJson` ב-`scoring.service.ts` — לוודא שהיא לא זורקת אם השדות חסרים
  (קו"ח שנותחו קודם).
- ה-keyword fallback חייב להחזיר את השדות (ריקים/גנריים) כדי לא לשבור טיפוסים.

### שלב 2 - פאנל Deep-Dive בדשבורד
לחיצה על שורת סקיל ב-`SkillsMatchDashboard` פותחת פאנל מתרחב:
- **הציון** (המד שכבר קיים, בקטן).
- **Strengths** — ה-`evidence` (מה כן נמצא בקו"ח).
- **Missing Elements** — ה-`missing`.
- **Agent Feedback** — משפט ההסבר.
- כפתור "Improve this skill" → קופץ למסך Improve עם הסקיל הזה נבחר (החיבור כבר קיים).

לשמור על שפת העיצוב הקיימת (glassmorphism, `[data-tooltip]` שכבר קיים ב-
`SkillsMatchDashboard.css`). להשוות ל-`image3.png` שבאפיון — **לא להעתיק אותו,** אלא
לספק את אותה פונקציה בשפת המוצר הנוכחית.

### שלב 3 - טבלת ה-Gap
מעל/מתחת לרשימת הסקילז: טבלה קומפקטית `Skill | Required by job | In your CV | Gap`
— זה בדיוק מה שהאפיון קורא לו "comparison table". זולה, וזה **הצילום שייכנס לפלייר ולספר**.

## אם המשתמש בוחר לחתוך (החלטה לגיטימית)

אז חייבים שלושה דברים, ובלעדיהם זה נחשב "הבטחה שלא קוימה":
1. שורה בטבלת "תוכנן מול בוצע" בספר (משימה 09) שמסבירה **למה** — למשל: "הוחלף בניקוד
   per-skill + שכתוב per-section, שנותנים למשתמש פעולה ולא רק אבחנה".
2. Future Work בספר.
3. **הסרת המסך מתסריטי משימות 08 ו-11** — שתיהן מניחות כרגע שהוא קיים.

## הגדרת Done

- [ ] החלטה מפורשת של המשתמש: לבנות / לחתוך.
- [ ] אם נבנה: הניתוח מחזיר `evidence`+`missing`, הפאנל עובד, טבלת ה-Gap מוצגת,
      וקו"ח ישן (בלי השדות) לא שובר את המסך.
- [ ] אימות Playwright: ניתוח אמיתי → לחיצה על סקיל חלש → הפאנל נפתח עם טקסט אמיתי מה-LLM
      (לא placeholder) → צילום מסך שמור ל-`outputs/`.
- [ ] אם נחתך: שלושת סעיפי התיעוד למעלה בוצעו.

## גבולות

- לא לשנות את חישוב ה-Match Score עצמו.
- לא לגעת במסך Improve מעבר לחיבור הכפתור.
- **קריאת LLM אחת** — לא להוסיף קריאה שנייה לכל סקיל (עלות וזמן בדמו).
