# שלד משפטי המפתח - מה חייב להופיע בכל סקשן

> **מה זה:** מפת החוזה של הספר. לכל סקשן - הטענות/משפטים נושאי-המשקל שחייבים לשרוד כל
> עריכה עתידית. משפט מפתח שנמחק = טענה מרכזית שאבדה - לזהות ולהחזיר. ציטוטים באנגלית = הנוסח בספר
> (מותר לנסח מחדש, אסור לאבד את הטענה). 🔒 = מספר/עובדה שמקורה `official-metrics.md` בלבד.
>
> נלווה: [דוח שיפורים ונקודות חולשה](../../final-sprint/outputs/09-book-improvements-and-weaknesses.md)

---

## Front Matter

### Executive Summary (250-300 מילים)
1. הבעיה + העוגן: **88% of employers admit qualified candidates are vetted out** [1].
2. תזת האסימטריה: "employers analyze candidates with NLP; candidates answer with a text editor."
3. שלושת סוגי האינטליגנציה: מודל שוק סטטיסטי + מסווג מפוקח + 5 סוכני LLM עם JSON guards.
4. הממצא המרכזי: 🔒 **89.7% Top-1 בצינור המלא מול 55-62% לרכיב החזק ביותר** - "the shipped role detector is a ladder."
5. 🔒 precision@10 **97%** למודל השוק.
6. החולשות בגוף ראשון: σ=0.11 יציב אבל הפרדת-fit חלשה **כי הפרומפט לא רואה את המשרה**; הסכמה אנושית לא נמדדה בהחלטה.
7. משפט הסיום: הספר מתעד "the measured evidence — including the open questions — behind every claim."

### Acknowledgments
- תודה למנחה ד"ר גלית חיים + "insisting, at each checkpoint, that we measure before we claim."

---

## 1. Introduction

### 1.1 Background
- "Modern hiring begins with a machine reading text."
- 88% [1] + "The rejection... is frequently about phrasing rather than ability."
- תזת האסימטריה ("analytical lens").

### 1.2 Problem Statement
- ההגדרה הקומפקטית: PDF+JD → per-skill evidence-based assessment + actionable path, **בלי** שהמועמד ידע לאיזה מ-59 התפקידים הוא שייך, **בלי** ציון אטום יחיד.
- פירוק לתתי-בעיות: extraction / role-ID / which-10-skills / scoring-on-evidence / rewrite-without-destroying.

### 1.3 Objectives
- ההפרדה: מה הובטח באפיון מול מה שנוסף ("the scope grew").
- הרשימה שנוספה: auto role detection, personalization, saved-CV comparison, nightly pipeline+gate.

### 1.4 Scope and Limitations - סעיף הגבולות; נשמר במלואו
- English-only.
- 🔒 **33 of 59 roles trained on synthetic title strings without real CV bodies** + ההשלכה המדידה.
- פרטיות: Mongo per-user + נשלח ל-OpenAI + deletion endpoint קיים.
- LLM non-deterministic - σ מדווח בפרק 5.
- URL fetching: JSON-LD/OG בלבד, לא אתרי-login.

### 1.5 Methodology
- לולאת build–measure–fix; ה-audit האדוורסרי ("went looking for the ways we might be fooling ourselves").
- "a data-leakage problem whose correction lowered our headline numbers while raising our confidence in them."
- קורפוס 32 קו"ח מתויג.

### 1.6 Organization
- מיפוי פרקים 2-6 + הדגשת §5.6 (planned vs built).

---

## 2. Literature Review (מקור: literature-dossier בלבד; [1]-[15] ותו לא)

| סקשן | טענת העוגן שחייבת להופיע |
|---|---|
| 2.1 | שני גופי ידע: empirical hiring + NLP; "We deliberately include work that argues against our own design choices." |
| 2.2 | [1] 88% + hidden workers; [2] ביקורת שקיפות שמחייבת **גם אותנו** |
| 2.3 | [3] מחסור בקורפוסים מתויגים ⇒ הבחירה שלנו ב-extractor מוכן ולא NER מאומן |
| 2.4 | [4] SkillSpan: הקצה המפוקח; SkillNer [5] = הקצה הדטרמיניסטי שלנו; **המחיר: recall ceiling** |
| 2.5 | [6] IDF; [7] "linear is often enough" ⇒ מסגור הציפיות מ-TF-IDF+MLP; ההערה שה-serving מסנן ubiquity בפילטר פשוט (לא specificity) |
| 2.6 | [8] SBERT + [9] nearest-centroid = הצדקת ה-normalizer בדיוק למשטר few-examples |
| 2.7 | [10] conSultantBERT = **המתח החד בסקירה** (embeddings>TF-IDF אצלם) + שלושת קווי ההתיישבות + "we return to it in Chapter 5" |
| 2.8 | [11] ~80% agreement אבל ביאסים; [12] positional bias ⇒ single-answer grading שלנו עוקף מבנית; scale **0-10** |
| 2.9 | [13] העוגן לניתוח שוק-עבודה; ההודאה שספרות trend-mining טמפורלי דלה |
| 2.10 | [14] shortcut learning + [15] leakage taxonomy = "the methodological backbone of our evaluation"; סיפור ה-77% בלי מספרי האב-טיפוס |

