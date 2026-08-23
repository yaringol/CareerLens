<#
.SYNOPSIS
  Verify the migration: exact document counts, local vs production.

.DESCRIPTION
  Uses countDocuments (exact) rather than estimatedDocumentCount, and also checks that
  no Tier C collection leaked into production. Read-only.

.EXAMPLE
  .\04-verify.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

$prod  = Get-RequiredUri 'PROD_URI'
$local = Get-RequiredUri 'LOCAL_URI'

Write-Section "Document counts (exact)"
$l = Get-CollectionCounts -Uri $local -Db $script:TargetDb -Names $script:TierB
$p = Get-CollectionCounts -Uri $prod  -Db $script:TargetDb -Names $script:TierB

$fail = 0
Write-Host ("  {0,-28}{1,12}{2,12}   {3}" -f 'COLLECTION', 'LOCAL', 'PROD', 'STATUS')
foreach ($c in $script:TierB) {
    $lv = if ($l.ContainsKey($c)) { $l[$c] } else { $null }
    $pv = if ($p.ContainsKey($c)) { $p[$c] } else { $null }

    if ($null -eq $lv -and $null -eq $pv) {
        Write-Host ("  {0,-28}{1,12}{2,12}   {3}" -f $c, '-', '-', 'absent both') -ForegroundColor DarkGray
        continue
    }
    if ($lv -eq $pv) {
        Write-Host ("  {0,-28}{1,12:N0}{2,12:N0}   {3}" -f $c, $lv, $pv, 'MATCH') -ForegroundColor Green
    } else {
        $shown = if ($null -eq $pv) { 'missing' } else { $pv }
        Write-Host ("  {0,-28}{1,12:N0}{2,12}   {3}" -f $c, $lv, $shown, 'MISMATCH') -ForegroundColor Red
        $fail++
    }
}

Write-Section "Tier C leak check"
$leaks = Get-CollectionCounts -Uri $prod -Db $script:TargetDb -Names $script:NeverMigrate
$userData = @('users', 'cvfiles', 'cvanalyses', 'improvementsessions')
$leaked = 0
foreach ($k in ($leaks.Keys | Sort-Object)) {
    if ($leaks[$k] -eq 0) { continue }
    if ($userData -contains $k) {
        # Legitimate once the app is live in production - flag, do not fail.
        Write-Host ("  {0,-28}{1,10:N0} docs  (app-generated - expected once prod is in use)" -f $k, $leaks[$k]) -ForegroundColor DarkYellow
    } else {
        Write-Host ("  {0,-28}{1,10:N0} docs  LEAKED - training data does not belong here" -f $k, $leaks[$k]) -ForegroundColor Red
        $leaked++
    }
}
if ($leaks.Count -eq 0) { Write-Host "  Clean - no Tier C collections in production." -ForegroundColor Green }

Write-Section "Indexes in production"
$js = @"
const x = db.getSiblingDB('$script:TargetDb');
x.getCollectionNames().sort().forEach(function(c){
  const idx = x.getCollection(c).getIndexes().map(function(i){ return i.name; });
  print('  ' + c + ': ' + idx.join(', '));
});
"@
Write-Host (Invoke-Mongosh -Uri $prod -Script $js)

Write-Section "Result"
if ($fail -eq 0 -and $leaked -eq 0) {
    Write-Host "  PASS - counts match and no training data leaked." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Still to do by hand (runbook section 5.4):" -ForegroundColor Cyan
    Write-Host "    - backend starts and connects"
    Write-Host "    - register a user"
    Write-Host "    - role selector populated"
    Write-Host "    - upload CV -> analyze"
    Write-Host "    - admin model-status screen"
    exit 0
} else {
    Write-Host "  FAIL - $fail count mismatch(es), $leaked leaked collection(s)." -ForegroundColor Red
    exit 1
}
