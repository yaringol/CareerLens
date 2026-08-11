# Workflow הפקה — איך גורמים לסרטון להיראות מקצועי ולהישאר קונסיסטנטי

מבוסס על מחקר של מדריכי הפקה עדכניים (מקורות בתחתית), מותאם לתשעת הסצנות ב-[01-SCRIPT.md](01-SCRIPT.md).

---

## 1. הצינור: שלושה שלבים, כל אחד עם תוצר סגור

הכלל שחוזר בכל מדריכי ההפקה המקצועיים: **לא עוברים שלב לפני שהתוצר של השלב הקודם מאושר.**
רוב הסרטונים החובבניים נכשלים כי מתחילים לייצר שוטים לפני שיש storyboard.

| שלב | פעולות | תוצר סגור |
|---|---|---|
| **Pre** | סקריפט → storyboard → shot list → UI/flow review | מסמך סצנות + לוח תמונות + רשימת שוטים ממוספרת |
| **Production** | ייצור שוטי AI · הקלטות מסך · הקלטת קריינות | תיקיית raw clips + WAV של קריינות |
| **Post** | עריכה → סאונד → color grade → טקסטים → QC | master + גרסאות 16:9 / 9:16 |

**מספרי עוגן מהתעשייה:** explainer של 60–90 שניות = 150–225 מילים של קריינות, ו-20–40 שעות פוסט.
הסקריפט שלנו הוא **125 מילים ל-85 שניות** (≈1.5 מילים/שנייה מול 2.5 מקובל) — זה מכוון: הרבה
ביטים ויזואליים שקטים. המשמעות היא שהוויזואל חייב לשאת את המשקל; אין מילים שיכסו על שוט חלש.

---

## 2. קונסיסטנטיות דמות — הבעיה מספר 1 בסרטון הזה

בסרטון שלנו יש **שלושה שוטים עם אותו אדם**: סצנה 4 (מקמט וזורק), 5a (שולף מהפח), 8b (מחייך).
אם הפנים יזוזו בין השוטים — כל הסיפור מתפרק. זה בדיוק הכשל שכל המדריכים מתריעים עליו: מודלי
וידאו מייצרים כל קליפ **באופן עצמאי**, ואותו טקסט מפורש קצת אחרת בכל פעם.

### ה-workflow שעובד (5 שלבים)

**1. Hero image לפני הכול.** אל תייצר וידאו מטקסט. קודם צור **תמונת סטילס אחת מושלמת** של
הדמות (בכלי תמונה), ורק אחר כך image-to-video. זו הנקודה הכי חשובה בכל המחקר: טקסט מתאר דמות,
אבל לא **מחזיק** פנים.

**2. ערכת reference של 2–3 זוויות** — חזית ניטרלית, שלושת־רבעי, פרופיל. תאורה **ניטרלית ושטוחה**
בכל תמונות הייחוס; צללים דרמטיים או הטיות צבע גורמים למודל לפרש מחדש את מבנה הפנים. הסטייל
מגיע מהפרומפט, לא מתמונת הייחוס. (Veo תומך בעד 3 תמונות של אותה דמות.)

**3. Frame chaining / last-frame conditioning.** ייצר שוט, ייצא ממנו **פריים נקי אחרון**, והזן
אותו כ-reference לשוט הבא. זה מה שנקרא reference propagation — זה מה ששומר על זהות בלי לטפל
בכל פריים. בסרטון שלנו: הפריים האחרון של סצנה 4 (הפח) → נקודת פתיחה של 5a.

**4. משפט זהות נעול, מילה במילה.** אותו תיאור בדיוק בכל פרומפט, בלי לשנות אפילו סדר מילים.
כל שינוי ניסוח = פנים אחרות.

**5. תנועה מדודה.** תנועות מצלמה אגרסיביות = עיוות פנים. עדיף מספר קליפים קצרים עם תנועה
מתונה מאשר קליפ אחד עם תנועה גדולה.

### מבנה פרומפט בשש שכבות

זה הפורמט שמדריכי Veo 3.1 ממליצים עליו — כל שכבה בשורה נפרדת, תמיד באותו סדר:

```
IDENTITY:        (נעול — זהה מילה במילה בכל שוט)
CINEMATOGRAPHY:  (עדשה, מסגור, תנועה, תאורה)
ENVIRONMENT:     (מקום + פלטה)
PERFORMANCE:     (הבעה ופעולה)
AUDIO:           (דליל בלבד)
NEGATIVE:        (1–3 שלילות קריטיות בלבד — לא יותר)
```

### שלושת הפרומפטים שלנו, כתובים מחדש בפורמט הזה