---

## 3. Research (פרק הסיפור - רציפות סיבתית חובה)

### 3.1 מודל 1
1. הפיבוט: "One day after... a mandatory proof of concept" - ה-POC החליף את תוכנית 9 השבועות.
2. מודל-זירו: **3 ימים**, 8,486 כותרות, spot check אחד ('python developer' → 3/5 רעש), "the replacement's noise blacklist still contains those exact three outputs."
3. התחליף "barely a model at all, and that was the point" → צמיחה ל-59 + prevalence/specificity[6]/time-features.
4. קשת המקורות: חברה אחת (24 postings) → AllJobs+תרגום נזנח → Glassdoor never attempted → LinkedIn ("it paid off") → **lang-uk = time machine**.
5. גילוי הפייפליין המת תוך מיפוי ארכיטקטורה ("the scraper wrote to a local file, and the trainer read from a collection that nothing populated") → לידת ה-**promotion gate** → 3 ריצות אמת (2 נדחו, 1 קודמה).
6. ה-specificity שלא נקרא: "the code answering live requests never read it"; הסימפטום: **backend כסקיל #1 של Frontend**; התיקון: ubiquity filter+retrain; 🔒 **97% relevant** והקונטמינציה נעלמה; "The specificity feature remains computed and unread to this day."
7. הלקח: "a feature that is computed but never consumed is not a feature."

### 3.2 מודל 2
1. "began with a suspiciously excellent number" (אב-טיפוס 38 מחלקות) → **77% מהקו"ח הכילו את הלייבל מילולית** → scrubbing → "a worse number and a far better model" [14][15].
2. כלל הציטוט: **אפס מספרים מהאב-טיפוס** ("its within-corpus scores describe a system that no longer exists").
3. כישלון ה-stop-words: F1 ~**0.2** - "label words *are* content words" ⇒ scrub כירורגי per-document.
4. מרחב הלייבלים 65→38→**59+`__other__`**.
5. הגשר הסינתטי ל-33: החלופות שנשקלו, "the cost... only became visible in measurement."
6. baseline: LogReg **57.6%** מול MLP **62.3%** - רק על scrubbed; **component-only**, לצד ההפניה למספר המערכתי בפרק 5.

### 3.3 הסולם
1. רגקס = "a real contender, not a placeholder"; הלקח המגדיר: **"a CV is not structured, everyone writes their own."**
2. ה-KNN התווי: **iOS→Kernel** ("both contain os"), JavaScript→Java, SQL→Frontend - "Spelling similarity is not semantic similarity."
3. רעיון ההיפוך: bidirectional role-skill inference (occupation prediction from skill profiles, [13]).
4. הסולם: SBERT+centroids [8][9] → classifier → closed-list LLM עם hallucination guard ("a fallback that can invent roles is worse than no fallback").
5. "Detection... is a system property... the ladder's failure modes are disjoint."
6. המחברת ההפוכה: תיקו head-to-head; הממצא האמיתי - **הסכמה בין שני כיוונים > confidence עצמי** ("one witness testifying about itself") → agreement signal.
7. ממצא ה-wiring: "the backend never called that endpoint at all... verify the wiring, not the wiring diagram."

### 3.4 אפיזודות מוצר
1. **האפס של המנחה**: "a candidate who does not know Linux cannot receive a 1 for it" + רף strong=8.0 - "a score scale... is a product statement, not a statistic."
2. **הרשימה הסגורה**: "There was no design rationale behind this. It was a misunderstanding of the task" + הדלת ששוחזרה ואומתה חיה.
3. **הפיצ'ר שהתאדה**: skill-preferences נעלם במיזוג → חזר כ-Personalization.
4. **data-contract לפני UI** (מסך Personalize) + הרה-דיזיין מונחה-ערכים של ינואר→אפריל.
5. **flow-coverage tests** → הזין את טקסונומיית התרחישים של הקורפוס.

### 3.5 אמון באוטומציה
- "The pipeline had every appearance of health... What it lacked was a single end-to-end assertion."
- המשפט החותם: **"'It runs every night' and 'it works' are different claims, and only the second one is worth reporting."**

---

## 4. System Design and Implementation

### 4.1 Architecture
- 3 שירותים; "the frontend never calls the DS service directly"; jobs DB = read-only מה-backend.
- 5 containers + pipeline + ofelia sidecar; **restart = promotion mechanism**.
- השער הוא **coverage check, not an accuracy check** ("It cannot tell a more accurate model from a less accurate one").
- Figures 2-7.

