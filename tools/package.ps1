# Package current source directly. Reusing a staging directory can silently ship
# retired components, so this allow-list is also the distribution boundary.
# Include only test sources and the synthetic fixture directory; tests/tmp can contain private extracts.
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$sourceFiles = @(
    foreach ($folder in @('extension','tools','demo')) {
        Get-ChildItem -LiteralPath (Join-Path $project $folder) -Recurse -File
    }
    Get-ChildItem -LiteralPath (Join-Path $project 'tests') -File
    Get-ChildItem -LiteralPath (Join-Path $project 'tests/fixtures') -Recurse -File
    foreach ($file in @('README.md','DEVELOPMENT.md','package.json','package-lock.json','.gitignore')) {
        Get-Item -LiteralPath (Join-Path $project $file)
    }
)
# Stream current files directly into the archive so stale staging files cannot be distributed.
$zip = Join-Path $project 'SC-DMV-Hotkeys.zip'
Add-Type -AssemblyName System.IO.Compression
$zipStream = [IO.File]::Open($zip, [IO.FileMode]::Create)
$archive = New-Object IO.Compression.ZipArchive($zipStream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $sourceFiles) {
        $relative = 'SC-DMV-Hotkeys/' + $file.FullName.Substring($project.Length + 1).Replace('\','/')
        $entry = $archive.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
        $input = [IO.File]::OpenRead($file.FullName)
        $output = $entry.Open()
        try { $input.CopyTo($output) } finally { $input.Dispose(); $output.Dispose() }
    }
} finally { $archive.Dispose(); $zipStream.Dispose() }
Write-Output $zip