**סצנה 4 — התסכול**
```
IDENTITY: Same protagonist throughout — a person in their late twenties, androgynous
  presentation, short dark hair, plain charcoal crewneck sweater, no glasses, no jewelry.
CINEMATOGRAPHY: 35mm, shallow depth of field, static tripod, slight over-the-shoulder
  framing then a low-angle insert. Cold blue monitor key light from screen left, no fill.
ENVIRONMENT: Small home office at night, desk, closed laptop screen glow, wastebasket on
  the floor at frame right. Desaturated cold palette.
PERFORMANCE: Picks up a printed resume, stares, exhales, crumples it with both hands in one
  motion; slow-motion insert of the paper ball landing in the wastebasket.
AUDIO: Dry paper crumple, room tone, no music.
NEGATIVE: No other people. No wardrobe change. No text visible on screen.
```

**סצנה 5a — שולף מהפח**
```
IDENTITY: [אותו בלוק IDENTITY מילה במילה]
CINEMATOGRAPHY: 50mm macro close-up, handheld with minimal drift, shallow depth of field.
  Lighting warms from cold blue to soft amber-violet across the shot.
ENVIRONMENT: Same desk, same room, same wastebasket. Palette shifts cold to warm.
PERFORMANCE: A hand reaches into the wastebasket, retrieves the crumpled paper, smooths it
  flat on the desk with both palms; creases unfold. The person sits up straight.
AUDIO: Paper unfolding, faint room tone.
NEGATIVE: No wardrobe change. No new props. No face close-up.
```

**סצנה 8b — ההקלה**
```
IDENTITY: [אותו בלוק IDENTITY מילה במילה]
CINEMATOGRAPHY: 35mm, shallow depth of field, static tripod — the exact same framing and
  angle as the night scene. Warm daylight key from the window at frame left.
ENVIRONMENT: The same home office, now in daytime. Warm palette, soft highlights.
PERFORMANCE: Holds up a freshly printed resume, smiles with genuine relief, leans back in
  the chair; phone lights up and they look up.
AUDIO: Soft room tone, distant street ambience.
NEGATIVE: No wardrobe change. No other people. No readable text on the paper.
```

> שים לב מה עושה את העבודה: `the exact same framing and angle as the night scene` בסצנה 8b.
> הניגוד בין 4 ל-8b הוא כל הפואנטה, והוא עובד רק אם המצלמה **לא זזה**.

### טבלת כשלים ותיקונים

| תסמין | סיבה | תיקון |
|---|---|---|
| הפנים משתנות בהדרגה | ניסוח הזהות השתנה בין שוטים | להעתיק־להדביק את בלוק IDENTITY, לא לנסח מחדש |
| דמות אחרת לגמרי בכל סצנה | לא השתמשת ב-reference images | לעגן כל קליפ בתמונת ייחוס |
| עיוות פנים בתנועה | תנועת מצלמה אגרסיבית מדי | להוריד תנועה או לקצר את הקליפ |
| הגיל/הסגנון קופצים | התאורה השתנתה דרמטית | לשמור תנאי תאורה דומים; לעבור בהדרגה |
| הזהות מתאפסת אחרי קאט | הקליפ החדש בלי ייחוס קודם | לייצא פריים אחרון ולהזין כ-reference |

---

## 3. קונסיסטנטיות סגנון וצבע

**"עמוד שדרה סמנטי":** אוצר מילים חוזר בכל הפרומפטים. אצלנו:
`shallow depth of field` · `soft key light` · `deep indigo and violet palette` · `no readable text`.
לא לגוון בניסוח כי "משעמם" — גיוון בניסוח = גיוון בתוצאה.

**נעילת פלטה.** קליפים שנוצרו בהפרש של דקות סובלים מ-drift באיזון לבן ובקונטרסט. הפתרון:
לא לתקן קליפ־קליפ, אלא **להחיל LUT אחד על כל הטיימליין** ורק אחר כך לאזן פרטנית.
DaVinci Resolve (חינמי) עושה את זה טוב יותר מכל דבר אחר, כולל התאמת shot-to-shot אוטומטית.

**הקשת הצבעונית שלנו מכוונת ולא מקרית:**

| סצנות | טמפרטורה | רוויה |
|---|---|---|
| 1–3 (מאגר, גרפים) | קר, indigo `#1e1b6e` | בינונית, זוהר סגול |
| 4 (הפח) | קר מאוד, כחלחל | **מופחתת** — זה תחתית הסיפור |
| 5–7 (המוצר) | ניטרלי → חמים | עולה |
| 8–9 (הייצוא) | חמים, אור יום | **גבוהה** — שיא |

