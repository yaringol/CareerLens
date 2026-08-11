# Kickoff M07 - השלמת עבודה טכנית פתוחה

**תאריך:** 2026-07-27 | **בריפינג:** [07-remaining-tech-work.md](../../07-remaining-tech-work.md)
| **סטטוס: ⛔ המימוש לא אושר (המשתמשת, 2026-07-27) - התחקיר וההכרעות (both-ways→Future Work, חריגת M01) נשמרים לקיקוף חוזר**

## 1. שערי כניסה

| שער | סטטוס |
|---|---|
| תלות M06 | ☑ שלב א' הושלם - דאטת מודל 1 שהטאב מציג תוקנה ואומתה חיה (הסיבה המקורית לתלות) |
| תלות M01 | ◐ המיזוג בוצע והבקאנד מתקמפל; נשארה סגירת E2E פורמלית. **מבוקשת חריגה** - M07 התגלתה כמשימת אימות-בעיקרה (למטה), אין סיכון לבנות על יסוד רעוע |
| החלטות פתוחות | הכרעת both-ways (שאלה 1); דלת המילוט התגלתה כקיימת - ההכרעה מתייתרת |

## 2. רקע - התחקיר הפך את המשימה על ראשה

הבריפינג (מבוסס מסמכים מ-02-05/07) הזהיר: "הקוד הוא מקור האמת, המסמכים מיושנים."
התחקיר של היום הוכיח זאת מעבר לכל ציפייה - **6 מ-7 הפריטים כבר ממומשים במלואם**:

### מתועד מול מצוי

