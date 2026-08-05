# MCP toolchain — איזה שרתים להתקין כדי לבצע את הסקריפט

מיפוי של 13 השוטים ב-[01-SCRIPT.md](01-SCRIPT.md) לכלים אמיתיים שאפשר להתקין ולהריץ.
מקורות בתחתית.

---

## התשובה הקצרה

**כן — לכל שלב בסקריפט יש היום MCP או Skill.** אבל הם מתחלקים לשתי קטגוריות שונות מאוד:

| | חינמי, מקומי, דטרמיניסטי | בתשלום, ענן, לא דטרמיניסטי |
|---|---|---|
| **מה** | הקלטות מסך, מושן גרפיקס, הרכבה | ייצור וידאו של אנשים, קריינות |
| **שוטים** | 1, 2, 3, 4, 8, 9, 10, 11, 13 | 6, 7, 12 + הקריינות |
| **כלים** | Playwright MCP · Remotion · FFmpeg | Runway MCP / fal.ai · ElevenLabs |
| **עלות** | 0 | קרדיטים / API key |

**9 מתוך 13 השוטים אפשר להפיק בחינם ומקומית.** רק שלושת שוטי הדמות ו-הקריינות דורשים שירות בתשלום.

---

## 1. הקלטות המסך — Playwright MCP עם הקלטת וידאו ⭐ הכי חשוב

ה-Playwright MCP **כבר מחובר** אצלך, אבל בלי הקלטת וידאו. מוסיפים דגל אחד:

```powershell
claude mcp add playwright-video -- npx @playwright/mcp@latest --save-video=1920x1080
```

**מה זה נותן:** כל ריצה בדפדפן נשמרת כקובץ webm. אפשר לכתוב סקריפט שמריץ את CareerLens
לאורך המסלול העלאה → זיהוי → דשבורד → שיפור → ייצוא, ולקבל את שוטים 8, 9, 10, 11 —
**זהים בכל ריצה**. אם צריך take נוסף כי הזום לא יצא טוב, מריצים שוב ומקבלים בדיוק אותו דבר.

זה בדיוק מה שכבר קיים ב-[demo_screenshots/reanalyze-video/](../../../demo_screenshots/reanalyze-video/).
עלות: 0.

---

## 2. מושן גרפיקס — Remotion (React → MP4)

```powershell
npx skills add remotion
```

**מה זה נותן:** כותבים קומפוננטת React, ומקבלים MP4. מתאים בדיוק לשוטים 1, 2, 3, 4, 13 —
כולם וקטוריים ומופשטים.

**היתרון הגדול אצלנו:** הלוגו כבר קיים כ-SVG ([careerlens-logo.svg](brand/careerlens-logo.svg)) וכ-React
([AppLogo.tsx](../../../frontend/src/components/ui/AppLogo.tsx)). Remotion יאנימט את **הלוגו האמיתי**,
לא קירוב של מודל AI. אותו דבר לגרפי הטרנדים בשוט 4 — נתונים אמיתיים במקום "משהו שנראה כמו גרף".

עלות: 0. דורש Node (מותקן אצלך).

---

## 3. שוטי הדמות (6, 7, 12) — כאן צריך לשלם

### אפשרות א' — Runway MCP (רשמי, הכי פשוט) ⭐ מומלץ

זהו **remote MCP** — לא מתקינים כלום, רק מחברים connector:

1. הגדרות Claude → **Connectors** → Add custom connector
2. שם: `Runway` · כתובת: `https://mcp.runwayml.com/mcp`
3. מאשרים מול חשבון Runway

**למה זה הכי מתאים לנו:** חשבון אחד נותן גישה ל-**Veo 3.1, Kling 3.0, Seedance 2.0, Gen-4.5**
וגם למודלי תמונה (**Nano Banana Pro, GPT Image 2**) — כלומר גם ה-hero image של הדמות וגם
הווידאו מאותו מקום. אין API key, רק התחברות. משלמים בקרדיטים של Runway לפי מודל ורזולוציה.

### אפשרות ב' — fal.ai MCP (הכי גמיש, למפתחים)

```powershell
claude mcp add -s user fal -e FAL_KEY=<your-key> -- npx -y fal-mcp-server
```
600+ מודלים, תשלום לפי שימוש. מתאים אם רוצים לנסות כמה מודלים ולהשוות.

