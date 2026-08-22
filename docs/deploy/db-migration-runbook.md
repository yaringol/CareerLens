# Local → Production MongoDB Migration Runbook

Status: plan, not yet executed. Written 2026-08-13.

Target URI is supplied at run time and **must never be committed** — not in this file,
not in a `.env`, not in a shell script. Every command below reads it from an
environment variable set in the session only.

---

## READ FIRST — status

### A. Production is a self-hosted MongoDB on a VPS — RESOLVED 2026-08-13

Not Atlas. A `mongod` on a rented host, port 27017 published directly to the internet,
authenticating as `root` via `authSource=admin`. Consequences that differ from the
managed-cluster assumption this runbook originally carried:

- **There is no managed snapshot to fall back on.** Nothing takes automatic backups. The
  `mongodump` in `01-backup-prod.ps1` is the *only* rollback artifact that will ever
  exist. This makes section 7.0 non-negotiable rather than good practice.
- There is no storage tier cap, so the Atlas M0 512 MB concern does not apply.
- Restore throughput is bounded by the **upload link to the VPS**, not by cluster IOPS.

> **Security, stated once:** a `root` account on a publicly reachable 27017 is the exact
> configuration that automated ransomware sweeps look for, and internet-wide scans find
> new hosts within hours. This is orthogonal to the migration and blocks nothing, but it
> is worth restricting 27017 to known IPs (or binding it behind the Docker network and
> reaching it over SSH) before the host carries real user data.

### B. Migration tooling — INSTALLED 2026-08-13

| Tool | Version | Path |
|---|---|---|
| `mongodump` / `mongorestore` | 100.17.0 | `C:\Program Files\MongoDB\Tools\100\bin` |
| `mongosh` | 2.9.2 | `%LOCALAPPDATA%\Programs\mongosh` |

Installed via `winget` (`MongoDB.DatabaseTools`, `MongoDB.Shell`); the Tools directory
was appended to the user `PATH`. The scripts in `scripts/db-migration/` also resolve
these paths themselves, so they work in a shell opened before the install.

### C. This plan is NOT purely additive — it contains two destructive operations

Do not assume update-in-place semantics anywhere. See section 4.0 below.

### D. `mongodump` has no `--nsInclude` — corrected 2026-08-13

`--nsInclude` is a **`mongorestore`** option. `mongodump` accepts only `--db` +
`--collection` (one collection per invocation) or `--excludeCollection` (a deny-list).

This matters beyond syntax: a deny-list **fails open**. Any collection added to local
later would be swept into production silently — including CV text. The scripts therefore
invoke `mongodump` once per collection, producing one archive each plus a
`manifest.json`. That is an allow-list, and it fails closed.

---

## 0. What we are actually migrating

CareerLens uses **two logical databases** (see `docker-compose.yaml:24-25`):

| Env var | DB name | Owner | Contents |
|---|---|---|---|
| `MONGODB_URI` | `careerlens` | App (`backend/src/config/db.ts`) | `users`, `cvfiles`, `cvanalyses`, `improvementsessions`, `roles` |
| `JOBS_MONGO_URI` | `jobs` | Pipeline / DS / admin screen (`backend/src/config/jobsDb.ts`) | `raw_postings`, `lang-uk-job`, `lang-uk-job-skills`, `role_skill_observations`, `role_skill_features`, `model_runs`, `pipeline_runs`, plus all training samples |

**RESOLVED 2026-08-13 by a live inventory of the local instance — everything is in
`careerlens`.** `ds/final/README.md:20` was right and `docker-compose.yaml`'s split is
aspirational. The local `jobs` database holds 1 document total: it contains only
`lang-uk-job`, `raw_postings`, `role_skill_features`, `role_skill_observations` (all
empty — these are the four collections `ensureAdminIndexes` auto-creates at boot, see
5.1) plus a single stray `model_runs` doc. Consequences:

