# Render all CV HTML sources to PDF via Edge headless. Run from anywhere.
$base = "c:\Git\CareerLens\test-fixtures\authentic-cvs"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$outDir = Join-Path $base "pdfs"
New-Item -ItemType Directory -Force $outDir | Out-Null

Get-ChildItem (Join-Path $base "generation\cvs") -Filter *.html | ForEach-Object {
  $pdf = Join-Path $outDir ($_.BaseName + ".pdf")
  $uri = "file:///" + ($_.FullName -replace '\','/')
  & $edge --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdf" $uri 2>$null | Out-Null
  Start-Sleep -Milliseconds 400
  if (Test-Path $pdf) { Write-Output ("OK   " + $_.BaseName) } else { Write-Output ("FAIL " + $_.BaseName) }
}