| פריט | הבריפינג חשב | מצוי בקוד (2026-07-27) |
|---|---|---|
| טאב "מצב הלמידה" ב-Admin | "לממש - הבסיס קיים" (רק endpoint) | **קיים מלא**: 3 endpoints ([admin.routes.ts:99-145](../../../../backend/src/routes/admin.routes.ts#L99-L145) - summary/collection-stats/titles מדורף) + [modelStatus.service.ts](../../../../backend/src/services/modelStatus.service.ts) (321 שורות: run history, confidence, trends, ISO timestamps) + [AdminModelStatusPanel.tsx](../../../../frontend/src/components/admin/AdminModelStatusPanel.tsx) עם טבלת titles מלאה, pagination, טרנדים |
| pipeline trigger (A3.4) | "נחתך - sidecar מסוכן" | **קיים מלא במימוש שונה**: לא sidecar אלא spawn מתוך ה-backend ([pipelineTrigger.service.ts](../../../../backend/src/services/pipelineTrigger.service.ts) - docker run, abort, log tail) + [AdminPipelinePanel.tsx](../../../../frontend/src/components/admin/AdminPipelinePanel.tsx) עם Run/Abort; כשלא מוגדר (`PIPELINE_DOCKER_IMAGE` חסר) מציג בכנות את הפקודה הידנית |
| Embedding fallback לטייטל | "בדיקת קוד - ייתכן שקיים" | **קיים מלא**: SBERT nearest-centroid ([server.py:107-127](../../../../ds/model/server.py#L107-L127)), `/title/normalize` (:571), מחווט בסולם הזיהוי ב-[dsModel.ts:428+](../../../../backend/src/services/dsModel.ts#L428) |
| LLM fallback לטייטל | "כנראה קיים - לוודא" | **קיים ומחווט**: `classifyTitleWithLlm` ([titleClassification.agent.ts:59](../../../../backend/src/agents/titleClassification.agent.ts#L59)) נקרא מ-[dsModel.ts:141](../../../../backend/src/services/dsModel.ts#L141) |
| Track B (59 מחלקות) | "נחתך; ייתכן שכבר קרה" | **כבר קרה**: המסווג החי הוא 59+`__other__` ([server.py:437-455](../../../../ds/model/server.py#L437-L455) - `OTHER_LABEL` בתוך `classes_`). נשאר רק לתעד בספר |
| דלת מילוט לתפקיד | "הוסרה בטעות; הכרעת סקופ" | **קיימת מלאה**: סטטוס `uncertain` → רשימת הצעות "Choose the closest supported role"; `not-found` → חיפוש ידני; כפתור override גם ב-ready ([CvUploadSection.tsx:781-845](../../../../frontend/src/components/upload/CvUploadSection.tsx#L781)). צילום rx-05 ("nurse-uncertain-protected") מאשש התנהגות חיה. ממצא הראיון (22/07) התייחס למצב ישן |
| Both-ways model (skills→title) | הכרעת סקופ | **לא קיים** - הפריט האמיתי היחיד. המסווג קורא טקסט גולמי; הכיוון skills→title אינו ממומש |
| dsModel.interface.ts מיושן | ל-M02 | נשאר ל-M02 - לא נוגעים |

**מסקנה:** M07 היא לא משימת מימוש אלא **משימת אימות-חי + תיעוד**: להוכיח שכל פריט
"קיים" באמת עובד (לא רק שהקוד שם), ולעדכן את הספר - כולל תיקון סעיף "נחתך" של
ה-pipeline trigger שבפועל מומש.

## 3. הבעיה והפתרון

**הבעיה:** מסמכי התכנון טוענים שפריטים חסרים/נחתכו כשהם קיימים, וממצא ראיון מ-22/07
(דלת המילוט) מתאר מצב שכבר תוקן. אם זה יגיע כך לספר - הספר ישקר לשני הכיוונים:
יבטיח Future Work שכבר קיים, ויתנצל על חסרים שאינם.

**הפתרון:** אימות חי פריט-פריט (Playwright/API) → טבלת סטטוס סופית אחת → עדכון
פרק "תוכנן מול בוצע" ו-Future Work בספר. ההכרעה היחידה: both-ways.

## 4. תוכנית מימוש

1. **אימות טאב Admin** (Playwright): התחברות כ-admin → הטאב נטען עם דאטת M06 המתוקנת
   (59 titles, סקילז אמיתיים, טרנדים אחרי רה-קליברציה) → צילום מסך ל-outputs.
2. **אימות פאנל pipeline**: סטטוס disabled מוצג בכנות עם הפקודה הידנית (לא נוגעים בקוד).
3. **אימות סולם הטייטל בשלוש שכבותיו** (API חי): כותרת עקומה → `/title/normalize`
   (embedding); קו"ח בלי כותרת → `/cv/role` (מסווג 60 המחלקות); confidence נמוך →
   ה-LLM הסגור. תיעוד איזו שכבה ענתה בכל תרחיש.
4. **אימות דלת המילוט** (Playwright): קו"ח האחות מ-M04 → uncertain עם הצעות →
   בחירה ידנית עובדת; קו"ח ג'יבריש → not-found עם חיפוש.
5. **תיעוד**: עדכון טבלת הבריפינג לסטטוסים סופיים; עדכון פרק 5 (תוכנן-מול-בוצע) -
   כולל הפיכת "sidecar נחתך" ל"מומש כ-spawn פנים-backend"; Future Work לפי הכרעת שאלה 1.
6. **Both-ways** - לפי ההכרעה: מימוש (יוגדר בנפרד) או פסקת Future Work עם המינוח
   המדויק (bidirectional role-skill inference / occupation prediction from skill profiles).

**Out of scope:** שינויי קוד בפריטים הקיימים (אלא אם האימות מגלה שבר); dsModel.interface
(M02); ניסוחים (M03).

## 5. סיכונים ומיטיגציות

| סיכון | תרחיש | מיטיגציה |
|---|---|---|
| האימות מגלה שבר | פריט "קיים" לא עובד בפועל | זו בדיוק מטרת המשימה - לתקן נקודתית או לחזור אלייך אם גדול |
| both-ways במימוש | עבודת מודל חדשה שבועיים לפני הגשה | ההמלצה: Future Work. אם מימוש - kickoff נפרד משלו |
| טאב Admin איטי מול מונגו חי | הדמו נתקע על הטאב | הקוד כבר ממטין (cache 60s, timeouts 12s, pagination) - האימות ימדוד בפועל |
| רגרסיה | אין - המשימה כמעט read-only | הצילומים והדוחות הם התוצר |

## 6. החלטות

**שכבר נלקחו:** סקופ 14/07 (מה לממש/לחתוך) - התייתר ברובו כי הדברים קיימים ·
sidecar נחתך → בפועל מומש אחרת (לתעד, לא לגעת) · דלת מילוט - קיימת (ההכרעה מתייתרת).

**שהסקיל לוקח:** המשימה מוגדרת מחדש כאימות+תיעוד · לא נוגעים בקוד עובד · פאנל
pipeline נשאר כמות-שהוא (מצב disabled מטופל בכנות).

**פתוחות:** both-ways (שאלה 1) · חריגת שער M01 (שאלה 2).

## 7. שאלות למשתמשת

1. **Both-ways model**: מימוש להגשה / Future Work בספר? (המלצה: Future Work)
2. **חריגת שער M01**: לאשר התחלה למרות ש-M01 עוד ◐? (המלצה: כן - המשימה כמעט read-only)

## תשובות והכרעות (המשתמשת, 2026-07-27)

1. ✅ **Both-ways: Future Work בספר** - פסקה מסודרת עם המינוח המדויק
   (bidirectional role-skill inference / occupation prediction from skill profiles),
   בהמשך לדפוס שנקבע ל-Track B. אפס עבודת מודל לפני הגשה.
   **עדכון (מאוחר יותר באותו יום):** המשתמשת ביקשה משימה קונקרטית - נוצרה **M18**
   ([18-skills-to-title-notebook.md](../../18-skills-to-title-notebook.md)): מחברת מחקר
   skills→title עם הערכה מול 32 האותנטיים ו-head-to-head מול המסווג המוגש. ה-Future Work
   בספר נשאר, והמחברת מספקת לו בסיס מדוד. חיווט לפרודקשן - רק בהחלטה נפרדת.
2. ✅ **חריגת שער M01 אושרה** - M07 רצה כמשימת אימות+תיעוד; האימות שלה מקדם ממילא
   את מטרת M01.
