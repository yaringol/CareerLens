# משימה 16: ארכיטקטורה ודיאגרמות - נכס משותף

> בריפינג לאייג'נט עצמאי. **לא חסום — אפשר להתחיל מיד** (קורא קוד בלבד).
> **שלוש משימות צורכות את התוצר הזה:** 08 (פלייר/מצגת), 09 (ספר, פרק 3), 11 (דמו).
> כללי הברזל מ-[00-MASTER-PLAN.md](00-MASTER-PLAN.md) מחייבים.

## מטרה

היום אין בריפו **ולו דיאגרמה אחת** של המערכת:
- `docs/architecture.md` הוא קובץ **0 בתים** — ו-tracked (כלומר clone מקבל מסמך ארכיטקטורה ריק).
- `grep -rl '```mermaid'` על כל הריפו → **אפס תוצאות**.
- הדיאגרמה היחידה שקיימת (`assets/final-project-design/image2.png`) מתארת את הארכיטקטורה
  **המתוכננת** — "Python AI service" יחיד מאחורי ה-backend — שהמימוש כבר עקף.

תבנית ספר הפרויקט **דורשת במפורש**: "Provide a diagram or visual representation to
illustrate the system architecture" (§3.1), וספר הדוגמה נושא 18 figures.

## התוצרים

### 1. `docs/architecture.md` — המסמך הקנוני (מקור אמת יחיד)
תיאור המערכת **כפי שהיא בקוד**, באנגלית, כולל שלוש הדיאגרמות. הוא משרת גם כמקור לפרק 3
בספר וגם כתיעוד למי שמצטרף לפרויקט.

### 2. שלוש דיאגרמות (mermaid בקוד → מרונדרות ל-PNG לספר/מצגת)

**דיאגרמה 1 — ארכיטקטורת המערכת (as-built):**
- React SPA (Vite) → Node/TypeScript REST API → שני צרכנים: (א) FastAPI DS server
  (פייתון) עם **שני מודלים**: title→skills ו-CV→title (+ נרמול טייטלים ב-embeddings),
  (ב) **אגנטי LLM בתוך ה-Node** (scoring, skill extraction, suggestions, title classification).
- MongoDB — שני DBs: `careerlens` (משתמשים, קו"ח, ניתוחים) ו-`jobs` (דאטת המודל).
- הסקרייפר + הפייפליין היומי (scrape → SkillNer → train → promotion gate → restart).
- **חשוב:** לאמת בקוד מי מדבר עם מי לפני שמציירים. ה-frontend **לא** מדבר עם ה-DS ישירות;
  ה-DS **לא** נגיש מהדפדפן.

**דיאגרמה 2 — פייפליין הדאטה והלמידה:**
LinkedIn scrape → SkillNer extraction (פעם אחת, נשמר) → `role_skill_observations` →
`train.py` (אגרגציה משוקללת + recency + stability) → **promotion gate** → `model.joblib` +
`model_runs`. להראות במפורש את **שער האיכות** — זה הרעיון החזק ביותר בארכיטקטורה
(ריצה גרועה לא דורסת מודל טוב).

**דיאגרמה 3 — sequence של בקשה מקצה לקצה:**
Upload PDF → חילוץ טקסט → זיהוי תפקיד (מסווג → סף → fallback) → Personalize (בחירת סקילז
ומשקלים) → Analyze (5 core + 5 dynamic → ניקוד LLM → Match Score) → Improve (per-section).
זו הדיאגרמה שמסבירה את המוצר במבט אחד — היא גם תשמש בתסריט הדמו ובמצגת.

### 3. דיאגרמת "תוכנן מול בוצע"
זוג צמוד: `image2.png` (המקורית) לצד דיאגרמה 1. **זהו הפיגר החזק ביותר בספר** — הוא הופך
את הפער בין האפיון למימוש מ"תירוץ" ל"ממצא". (הספר יסביר את הפער; כאן רק מייצרים את הוויזואל.)

## שיטת עבודה

0. **⚡ קיצור דרך (נוסף 2026-07-21):** ביקורת-קוד מלאה כבר בוצעה עבור פרק 4 של הספר —
   ראה `docs/progect_book/chapters/04-system-design.md` והממצאים בסוף
   `outputs/kickoffs/09-kickoff.md`. עובדות מאומתות שהדיאגרמות חייבות לשקף:
   **חמישה** אגנטי LLM (כולל titleExtraction); סולם הזיהוי כפי שמוגש = אגנט חילוץ →
   `/title/normalize` (SBERT) → `/cv/role` → LLM fallback (לא `POST /cv/title` הישן);
   לבקאנד חיבור read-only ל-jobs DB (admin בלבד); פריסה = 5 קונטיינרים + batch + cron.
1. **לקרוא קוד לפני שמציירים** — `backend/src/routes/*`, `backend/src/services/dsModel.ts`,
   `ds/model/server.py`, `docker-compose.yaml`, `pipeline/`, `ofelia/`. המסמכים ב-`docs/ds-models`
   מיושנים חלקית (נכתבו לפני מסך ה-Personalization וה-Improve).
2. לכתוב mermaid בתוך `docs/architecture.md` (Artifacts/GitHub מרנדרים אותו נייטיב).
3. לרנדר ל-PNG לספר ולמצגת (`@mermaid-js/mermaid-cli`, או Playwright על דף HTML) →
   `docs/final-sprint/outputs/diagrams/`.
4. **לאמת מול המשתמש** לפני שהספר נשען על זה: להציג את שלוש הדיאגרמות ולשאול "זו המערכת?".

## הגדרת Done

- [ ] `docs/architecture.md` מלא באנגלית (לא 0 בתים!), עם 3 הדיאגרמות.
- [ ] כל דיאגרמה מרונדרת גם כ-PNG, ממוספרת, עם caption מוכן לטבלת ה-Figures בספר.
- [ ] כל רכיב וכל חץ **אומת מול הקוד** — אפס רכיבים "מתוכננים" שאינם קיימים.
- [ ] דיאגרמת תוכנן-מול-בוצע מוכנה כזוג.
- [ ] המשתמש אישר שהדיאגרמות מתארות נכון את המערכת.

## גבולות

- **לא לשנות קוד.** משימה זו קוראת ומתעדת בלבד.
- לא לתאר פיצ'רים שנחתכו כאילו קיימים (לתאם עם סטטוס משימות 07 ו-15).
- לא להמציא רכיבים "לניקיון הדיאגרמה" — אם הארכיטקטורה מכוערת במקום מסוים, זה מה שמציירים,
  וזה מה שמסבירים בספר.
