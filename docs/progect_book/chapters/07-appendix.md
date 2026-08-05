# Appendix A

## A.1 Running the System

CareerLens runs as a docker-compose stack of five long-lived containers
(MongoDB, backend, DS server, scraper, frontend) plus the nightly pipeline
container and its cron sidecar. To bring it up from a fresh clone:

1. **Prerequisites:** Docker with docker-compose, Git, and **Git LFS** — the
   trained model artifacts (`.joblib`) are stored with LFS, and a clone without
   it yields pointer files instead of models (the repository's install script
   checks for this and fails with a clear message).
2. **Clone and configure:** `git clone github.com/yaringol/CareerLens`, then
   create the environment files from their tracked `.env.example` templates. The
   backend requires an `OPENAI_API_KEY`; the DS server's ranking configuration
   should be set to the evaluated values (`SKILL_UBIQUITY_CAP=11`,
   `ROLE_COUNT_MIN_PREVALENCE=0.05`, `AGREEMENT_SIGNAL_ENABLED=1`) — Chapter 5
   documents why a deployment on the defaults produces materially different
   rankings.
3. **Start:** `docker-compose up`. The frontend serves the SPA; the backend
   listens under `/api`; the DS server is reachable only from the backend's
   network. Full service-by-service instructions, including running each service
   outside Docker for development, are in the repository README.

## A.2 Specification API → Implemented API

The original specification defined six endpoints. Every one has an implemented
counterpart — under different names, and surrounded by the larger surface the
real user flows required (Section 5.6, row 9).

| Specification | Implemented as | Notes |
|---|---|---|
| `POST /cv/upload` | `POST /api/upload` | Multipart PDF upload; parsing, normalization and the preserved header window happen here |
| `POST /jobs/extract` | `POST /api/jobs/extract` + `POST /api/jobs/fetch-description` | Kept almost verbatim; URL fetching is a separate endpoint using structured-data extraction rather than Selenium |
| `POST /analysis/score` | `POST /api/analyze` (also `/api/analyze/personalized`, `/api/analyze/rescore`) | The personalized variant applies the user's Recommendation Balance; rescore re-scores a fixed skill list |
| `GET /analysis/results/:id` | `GET /api/results/:id` | The match breakdown, core vs. dynamic, per-skill evidence and gaps |
| `GET /cv/optimized` | `POST /api/cv-improve/merge` + `GET /api/cv-improve/sessions/:id` | Improvement became a stateful per-section flow (prepare → suggest → merge) rather than a single GET |
| `GET /history` | `GET /api/cv` (saved-CV library), `GET /api/cv-improve/sessions` | **Partial:** libraries and improvement sessions persist per user, but a unified past-analyses history screen was not built |

Endpoints with no specification ancestor — the grown surface: authentication
(`/api/auth/register`, `/login`, `/password`), role detection (`/api/cv/title`,
`/api/cv/extract-title`, `/api/title/match`), personalization
(`/api/personalize/options`, `/preference`), saved-CV management
(`GET/PATCH/DELETE /api/cv/:id`), background comparison
(`/api/analyze/compare-saved`), and the admin model-status dashboard
(`/api/admin/...`).

## A.3 Evaluation Corpus Manifest (excerpt)

The 32-file evaluation corpus (Section 5.1) is driven by a manifest that binds
every PDF to its ground truth; labels are validated automatically against the
59-title taxonomy. Two representative records:

```json
{
  "file": "backend-senior-strong_Daniel-Peretz.pdf",
  "true_title": "Backend Developer",
  "acceptable_titles": ["Backend Developer"],
  "scenario": "clear-cut",
  "seniority": "senior",
  "strength": "strong",
  "is_negative_fixture": false,
  "notes": "Python/Django/K8s, metrics-rich"
}
{
  "file": "datasci-ml-mid-ambiguous_Yael-Rosen.pdf",
  "true_title": "Data Scientist",
  "acceptable_titles": ["Data Scientist", "Machine Learning Engineer"],
  "scenario": "ambiguous",
  "seniority": "mid",
  "strength": "mid",
  "is_negative_fixture": false,
  "notes": "Title line 'Data Scientist / ML Engineer'"
}
```

The `acceptable_titles` set is what lets Top-3 accuracy be judged fairly on
ambiguous and hybrid careers; `scenario` drives the per-scenario breakdown of
Section 5.2; and the three `is_negative_fixture` records define the guard
behavior the pipeline must show rather than an accuracy denominator.
