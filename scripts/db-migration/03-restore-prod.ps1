<#
.SYNOPSIS
  Restore the local dump into production.

.DESCRIPTION
  Additive by default: mongorestore WITHOUT --drop inserts new documents and skips any
  _id that already exists. It does NOT update existing documents - MongoDB's restore
  tooling has no merge mode. See section 4.0 of the runbook.

  -Drop is the destructive path: it DELETES each target collection before inserting.
  It refuses to run without both -IAcknowledgeDataLoss and an on-disk production backup.

  Restores collection by collection so a failure part-way through is legible and
  resumable, rather than leaving one opaque half-finished archive.

.PARAMETER DumpDir
  Folder produced by 02-dump-local.ps1. Defaults to the newest one found.

.PARAMETER Drop
  Delete target collections before inserting. Requires -IAcknowledgeDataLoss.

.PARAMETER Force
  Skip the interactive confirmation (for unattended runs).

.EXAMPLE
  .\03-restore-prod.ps1
  .\03-restore-prod.ps1 -Drop -IAcknowledgeDataLoss
#>
[CmdletBinding()]
param(
    [string]$DumpDir,
    [switch]$Drop,
    [switch]$IAcknowledgeDataLoss,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$prod = Get-RequiredUri 'PROD_URI'

if (-not $DumpDir) {
    $newest = Get-ChildItem -Path $script:OutRoot -Filter 'manifest.json' -Recurse -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $newest) { throw "No dump found under $script:OutRoot. Run 02-dump-local.ps1 first." }
    $DumpDir = $newest.DirectoryName
}
$manifestPath = Join-Path $DumpDir 'manifest.json'
if (-not (Test-Path $manifestPath)) { throw "No manifest.json in $DumpDir" }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

Write-Section "Restore plan"
Write-Host "  Dump:    $DumpDir"
Write-Host "  Created: $($manifest.createdUtc)"
Write-Host "  Target:  $(Hide-Credentials $prod)  db=$script:TargetDb"
if ($Drop) {
    Write-Host "  Mode:    --drop  (DESTRUCTIVE - target collections are deleted first)" -ForegroundColor Red
} else {
    Write-Host "  Mode:    additive (insert-only; existing _id values are skipped, not updated)" -ForegroundColor Green
}
foreach ($m in $manifest.collections) {
    Write-Host ("    {0,-28}{1,10:N0} docs  {2,8:N2} MB" -f $m.collection, $m.docs, $m.sizeMB)
}

# --- safety gates -----------------------------------------------------------------
if ($Drop -and -not $IAcknowledgeDataLoss) {
    throw "-Drop requires -IAcknowledgeDataLoss. Re-read section 4.0 of the runbook first."
}
if ($Drop) {
    $backup = Get-ChildItem -Path $script:OutRoot -Filter 'prod-full.gz' -Recurse -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $backup) {
        throw "No production backup found under $script:OutRoot. Run 01-backup-prod.ps1 before using -Drop."
    }
    $ageH = [math]::Round(((Get-Date) - $backup.LastWriteTime).TotalHours, 1)
    Write-Host "  Backup:  $($backup.FullName) (${ageH}h old)" -ForegroundColor Yellow
    if ($ageH -gt 24) {
        Write-Host "  WARNING: backup is over 24h old. Consider re-running 01-backup-prod.ps1." -ForegroundColor Yellow
    }
}

Write-Section "Production state before restore"
$names  = @($manifest.collections | ForEach-Object { $_.collection })
$before = Get-CollectionCounts -Uri $prod -Db $script:TargetDb -Names $names
if ($before.Count -eq 0) {
    Write-Host "  None of these collections exist yet - clean target." -ForegroundColor Green
} else {
    foreach ($k in ($before.Keys | Sort-Object)) {
        Write-Host ("  {0,-28}{1,10:N0} docs  <- already present" -f $k, $before[$k]) -ForegroundColor Yellow
    }
    if (-not $Drop) {
        Write-Host ""
        Write-Host "  These will NOT be updated. Matching _id values are skipped silently." -ForegroundColor Yellow
    }
}

if (-not $Force) {
    $answer = Read-Host "`nProceed with restore? Type YES to continue"
    if ($answer -ne 'YES') { Write-Host "Aborted." -ForegroundColor DarkGray; exit 1 }
}

Write-Section "Restoring"
$swAll = [Diagnostics.Stopwatch]::StartNew()
$done = 0
foreach ($m in $manifest.collections) {
    $file = Join-Path $DumpDir $m.file
    if (-not (Test-Path $file)) { throw "Missing archive: $file" }

    Write-Host ("  {0,-28} " -f $m.collection) -NoNewline
    $sw = [Diagnostics.Stopwatch]::StartNew()

    $restoreArgs = @(
        "--uri=$prod"
        '--gzip'
        "--archive=$file"
        "--nsFrom=$($manifest.sourceDb).$($m.collection)"
        "--nsTo=$script:TargetDb.$($m.collection)"
        '--numInsertionWorkersPerCollection=4'
        '--quiet'
    )
    if ($Drop) { $restoreArgs += '--drop' }

    & mongorestore @restoreArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED" -ForegroundColor Red
        throw "mongorestore failed on '$($m.collection)' (exit $LASTEXITCODE) after $done collection(s). Fix the cause and re-run; completed collections restore idempotently without --drop."
    }
    $sw.Stop()
    $done++
    Write-Host ("{0,6:N1}s" -f $sw.Elapsed.TotalSeconds) -ForegroundColor Green
}
$swAll.Stop()

Write-Host ""
Write-Host "  Restored $done collection(s) in $([math]::Round($swAll.Elapsed.TotalMinutes,2)) min" -ForegroundColor Green
Write-Host "  Next: .\04-verify.ps1" -ForegroundColor Cyan
