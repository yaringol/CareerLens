<#
.SYNOPSIS
  Full backup of the production database. THE rollback artifact.

.DESCRIPTION
  This host is self-hosted MongoDB, not Atlas - there is no managed snapshot to fall
  back on. This dump is the only thing standing between a mistaken --drop and permanent
  data loss. Run it before every restore or seed, even when preflight said production
  looks empty (it costs seconds on an empty DB).

  The archive is written outside the repo and is never committed.

.EXAMPLE
  .\01-backup-prod.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$prod = Get-RequiredUri 'PROD_URI'
$dir  = New-OutDir 'prod-backup'
$file = Join-Path $dir 'prod-full.gz'

Write-Section "Backing up production"
Write-Host "  Source: $(Hide-Credentials $prod)"
Write-Host "  Target: $file"
Write-Host ""

$sw = [Diagnostics.Stopwatch]::StartNew()
& mongodump --uri="$prod" --gzip --archive="$file"
if ($LASTEXITCODE -ne 0) { throw "mongodump failed with exit code $LASTEXITCODE - DO NOT PROCEED." }
$sw.Stop()

if (-not (Test-Path $file)) { throw "Archive was not created - DO NOT PROCEED." }
$mb = [math]::Round((Get-Item $file).Length / 1MB, 2)

Write-Host ""
Write-Host "  Backup complete: $mb MB in $([math]::Round($sw.Elapsed.TotalSeconds,1))s" -ForegroundColor Green
Write-Host ""
Write-Host "  Restore command if rollback is ever needed:" -ForegroundColor Yellow
Write-Host "    mongorestore --uri=`"`$env:PROD_URI`" --gzip --archive=`"$file`" --drop" -ForegroundColor Yellow
Write-Host ""
Write-Host "  KEEP THIS FILE until the migration is verified and accepted." -ForegroundColor Yellow

# Leave a breadcrumb next to the archive so the restore path survives a lost console.
@"
CareerLens production backup
Taken:   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Host:    $(Get-UriHost $prod):$(Get-UriPort $prod)
Size:    $mb MB
Restore: mongorestore --uri="<PROD_URI>" --gzip --archive="$file" --drop
"@ | Set-Content -Path (Join-Path $dir 'RESTORE-ME.txt') -Encoding utf8