### אפשרות ג' — Veo MCP / Kling MCP ייעודיים
[alohc/veo-mcp-server](https://github.com/alohc/veo-mcp-server) (דורש Google API key) ·
[AceDataCloud/KlingMCP](https://github.com/AceDataCloud/KlingMCP). מתאים אם כבר יש לך מפתח לאחד מהם.

> **חשוב:** בכל האפשרויות האלה — בקש **image-to-video עם תמונות ייחוס**, לא text-to-video.
> זה הכלל מ-[03-production-workflow.md](03-production-workflow.md), והוא לא משתנה בגלל שעובדים דרך MCP.

---

## 4. קריינות — ElevenLabs MCP

```powershell
claude mcp add -s user elevenlabs -e ELEVENLABS_API_KEY=<your-key> -- npx -y elevenlabs-mcp
```

נותן TTS, אפקטי סאונד, ואפילו ג'ינגל. אפשר להזין את שמונה שורות הקריינות מ-[01-SCRIPT.md](01-SCRIPT.md)
ולקבל WAV. שים לב לכיוון הקולי שנקבע: **warm neutral, ~135 מילים לדקה, בלי חיוך בקול.**

---

## 5. הרכבה וקולור — FFmpeg מקומי (לא MCP)

**FFmpeg לא מותקן אצלך.** התקנה:
```powershell
winget install Gyan.FFmpeg
```

יש MCP-ים להרכבה ([misbahsy/video-audio-mcp](https://github.com/misbahsy/video-audio-mcp)),
אבל **אני לא ממליץ עליהם בשלב הזה** — ראה את האזהרה למטה.

---

## ⚠️ אזהרה שחוסכת שבוע עבודה

יש כתבה של מישהי שניסתה בדיוק את זה — לבנות pipeline אוטומטי לפוסט-פרודקשן עם Claude Code.
**זה נכשל.** הסיבה: עריכת וידאו היא זרם אינסופי של מיקרו-החלטות ("עוד חצי שנייה", "הזום קצת
חזק", "המוזיקה מכסה את הקריינות כאן"), ואי אפשר לתקנן אותן לפני שיודעים מה חוזר על עצמו.

מה שכן עבד אצלה: **להתקין את הכלים מקומית ולעבוד בשיחה.** לבקש "תוריד את המוזיקה ב-3dB
בין 0:50 ל-1:02" ולקבל את זה תוך שניות, במקום לבנות CLI עם קונפיגורציה.

**המסקנה למקרה שלנו:** התקיני Playwright-video, Remotion ו-FFmpeg → תני לי להריץ אותם
בשיחה. אל תבני pipeline. את הצבע והקצב הסופיים ממילא עדיף לעשות ב-DaVinci Resolve בעיניים.

---

## סדר התקנה מומלץ

| # | פקודה | למה קודם |
|---|---|---|
| 1 | `claude mcp add playwright-video -- npx @playwright/mcp@latest --save-video=1920x1080` | 4 שוטים, חינם, מיד |
| 2 | `winget install Gyan.FFmpeg` | נדרש לכל חיתוך/הרכבה |
| 3 | `npx skills add remotion` | 5 שוטים נוספים, חינם |
| 4 | Runway connector (בהגדרות) | רק כשמגיעים לשוטי הדמות |
| 5 | ElevenLabs MCP | רק אם לא מקליטים קריינות אנושית |

לאחר 1–3 יש לך **9 מתוך 13 השוטים** בלי לשלם שקל.

---

## שתי הערות על הסביבה הזו

1. **שרתי MCP מרוחקים (Runway) דורשים אישור OAuth בסשן אינטראקטיבי.** אני לא יכולה לאשר
   אותם מכאן — צריך להוסיף את ה-connector דרך ההגדרות ולהתחבר, ואז הם יהיו זמינים.
2. גם היום כבר מחוברים אצלך Canva, Gmail, Google Drive ו-AEM — **אבל לא מאומתים**. Canva
   רלוונטי פה (הוא כן עושה עריכת וידאו בסיסית), אז אם תאמתי אותו הוא נכנס לתמונה כאלטרנטיבה
   קלה ל-DaVinci.

---

## מקורות

- [Runway MCP — official](https://runway.com/mcp)
- [Claude Code Video Toolkit — Remotion, Manim, Playwright recording, FFmpeg](https://github.com/wilwaldon/Claude-Code-Video-Toolkit)
- [fal-mcp-server (PyPI)](https://pypi.org/project/fal-mcp-server/) · [luminarylane/fal-mcp-server](https://github.com/raveenb/fal-mcp-server)
- [alohc/veo-mcp-server](https://github.com/alohc/veo-mcp-server)
- [AceDataCloud/KlingMCP](https://github.com/AceDataCloud/KlingMCP)
- [ElevenLabs MCP announcement](https://elevenlabs.io/blog/introducing-elevenlabs-mcp) · [claude-code-elevenlabs-mcp](https://github.com/wynandw87/claude-code-elevenlabs-mcp)
- [misbahsy/video-audio-mcp — FFmpeg MCP](https://github.com/misbahsy/video-audio-mcp)
- [Higgsfield MCP — Sora, Veo, Kling from Claude Code](https://claudefa.st/blog/tools/mcp-extensions/higgsfield-mcp)
- [Best MCP connectors for AI image & video — Artlist](https://artlist.io/blog/the-best-mcp-connectors-for-ai-image-and-video-generation-in-2026/)
- [I built a video post-production pipeline with Claude Code. It failed.](https://wonderingaboutai.substack.com/p/i-built-a-video-post-production-pipeline)
