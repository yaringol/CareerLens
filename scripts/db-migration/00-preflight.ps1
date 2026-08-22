<#
.SYNOPSIS
  Read-only preflight for the local -> production MongoDB migration.

.DESCRIPTION
  Verifies tooling, waits for the production host to come up, then inventories BOTH
  sides and tells you whether production is empty or already holds data.
  Writes nothing. Run this first, every time.

  Requires $env:PROD_URI and $env:LOCAL_URI. See README.md in this folder.

.EXAMPLE
  .\00-preflight.ps1
  .\00-preflight.ps1 -WaitMinutes 60      # poll until the host answers
#>
[CmdletBinding()]
param(
    [int]$WaitMinutes = 0,
    [int]$PollSeconds = 30
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

Write-Section "1. Tooling"
$ok = $true
foreach ($t in 'mongodump', 'mongorestore', 'mongosh') {
    $cmd = Get-Command $t -ErrorAction SilentlyContinue
    if ($cmd) {
        Write-Host ("  OK   {0,-14} {1}" -f $t, $cmd.Source) -ForegroundColor Green
    } else {
        Write-Host ("  MISS {0,-14} not on PATH" -f $t) -ForegroundColor Red
        $ok = $false
    }
}
if (-not $ok) {
    throw "Install MongoDB Database Tools and mongosh, then reopen the shell. See README.md."
}

Write-Section "2. Environment"
$prod  = Get-RequiredUri 'PROD_URI'
$local = Get-RequiredUri 'LOCAL_URI'
Write-Host "  PROD_URI  -> $(Hide-Credentials $prod)"
Write-Host "  LOCAL_URI -> $(Hide-Credentials $local)"
Write-Host "  Target DB -> $script:TargetDb"

Write-Section "3. Production host reachability"
$hostName = Get-UriHost $prod
$port     = Get-UriPort $prod
$deadline = (Get-Date).AddMinutes($WaitMinutes)
$up = $false
do {
    $up = (Test-NetConnection -ComputerName $hostName -Port $port `
           -InformationLevel Quiet -WarningAction SilentlyContinue)
    if ($up) { break }
    if ((Get-Date) -lt $deadline) {
        Write-Host ("  {0}  {1}:{2} down - retrying in {3}s" -f `
            (Get-Date -Format 'HH:mm:ss'), $hostName, $port, $PollSeconds) -ForegroundColor DarkYellow
        Start-Sleep -Seconds $PollSeconds
    }
} while ((Get-Date) -lt $deadline)

if (-not $up) {
    Write-Host "  DOWN  $hostName`:$port is not answering." -ForegroundColor Red
    Write-Host "        Bring the host up, then re-run. Use -WaitMinutes 60 to poll." -ForegroundColor DarkGray
    exit 2
}
Write-Host "  UP    $hostName`:$port" -ForegroundColor Green

Write-Section "4. Production inventory"
$prodStats = Get-DbInventory -Uri $prod
if ($prodStats.Count -eq 0) {
    Write-Host "  Production has no user databases - this is a FIRST DEPLOY." -ForegroundColor Green
    Write-Host "  The migration is additive in effect; nothing can be destroyed." -ForegroundColor Green
} else {
    Show-Inventory $prodStats
    Write-Host ""
    Write-Host "  PRODUCTION IS NOT EMPTY." -ForegroundColor Yellow
    Write-Host "  Run 01-backup-prod.ps1 before ANY restore or seed." -ForegroundColor Yellow
}

Write-Section "5. Local inventory"
Show-Inventory (Get-DbInventory -Uri $local)

Write-Section "6. Migration set (Tier A + B)"
$localCounts = Get-CollectionCounts -Uri $local -Db $script:TargetDb -Names $script:TierB
$total = 0
foreach ($n in $script:TierB) {
    if ($localCounts.ContainsKey($n)) {
        Write-Host ("  {0,-28}{1,10} docs" -f $n, $localCounts[$n])
        $total += $localCounts[$n]
    } else {
        Write-Host ("  {0,-28}{1,10}" -f $n, "absent") -ForegroundColor DarkGray
    }
}
Write-Host ("  {0,-28}{1,10} docs" -f 'TOTAL', $total) -ForegroundColor Cyan

Write-Section "Next"
Write-Host "  1. .\01-backup-prod.ps1     (mandatory if step 4 showed data)"
Write-Host "  2. .\02-dump-local.ps1"
Write-Host "  3. .\03-restore-prod.ps1"
Write-Host "  4. .\04-verify.ps1"