### 4.2 Data
- SkillNer (EMSI, **31,278 skills**) פועל **פעם אחת ב-ingest**; lang-uk 210,250/141,897 במשקל 0.3; מסגור מכונת-הזמן.
- `observed_at` = הבסיס לכל פיצ'ר זמן.
- **אסימטריית ה-header window** (25 שורות) - "This asymmetry is not elegant, but it is honest engineering."

### 4.3 Implementation
- מודל 1: half-life 14 יום; קטע הקוד prevalence/idf/specificity; **specificity לא נקרא + ubiquity filter env-driven**; קטע קוד ה-gate; "this gate counts records, not accuracy."
- מודל 2: TF-IDF+MLP(256) על **59+`__other__`**; ה-renormalization של top-3 ("that deflation *is* the rejection signal").
- הסולם + הספים (0.55 cosine; 55 fallback) + source tags.
- **agreement signal**: boost/cap/skip + דגל env - "which Chapter 5 does" (ablation).
- 5 סוכנים, gpt-4o-mini temp 0.2, JSON guard, identical-scores discard, keyword fallback; **Match Score = unweighted mean** + הפניה ל-§5.6.
- Personalization scalar; **per-section versioning** + תרחיש ה-UX שכפה אותו; compare-saved.
- Figures 8-11 (המסכים).

### 4.4 Evaluation Metrics (בלי תוצאות!)
- קורפוס 32 (29+3 negative) / 9 תרחישים; "the user experiences the pipeline, not the classifier."
- כיול **per-rung** (cosine מול softmax share); sweep; ablation; determinism probe; coverage recomputed from source.
- סוכן הניקוד: label-free בלבד (stability/bands/keyword-divergence) + **"the team decided... not to run the session"**.
- מודל 1: פרוטוקול עיוור merged-shuffled + מגבלת relevance-vs-informativeness.
- הגשר: "These are the instruments. The next chapter reports what they showed."

---

## 5. Results and Analysis

### 5.1 Setup
- הסביבה מוצהרת (cap 11, floor 0.05, signal ON) + האימות ההתנהגותי (`nice`/`git` תחת defaults).
- "Any deployment that does not set these variables will not reproduce these numbers."
- מערך הניקוד: 8 CV × 3 bands, 24 pairs, 240 ratings + חשיפת 3 הלייבלים הסוטים ("upper bound").

### 5.2 Results - כל המספרים 🔒
- טבלת הכותרת: **26/29 (89.7%) / 27/29 (93.1%) / 0 errors / 3/3 blocked**.
- פירוק הדרגות: extraction 26 קו"ח **92.3%** מול classifier 3 קו"ח 66.7%; "**26 of the 29 CVs never reach the classifier**"; 55.2% isolated ↔ 62.3% component; **"The system's accuracy *is* its architecture."**
- כיול: 60→**80 חינם** (טבלת ה-sweep, Figure 12); בדרגת המסווג "**no threshold separates right from wrong**" (37.1-99.99).
- agreement ablation: 17/29 מול 16/29, 1 helped/0 harmed + **ההסתייגות על שני מקרי ה-agree שעקפו את ה-LLM**.
- coverage: **33/59 (56%)**, התפלגות בינארית; FPGA/malware→C++ במסווג אבל **5/5 דרך הסולם**.
- determinism: זהה ×5.
- מודל 1: **97% מול 96%**, 191 skills, 8 rejects שמתפצלים לפי סוג (cross-role מול vague) - "The contamination class of error is measurably absent."
- הסוכן: **σ=0.11**; רצועות **4.50/4.50/3.84**, margin **0.66**, 6/8+tie+inversion (Figure 13); keyword agreement **49.6%** (4.28 מול 5.73).

### 5.3 Interpretation - שלושת הממצאים
1. "The product's accuracy lives in the architecture, not in any model."
2. "A confidence field is only as meaningful as its worst producer" ⇒ 60→80 מומלץ-לא-מוחל; ההצדקה לסיגנל.
3. "An aggregate metric can hide the finding" - ה-+0.8pp והחלפת סוג השגיאה.

### 5.4 Comparison
- מול ATS/keyword: 50% disagreement = "the quantitative version of the product's thesis."
- מול conSultantBERT: "unapologetically shallower" + הנימוק (אין supervision scale; 56% בלי דאטה בכלל).

### 5.5 Discussion
- **הממצא המרכזי**: `scoreSkills` מקבל רק CV+skills - "the scorer cannot distinguish a matched posting from a mismatched one because it never sees the posting"; מבני, לא ניסוחי; σ קטן פי 6 מה-margin ⇒ לא רעש; Future Work קונקרטי.
- מה לא נמדד + הניסוח: "we would rather report an open question than a manufactured answer."
- **7 המגבלות** (מתייג יחיד; אין רפרנס אנושי; 33/59; n קטן; fixtures authored; קורפוס אוקראיני; תלות env).