- All `--nsInclude` / `--nsFrom` patterns below use `careerlens.*`, not `jobs.*`.
- In production, `JOBS_MONGO_URI` should point at the **same database** as
  `MONGODB_URI`, matching how local actually runs.
- `role_skill_observations` and `raw_postings` **do not exist with data anywhere** — the
  unified-observations migration and the scraper were never run against this instance.
  They cannot be migrated; the admin screen will show 0 for both regardless.

The DS server itself needs **no database at all**. `ds/model/server.py` loads `.joblib`
artifacts from disk; it never opens a Mongo connection. Nothing in this migration
affects model serving.

---

## 1. Phase 1 — Inventory (read-only, do this first)

### 1.1 Enumerate local databases and collections

```powershell
$env:LOCAL_URI = "mongodb://localhost:27017"   # adjust if auth / docker
mongosh $env:LOCAL_URI --quiet --eval @'
db.adminCommand({listDatabases:1}).databases.forEach(d => {
  if (["admin","local","config"].includes(d.name)) return;
  print("=== " + d.name + "  (" + (d.sizeOnDisk/1048576).toFixed(1) + " MB)");
  const x = db.getSiblingDB(d.name);
  x.getCollectionNames().sort().forEach(c => {
    const s = x.getCollection(c).stats();
    print("  " + c.padEnd(32) + String(s.count).padStart(10) +
          " docs  " + (s.size/1048576).toFixed(1) + " MB  idx " +
          (s.totalIndexSize/1048576).toFixed(1) + " MB");
  });
});
'@
```

Record the output. It drives every size decision below.

### 1.2 Capture the local index definitions

```powershell
mongosh $env:LOCAL_URI --quiet --eval @'
["careerlens","jobs"].forEach(n => {
  const x = db.getSiblingDB(n);
  x.getCollectionNames().forEach(c =>
    printjson({db:n, coll:c, idx:x.getCollection(c).getIndexes()}));
});
'@
```

`mongorestore` recreates indexes from the dump automatically, so this is a
**verification baseline**, not an input. Keep it to diff against Phase 5.

### 1.3 Check the production target's headroom

```powershell
$env:PROD_URI = "<paste at run time — do not save>"
mongosh $env:PROD_URI --quiet --eval "printjson(db.adminCommand({listDatabases:1}))"
mongosh $env:PROD_URI --quiet --eval "printjson(db.hello())"
```

If the target is an **Atlas M0 (free) cluster, the hard cap is 512 MB** — that will not
hold `role_skill_observations` or `raw_postings`. Confirm the tier before committing to
Tier B below; if it is M0, migrate Tier A only and accept zeroed admin counters.

---

## 2. Phase 2 — Decide the migration set

Three tiers. The recommendation is **Tier A + Tier B, never Tier C**.

### Tier A — required for the app to work

| Collection | DB | Why | How |
|---|---|---|---|
| `roles` | `careerlens` | Canonical title catalog behind every role selector (`backend/src/models/job.model.ts:20`) | **Seed, don't migrate** — see 2.1 |

That is the entire functional requirement. Everything else the product serves at
runtime comes from the `.joblib` artifacts and the OpenAI calls.

### 2.1 Prefer seeding `roles` over copying it

`backend/src/scripts/seed.ts` rebuilds `roles` from the DS server's `/titles` endpoint,
which is the single source of truth. Running it against production guarantees the role
catalog matches the deployed model — a copied `roles` collection can silently drift
from the shipped `model.joblib`.

```powershell
cd backend
$env:MONGODB_URI = $env:PROD_URI_APP
$env:DS_MODEL_URL = "http://<prod-ds-host>:8000"
npm run seed
```

Note `seed.ts:33` calls `Job.deleteMany({})` first — it is a **full replace**, which is
what we want on a fresh DB but is destructive if run twice against a live one.

### Tier B — needed only for the admin model-status screen

