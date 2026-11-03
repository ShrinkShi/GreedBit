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
  'src\core.js',
  'src\market.js',
  'src\v011-preload.js',
  'src\v011.js',
  'src\v013-market.js',
  'src\v013-ui.js',
  'src\v013-fixes.js',
  'src\v014.js',
  'src\v015.js',
  'src\v015-market-worker.js',
  'src\v016.js',
  'styles\base.css',
  'styles\trading.css',
  'styles\v011.css',
  'styles\v014.css',
  'styles\v015.css',
  'styles\v016.css'
)
foreach ($relative in $required) {
  if (-not (Test-Path (Join-Path $out $relative))) {
    throw "Missing required runtime file: $relative"
  }
}

$files = Get-ChildItem $out -Recurse -File
$total = ($files | Measure-Object Length -Sum).Sum
Write-Host "Runtime files: $($files.Count)"
Write-Host "index.html: $($index.Length) bytes"
Write-Host ("Package size before ZIP: {0:N2} MB" -f ($total / 1MB))
Write-Host 'Relative-path precheck: PASS'

if (-not $NoZip) {
  if (Test-Path $zip) {
    Remove-Item $zip -Force
  }
  Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -CompressionLevel Optimal
  $zipItem = Get-Item $zip
  Write-Host ("ZIP: {0} ({1:N2} MB)" -f $zipItem.FullName, ($zipItem.Length / 1MB))
}

Write-Host 'Build complete.'
Write-Host 'Next: run the official Bilibili toy_doctor.py against dist-toy or GreedBit-toy.zip, then create a preview before submitting for review.'