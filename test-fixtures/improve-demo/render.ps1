# Render the improve-demo CV sources to PDF via Edge headless.
# Mirrors test-fixtures/authentic-cvs/tools/render.ps1 - same toolchain, separate set.
$base = "c:\Git\CareerLens\test-fixtures\improve-demo"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$outDir = Join-Path $base "pdfs"
New-Item -ItemType Directory -Force $outDir | Out-Null

Get-ChildItem (Join-Path $base "src") -Filter *.html | ForEach-Object {
  $pdf = Join-Path $outDir ($_.BaseName + ".pdf")
  $uri = "file:///" + ($_.FullName -replace '\\','/')
  $profile = Join-Path $env:TEMP ("cl-render-" + $_.BaseName)
  & $edge --headless --disable-gpu --no-pdf-header-footer --user-data-dir="$profile" --print-to-pdf="$pdf" $uri 2>$null | Out-Null
  Start-Sleep -Milliseconds 400
  if (Test-Path $pdf) { Write-Output ("OK   " + $_.BaseName) } else { Write-Output ("FAIL " + $_.BaseName) }
}
