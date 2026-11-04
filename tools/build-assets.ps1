# Asset maintenance only; normal installation needs no build. Copies local PDF.js
# with its support files/license and draws the palmetto icon at supported sizes.
param([string]$PdfJsRoot = 'C:\Users\prest\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pdfjs-dist')
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$vendor = Join-Path $project 'extension\vendor'
New-Item -ItemType Directory -Path $vendor -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PdfJsRoot 'legacy\build\pdf.mjs') -Destination (Join-Path $vendor 'pdf.mjs')
Copy-Item -LiteralPath (Join-Path $PdfJsRoot 'legacy\build\pdf.worker.mjs') -Destination (Join-Path $vendor 'pdf.worker.mjs')
Copy-Item -LiteralPath (Join-Path $PdfJsRoot 'LICENSE') -Destination (Join-Path $vendor 'PDFJS-LICENSE.txt')
foreach ($folder in @('cmaps','standard_fonts','wasm')) { Copy-Item -LiteralPath (Join-Path $PdfJsRoot $folder) -Destination $vendor -Recurse -Force }
Add-Type -AssemblyName System.Drawing
$icons = Join-Path $project 'extension\icons'
New-Item -ItemType Directory -Path $icons -Force | Out-Null
foreach ($size in @(16,32,48,128)) {
    $bitmap = New-Object Drawing.Bitmap 512,512
    $g = [Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $blue = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#0c3d70'))
    $white = [Drawing.Brushes]::White
    $g.Clear([Drawing.ColorTranslator]::FromHtml('#0c3d70'))
    $g.FillEllipse($white,65,51,106,112)
    $g.FillEllipse($blue,91,30,100,111)
    $trunk = New-Object Drawing.Drawing2D.GraphicsPath
    $trunk.AddBezier(286,410,304,337,289,250,282,205)
    $trunk.AddLine(282,205,260,205)
    $trunk.AddBezier(260,205,272,294,268,355,251,410)
    $trunk.CloseFigure(); $g.FillPath($white,$trunk)
    $pen = New-Object Drawing.Pen ([Drawing.Color]::White),17
    $pen.StartCap = [Drawing.Drawing2D.LineCap]::Round; $pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $fronds = @(@(277,210,229,125,173,146,146,201),@(277,210,198,172,153,208,134,266),@(277,210,221,216,197,258,185,308),@(277,210,259,120,294,100,306,96),@(277,210,306,116,363,130,395,173),@(277,210,357,153,407,195,427,249),@(277,210,336,204,365,251,374,294))
    foreach ($p in $fronds) { $g.DrawBezier($pen,[single]$p[0],[single]$p[1],[single]$p[2],[single]$p[3],[single]$p[4],[single]$p[5],[single]$p[6],[single]$p[7]) }
    $g.FillEllipse($white,249,189,55,37)
    $small = New-Object Drawing.Bitmap $size,$size
    $sg = [Drawing.Graphics]::FromImage($small); $sg.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $sg.DrawImage($bitmap,0,0,$size,$size)
    $small.Save((Join-Path $icons "icon$size.png"),[Drawing.Imaging.ImageFormat]::Png)
    $sg.Dispose(); $small.Dispose(); $pen.Dispose(); $trunk.Dispose(); $blue.Dispose(); $g.Dispose(); $bitmap.Dispose()
}
Write-Output 'Bundled PDF.js and generated extension icons.'
