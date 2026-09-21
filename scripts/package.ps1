$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundle = Join-Path $projectRoot 'com.bact.obs-audio-meter.sdPlugin'
if (-not (Test-Path -LiteralPath (Join-Path $bundle 'bin/plugin.mjs'))) { throw 'Build first.' }
$outputDir = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$output = Join-Path $outputDir ('OBSAudioMeter-0.1.9-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.streamDeckPlugin')
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $files = @((Get-Item -LiteralPath (Join-Path $bundle 'manifest.json')))
  foreach ($directory in @('bin', 'imgs', 'layouts', 'ui')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $bundle $directory) -File -Recurse
  }
  foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($bundle.Length + 1).Replace([char]92, [char]47)
    $entry = 'com.bact.obs-audio-meter.sdPlugin/' + $relativePath
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $archive.Dispose()
}
Write-Output $output
