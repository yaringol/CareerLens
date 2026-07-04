# CareerLens Frontend

React + TypeScript UI for the CareerLens POC.

## Setup

```bash
npm install
npm run dev
```

- Dev server: **`http://localhost:8080`** (see `vite.config.ts`).
- API calls use **`/api`** by default; Vite proxies `/api` → backend `http://localhost:8000`.

```bash
npm run build
npm run preview
```

## POC flow (current)

1. **`/upload`** - `UploadScreen`: load jobs, pick PDF, select job, submit.
2. **`/dashboard`** - `SkillsMatchDashboard`: shows last analyze result from `sessionStorage`.

Full step-by-step, contracts, and backend file map: **[`../docs/POC.md`](../docs/POC.md)**.

## Project structure (relevant)

```
frontend/
├── src/
│   ├── App.tsx                 # Routes: /upload, /dashboard
│   ├── pages/
│   │   ├── UploadScreen.tsx
│   │   └── SkillsMatchDashboard.tsx
│   ├── services/
│   │   └── api.ts              # fetchJobs, uploadPdf, analyzeCv
│   └── components/ui/          # CircularGauge, SkillBar, …
├── vite.config.ts              # dev server + /api proxy
└── package.json
```

## Stack

- React 18, TypeScript, Vite, React Router

## Legacy / outdated docs

If you see references to Input/Extract/Results pages or mocked `api.ts`, ignore them - the POC uses **`api.ts` real fetches** as described in `docs/POC.md`.
