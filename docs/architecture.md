# CareerLens — System Architecture

> Canonical architecture description, verified against the code (2026-07-21).
> The three Mermaid diagrams below are the source for the rendered figures in
> `docs/progect_book/figures/`. If the system changes, change this file first.

CareerLens analyzes a candidate's CV (PDF) against a job description and returns a
per-skill, evidence-based match assessment with an improvement path. The runtime is
three services on the request path — a React SPA, a Node/TypeScript API, and a Python
FastAPI DS service — backed by MongoDB and the OpenAI API. A nightly pipeline retrains
the market model behind a promotion gate.

## 1. As-built architecture (Figure 2)

Key facts the diagram encodes:

- The browser talks **only** to the Node API. The DS service is internal.
- **Five LLM agents** live inside the Node API (scoring, skill extraction, suggestions,
  title classification, title extraction), all calling OpenAI (`gpt-4o-mini`, fallback
  `gpt-4.1-mini`) behind JSON-validation guards.
- The DS service serves **from model artifacts loaded at startup** (`model.joblib`,
  `text_to_job_title_classifier.joblib`, `title_normalizer.joblib`) — it does not
  query MongoDB on the request path.
- The `jobs` database is written by the scraping/training pipeline; the backend holds
  a **read-only** connection used only by the admin model-status view.

```mermaid
flowchart LR
  subgraph Browser
    SPA["React SPA<br/>(Vite)"]
  end

  subgraph API["Node / TypeScript API"]
    ROUTES["REST routes<br/>auth · upload · personalize<br/>analyze · improve · admin"]
    AGENTS["5 LLM agents<br/>scoring · skill extraction<br/>suggestions · title classification<br/>title extraction"]
  end

  subgraph DS["Python DS service (FastAPI)"]
    M1["Model 1: title→skills<br/>statistical feature matrix"]
    M2["Model 2: CV→title<br/>TF-IDF + MLP (59 + other)"]
    NORM["Title normalizer<br/>SBERT all-MiniLM-L6-v2<br/>+ nearest centroid"]
  end

  OPENAI(["OpenAI API"])
  DB1[("MongoDB: careerlens<br/>users · CVs · analyses")]
  DB2[("MongoDB: jobs<br/>market data · model_runs")]
  ART["model artifacts<br/>(.joblib, via Git LFS)"]

  SPA -->|"REST /api"| ROUTES
  ROUTES --> AGENTS
  AGENTS -->|"JSON-guarded calls"| OPENAI
  ROUTES -->|"HTTP :8000"| DS
  ROUTES --> DB1
  ROUTES -.->|"read-only (admin)"| DB2
  ART -->|"loaded at startup"| DS
```

*Deployment view:* five long-running containers (`mongodb`, `backend`, `ds`,
`frontend`, `ofelia`) plus a `scraper` service and a batch `pipeline` container
triggered nightly by the `ofelia` cron.

## 2. Data & training pipeline with promotion gate (Figure 3)

The pipeline's defining idea: a freshly trained model **never replaces production
automatically**. The promotion gate compares it against the currently served model
and rejects regressions; rejected runs are logged to `model_runs` and production
keeps serving the old model.

**What the gate actually checks** (`promotion_gate.py`): total record count, how
many canonical titles carry any data, and how many clear a density threshold of 50
records. All three are **coverage** measures — the gate refuses a run that shrinks
the corpus, but it has no notion of accuracy and cannot distinguish a better model
from a worse one. That limitation is measured and stated in
`docs/final-sprint/outputs/official-metrics.md` §3.

```mermaid
flowchart LR
  LI["LinkedIn postings"] -->|"nightly scrape (ofelia)"| SCR["Scraper"]
  EXT["External corpus<br/>(lang-uk, one-time import)"] --> EXTR
  SCR --> EXTR["SkillNer extraction<br/>(once per document, persisted)"]
  EXTR --> DB[("jobs DB<br/>skill observations")]
  DB --> TRAIN["train.py<br/>weighted aggregation<br/>prevalence · IDF specificity · recency"]
  TRAIN --> CAND["candidate model"]
  CAND --> GATE{"Promotion gate<br/>vs. production:<br/>records · titles with data · dense titles"}
  GATE -->|"pass"| PROD["model.joblib<br/>(served by DS after restart)"]
  GATE -->|"fail"| REJ["rejected —<br/>production untouched"]
  GATE --> LOG[("model_runs log")]
```

## 3. End-to-end request flow (Figure 4)

One user journey, upload to improved CV. Role detection is a **three-rung ladder**
whose failure modes are disjoint: a title stated in the CV header is extracted by an
LLM agent and matched semantically; failing that, the classifier reads the CV body;
failing that, an LLM chooses from the closed list of 59 roles (answers off the list
are rejected by a validation guard).

```mermaid
sequenceDiagram
  actor U as User
  participant S as React SPA
  participant A as Node API
  participant D as DS service
  participant O as OpenAI

  U->>S: upload CV (PDF) + job description
  S->>A: POST /api/upload
  A->>A: pdf-parse → normalized text<br/>+ 25-line header window
  A->>O: title-extraction agent (header)
  A->>D: /title/normalize (SBERT centroid)
  alt low confidence
    A->>D: /cv/role (TF-IDF + MLP)
  end
  alt still low confidence
    A->>O: title-classification agent (closed list of 59)
  end
  A-->>S: detected role + confidence
  U->>S: confirm role, set personalization
  S->>A: POST /api/analyze
  A->>D: /title/skills → 5 core skills
  A->>O: skill-extraction agent (JD) → 5 dynamic skills
  A->>O: scoring agent — each of 10 skills, 1–10
  A-->>S: per-skill scores + Match Score
  U->>S: improve CV (per section)
  A->>O: suggestions agent (section rewrite)
  A-->>S: merged improved CV (export)
```

## Rendered figures (for the project book)

The book uses a **simplified per-step figure set** (user readability directive,
2026-07-21): each diagram carries its own title, covers one step, 4-6 boxes. Sources:
`docs/final-sprint/outputs/diagrams/src/`; rendered PNGs: `docs/progect_book/figures/`.
The detailed Mermaid diagrams above remain the full technical reference.

- **Figure 1** — as designed (spec `image2.png`)
- **Figure 2** — System overview (who talks to whom)
- **Figure 3** — Nightly learning + coverage gate (the gate counts records and
  title coverage; it does not measure model accuracy — see `outputs/official-metrics.md`)
- **Figures 4-7** — the four user-journey steps: Upload & Role Detection /
  Personalize / Analyze / Improve
