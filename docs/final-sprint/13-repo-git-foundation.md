# משימה 13: יסודות ריפו ו-git - חוסם את כל השאר

> בריפינג לאייג'נט עצמאי. **רץ ראשון, לפני כל משימה אחרת.**
> כללי הברזל מ-[00-MASTER-PLAN.md](00-MASTER-PLAN.md) מחייבים.

## מטרה

הריפו כרגע **בולע בשקט** קבצים קריטיים ו**נכשל ב-clone נקי**. כל עבודה שתיעשה לפני שזה
מתוקן עלולה ללכת לאיבוד או להישאר בלתי-ניתנת להרצה אצל הבודק. זו הסיבה שהמשימה חוסמת הכל.

כל הממצאים כאן **אומתו ידנית ב-2026-07-14** מול הקוד — הם אינם השערות.

## חלק א' - `.gitignore` בולע את התוצרים המנוקדים (קריטי)

`.gitignore` שורה 41 היא `*.md` עם שלוש החרגות בלבד (`!README.md`, `!docs/TESTING.md`,
`!docs/ds-models/*.md`).

```bash
git check-ignore -v docs/final-sprint/00-MASTER-PLAN.md
# .gitignore:41:*.md   docs/final-sprint/00-MASTER-PLAN.md      ← ignored!
```

**המשמעות:** ספר הפרויקט (בנתיב שהתוכנית עצמה קובעת), כל 13 קבצי התוכנית, דוח ה-benchmark,
כרוניקת הניסוי-וטעייה, ותוכן הפלייר — **כולם ignored**. אייג'נט יכתוב את הספר, יריץ
`git add -A`, יראה הצלחה (git לא זורק שגיאה על נתיב ignored) — והספר לא יהיה בריפו.

**לתקן:** להחליף את הכלל הגורף בהחרגות ממוקדות. לשמור ignored רק את הפתקים הפרטיים
(`docs/IMPLEMENTATION_PLAN.md`, `docs/JIRA_TASKS*.md`, `docs/milestone1-*.md`,
`docs/mcp-prompts.md`, `docs/design-todo.md`, `LOGIN_QA_REPORT.md`, `QA_TEST_PLAN.md`),
ולוודא ש-`docs/final-sprint/**`, `docs/progect_book/**`, `README.md` ו-`CLAUDE.md` נכנסים.

## חלק ב' - קבצים חיוניים שאינם ב-git כלל (אומת)

```
poc_files          0 tracked files   ← חבילת הטסטים היחידה בפרויקט!
scripts            0 tracked files   ← backend/package.json קורא לזה ב-postinstall
docs/final-sprint  0 tracked files
docs/progect_book  0 tracked files
```

1. **`scripts/check-git-lfs.js` — `npm install` נכשל ב-clone נקי.**
   `backend/package.json` מכיל `"postinstall": "node ../scripts/check-git-lfs.js"`, והקובץ
   **אינו בעץ הקומיטים** (לא ב-HEAD ולא ב-origin/main). הוא קיים רק כקובץ untracked אצלך.
   כל בודק שיעשה clone יקבל `MODULE_NOT_FOUND` וההתקנה תיכשל. → `git add scripts/`.
2. **`poc_files/`** — חבילת 15 הקו"ח. להוסיף (בלי `node_modules`).
3. **`docs/final-sprint/`, `docs/progect_book/`** — אחרי תיקון א'.
4. **האפיון המקורי + הנכסים שלו:** `docs/ds-models/Final project design.md` ו-
   `docs/ds-models/assets/final-project-design/*.png` (5 תמונות: ארכיטקטורה + 4 mockups)
   הם untracked. **הספר בנוי עליהם.** להוסיף.
5. **`test-fixtures/*.pdf`** החדשים (nurse, fpga, malware-researcher) — untracked.

## חלק ג' - קבצים שחייבים להישאר בחוץ

`.gitignore` **אינו** מכסה: `.claude/`, `.codex/`, `.mcp.json`. `git add -A` יסחוף אותם
לריפו ציבורי — תיקייה בשם `.claude` ליד ה-README היא טביעת אצבע AI בוטה. להוסיף לגיטאיגנור,
יחד עם: `rx-*.png` (בשורש), `demo_screenshots/`, `ds/model/*_20*.joblib` (snapshots מתוארכים),
`ds/model/NEW.ipynb`, `ds/model/.ipynb_checkpoints/`.

**החלטה נדרשת מהמשתמש:** `rx-*.png` ו-`demo_screenshots/` — לזרוק, או להעביר ל-
`docs/final-sprint/outputs/qa-evidence/` ולתייג? (אחד מהם נקרא
`rx-02-BUG-personalize-role-mismatch-backend-developer.png` — שם קובץ שמפרסם באג.)