### 5.6 Planned vs. Built
- ההצדקה: "the *pattern* of its misses is itself a finding" + שני שורשי הפספוס.
- Figure 1 מול Figure 2 (as-designed מול as-built).
- כל 10 השורות, ולכל אחת עמודת **"What the specification missed"**.
- שלוש התבניות הסוגרות (intelligence-hiding; the costliest deviations are the contribution; weighted שנדחה במוצהר).

## 6. Conclusion and Future Work
- הישגים מול האפיון + 4 היכולות שנוספו.
- "The measured headline is architectural... 89.7% belongs to a *ladder*."
- לקח הכנות: leakage / unread feature / never-called endpoint - "measuring the real path, not the documented one."
- **7 סעיפי Future Work ממוספרים** - כל אחד מעוגן במדידה (posting-context ראשון!).
- הסגיר: "the honest record of that gap as much a deliverable as the system itself."

## References
- **בדיוק [1]-[15]** מהתיק; כל תוספת עתידית - רק לאחר אימות מקור מלא.

## Appendix A
- A.1: דרישת git-lfs + **ערכי ה-env של המדידה** (cap 11 / floor 0.05 / signal 1).
- A.2: **כל 6** נקודות האפיון ממופות + רשימת ה-surface שצמח; שורת ה-history מסומנת **Partial**.
- A.3: שתי רשומות manifest + הסבר acceptable_titles/scenario/negative.

---

# חלק ב' - מאגר חידודים: הפרטים שהופכים דוח לסיפור

> חידודים שמוסיפים עניין ומדגימים את הדרך - הניסויים, השינויים וההחלטות. לכל חידוד:
> הניסוח החד, איפה הוא יושב, וסטטוס - ✔ כבר בספר / ➕ מועמד להוספה (באישור המשתמשת).
> כולם מאומתים מול git / הראיון / official-metrics; אפס המצאות.

## מספרים שמספרים את המסע

| חידוד | הניסוח החד | איפה | סטטוס |
|---|---|---|---|
| **פי 34 קטן יותר - וטוב יותר** | מודל-זירו נדחס מ-4.77MB ל-139KB כשהוחלף: "the model got better by getting 34× smaller" - כי 4.77MB היו *כל הדאטהסט* בתוך ה-artifact | §3.1, ליד סיפור 3 הימים | ✔ נשזר 05/08 |
| **מחברת של 10,115 שורות שנחתכה ב-9,670** | ה-notebook של מודל-זירו איבד 95% מעצמו בהחלפה - הקוד ששרד הוא התמצית | §3.1 | ✔ נשזר 05/08 |
| **מ-24 ל-183,000+** | הסקרייפר הראשון הביא 24 משרות מאתר של חברה אחת; הקורפוס הסופי: 41,745 משרות + 210,250 פרופילים | §3.1 (קשת המקורות; ה-24 כבר בספר, הניגוד המספרי המפורש - ➕) | ◐ |
| **65 → 38 → 59+1** | שלושת גלגולי מרחב הלייבלים כציר-זמן של הבנת הבעיה | §3.2 | ✔ |
| **8,486 כותרות גולמיות → 59 קנוניות** | היחס ~144:1 בין השפה החופשית של השוק לטקסונומיה - זו הצדקת ה-normalizer במספר אחד | §3.1/§4.2 | ➕ |
| **153 קומיטים, 43 ענפים, 63 issues, 39 PRs** (נכון לראיון יולי) | היקף התהליך במספר אחד; לצד "אף ענף נטוש לא הכיל עבודה אבודה" | §5.6 (שורת ציר הזמן) או ES | ➕ |
| **שבועיים = חצי-חיים** | הידע של מודל השוק דועך אקספוננציאלית עם half-life של 14 יום - "המודל שוכח בכוונה" | §4.3 | ✔ (הניסוח הציורי ➕) |
| **8 מתוך 191** | בתיוג העיוור נפסלו רק 8 סקילז - אבל *כל* פסילות המודל הישן היו זיהום-בין-תפקידים ו*כל* פסילות החדש היו כלליות-מדי. הסיפור בפיצול, לא בסכום | §5.2 | ✔ |
| **290 דירוגים שמחכים במגירה** | הגיליון העיוור בנוי, מאומת, ולא הורץ - בהחלטה. שקיפות שאפשר למשש | §5.5 | ✔ |

## רגעי החלטה שמראים שיקול דעת (חומר לשאלות מנחה)

