# DB migration scripts — local → production

Ready-to-run wrappers for [`docs/deploy/db-migration-runbook.md`](../../docs/deploy/db-migration-runbook.md).
Read the runbook's **section 4.0 (destructive vs. additive)** once before the first run.

These scripts contain **no credentials**. Both URIs come from environment variables set
in your shell session only.

## One-time: set the URIs for the session

Open PowerShell in this folder and paste (substituting the real password — this is a
session variable, it is not written to disk and disappears when the window closes):

```powershell
$env:PROD_URI  = "mongodb://<USER>:<PASSWORD>@<HOST>:27017/?authSource=admin"
$env:LOCAL_URI = "mongodb://localhost:27017"
```

The real host and credentials are deliberately **not** written here — this repository is
a submission artifact and may be shared. Keep them in a password manager, not in the repo.

Never put these into a `.env`, a script, or a commit. `.gitignore` blocks the obvious
accidents, but the real control is not typing them into a file in the first place.

## Run order

```powershell
.\00-preflight.ps1                  # read-only: tools, host up?, what's in prod?
.\01-backup-prod.ps1                # THE rollback artifact — always run it
.\02-dump-local.ps1                 # allow-listed dump of Tier A+B   [ALREADY DONE]
.\03-restore-prod.ps1               # additive by default; asks for confirmation
.\04-verify.ps1                     # exact counts + Tier C leak check
```

**Step 2 is already staged** — a verified 169.58 MB dump sits in
`C:\tmp\careerlens-migration\`. When the host comes up, only backup → restore → verify
remain. Re-run `02` only if local data has changed since 2026-08-13.

The production host was down when these were written, so `00-preflight.ps1` can wait
for it:

```powershell
.\00-preflight.ps1 -WaitMinutes 60
```

It polls every 30s and exits with code 2 if the host never answers, so nothing
downstream runs against a dead target.

## Verification status

All four scripts were rehearsed end-to-end on 2026-08-13 against a throwaway local
database (`careerlens_migtest`, since dropped):

| Step | Result |
|---|---|
| Dump | 169.58 MB / 316,173 docs in **17 s**; all 6 archives passed `--dryRun` |
| Restore | 6 collections in **14 s** (same machine) |
| Counts | All 6 collections matched source exactly |
| Indexes | All carried over, incl. `role_skill_features.source_1_title_1_skill_1` |
| Leak check | Clean — no Tier C data |
| Preflight vs. real host | Correctly detected down, exited 2, credentials masked |

The production restore will therefore not be the first execution of this code.

## Server-side scripts (bash)

Because `docker-compose.yaml` never publishes port 27017, the practical path is to move
a bundle to the host and restore there. These run on the production host:

| Script | Purpose |
|---|---|
| `restore-on-server.sh` | Restores the dump. Finds `mongorestore` on the host or falls back to `docker exec` into the mongo container. Additive by default; `--drop` takes a full backup first and aborts if it comes out empty. |
| `verify-on-server.sh` | Exact counts vs. `expected-counts.txt`, training-data leak check, index listing. |
| `install-models.sh` | Copies the four `.joblib` artifacts into place (`--dest <dir>` or `--docker-volume`). |

A ready-to-ship bundle containing these plus the dump and the model artifacts is built
at `C:\tmp\careerlens-transfer\` (~474 MB, or 450 MB as `.tar.gz`). See its `README.md`
for the server-side run order.

**The model artifacts are the part most easily missed.** They are not in MongoDB — the
DS server loads them from disk, and in git they are LFS pointers. A `git clone` without
`git lfs pull` leaves ~130-byte stubs and the DS server fails at load.

## What gets migrated

`_common.ps1` holds the authoritative lists.

**Migrated (Tier A + B)** — `roles`, `model_runs`, `cv_title_model_runs`,
`role_skill_features`, `lang-uk-job`, `lang-uk-job-skills`. About 755 MB / 316k docs,
compressing to roughly 130–190 MB.

**Never migrated (Tier C)** — dev user data (`users`, `cvfiles`, `cvanalyses`,
`improvementsessions`) for privacy, and ~690 MB of training-only corpora that no
production code path reads.

`02-dump-local.ps1` calls `mongodump` **once per collection** rather than dumping the
database with exclusions. `mongodump` has no `--nsInclude` (that is a `mongorestore`
option), and its only whole-database filter is `--excludeCollection` — a deny-list,
which fails open: a collection added to local later would land in production silently.
Per-collection calls are an allow-list and fail closed. `04-verify.ps1` re-checks after
the fact.

Tight on bandwidth? `.\02-dump-local.ps1 -SkipLargest` drops `lang-uk-job-skills`
(77 MB of the 170 MB archive) and costs one counter on the admin screen.

## Useful flags

| Variable | Default | Purpose |
|---|---|---|
| `TARGET_DB` | `careerlens` | Target database name. Local keeps everything in one DB; the production URI pins no database, so the scripts supply it. |
| `MIGRATION_OUT` | `C:\tmp\careerlens-migration` | Where archives are written — deliberately outside the repo. |

## Safety behaviour

- `03-restore-prod.ps1` is **additive by default** — insert-only, existing `_id`s are
  skipped. It never updates existing documents; MongoDB's restore tooling has no merge
  mode.
- `-Drop` is destructive and refuses to run without **both** `-IAcknowledgeDataLoss` and
  an existing `prod-full.gz` backup on disk.
- Every script prints URIs with the credentials masked, so console output and logs are
  safe to paste.
- `01-backup-prod.ps1` writes a `RESTORE-ME.txt` next to the archive with the exact
  rollback command, so the recovery path survives a closed terminal.

## After a successful migration

Set on the production host (runbook section 6):

| Var | Value |
|---|---|
| `MONGODB_URI` | production URI + `/careerlens` |
| `JOBS_MONGO_URI` | **same database** — local never split them |
| `MONGO_URI` | same, for the pipeline/DS scripts |
| `SKILL_UBIQUITY_CAP` | `11` |
| `ROLE_COUNT_MIN_PREVALENCE` | `0.05` |

The last two are not optional — without them boilerplate skills like "english" top every
role's skill list.