These back the counters and run history on the admin dashboard
(`backend/src/services/modelStatus.service.ts:131-240`). Without them the screen renders
zeros; `estimatedCount` on a missing collection returns 0 rather than throwing, so
nothing breaks. Migrate them if the admin screen is part of what gets demonstrated.

Measured sizes, local instance, 2026-08-13 (data + index):

| Collection | Docs | Size | Notes |
|---|---|---|---|
| `model_runs` | 2 | ~0 MB | Training run history — highest value per byte, migrate first |
| `cv_title_model_runs` | 2 | ~0 MB | Title-model run history |
| `role_skill_features` | 132,514 | **64.4 MB** | Per-run role/skill features |
| `lang-uk-job` | 141,897 | **299.0 MB** | Raw local corpus |
| `lang-uk-job-skills` | 41,745 | **391.6 MB** | Skill-extracted postings; also the retrain input |
| `role_skill_observations` | — | — | **Does not exist** — never populated locally |
| `raw_postings` | — | — | **Does not exist** — scraper never run locally |
| `pipeline_runs` | — | — | **Does not exist** — no pipeline runs recorded |
| `jobs` | — | — | **Does not exist**; local has `job-PocOnly` (6 docs) instead |

**Tier B total: ~755 MB across 316,160 documents.** Three collections carry all of it.

If space is tight, migrate this list **top-down and stop when the budget runs out** — it
is ordered by value-per-megabyte. Dropping `lang-uk-job-skills` alone saves 392 MB (52%)
and costs one counter on the admin screen.

For reference, the **whole local `careerlens` DB is 1,451.8 MB / 616,148 docs** — so a
naive "copy everything" nearly triples the transfer and drags Tier C along with it.

### Tier C — do NOT migrate

**Local user data — 2.5 MB, and the most sensitive thing in the database.**

| Collection | Docs | Size |
|---|---|---|
| `users` | 42 | 0.1 MB |
| `cvanalyses` | 430 | 1.9 MB |
| `improvementsessions` | 37 | 0.4 MB |
| `cvfiles` | 29 | 0.1 MB |

These are dev test accounts and real CV files. Copying them into production means
publishing personal documents and bcrypt password hashes for accounts nobody intends to
keep. Production starts empty here — the app creates them on first use. Note the size:
excluding them is a privacy decision, never a capacity one.

**Training-only collections — 690 MB.** None are referenced anywhere in `backend/`,
`frontend/`, or `pipeline/`; they are inputs to notebooks that already produced the
shipped `.joblib` files:

| Collection | Docs | Size | Origin |
|---|---|---|---|
| `lang-uk-cv` | 210,250 | **445.0 MB** | Raw CV corpus |
| `lang-uk-cv-skills` | 11,776 | 69.2 MB | Skill extraction over the CV sample |
| `lang-uk-job-sample` | 41,745 | 88.9 MB | commit `908609c` |
| `master-resumes-skills` | 4,792 | 34.8 MB | Skill extraction over master resumes |
| `augmented-2026` | 10,800 | 26.3 MB | `89b2290` |
| `lang-uk-cv-sample` | 11,776 | 14.9 MB | `83f340c` |
| `lang-uk-cv-other-skills` | 1,750 | 8.0 MB | `__other__` class skills |
| `master-resumes-sample` | 4,792 | 5.0 MB | `2cc248d` |
| `lang-uk-cv-other-sample` | 1,750 | 2.1 MB | `d51cd3a` |
| `job-PocOnly` | 6 | ~0 MB | POC leftover |
| `JOB_EXAMPLE` | 0 | 0 MB | Empty shell from `generate_example_jobs.py` |

Leave all of these in the local/research database. If a future retrain needs them, it
runs against local, not production. `lang-uk-cv` alone is 445 MB of third-party CV text —
there is no product reason for it to exist on a production host.

---

## 3. Phase 3 — Dump

Install MongoDB Database Tools first (`mongodump` / `mongorestore` ship separately from
the server since 4.4): https://www.mongodb.com/try/download/database-tools