| חידוד | למה זה מעניין | איפה | סטטוס |
|---|---|---|---|
| **ה-13 בביטחון 99.99%** | תחזית שגויה עם confidence 99.99 היא ההצדקה החיה לכך ששום סף לא יציל את המסווג - ולכן נולד סיגנל שני מודלים | §5.2 | ✔ |
| **הצבעה של שני עדים** | "A model's self-reported confidence is one witness testifying about itself" - המשפט שמסביר את סיגנל ההסכמה בלי מתמטיקה | §3.3 | ✔ |
| **תיקון שנמדד ולא הוחל** | מצאנו שסף 80 חינמי - ולא שינינו אותו, כי היינו בתוך הקפאת מדידה. משמעת = ממצא | §5.3 | ✔ |
| **בחרנו לתקן את הסימפטום** | ימים לפני freeze: לא חיווטנו את specificity (סיכון ל-59 תפקידים) אלא הוספנו פילטר פשוט ומדיד. הנדסה תחת אילוץ אמיתי | §3.1 | ✔ |
| **הציון הגבוה בסט כולו - 7.0 - הלך לזוג ה"כמעט"** | Data Engineer CV מול משרת Data Scientist עקף כל זוג תואם - העדות הכי חדה לעיוורון-המשרה | §5.2 | ✔ |
| **המשרה בוחרת מה, לא איך** | "the posting decided *which* ten skills were selected upstream but plays no part in the scoring itself" - ניסוח סיבתי חד של ממצא W1 | §5.5 | ✔ |
| **גשר סינתטי במקום כניעה** | מול 33 תפקידים בלי דאטה: לא צמצמנו טקסונומיה - בנינו גשר ומדדנו את מחירו | §3.2 | ✔ |
| **הפיבוט של פברואר כהחלטה נכונה** | "יום אחרי הדדליין" הפך ל-POC מחייב - והספר טוען שזו הייתה ההחלטה הנכונה, בדיעבד ובמפורש | §3.1 | ✔ |

## אירוניות והיפוכים (הזיכרונות שנשארים אצל הקורא)

| חידוד | הניסוח | איפה | סטטוס |
|---|---|---|---|
| **הסקיל מס' 1 של Frontend היה "backend"** | הבאג הכי ציטוטי של הפרויקט - ופתיח מצוין להרצאה | §3.1 | ✔ |
| **iOS → Kernel** | הכישלון שהוכיח ש"דמיון איות איננו דמיון סמנטי" | §3.3 | ✔ |
| **המערכת מדויקת מכל אחד מחלקיה** | 89.7% לסולם מול 55-62% לרכיב הטוב ביותר - ההיפך מהאינטואיציה "המערכת חלשה כחוליה החלשה" | §5.3/ES | ✔ |
| **הפייפליין שרץ כל לילה ולא עשה כלום** | "every appearance of health" - והלקח שהפך לשער, לגארדים ולקורפוס | §3.1/§3.5 | ✔ |
| **חוסר-הכיסוי מכוסה ע"י הארכיטקטורה** | FPGA/Malware CV: המסווג טועה (C++) אבל הסולם קולע 5/5 - הפער בין רכיב למערכת בדוגמה חיה | §5.2 | ✔ |
| **שכתוב שהוריד את הציון ושיפר את המודל** | "a worse number and a far better model" - הפרדוקס של תיקון הדליפה | §3.2 | ✔ |
| **הפיצ'ר שאף אחד לא מחק** | skill-preferences נעלם במיזוג בלי החלטה - וחזר כמסך שלם. רעיונות שורדים את המימושים שלהם | §3.4 | ✔ |
| **התיעוד אמר שקוראים ל-endpoint. אף אחד לא קרא** | ממצא ה-wiring של השבוע האחרון - "verify the wiring, not the wiring diagram" | §3.3 | ✔ |

## הנחיה לשזירת ה-➕
שלושת המועמדים המובילים (פי-34, המחברת שנחתכה, 24→183K) נכנסים כולם ל-§3.1 - פסקה
אחת מוסיפה את שלושתם בלי לנפח. "153 קומיטים" מתאים יותר למצגת/פוסטר מאשר לגוף הספר.
**לא לשזור בלי אישור המשתמשת** - הספר עבר הגהה סופית.

---

# חלק ג' - מפת הסקשנים: הספר מול התבנית ומול MED

> הכלל המחייב (אישור המשתמשת, 21/07): **כל סעיפי התבנית נשמרים 1:1**; פרק Research
> הוא תוספת במתכונת MED, ולכן המספור זז ב-1+ מהתבנית החל מפרק 3. שום סעיף לא אוחד,
> הושמט או שינה שם.

