<#
.SYNOPSIS
  Dump the Tier A + Tier B collections from the local database.

.DESCRIPTION
  Writes ONE ARCHIVE PER COLLECTION into a timestamped folder, plus a manifest.json
  that 03-restore-prod.ps1 reads.

  Why per-collection: mongodump has no --nsInclude (that is a mongorestore option), and
  its only whole-database filter is --excludeCollection, which is a deny-list. A
  deny-list fails open - a collection added later would be swept into production
  silently. One explicit `--collection` call each is an allow-list: it fails closed.

  That matters here, because the collections NOT being copied include dev user data
  (users / cvfiles / cvanalyses / improvementsessions) and ~690 MB of training corpora.

  Tier B is ~755 MB raw and compresses to roughly 130-190 MB.

.PARAMETER SkipLargest
  Omit lang-uk-job-skills (392 MB, 52% of the payload). Costs one counter on the admin
  screen; roughly halves the restore time.

.EXAMPLE
  .\02-dump-local.ps1
  .\02-dump-local.ps1 -SkipLargest
#>
[CmdletBinding()]
param(
    [switch]$SkipLargest
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$local = Get-RequiredUri 'LOCAL_URI'

# Only dump what actually exists locally.
$present = Get-CollectionCounts -Uri $local -Db $script:TargetDb -Names $script:TierB
$wanted  = @($script:TierB | Where-Object { $present.ContainsKey($_) })
if ($SkipLargest) {
    $wanted = @($wanted | Where-Object { $_ -ne 'lang-uk-job-skills' })
}
if ($wanted.Count -eq 0) { throw "No Tier A/B collections found in $script:TargetDb on local." }

Write-Section "Collections to dump"
$total = 0
foreach ($c in $wanted) {
    Write-Host ("  {0,-28}{1,10:N0} docs" -f $c, $present[$c])
    $total += $present[$c]
}
Write-Host ("  {0,-28}{1,10:N0} docs" -f 'TOTAL', $total) -ForegroundColor Cyan

$skipped = @($script:TierB | Where-Object { $wanted -notcontains $_ })
if ($skipped.Count -gt 0) {
    Write-Host "  Not dumped: $($skipped -join ', ')" -ForegroundColor DarkGray
}

$dir = New-OutDir 'local-dump'

Write-Section "Dumping"
$manifest = @()
$swAll = [Diagnostics.Stopwatch]::StartNew()

foreach ($c in $wanted) {
    $file = Join-Path $dir "$c.gz"
    Write-Host ("  {0,-28} " -f $c) -NoNewline
    $sw = [Diagnostics.Stopwatch]::StartNew()

    & mongodump --uri="$local" --db=$script:TargetDb --collection=$c `
                --gzip --archive="$file" --quiet
    if ($LASTEXITCODE -ne 0) { throw "mongodump failed on '$c' (exit $LASTEXITCODE)" }
    if (-not (Test-Path $file)) { throw "No archive produced for '$c'" }

    $sw.Stop()
    $mb = [math]::Round((Get-Item $file).Length / 1MB, 2)
    Write-Host ("{0,8:N2} MB  {1,6:N1}s" -f $mb, $sw.Elapsed.TotalSeconds) -ForegroundColor Green

    $manifest += [PSCustomObject]@{
        collection = $c
        file       = "$c.gz"
        docs       = $present[$c]
        sizeMB     = $mb
    }
}
$swAll.Stop()

$manifestPath = Join-Path $dir 'manifest.json'
[PSCustomObject]@{
    createdUtc = (Get-Date).ToUniversalTime().ToString('s') + 'Z'
    sourceDb   = $script:TargetDb
    totalDocs  = $total
    collections = $manifest
} | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding utf8

$totalMB = [math]::Round((($manifest | Measure-Object -Property sizeMB -Sum).Sum), 2)
Write-Host ""
Write-Host "  Dump complete: $totalMB MB across $($manifest.Count) archives in $([math]::Round($swAll.Elapsed.TotalMinutes,2)) min" -ForegroundColor Green
Write-Host "  Folder: $dir"

Write-Section "Verifying archives (dry run - writes nothing)"
foreach ($m in $manifest) {
    $f = Join-Path $dir $m.file
    Write-Host ("  {0,-28} " -f $m.collection) -NoNewline
    & mongorestore --gzip --archive="$f" --dryRun --quiet
    if ($LASTEXITCODE -ne 0) { throw "Archive for '$($m.collection)' failed --dryRun - do not restore it." }
    Write-Host "OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Next: .\03-restore-prod.ps1 -DumpDir `"$dir`"" -ForegroundColor Cyan
