# Shared helpers for the db-migration scripts. Dot-sourced; not run directly.
# Contains no credentials - every URI comes from the environment at run time.

# Local keeps ALL collections in `careerlens` (verified 2026-08-13); the `jobs` DB
# holds only empty shells. Production restores into the same single database.
$script:TargetDb = if ($env:TARGET_DB) { $env:TARGET_DB } else { 'careerlens' }

# Tier A + Tier B, ordered by value-per-megabyte. See docs/deploy/db-migration-runbook.md.
$script:TierB = @(
    'roles',
    'model_runs',
    'cv_title_model_runs',
    'role_skill_features',
    'lang-uk-job',
    'lang-uk-job-skills'
)

# Never migrated: dev user data (privacy) + training-only corpora (690 MB, unused in prod).
$script:NeverMigrate = @(
    'users', 'cvfiles', 'cvanalyses', 'improvementsessions',
    'lang-uk-cv', 'lang-uk-cv-skills', 'lang-uk-cv-sample',
    'lang-uk-cv-other-sample', 'lang-uk-cv-other-skills',
    'lang-uk-job-sample', 'master-resumes-sample', 'master-resumes-skills',
    'augmented-2026', 'JOB_EXAMPLE', 'JOBS_EXAMPLE', 'job-PocOnly'
)

$script:OutRoot = if ($env:MIGRATION_OUT) { $env:MIGRATION_OUT } else { 'C:\tmp\careerlens-migration' }

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title" -ForegroundColor Cyan
}

# The MongoDB Database Tools MSI does not add itself to PATH, and a freshly-installed
# mongosh is invisible to shells opened before the install. Resolve both here so the
# scripts work without reopening the terminal.
function Initialize-MongoTools {
    $candidates = @(
        "$env:ProgramFiles\MongoDB\Tools\100\bin"
        "${env:ProgramFiles(x86)}\MongoDB\Tools\100\bin"
        "$env:LOCALAPPDATA\Programs\mongosh"
        "$env:ProgramFiles\mongosh"
    )
    foreach ($d in $candidates) {
        if ((Test-Path $d) -and ($env:Path -notlike "*$d*")) { $env:Path = "$env:Path;$d" }
    }
    # Also pick up anything a prior install wrote to the persisted PATH.
    foreach ($scope in 'Machine', 'User') {
        $p = [Environment]::GetEnvironmentVariable('Path', $scope)
        if ($p) {
            foreach ($d in ($p -split ';' | Where-Object { $_ -and ($_ -match 'MongoDB|mongosh') })) {
                if ((Test-Path $d) -and ($env:Path -notlike "*$d*")) { $env:Path = "$env:Path;$d" }
            }
        }
    }
}
Initialize-MongoTools

function Get-RequiredUri {
    param([string]$Name)
    $v = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($v)) {
        throw "$Name is not set. See scripts\db-migration\README.md for how to set it for this session only."
    }
    return $v.Trim()
}

# Masks user:pass so a URI can be echoed to a console or a log safely.
function Hide-Credentials {
    param([string]$Uri)
    return ([regex]::Replace($Uri, '://[^@/]+@', '://***:***@'))
}

function Get-UriHost {
    param([string]$Uri)
    $m = [regex]::Match($Uri, '://(?:[^@/]+@)?([^:/,?]+)')
    if (-not $m.Success) { throw "Cannot parse host from URI" }
    return $m.Groups[1].Value
}

function Get-UriPort {
    param([string]$Uri)
    $m = [regex]::Match($Uri, '://(?:[^@/]+@)?[^:/,?]+:(\d+)')
    if ($m.Success) { return [int]$m.Groups[1].Value }
    return 27017
}

function Invoke-Mongosh {
    param([string]$Uri, [string]$Script)
    $out = & mongosh $Uri --quiet --norc --eval $Script 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "mongosh failed: $($out -join "`n")"
    }
    return ($out -join "`n")
}

# Returns an array of PSCustomObject: Db, Collection, Docs, DataMB, IndexMB
function Get-DbInventory {
    param([string]$Uri)
    # NOTE: single quotes only inside the JS. PowerShell strips embedded double quotes
    # when handing an argument to a native executable, which silently turns string
    # literals into undefined identifiers.
    $js = @'
const out = [];
db.adminCommand({listDatabases:1}).databases.forEach(function(d){
  if (['admin','local','config'].indexOf(d.name) >= 0) return;
  const x = db.getSiblingDB(d.name);
  x.getCollectionNames().sort().forEach(function(c){
    try {
      const s = x.runCommand({collStats: c});
      out.push({db:d.name, coll:c, n:s.count||0, sz:s.size||0, ix:s.totalIndexSize||0});
    } catch (e) { out.push({db:d.name, coll:c, n:-1, sz:0, ix:0}); }
  });
});
print(JSON.stringify(out));
'@
    $raw = Invoke-Mongosh -Uri $Uri -Script $js
    $line = ($raw -split "`n" | Where-Object { $_.Trim().StartsWith('[') } | Select-Object -Last 1)
    if (-not $line) { return @() }
    $parsed = $line | ConvertFrom-Json
    return @($parsed | ForEach-Object {
        [PSCustomObject]@{
            Db         = $_.db
            Collection = $_.coll
            Docs       = $_.n
            DataMB     = [math]::Round($_.sz / 1MB, 1)
            IndexMB    = [math]::Round($_.ix / 1MB, 1)
        }
    })
}

function Show-Inventory {
    param($Rows)
    if (-not $Rows -or $Rows.Count -eq 0) {
        Write-Host "  (no user databases)" -ForegroundColor DarkGray
        return
    }
    foreach ($g in ($Rows | Group-Object Db)) {
        $mb = ($g.Group | Measure-Object -Property DataMB -Sum).Sum +
              ($g.Group | Measure-Object -Property IndexMB -Sum).Sum
        $dc = ($g.Group | Measure-Object -Property Docs -Sum).Sum
        Write-Host ("  DB {0}  ({1:N0} docs, {2:N1} MB)" -f $g.Name, $dc, $mb) -ForegroundColor White
        foreach ($r in $g.Group) {
            Write-Host ("    {0,-32}{1,10:N0} docs  {2,8:N1} MB data  {3,7:N1} MB idx" -f `
                $r.Collection, $r.Docs, $r.DataMB, $r.IndexMB)
        }
    }
}

# Returns a hashtable name -> exact document count, for collections that exist.
function Get-CollectionCounts {
    param([string]$Uri, [string]$Db, [string[]]$Names)
    $list = ($Names | ForEach-Object { "'" + $_ + "'" }) -join ','
    $js = @"
const x = db.getSiblingDB('$Db');
const want = [$list];
const have = x.getCollectionNames();
const out = {};
want.forEach(function(c){ if (have.indexOf(c) >= 0) out[c] = x.getCollection(c).countDocuments({}); });
print(JSON.stringify(out));
"@
    $raw = Invoke-Mongosh -Uri $Uri -Script $js
    $line = ($raw -split "`n" | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1)
    $h = @{}
    if ($line) {
        $obj = $line | ConvertFrom-Json
        foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = [long]$p.Value }
    }
    return $h
}

function New-OutDir {
    param([string]$Label)
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dir = Join-Path $script:OutRoot "$stamp-$Label"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return $dir
}