| התבנית הרשמית | MED (הדוגמה) | הספר שלנו | הערות |
|---|---|---|---|
| Cover page | Cover | Cover | "August 2026, Rishon LeZion"; צוות + מנחה |
| Acknowledgments | Acknowledgments | Acknowledgments | |
| Executive Summary | Executive Summary | Executive Summary | נכתב אחרון |
| Table of Contents | TOC | TOC | נוצר אוטומטית בהרכבה |
| Table of Abbreviations | Abbreviations | Abbreviations | 22 ערכים, כולם בשימוש |
| Table of Figures | Figures | Figures | 13 figures, ממוספרים לפי סדר הופעה |
| 1. Introduction (1.1-1.6) | 1 (1.1-1.6) | **1 (1.1-1.6)** | כל 6 תתי-הסעיפים בשמות התבנית |
| 2. Literature Review (2.1) | 2 | **2 (2.1-2.10)** | 2.1 Overview כנדרש; 2.2-2.10 העמקה נושאית (מותר - הרחבה, לא שינוי) |
| - | **3. Research** | **3. Research (3.1-3.5)** | התוספת במתכונת MED - מסע הניסוי-והטעייה |
| 3. System Design (3.1-3.4) | 4 | **4 (4.1-4.4)** | Architecture / Data / Implementation / Evaluation Metrics - שמות התבנית בדיוק |
| 4. Results & Analysis (4.1-4.5) | 5 | **5 (5.1-5.5)** | Setup / Presentation / Analysis / Comparison / Discussion - שמות התבנית בדיוק |
| - | - | **5.6 Planned vs. Built** | תוספת בדרישת המשתמשת - תת-סעיף, לא מחליף דבר |
| 5. Conclusion & Future Work | 6 | **6** | |
| 6. References | 7 | **7. References** | [1]-[15] |
| 7. Appendix A | Appendix | **Appendix A (A.1-A.3)** | Setup / מיפוי API / Manifest |

**בדיקת ציות מהירה לפני הגשה:** אם סעיף מהעמודה הראשונה חסר בעמודה השלישית - עצור.
נכון ל-05/08: ✅ מלא.

---

# חלק ב'2 - סבב כרייה 2 (05/08): זיכרון הפרויקט + כל דוחות ה-outputs

> נסרקו: 9 קבצי זיכרון, 00-readiness-audit, 06-model1-report, דוחות 18/19, זיכרון
> המתודולוגיה. כללי הציטוט: 🚫 = לספר את הסיפור **בלי** המספר האסור; ⚠️ = מספר ממסמך
> שקדם ל-official-metrics - מותר רק כעובדה היסטורית על גרסה קודמת, לא כמדד של המערכת המוגשת.

## סיפורי תקריות - "היום שבו X נשבר"

| חידוד | הסיפור בשורה | איפה ישתלב | סטטוס |
|---|---|---|---|
| **היום שבו המודל היה ריק** | QA 03/07: `model.joblib` עם 269/269 שורות skills ריקות - `/analyze` שבור לכל משתמש ולכל תפקיד; אובחן כ-artifact ביניים של אימון-בעיצומו; רה-טריין למחרת החזיר הכל | §3.5 (עוד ראיה ל"רץ ≠ עובד") | ➕ |
| **דרגה 1 הייתה קוד מת בפרודקשן** | סיפור המקור של חלון ה-header (§4.2!): הנרמול מחק את שורות-השורה, ה-extractor דילג על "שורה" באורך קו"ח שלם - ודרגת ה-title_extraction מעולם לא נורתה עבור העלאת PDF אמיתית. התגלה תוך הקלטת סרטוני דמו | §3.3 או §4.2 - הבאג שהוליד את האסימטריה המתועדת | ➕ חזק |
| **"Kubernetes" ניצח את "DevOps Engineer"** | רגרסיית הפסיק: פיצול שורות על פסיקים ריסק משפט-summary למילים בודדות, ומילת-buzz בודדת (cosine 0.805 מול "Kubernetes Engineer") עקפה את הכותרת האמיתית ועברה auto-accept בשקט | §3.3 (המשך סיפור ה-header) | ➕ |
| **התיקון שהרס 20/20 - ונתפס באותו תור** | תיקון ה-line-wrap הראשון קיפל אימיילים לתוך שורות כותרת והשמיד את המועמד; סוויטת הרגרסיה תפסה את זה מיד (SOC Analyst, Cryptographer, Kernel Developer - כולם נפלו). הלקח: "לעולם לא לתקן היוריסטיקת header בלי להריץ את כל הסוויטה" | §3.3/§3.5 | ➕ חזק |
| **המדידה שתפסה רגרסיה חיה** | קמפיין M05 עצמו גילה שחיווט W5 גרר SkillNer על כל `/cv/role` (1.2-7.4s מול timeout של 5s) → 503; תוקן ב-`98afe29` (short-circuit כשהסיגנל provably no-op). המדידה כבדיקת-אינטגרציה | §5.1 הערת-אגב או §3.5 | ➕ |
| **הבאג התאום שחיכה באנדפוינט האח** | תיקנו את באג ה-header ב-`/cv/title` - והעתק מדויק שלו נשאר ב-personalize.routes, שגם *העדיף* את הזיהוי-מחדש השגוי על הנכון שנשלח. מסך הציג "Backend Developer" על קו"ח שזוהה נכון כ-Software Engineer | §3.4 (fixed in M14) | ➕ |

## סיפורי משמעת הנדסית - "בנינו שער, והוא עצר גם אותנו"