Dump to the scratch area, **not** into the repo — a stray `.bson` of CV text must never
reach git.

```powershell
$STAMP = Get-Date -Format "yyyyMMdd-HHmm"
$OUT   = "C:\tmp\careerlens-migration\$STAMP"
New-Item -ItemType Directory -Force $OUT | Out-Null
```

### 3.1 App DB — the role catalog only

Skip entirely if seeding per 2.1 (recommended).

```powershell
mongodump --uri="$env:LOCAL_URI" --db=careerlens --collection=roles `
          --gzip --archive="$OUT\careerlens-roles.gz"
```

### 3.2 Tier B — from `careerlens` (not `jobs`; see Phase 0)

**Use the script — `.\02-dump-local.ps1`.** It loops the collections, writes one archive
each plus `manifest.json`, and `--dryRun`-verifies every archive before reporting
success. To drop the largest collection and save 392 MB: `.\02-dump-local.ps1 -SkipLargest`.

The equivalent by hand, if you ever need it — note **one `mongodump` call per
collection**; there is no `--nsInclude` on `mongodump` (see blocker D):

```powershell
foreach ($c in 'roles','model_runs','cv_title_model_runs','role_skill_features','lang-uk-job','lang-uk-job-skills') {
  mongodump --uri="$env:LOCAL_URI" --db=careerlens --collection=$c `
            --gzip --archive="$OUT\$c.gz"
}
```

Never use `mongodump --db=careerlens` without `--collection`: that sweeps in `users`,
`cvfiles`, `cvanalyses`, `improvementsessions` and 690 MB of training corpora.

**Measured 2026-08-13** — the full Tier B dump is **169.58 MB in 17 seconds**:

| Collection | Docs | Archive | Time |
|---|---|---|---|
| `roles` | 13 | ~0 MB | 0.0s |
| `model_runs` | 2 | ~0 MB | 0.0s |
| `cv_title_model_runs` | 2 | ~0 MB | 0.0s |
| `role_skill_features` | 132,514 | 3.78 MB | 0.8s |
| `lang-uk-job` | 141,897 | 88.53 MB | 9.3s |
| `lang-uk-job-skills` | 41,745 | 77.27 MB | 7.2s |
| **Total** | **316,173** | **169.58 MB** | **17s** |

Compression is ~4.5× (755 MB → 170 MB).

Verify the archive before restoring:

```powershell
mongorestore --gzip --archive="$OUT\tierB.gz" --dryRun --verbose
Get-ChildItem $OUT | Select-Object Name, @{n="MB";e={[math]::Round($_.Length/1MB,1)}}
```

`--dryRun` parses the archive and reports what it *would* write without touching the
target — it is the cheapest way to catch a truncated dump.

---

## 4. Phase 4 — Restore

### 4.0 Destructive vs. additive — read before running anything

MongoDB's restore tooling has **no merge/update mode**. Every option is one of these
three, and only the first is non-destructive:

| Operation | Semantics | Destructive? |
|---|---|---|
| `mongorestore` **without** `--drop` | Insert-only. Existing `_id`s are **skipped** with a duplicate-key error that does not stop the run. | No — but it does not update existing docs either |
| `mongorestore --drop` | **Deletes the target collection**, then inserts. | **Yes — total loss of that collection** |
| `npm run seed` (`seed.ts:33`) | Calls `Job.deleteMany({})` — wipes **all** of `roles` — then inserts fresh. | **Yes — full replace of `roles`** |

Two consequences that are easy to get wrong:

1. **"Insert-only" is not "update".** If a document already exists in production with the
   same `_id`, restoring without `--drop` leaves the **production** version in place and
   silently discards the local one. You get neither a merge nor an overwrite. If genuine
   field-level merging is required, that is a purpose-written script — `mongorestore`
   cannot do it.
2. **The seed step is destructive even on the "safe" path.** Section 2.1 recommends
   seeding `roles` instead of copying it; that recommendation carries a `deleteMany({})`
   with it. On a fresh database that is exactly right. Against a production database that
   already has a curated `roles` collection, it destroys it. Check before running.

**On a genuinely empty target, none of this matters** — there is nothing to destroy, and
the whole migration is additive in effect. The risk lives entirely in the case where
production already holds data, which as of this writing is **unverified**.

### 4.1 Safety gate

Confirm the target is empty (or that overwriting it is intended) **before** running
anything with `--drop`:

```powershell
mongosh $env:PROD_URI --quiet --eval "db.getSiblingDB('jobs').getCollectionNames()"
mongosh $env:PROD_URI --quiet --eval "db.getSiblingDB('careerlens').getCollectionNames()"
```

If either returns non-empty and this is not a first deploy, **stop** and get an explicit
decision — `--drop` deletes the production collection before writing.

### 4.2 Restore

Omit `--drop` on a genuinely fresh target; include it only for a deliberate replace.

```powershell
# roles (only if not seeding per 2.1)
mongorestore --uri="$env:PROD_URI" --gzip --archive="$OUT\careerlens-roles.gz" `
             --nsFrom="careerlens.*" --nsTo="careerlens.*"

# Tier B
mongorestore --uri="$env:PROD_URI" --gzip --archive="$OUT\tierB.gz" `
             --nsFrom="careerlens.*" --nsTo="careerlens.*" `
             --numInsertionWorkersPerCollection=4
```

If the production URI pins a different database name in its path, remap explicitly
rather than relying on the URI to win:

```powershell
mongorestore --uri="$env:PROD_URI" --gzip --archive="$OUT\tierB.gz" `
             --nsFrom="careerlens.*" --nsTo="<prod-db-name>.*"
```

Since local keeps everything in one database, set **both** `MONGODB_URI` and
`JOBS_MONGO_URI` to that same database in Phase 6.

---

## 5. Phase 5 — Indexes and verification

### 5.1 Admin indexes are created automatically

`backend/src/config/ensureAdminIndexes.ts` runs at boot from `backend/src/index.ts:4`
and creates indexes on `role_skill_observations`, `raw_postings`, `lang-uk-job`, and
`role_skill_features`. Two consequences:

- Those four indexes need no manual step.
- **On a fresh production DB, that boot call creates those four collections empty even
  if you migrate nothing.** Harmless, but a "clean" production database will not look
  clean — expect them to appear.

Mongoose schema indexes (`cvAnalyses` compound indexes, the `users.email` unique index)
are also built on first connect via autoIndex.

### 5.2 Verify counts match

```powershell
mongosh $env:PROD_URI --quiet --eval @'
["careerlens","jobs"].forEach(n => {
  const x = db.getSiblingDB(n);
  x.getCollectionNames().sort().forEach(c =>
    print(n + "." + c.padEnd(32) + String(x.getCollection(c).countDocuments({})).padStart(10)));
});
'@
```

Diff against the Phase 1.1 baseline. Counts must match exactly for every migrated
collection — `countDocuments` is slow but exact, unlike `estimatedDocumentCount`.

### 5.3 Verify indexes match

Re-run the Phase 1.2 command against `$env:PROD_URI` and diff. Expect the migrated
indexes plus the four from `ensureAdminIndexes`.

### 5.4 Functional smoke test

1. `GET /api/health` (or equivalent) — backend connects to both URIs without throwing.
   `requireMongoUri` (`backend/src/config/mongoUri.ts:5`) throws on a missing/blank var,
   so a startup crash here means an unset env var, not a bad migration.
2. Register a new user → confirms `careerlens` is writable.
3. Load the role selector → confirms `roles` is populated and matches the model.
4. Upload a CV → run analyze → confirms `cvfiles` / `cvanalyses` write paths and the DS
   round-trip.
5. Open the admin model-status screen → confirms Tier B landed (or shows the expected
   zeros if Tier B was skipped).

---

## 6. Phase 6 — Configuration cutover

Set on the production host only — never in a committed file:

| Var | Consumer | Value |
|---|---|---|
| `MONGODB_URI` | backend app DB | prod URI, `/careerlens` |
| `JOBS_MONGO_URI` | backend jobs DB, admin screen | prod URI, `/jobs` |
| `MONGO_URI` | pipeline / DS scripts, ofelia secret | prod URI, `/jobs` |
| `SKILL_UBIQUITY_CAP` | DS server | `11` |
| `ROLE_COUNT_MIN_PREVALENCE` | DS server | `0.05` |

The last two are **not optional**: without them, boilerplate skills like "english" top
every role's skill list on this corpus (`ds/final/README.md:26-28`).

If deploying via `docker-compose.yaml`, the URIs are currently constructed inline from
`MONGO_ROOT_PASSWORD` against the bundled `mongodb` service. Pointing at an external
production cluster means overriding `MONGODB_URI` / `JOBS_MONGO_URI` / `MONGO_URI` per
service and dropping the `mongodb` service plus its `depends_on` conditions.

---

## 7. Rollback

### 7.0 Backup status: NONE EXISTS

As of 2026-08-13 there is **no backup of the production database, and its contents are
unknown.** No connection to production has ever been made from this workstation — there
is no URI. Nothing in this repo has ever touched it. Statements elsewhere in this runbook
about "a fresh/empty target" are an *assumption to be verified in Phase 4.1*, not a
finding.

The only backup that exists is the local database itself (1,451.8 MB), which is a copy of
**local**, not of production. It cannot restore production.

**Therefore, before any `--drop` or any `npm run seed` against production:**

- Managed cluster: take a cloud snapshot/backup (Atlas → Backup → take snapshot now).
  Note that **M0/M2/M5 shared tiers have no automated backup** — on those you must
  `mongodump` the production database yourself and keep the archive.
- Self-hosted / docker-compose: `mongodump` the production database to a file on the host,
  or snapshot the `mongo_data` volume.

That artifact — not this runbook's dumps — is the rollback path.

### 7.1 Rollback procedure

On an empty target the migration is additive in effect, so rollback is:

1. Repoint the env vars at the previous database and restart. This is the fast path and
   should be the default response to trouble during cutover.
2. If a `--drop` restore overwrote real production data, restore from the target's own
   backup/snapshot — **this runbook's dumps cannot recover production data, only
   re-supply local data.** Take a snapshot of the production cluster before any
   `--drop`, and treat that snapshot as the actual rollback artifact.

Keep `$OUT` until the smoke test in 5.4 passes, then delete it — it contains corpus data
and, if Tier C was ever dumped by mistake, CV text.

---

## 8. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `careerlens` vs `jobs` DB layout differs locally from compose | high | Phase 1.1 resolves before any dump is written |
| Atlas M0 512 MB cap can't hold Tier B | medium | Phase 1.3 checks tier; Tier B is ordered so it can be truncated |
| Tier C user data copied by accident | medium | Explicit `--nsInclude` lists only; never `--db` without `--collection` on `careerlens` |
| Production URI leaked into git | medium | Env vars only; `$OUT` is outside the repo; see the standing rule against committing `.env*` |
| `--drop` against a non-empty prod | low | Phase 4.1 gate + pre-migration cluster snapshot |
| `roles` drifts from the deployed model | low | Seed from DS `/titles` (2.1) instead of copying |

---

## 9. Time budget

Based on the measured local sizes in section 2. The **target cluster has not been
measured** — no URI yet — so the restore row is the only genuinely uncertain one, and it
dominates. Upload bandwidth and Atlas tier are the two variables that decide the answer.

### Tier A only (seed `roles`, 13 docs)

| Step | Time |
|---|---|
| Phase 1 inventory + Phase 4.1 gate | 2–3 min |
| `npm run seed` against prod (DS must be up) | < 1 min |
| Smoke tests 1–4 | 10–15 min |
| **Total** | **~15–20 min**, nearly all of it manual verification |

### Tier A + Tier B (755 MB raw → 169.58 MB compressed, 316,173 docs)

Rows marked **measured** were timed end-to-end on 2026-08-13, including a full rehearsal
restore into a throwaway local database.

| Step | Time | Basis |
|---|---|---|
| `00-preflight.ps1` | < 1 min | **Measured** |
| `01-backup-prod.ps1` | 1–5 min | Depends on what production currently holds — **unknown** |
| `02-dump-local.ps1` (dump + dryRun verify) | **17 s** | **Measured**: 169.58 MB |
| `03-restore-prod.ps1`, same machine | **14 s** | **Measured** (rehearsal) |
| `03-restore-prod.ps1`, over WAN to the VPS | **3–10 min** | Estimated: 170 MB upload at 10–40 Mbps = 35–140 s of pure transfer, plus 316k inserts |
| Index build (`role_skill_features`, `lang-uk-job*`) | < 1 min | **Measured**: all indexes carried over in the rehearsal |
| `04-verify.ps1` | < 1 min | **Measured** |
| `npm run seed` (if seeding `roles`) | < 1 min | Needs DS reachable |
| Smoke tests 5.4 | 10–15 min | Human |
| **Total** | **~20–30 min** | Roughly half of it manual testing |

The data movement is far cheaper than originally estimated — the dump is 17 seconds, not
minutes. **Upload bandwidth to the VPS is now the only meaningful variable**, and the
manual smoke test is the largest single block.

### Practical guidance

- **Budget 30 minutes**, one hour if something needs troubleshooting on first contact
  with the host.
- The **dump is already done and staged** (2026-08-13, `C:\tmp\careerlens-migration\`).
  When the host comes up, only backup → restore → verify remain. Re-dump only if local
  data has changed since.
- Dropping `lang-uk-job-skills` (77 MB of the 170 MB archive) is available via
  `-SkipLargest` and costs one counter on the admin screen — worth it only on a slow
  uplink, since the dump itself is no longer a bottleneck.
- The migration is **not** a downtime event on a fresh target: production has no data to
  invalidate, so the restore can run before cutover with the app still pointed at the
  old config. Actual downtime is only the Phase 6 env-var change plus a backend restart —
  **under a minute**.

## 10. Execution checklist

Everything runnable without the production host is **done**. What remains needs the host up.

- [x] A. "Production" resolved — self-hosted MongoDB on a VPS, not Atlas
- [x] B. MongoDB Database Tools 100.17.0 + mongosh 2.9.2 installed and on PATH
- [x] D. `mongodump --nsInclude` corrected to a per-collection allow-list
- [x] 1.1 local inventory captured; DB layout resolved (everything in `careerlens`)
- [x] 2 tier decision recorded — Tier A + B, 316,173 docs
- [x] 3 dump written and `--dryRun` verified — 169.58 MB, `C:\tmp\careerlens-migration\`
- [x] Scripts rehearsed end-to-end against a throwaway local DB — counts and indexes matched
- [ ] **C. Production contents inspected** — `.\00-preflight.ps1` (needs host up)
- [ ] **Backup of production taken** — `.\01-backup-prod.ps1` (mandatory; no managed snapshots exist)
- [ ] 4.1 target emptiness confirmed
- [ ] 4.2 restore completed — `.\03-restore-prod.ps1`
- [ ] 5.2 / 5.3 counts and indexes verified — `.\04-verify.ps1`
- [ ] 2.1 `npm run seed` run against prod (if seeding `roles` — destructive, see 4.0)
- [ ] 5.4 all five smoke tests pass
- [ ] 6 env vars set, including `SKILL_UBIQUITY_CAP` and `ROLE_COUNT_MIN_PREVALENCE`
- [ ] 27017 firewalled to known IPs (see blocker A)
- [ ] `C:\tmp\careerlens-migration\` deleted once accepted
