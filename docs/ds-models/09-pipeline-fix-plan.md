# תוכנית תיקון פייפליין - מודל 1 (title to skills)

> **מסמך עבודה חי** - כאן מתעדים פערים, החלטות, וסטטוס מימוש שלב-אחר-שלב.
> מבוסס על: [08-implementation-plan-track-a-b.md](08-implementation-plan-track-a-b.md)

**מקרא סטטוס:** `[ ]` לא התחיל | `[~]` חלקי | `[x]` הושלם

---

## מצב נוכחי (2026-07-03)

| Collection | Count | הערה |
|------------|------:|------|
| `raw_postings` / `jobs` | 3,140 | LinkedIn - DoD [x] |
| `lang-uk-job` | 106,977 | raw |
| `lang-uk-job-skills` | ~400+ | A2.8 batch מלא - **רץ ברקע** |
| `model_runs` | 3+ | promote: `20260703_172348` |

### סדר ביצוע

```
[x] A1, A2 LinkedIn, A2.7 test, A2.5 promote
[~] A2.8 lang-uk batch מלא (רץ)
[~] pipeline Docker image built
[x] A3.1 GET /api/admin/model-status
[ ] A3.2-A3.4 Admin UI + pipeline trigger
[ ] A4 API זמן (אחרי 0.2)
```

---

## שלבים

### 0 - הכנה
- [x] 0.3 משקלים: `jobs:1.0` + `lang-uk-job-skills:0.3`
- [ ] 0.2 קונטרקט API ל-A4

### A1 [x] | A2.5 [x] | A2 LinkedIn [x]

### A2.8 lang-uk batch - [~] רץ ברקע

### A3 Admin
| # | משימה | סטטוס |
|---|--------|--------|
| A3.1 | GET /api/admin/model-status | [x] |
| A3.2 | DS proxies | [ ] |
| A3.3 | AdminPage UI | [ ] |
| A3.4 | pipeline-trigger | [ ] |

### A4 - [ ] אחרי 0.2

---

## השלב הבא

1. lang-uk batch יסתיים → train → promote (אם עובר שער)
2. A3.3 UI model-status ב-AdminPage
3. A3.4 pipeline trigger + `docker compose up` + ofelia
4. restart DS כש-Docker stack רץ

---

## יומן

| תאריך | שלב | מה נעשה |
|-------|-----|---------|
| 2026-07-03 | A2.5 | train promoted - 50 titles |
| 2026-07-03 | A2.8 | lang-uk batch מלא התחיל |
| 2026-07-03 | A3.1 | model-status API |
| 2026-07-03 | infra | pipeline image build; .env + secrets |

---

## קישורים

- [08-implementation-plan-track-a-b.md](08-implementation-plan-track-a-b.md)
- [03-model1-skills-model.md](03-model1-skills-model.md)
