# CareerLens — תוכן פלייר (M08 חלק ב')

פורמט: **A5 דו-צדדי**. כל הטקסטים מוכנים לעימוד. כל מספר במסמך הזה נשען על
[official-metrics.md](../official-metrics.md) — אפס מספרים מומצאים.

**פלטה:** `#1e1b6e` אינדיגו · `#8b7cf6` סגול · `#c084fc` סגול בהיר · `#eeeef8` רקע · לבן
**גופן:** Inter — כותרות 800, גוף 400, "Lens" תמיד 300
**לוגו:** [promo/brand/careerlens-lockup-transparent.png](../../promo/brand/careerlens-lockup-transparent.png)

---

## צד א' — ההוק

### כותרת ראשית
> # Your CV is being rejected by robots.
> ## Fight back.

*(Inter 800, `#1e1b6e`. "Fight back." בסגול `#8b7cf6`.)*

### תת-כותרת
> Candidates aren't filtered out for lacking skills.
> They're filtered out for how those skills are worded.

### הוויז'ואל המרכזי
מסך התוצאות: [ui-02-score-and-skills.png](../../promo/screenshots/ui-02-score-and-skills.png)
— המחוון על **46% · MODERATE**, טורי Core Skills ו-Dynamic Skills.

> **למה דווקא ציון בינוני ולא גבוה:** פלייר שמראה 95% נקרא כפרסומת. פלייר שמראה
> אבחון אמיתי — כולל מיומנות ב-0/10 — נקרא ככלי. זו גם הסיבה שמסך ה-Gap Analysis
> נמצא בצד ב'.

### שלוש שורות הערך (אייקון + שורה)
- 🎯 **Know your real match** — a score per skill, not a vague verdict
- 🔍 **See exactly what's missing** — measured against real job-market data
- ✍️ **Rewrite it in their language** — you approve every single change

### תחתית
`QR PLACEHOLDER` + הלוגו + השורה: **See your CV the way the market does.**

---

## צד ב' — איך זה עובד

### כותרת
> ## Four steps. About a minute.

### הצעדים (מיני-סקרינשוט לכל אחד)

| # | כותרת | טקסט | ויז'ואל |
|---|---|---|---|
| 1 | **Upload** | Drop in your CV. CareerLens detects the role you're aiming for — automatically. | [ui-01-upload-and-role-detect.png](../../promo/screenshots/ui-01-upload-and-role-detect.png) |
| 2 | **Analyse** | A match score, and a 0-10 rating for every skill the role actually requires. | [ui-02-score-and-skills.png](../../promo/screenshots/ui-02-score-and-skills.png) |
| 3 | **See the gaps** | Skill by skill: what's in your CV, what's missing, and what the gap really is. | [ui-03-gap-analysis.png](../../promo/screenshots/ui-03-gap-analysis.png) |
| 4 | **Improve & export** | Section-by-section rewrites you review and approve. Then export. | [ui-05-rewrite-approved.png](../../promo/screenshots/ui-05-rewrite-approved.png) |

### מה מייחד את זה — שורת "מתחת למכסה"

> **Two machine-learning models, trained on real job postings.**
> One reads the market and ranks the skills that matter for each role.
> One reads your CV and identifies the role you fit.
> The market data is re-scraped continuously — so the ranking isn't frozen in time.

### מספרים (מותר לצטט — ורק אלה)

| מדד | מספר | ניסוח מומלץ לפלייר |
|---|---|---|
| זיהוי תפקיד מ-CV, מסלול מוצר מלא | **26/29 (89.7%)** top-1 | *"89.7% top-1 accuracy on authentic CVs, measured end-to-end through the product"* |
| top-3 | 93.1% | אופציונלי, אם יש מקום |
| דירוג מיומנויות (מודל 1) | **precision@10 = 97%** | *"97% precision@10 on skill relevance, blind-labelled"* |
| שגיאות פייפליין | 0 | *"zero pipeline errors"* |

> ⚠️ **אסור לצטט בשום תוצר:** `0.93 macro-F1` · `15/15 passed` · `62.3%` · `0.981→0.932`.
> כולם פסולים לפי §4 ב-official-metrics. אם מישהו שואל "מה הדיוק?" — התשובה היא 89.7%,
> ורק היא.

### שורת הטכנולוגיות
`React · TypeScript · Node.js · Express · MongoDB · Python · scikit-learn · LLM agents · 2 ML models`

### צוות
> **Amit Alon · May Eliyahu · Yarin Golzar · Reut Maduel**
> Supervisor: **Dr. Galit Haim**

---

## מה במכוון לא נכנס לפלייר

| הושמט | למה |
|---|---|
| "מבטיח לך עבודה" / "מכפיל את הסיכוי" | אין לזה מדידה. M08 אוסרת מספרים מומצאים, וזו הבטחה בלי בסיס |
| מספר המשרות במאגר | לא מופיע ב-official-metrics כמספר מאושר |
| "AI שמבין אותך" | אנטי-אווירה — המוצר אבחוני, לא רגשי |
| כיסוי 59 התפקידים | **33 מתוך 59 בלי דאטת אימון אמיתית.** לא לטעון כיסוי רחב; הפלייר מדבר על תפקידי הליבה בלבד |

> אם שופט ישאל על כיסוי — התשובה הכנה: *"26 מתוך 59 התפקידים נתמכים בדאטה אמיתית;
> על השאר הביצועים לא נמדדים, וזה מתועד כמגבלה."* זו תשובה שמחזקת, לא מחלישה.

---

## צ'קליסט עימוד

- [ ] הלוגו בגרסה השקופה, לא ה-favicon (הם שני ציורים שונים)
- [ ] "Lens" במשקל 300 — ההבדל מ-"Career" ב-800 הוא חתימת המותג
- [ ] כל סקרינשוט בזום מספיק שהמספרים נקראים בהדפסה A5
- [ ] QR מוחלף בכתובת אמיתית לפני הדפסה
- [ ] שמות הצוות והמנחה מאויתים בדיוק כמו למעלה
- [ ] בדיקת הדפסה אמיתית — צבעי המסך `#8b7cf6` יוצאים כהים יותר בהדפסה