| חידוד | הסיפור בשורה | איפה | סטטוס |
|---|---|---|---|
| **שחזרנו, הוכחנו שקילות - והשארנו את המקורי** | ה-normalizer בפרודקשן היה בלתי-מתועד; W2 שחזר אותו במחברת, ההשוואה יצאה תיקו מדויק (8 תיקונים מול 8 רגרסיות) - ושער השקילות **סירב להחלפה**. המחברת נשארה כ"מפרט", ה-artifact החי לא נגע | §3.3 | ➕ חזק |
| **+23 נקודות, נמדד** | החלפת ה-KNN התווי ב-SBERT לא הייתה ניחוש: 69.4%→92.6% על אותו held-out split ⚠️ (מדידה היסטורית של ההחלפה) | §3.3 (לצד iOS→Kernel) | ➕ |
| **סינתטי שמודה שהוא סינתטי** | הרה-טריין של M06: 41,745 אמיתיות + 10,800 רשומות המשך 2024-2026 מסומנות `source='augmented-2026'` - כי הקורפוס האמיתי (2020-2023) קודם ל-LLM/RAG, והמוצר חייב להכיר אותם. הדאטה המומצא מסומן, לא מוסתר | §4.2 | ➕ |
| **הקורפוס היה אצלנו כל הזמן** | התוכנית הניחה שצריך לשחזר קורפוס מ-HuggingFace; בפועל ה-Mongo המקומי החזיק את הדאמפ המלא - הפייפליין פשוט הצביע על DB אחר וציפה לשמות שדות מנורמלים. "לפני שמשחזרים - לבדוק מה כבר יש" | §3.1 או להשמיט (קרוב ל-process) | ➕? |
| **2.3 שניות לדוקומנט × 41,745** | SkillNer איטי מדי סדרתית → מקבול ל-12 workers עם checkpoint לכל דוקומנט (הרצה קטועה ממשיכה מאיפה שעצרה) → 773,696 תצפיות, 21,103 סקילז ייחודיים | §4.2 | ➕ |
| **המודל הישן לא היה ניתן לשחזור** | 12,485 רשומות האימון של מודל 1 הישן - בלתי-משוחזרות; זו הצדקת הרה-טריין לא פחות מהאיכות: מודל שאי-אפשר לאמן מחדש הוא התחייבות שאי-אפשר לקיים | §3.1 | ➕ |
| **הסוויטה שבדקה את עצמה** 🚫 | סוויטת ה-POC המקורית ניסתה עד 3 פעמים עד שהציון נפל בטווח שהצוות עצמו הגדיר - מעגליות שזוהתה בביקורת, והסוויטה הודחה ממעמד ראיה. לספר את הזיהוי, **בלי** לצטט את תוצאותיה | §3.5 או §4.4 | ➕ |
| **74 → 52** | ביקורת המוכנות: 8 סוכנים בלתי-תלויים סרקו את הקוד → 74 ממצאים → כל ממצא הותקף ע"י סוכן-מפריך → 52 שרדו, 2 הופרכו. ה"audit האדוורסרי" של §1.5 - עכשיו עם המספרים | §1.5 | ➕ |

## הפתעות בדאטה - "המספר הסתיר את הסיפור"

| חידוד | הסיפור בשורה | איפה | סטטוס |
|---|---|---|---|
| **פיצ'ר ה-Trending היה מת מתמטית** | ספי rising/falling (1.25/0.80) מול טווח יחסים בפועל [0.84, 1.22] - **0 מתוך 60,334** סקילז יכלו אי-פעם להיות rising או falling. תוקן בכיול percentile בטעינת השרת (ה-artifact לא נגע). "פיצ'ר שקיים בקוד ולא יכול לירות = לא קיים" | §3.1 (אח של ה-specificity שלא נקרא!) | ➕ חזק |
| **שגיאת מפתח אחת = 100% "לא אמין"** | הקוד קרא `time_coverage_reliable`; המודל שמר `time_features_reliable` - כל דגלי האמינות היו false. תיקון של שורה | §3.1 (אותה משפחה) | ➕ |
| **תפקידים דלי-דאטה המציאו סקילז** | תפקיד עם 2 רשומות הגיש top-5 של פרגמנטים ("planning execution") → נוסף floor: מתחת ל-25 רשומות - `limited_data: true` ורשימה ריקה, בלי המצאות | §3.1/§4.3 | ➕ |
| **62.3% הוא ממוצע של שני עולמות** ⚠️ | פיצול per-source של המסווג: ~95% על קו"ח מלאים מובנים מול ~56% על תקצירי Djinni קצרים (84% מסט הבדיקה). המספר המעורבב מסתיר התפלגות דו-אופנית. ⚠️ לצטט רק כניתוח היסטורי של ה-checkpoint, לצד המספרים הרשמיים | §5.3 מועמד; דורש ניסוח זהיר | ➕? |
| **הכישלונות של שני הכיוונים מתואמים** | מחברת M18: היכן שהדאטה דל (100-200 דוגמאות למחלקה), שני הכיוונים טועים *יחד* - וסיגנל ההסכמה מתדלדל בדיוק שם. שני עדים שלמדו מאותו ספר דל אינם שני עדים | §3.3 (עומק לסיגנל) | ➕ |
| **איזון לפני הכל** | M18 סבב 2: cap 600 לכל מחלקה + class_weight='balanced' - "שכיחות אסור שתשקלל כותרות". החלטת עיצוב דאטה שקטה שקובעת מה המודל בכלל לומד | §3.3 | ➕ |
| **"AI matched" במקום אחוז** | כשהבחירה מגיעה מ-LLM מוגבל-רשימה, האחוז איננו ציון דמיון - אז ה-UI מציג badge "AI matched" במקום מספר. יושרה בתצוגה: לא להציג מספר שמתחזה למשמעות שאין לו | §3.4 או §4.3 | ➕ |

