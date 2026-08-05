# ארכיאולוגיית "מודל-אפס" — המודל הראשון של CareerLens (8–12 באפריל 2026)

מקורות: `5fee9ff` + `a60bca4` (8.4, לידה) → `c3dc7c8` (9.4, עטיפת REST + model.joblib) → `0dc7263` (12.4, ההחלפה, מוזג כ-PR ‎#48 ב-`6500f58` ב-14.4).
כל הציטוטים מתוך `git show <sha>:ds/model/training.ipynb` ו-`ds/model/server.py`.

---

## 1. מה היה מודל-אפס (CODE FACT)

**אלגוריתם:** TF-IDF ברמת מילים על *כותרות משרה גולמיות* + K-Nearest-Neighbors (cosine, ‏10 שכנים) של sklearn. לא היה כאן מודל מאומן במובן של למידה — אלא אחזור שכנים וספירת שכיחויות:

```python
vectorizer = TfidfVectorizer(stop_words='english')
X = vectorizer.fit_transform(titles)                 # 8,486 כותרות גולמיות
knn = NearestNeighbors(n_neighbors=10, metric='cosine')
...
skill_counts = Counter(all_neighbor_skills)
top_5 = [skill for skill, count in skill_counts.most_common(5)]
```

**דאטה:** ‏8,486 מודעות דרושים (LinkedIn + AllJobs) עם סקילים שחולצו ע"י SkillNer‏ (`full_matches` + `ngram_matches`), ובהן **4,727 כותרות ייחודיות** — כולל כותרות בעברית ("דרוש /ה מפתח /ת אפליקציות Native IOS") ורעש סריקה (למשל שאילתת "Security Researcher" שהחזירה מודעות מפתח iOS). (CODE FACT — פלטים שמורים של `df.shape` ו-`value_counts`.)

**למה 4.77MB:** ה-joblib‏ (`4,772,138 bytes` לפי `git cat-file -s`) הכיל את *כל הדאטה הגולמי*:

```python
model_artifacts = {
    'vectorizer': vectorizer,          # אוצר מילים TF-IDF מלא
    'knn_model': knn,                  # מטריצה דלילה של 8,486 וקטורים
    'skills': df['skills'].tolist(),   # 8,486 רשימות סקילים
    'titles': df['title'].tolist(),
}
```

(CODE FACT שההרכב הוא זה; INFERENCE שהנפח נובע בעיקר מרשימות הסקילים והמטריצה של 8,486 השורות.)

**Serving‏ (`c3dc7c8:ds/model/server.py`):** FastAPI עם שני endpoints — ‏`/text/skills` (SkillNer על טקסט חופשי) ו-`/title/skills` שמריץ את לוגיקת 10-השכנים בזמן אמת.

## 2. "ההערכה" והמספרים שנשמרו (CODE FACT)

**לא הייתה הערכה כמותית.** אין train/test split, אין מטריקה, אין מספר דיוק אחד בכל הנוטבוק. ה"evaluation" (כלשון הקומיט "first model evaluation") היה שתי בדיקות ידניות שפלטן נשמר ב-JSON של הנוטבוק:

- ב-`a60bca4`: ‏`'soc'` → ‏siem, investigation, automation, problem solve, security control
- ב-`c3dc7c8`: ‏`'python developer'` → ‏**python, backend, scalable, computer science, best practices**

הפלט השני הוא הראיה המרשיעה: 3 מתוך 5 ה"סקילים" הם רעש גנרי — וזה בדיוק מה שהצוות זכר כ"התוצאות לא היו מספיק טובות".

## 3. מה החליף אותו — `0dc7263` ("done", מאי אליהו, 12.4)

הנוטבוק ירד מ-10,166 ל-~500 שורות (רוב המחיקה: פלטי תמונות base64; המהות: כתיבת סקשן ה-Train מחדש), וה-joblib התכווץ ל-**139,231 bytes** (פי 34).

**הגישה החדשה (CODE FACT):**

1. **קנוניזציה ידנית**: 5 תפקידי POC‏ (`POC_TITLE_VARIANTS`) עם 37 כותרות-וריאנט ("Python Developer"→Software Engineer, ‏"SRE"→DevOps Engineer...).
2. **אגרגציה משוקללת אופליין** במקום ספירת שכנים אונליין: ‏full match‏ = 1.0, ‏ngram נספר רק אם `score >= 0.75` ומשוקלל בציון; דירוג לפי **prevalence**‏ (`score / n_postings`).
3. **ניקוי רעש מפורש**: ‏`UNIVERSAL_NOISE` — סט שחור שכולל מילה במילה את `'scalable'`, `'computer science'`, `'best practices'` (שלושת הפלטים הרעים של מודל-אפס), פלוס `ROLE_NAME_NOISE` (שם התפקיד עצמו לא ייחשב סקיל) ו-`SKILL_NORMALIZE` (מיזוג יחיד/רבים: ‏pipelines→pipeline).
4. **ה-KNN הפך מ"מודל" ל"ראוטר כותרות"**: ‏1-NN בלבד על 37 הווריאנטים, עם `TfidfVectorizer(analyzer='char_wb', ngram_range=(2,4))` (n-גרמות של תווים — עמיד לשגיאות כתיב וקיצורים כמו "SW Engineer"), והסקילים כבר ממוינים מראש:

```python
knn = NearestNeighbors(n_neighbors=1, metric='cosine')   # היה n_neighbors=10
```

וב-`server.py`:

```python
# Snap to the nearest POC role (n_neighbors=1)
matched_role = skills_data[indices[0][0]]
# Skills are pre-sorted by aggregated score — take top 5 directly
top_5 = matched_role[:5]
```

5. **חיבור לבקאנד** באותו קומיט: ‏`backend/src/services/dsModel.ts` הוחלף ממוֹק לקליינט axios אמיתי מול השרת (`DS_MODEL_URL`), ונוסף `analyze.routes.ts`.

## 4. למה ההחלפה הגיונית בדיעבד (INFERENCE, מגובה בראיות קוד)

- **בעיית התיווך של מודל-אפס**: הוא חיפש שכנים בין 4,727 כותרות גולמיות ומלוכלכות (כולל עברית ומודעות שגויות מהסריקה), אז 10 השכנים של קלט נתון היו לרוב וריאציות אקראיות — והסקילים הנפוצים ביניהם היו בהכרח הגנריים ביותר ("scalable", "best practices"). ספירת שכיחות פשוטה מקדמת רעש אוניברסלי.
- **הפתרון תוקף כל כשל בנפרד**: כותרות מלוכלכות → מיפוי ידני לתפקידים קנוניים; רעש גנרי → blacklist + שקלול ציוני SkillNer; חוסר עמידות לכתיב → char n-grams; חישוב אונליין כבד → אגרגציה אופליין ופלט ממוין מראש.
- **מחיר מודע**: ויתור על כלליות — המערכת החדשה מכירה רק 5 תפקידים (POC scope), בתמורה לאיכות פלט שאפשר להראות בדמו.
- ה-blacklist שמכיל בדיוק את הפלטים הרעים של הבדיקה הידנית מ-9.4 הוא עדות ישירה שההחלפה הונעה מאותה בדיקה — הקוד "זוכר" את מה שהצוות שכח.

## 5. ציר זמן

| תאריך | קומיט | אירוע |
|---|---|---|
| 8.4 16:20 | `5fee9ff` | לידת הנוטבוק — חקירת דאטה (יריב גולזר) |
| 8.4 17:10 | `a60bca4` | "first model evaluation" — ‏TF-IDF+10NN + בדיקת 'soc' |
| 9.4 20:43 | `c3dc7c8` | עטיפת FastAPI‏ + model.joblib‏ 4.77MB |
| 12.4 13:26 | `0dc7263` | ההחלפה: 5 תפקידים קנוניים, אגרגציה משוקללת, 1-NN, ‏139KB |
| 14.4 | `6500f58` | מיזוג PR ‎#48‏ (`feat/ds-model-may`) |

**חיי מודל-אפס בפרודקשן-POC: ‏9.4 → 12.4 — שלושה ימים.**
