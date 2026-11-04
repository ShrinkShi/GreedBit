param(
  [switch]$NoZip
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out = Join-Path $root 'dist-toy'
$zip = Join-Path $root 'GreedBit-toy.zip'

Write-Host '=== GreedBit Toy build ==='
Write-Host "Root: $root"

if (Test-Path $out) {
  Remove-Item $out -Recurse -Force
}
New-Item -ItemType Directory -Path $out | Out-Null

Copy-Item (Join-Path $root 'index.html') (Join-Path $out 'index.html')
foreach ($dir in @('src','styles','assets')) {
  $src = Join-Path $root $dir
  if (-not (Test-Path $src)) {
    throw "Missing required directory: $dir"
  }
  Copy-Item $src (Join-Path $out $dir) -Recurse
}

$index = Get-Item (Join-Path $out 'index.html')
if ($index.Length -gt 1MB) {
  throw "Toy hard limit exceeded: index.html is $($index.Length) bytes (> 1MB)."
}

# Toy runs below /toy/<slug>/, so package-owned resources must not start at site root.
$pathErrors = @()
Get-ChildItem $out -Recurse -File | Where-Object { $_.Extension -in '.html','.css' } | ForEach-Object {
  $text = Get-Content $_.FullName -Raw
  $relative = $_.FullName.Substring($out.Length + 1)
  $patterns = @(
    '(?i)(?:src|href|poster)\s*=\s*["'']/(?!/)',
    '(?i)url\(\s*["'']?/(?!/)'
  )
  foreach ($pattern in $patterns) {
    if ($text -match $pattern) {
      $pathErrors += $relative
      break
    }
  }
}

if ($pathErrors.Count -gt 0) {
  throw "Root-absolute package path detected in: $($pathErrors -join ', ')"
}

$required = @(
  'assets\greedbit-logo.png',
  'assets\greedbit-favicon.png',
  'assets\default avatar.png',
  'assets\favicon.ico',
  'assets\mammon-home.webm',
  'assets\voice\收银机音效.wav',
  'assets\bitcoinicon\xau.png',
  'assets\bitcoinicon\xag.png',
  'assets\bitcoinicon\xpt.png',
  'assets\bitcoinicon\xpd.png',
  'assets\bitcoinicon\copper.png',
  'assets\bitcoinicon\usoil.png',
  'assets\bitcoinicon\brentoil.png',
  'assets\bitcoinicon\natgas.png',
  'assets\forex\eurusd.png',
  'assets\forex\gbpusd.png',
  'assets\forex\usdjpy.png',
  'assets\stocksicon\manifest.json',
  'assets\stocksicon\aapl.png',
  'assets\stocksicon\msft.png',
  'assets\stocksicon\nvda.png',
  'assets\stocksicon\openai.png',
  'assets\stocksicon\anthropic.png',
  'src\domain\trading.js',
  'src\domain\position-book.js',
  'src\domain\hash.js',
  'src\core.js',
  'src\market.js',
  'src\futures.js',
  'src\spot.js',
  'src\account.js',
  'src\ui.js',
  'src\bootstrap.js',
  'src\app\events.js',
  'src\app\compatibility.js',
  'src\app\runtime.js',
  'src\chart\renderer.js',
  'src\market\preload.js',
  'src\market\model.js',
  'src\market\extended.js',
  'src\market\external.js',
  'src\news\feeds.js',
  'src\performance\runtime.js',
  'src\performance\market-worker.js',
  'src\trading\advanced-orders.js',
  'src\trading\contracts.js',
  'src\trading\records.js',
  'src\trading\positions-ui.js',
  'src\strategy\grid.js',
  'src\ui\preferences.js',
  'src\ui\home.js',
  'src\ui\shell.js',
  'src\ui\trading-experience.js',
  'src\ui\terminal-theme.js',
  'src\ui\runtime.js',
  'styles\base.css',
  'styles\trading.css',
  'styles\positions.css',
  'styles\v011.css',
  'styles\v014.css',
  'styles\v015.css',
  'styles\v016.css',
  'styles\v017.css',
  'styles\v018.css',
  'styles\v019.css',
  'styles\v020.css',
  'styles\v021.css',
  'styles\v024.css'
)
foreach ($relative in $required) {
  if (-not (Test-Path (Join-Path $out $relative))) {
    throw "Missing required runtime file: $relative"
  }
}

# Version scripts are not allowed back into the runtime after consolidation.
$legacyVersionScripts = Get-ChildItem (Join-Path $out 'src') -File -Filter 'v*.js' -ErrorAction SilentlyContinue
if ($legacyVersionScripts) {
  throw "Legacy version-script regression detected: $($legacyVersionScripts.Name -join ', ')"
}

$files = Get-ChildItem $out -Recurse -File
$total = ($files | Measure-Object Length -Sum).Sum
Write-Host "Runtime files: $($files.Count)"
Write-Host "index.html: $($index.Length) bytes"
Write-Host ("Package size before ZIP: {0:N2} MB" -f ($total / 1MB))
Write-Host 'Relative-path precheck: PASS'
Write-Host 'Canonical-module precheck: PASS'

if (-not $NoZip) {
  if (Test-Path $zip) {
    Remove-Item $zip -Force
  }
  Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -CompressionLevel Optimal
  $zipItem = Get-Item $zip
  Write-Host ("ZIP: {0} ({1:N2} MB)" -f ($zipItem.FullName, ($zipItem.Length / 1MB)))
}

Write-Host 'Build complete.'
Write-Host 'Next: run the official Bilibili toy_doctor.py against dist-toy or GreedBit-toy.zip, then create a preview before submitting for review.'