## הנחיית שזירה לסבב 2
המועמדים בעלי התשואה הגבוהה ביותר: **דרגה 1 המתה** + **Kubernetes** + **התיקון שהרס
20/20** (משפחת ה-header - פסקה ל-§3.3), **Trending המת** + **שגיאת המפתח** + **floor
ההמצאות** (משפחת "קיים בקוד, מת בפועל" - פסקה ל-§3.1), **שער השקילות שסירב** (§3.3),
**74→52** (משפט ל-§1.5), **סינתטי מסומן** (משפט ל-§4.2). כרגיל: **שזירה רק באישור
המשתמשת.** השאר - עתודה למצגת/פוסטר/שאלות מנחה.


---

# נספח שזירה - סבב "הכל מחדש" (05/08, מאושר)

נשזרו לספר (סטטוס ✔): פי-34 + המחברת שנחתכה + 24→183K (§3.1); משפחת "קיים בקוד מת
בפועל" - Trending המת, שגיאת המפתח, floor ההמצאות (§3.1); משפחת ה-header - דרגה 1
המתה, Kubernetes, התיקון שהרס 20/20 (§3.3); +23 נקודות ⚠️ (§3.3); שער השקילות
שסירב (§3.3); 74→52 (§1.5); המודל הריק + הסוויטה המעגלית 🚫 (§3.5); סינתטי מסומן
(§4.2); badge "AI matched" (§4.3); רגרסיית ה-503 שנתפסה במדידה (§5.1).
נוסף: **Figure 14** - ציר הזמן - בפתיחת פרק 3.
מבנה חדש בפרקים סיפוריים: **יעד → דרך → מה השתנה** (הפתרון הסופי פותח כל סקשן).


---

# נספח עדכון - סבב האיזון (05/08, ביקורת המשתמשת)

**הכיוון:** פחות פוסט-מורטם, יותר עבודת גמר ממוקדת; שלוש התזות במרכז; טון בטוח ומדעי.

1. **שלוש התזות נקבעו כחוזה-העל** (מופיעות ב-§1.5, ES ופרק 6): (א) מערכת ולא מודל;
   (ב) מדידת הנתיב האמיתי היא שהפרידה קוד-עובד ממערכת-עובדת; (ג) בחירת סקילז לפי
   משרה ≠ ניקוד מולה - הגבול המבני של מנוע הניקוד.
2. **Appendix B חדש** - "Selected Engineering Incidents": Kubernetes/line-wrap,
   המודל הריק, רגרסיית ה-503, באג האנדפוינט האח. הגוף מפנה; הפירוט שם.
3. **משפטי מחץ שנשמרו (5):** "a worse number and a far better model" | "'It runs
   every night' and 'it works' are different claims" | "verify the wiring, not the
   wiring diagram" | "one witness testifying about itself" | "a score scale is a
   product statement, not a statistic". השאר שוטחו לניסוח עובדתי.
4. **דיוק טענות:** 89.7% מנוסח כ"on the full pipeline, over the 29 positive CVs of
   this evaluation corpus" + הצהרת לא-per-role; מגבלת precision@10 (רלוונטיות בלבד)
   צמודה למספר; טבלת פירוש 57.6/62.3/55.2/89.7 ב-§5.2; 240 מול 290 הוגדרו; שני סוגי
   הסינתטי הובחנו; 24→141,897+210,250 מפורש.
5. **hedging לראיות קטנות:** ablation ההסכמה = "single-case signal... preliminary
   evidence"; דרגת המסווג n=3 = "too few to support a rate".
6. **הפער האנושי** מוצג כ"the evaluation's most significant open item" - מגבלת
   validity רצינית (ציונים, רצועות, והצעות השכתוב - לא מאומתים), לא כהישג שקיפות.
7. **מפתחות שהוסרו מהחוזה** (שוטחו/הועברו): "The gates we build... also stop us",
   "graded its own homework", "PDF text is an adversary", "the moment a failed check
   became an architecture decision", "Ideas outlive their first implementations",
   "also an integration test" (→ Appendix B). **מפתחות חדשים:** ניסוח ה-89.7 המדויק,
   שלוש התזות ב-§1.5, "necessary conditions for validity, not proof of it".