זו ההצדקה היחידה לשבור עקביות צבע: כשהשבירה **היא** הסיפור.

---

## 4. הקלטות המסך — איפה סרטוני מוצר נשברים

זה החלק שהכי קל לעשות בזול ולהיראות חובבני. הכללים:

- **60fps, לא 30.** יש לנו גלילה בדשבורד ובטבלת ה-Gap — ב-30fps זה יראה קטוע.
- **זום, תמיד.** UI מלא ב-1080p עם סמן זעיר הוא בלתי צפייה. כל ביט צריך זום לאזור הפעיל —
  המחוון, השורה `✗ Not found`, כפתור `Save`, כפתור `Export`.
- **סמן איטי ומכוון.** להזיז את העכבר לאט ובקו ישר, לעצור לפני לחיצה. הסמן מוביל את העין.
- **click highlights** — סימון ויזואלי לכל לחיצה.
- **דסקטופ נקי:** רקע ניטרלי, בלי קבצים על שולחן העבודה, בלי סרגלי דפדפן, בלי תוספים,
  **Do Not Disturb פעיל** (התראה שקופצת באמצע = הקלטה מחדש).
- **דאטה אמיתי, לא lorem.** יש לנו `sample-cv.pdf` ותוצאות אמיתיות — להשתמש בהן. מספרים
  מזויפים ניכרים.
- **להשאיר את הציון הנמוך.** 46% MODERATE ו-30% WEAK הם נכס, לא בעיה — מוצר שמראה כישלון אמיתי
  לפני השיפור נקרא אמין.

כלים: Rapidemo / Screenify / Focusee (זום אוטומטי אחרי הקלטה) · או Playwright `recordVideo`
לקבלת ריצה דטרמיניסטית וזהה בכל take — שזו בדיוק הסיבה שהיא מתאימה לנו.

---

## 5. סדר עבודה מומלץ בפועל

1. **קודם הקלטות מסך** (סצנות 5b, 6, 7, 8a) — הן ודאיות, לא תלויות במודל, ומגדירות את הקצב האמיתי.
2. **אחר כך קריינות** — מקליטים, וחותכים את הוויזואל לקריינות. לא ההפך.
3. **אחר כך אנימציית הלוגו** (סצנות 1, 9) — קלה, ונותנת את הפלטה לכל השאר.
4. **בסוף שוטי הדמות** (4, 5a, 8b) — הכי יקרים בזמן, 3–4 וריאציות לכל שוט. מתחילים מ-hero image.
5. **הרכבה → LUT אחד → סאונד → טקסטים → QC.**

**QC לפני ייצוא:** האם זו אותה דמות בשלוש הסצנות? · האם המצלמה זהה ב-4 ו-8b? · האם יש טקסט
ג'יבריש שנוצר ב-AI במסך כלשהו? · האם כל טקסט על המסך נקרא ב-3 שניות? · האם הסרטון עובד **בלי
סאונד** (רוב הצפיות ברשתות מושתקות)? · האם יש גרסת 9:16?

---

## מקורות

- [How to Keep Characters Consistent in AI Video (2026) — Magic Hour](https://magichour.ai/blog/how-to-keep-characters-consistent-in-ai-video)
- [Veo 3.1 Multi-Prompt Storytelling Best Practices — Skywork](https://skywork.ai/blog/multi-prompt-multi-shot-consistency-veo-3-1-best-practices/)
- [Veo 3 Character Consistency: A Step-by-Step Guide — Arsturn](https://www.arsturn.com/blog/veo-3-character-consistency-guide)
- [Can Sora 2 Maintain Character Consistency Across Shots? — AI Free API](https://www.aifreeapi.com/en/posts/sora-2-character-consistency)
- [AI Video Character Consistency Workflow (first/end frame) — Kittl](https://www.kittl.com/blogs/ai-video-character-consistency-workflow/)
- [Consistent Character AI: Pro Tips & Workflow — Artlist](https://artlist.io/blog/consistent-character-ai/)
- [A Complete Guide for Video Production Process for B2B SaaS — Content Beta](https://www.contentbeta.com/blog/video-production-process/)
- [SaaS Explainer Video Creator: Complete Guide for 2026 — ngram](https://www.ngram.com/blog/saas-explainer-video-creator-guide)
- [How to Make Tasteful Screen-Recorded Videos — Clueso](https://www.clueso.io/blog/how-to-make-tasteful-screen-capture-videos)
- [The Complete Guide to Recording Product Demos (2026) — Cubix](https://www.cubix.design/resources/complete-guide-recording-product-demos)
- [AI Color Grading: How to Make AI Video Look Cinematic — InVideo](https://invideo.io/blog/ai-color-grading/)