## חלק ד' - היסטוריית ה-AI (דורש אישור מפורש + תיאום)

```bash
git log origin/main --grep="Co-Authored-By: Claude" -i --oneline   # → 5 קומיטים
```
חמישה קומיטים עם `Co-Authored-By: Claude ... <noreply@anthropic.com>` נמצאים **כרגע
ב-origin/main בריפו ציבורי**, ושניים מהם הם קומיטים של פיצ'רי דגל
(`79448cd feat(milestone-4): CV improvement flow`, `8dd6314 feat(ds): expand model to 60+ roles`).
עוד 3 ב-`origin/UI_branch`.

**✅ הוחלט (המשתמש, 2026-07-14): לנקות את `main` בלבד.** UI_branch נשאר כמו שהוא.
- לפני הביצוע: גיבוי mirror (`git clone --mirror`) + לוודא שהמשתמש תיאם עם השותפים
  (force-push על main משפיע על כולם).
- השיטה: rewrite של 5 הקומיטים על `main` (`git filter-repo --message-callback` שמסיר כל
  שורה שמתאימה ל-`/Co-Authored-By:.*(Claude|anthropic)/i`, מוגבל ל-refs של main) →
  force-push ל-`origin/main`.
- אחרי הניקוי: הענף הנוכחי (`final-submission-prep`) צריך rebase על ה-main החדש כדי לא
  להחזיר את הקומיטים הישנים דרך ה-merge הבא. לוודא גם ש-3 הקומיטים המקומיים-בלבד עם
  trailer לא נדחפים לעולם.
- לוודא בסוף: `git log origin/main --grep="Co-Authored-By" -i` → 0.

## חלק ה' - Git LFS ותלויות (שבירות ב-clone נקי)

- `.gitattributes` מנתב `ds/model/*.joblib` דרך LFS. `text_to_job_title_classifier.joblib`
  הוא **~307MB**. מכסת LFS החינמית של GitHub היא 1GB אחסון + 1GB תעבורה לחודש — כלומר
  ~3 clones ואתם מחוץ למכסה, וה-joblib יגיע כקובץ טקסט של 132 בתים וה-DS server ייפול
  בשגיאת pickle סתומה. **לבדוק את המכסה בהגדרות הריפו** ולדווח למשתמש.
- ה-README **לא מזכיר `git lfs` בכלל**. להוסיף ל-Prerequisites: `git lfs install && git lfs pull`.
- **תלויות Python בלי שום pin:** `ds/requirements.txt` משאיר את `scikit-learn`, `numpy`
  ו-`joblib` פתוחים לגמרי — ואלה בדיוק שלוש הספריות שקובעות אם ה-joblib ייטען. venv חדש
  בבוקר הדמו יכול להפיל את ה-DS server. → `pip freeze` על מכונת האימון ולנעול גרסאות.
- להוסיף guard בראש `ds/model/server.py`: אם קובץ artifact מתחיל ב-`version https://git-lfs`
  — לזרוק שגיאה ברורה ("run `git lfs pull`") במקום traceback של pickle.

## חלק ו' - אימות סופי: clone נקי (הבדיקה היחידה שקובעת)

```bash
git clone <repo> /tmp/careerlens-fresh && cd /tmp/careerlens-fresh
git lfs pull
cd backend && npm install          # חייב לעבור
cd ../frontend && npm install && npm run build
cd ../ds && python -m venv .venv && pip install -r requirements.txt
python model/server.py             # חייב לעלות ולטעון את שני המודלים
```
אם שלב כלשהו נכשל — זו בדיוק החוויה של הבודק. לתקן ולחזור.

## הגדרת Done

- [ ] `git check-ignore docs/progect_book/x.md` → לא ignored.
- [ ] `git ls-files scripts poc_files docs/final-sprint docs/progect_book` → כולם > 0.
- [ ] האפיון + 5 התמונות שלו tracked.
- [ ] `.claude/`, `.codex/`, `.mcp.json`, snapshots מתוארכים — ignored.
- [ ] היסטוריית AI: נוקתה **או** מתועדת החלטה מפורשת של המשתמש לא לנקות.
- [ ] תלויות Python נעולות; README כולל git-lfs.
- [ ] **clone נקי עובר מקצה לקצה** — זו ההוכחה.

## גבולות

- לא לגעת בתוכן של שום קובץ קוד (זה משימות 02/14). כאן: git plumbing בלבד.
- README: כאן רק להוסיף git-lfs ו-prerequisites. תיקון התוכן (macOS-only, "POC") — משימה 02.
- לא למחוק שום קובץ untracked בלי לשאול. **לעולם לא `git clean -fdx`** — זה ימחק את
  התוכנית, את האפיון ואת poc_files לפני שהם נכנסו ל-git.
