Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sourceRoot = Join-Path $repoRoot "static\xu-town\assets\source-isolated\buildings"
$panelRoot = Join-Path $repoRoot "static\xu-town\assets\buildings"
$worldRoot = Join-Path $repoRoot "static\xu-town\assets\world"

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Get-ColorDistance {
  param(
    [System.Drawing.Color]$A,
    [System.Drawing.Color]$B
  )

  $dr = [int]$A.R - [int]$B.R
  $dg = [int]$A.G - [int]$B.G
  $db = [int]$A.B - [int]$B.B
  return [Math]::Sqrt(($dr * $dr) + ($dg * $dg) + ($db * $db))
}

function Get-CornerAverageColor {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$SampleSize = 24
  )

  $sampleWidth = [Math]::Min($SampleSize, [Math]::Max(1, [Math]::Floor($Bitmap.Width / 5)))
  $sampleHeight = [Math]::Min($SampleSize, [Math]::Max(1, [Math]::Floor($Bitmap.Height / 5)))
  $corners = @(
    @{ X = 0; Y = 0 },
    @{ X = $Bitmap.Width - $sampleWidth; Y = 0 },
    @{ X = 0; Y = $Bitmap.Height - $sampleHeight },
    @{ X = $Bitmap.Width - $sampleWidth; Y = $Bitmap.Height - $sampleHeight }
  )

  [long]$sumR = 0
  [long]$sumG = 0
  [long]$sumB = 0
  [long]$count = 0

  foreach ($corner in $corners) {
    for ($x = $corner.X; $x -lt ($corner.X + $sampleWidth); $x++) {
      for ($y = $corner.Y; $y -lt ($corner.Y + $sampleHeight); $y++) {
        $pixel = $Bitmap.GetPixel($x, $y)
        $sumR += $pixel.R
        $sumG += $pixel.G
        $sumB += $pixel.B
        $count++
      }
    }
  }

  if ($count -eq 0) {
    return [System.Drawing.Color]::FromArgb(255, 245, 235, 210)
  }

  return [System.Drawing.Color]::FromArgb(
    255,
    [int]($sumR / $count),
    [int]($sumG / $count),
    [int]($sumB / $count)
  )
}

function Remove-ConnectedBackground {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [System.Drawing.Color]$BackgroundReference,
    [double]$Threshold
  )

  $width = $Bitmap.Width
  $height = $Bitmap.Height
  $visited = New-Object 'bool[,]' $width, $height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()

  for ($x = 0; $x -lt $width; $x++) {
    $queue.Enqueue([System.Drawing.Point]::new($x, 0))
    $queue.Enqueue([System.Drawing.Point]::new($x, $height - 1))
  }

  for ($y = 1; $y -lt ($height - 1); $y++) {
    $queue.Enqueue([System.Drawing.Point]::new(0, $y))
    $queue.Enqueue([System.Drawing.Point]::new($width - 1, $y))
  }

  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    $x = $point.X
    $y = $point.Y

    if ($x -lt 0 -or $x -ge $width -or $y -lt 0 -or $y -ge $height) { continue }
    if ($visited[$x, $y]) { continue }

    $visited[$x, $y] = $true
    $pixel = $Bitmap.GetPixel($x, $y)
    if ($pixel.A -eq 0) { continue }

    $distance = Get-ColorDistance -A $pixel -B $BackgroundReference
    if ($distance -gt $Threshold) { continue }

    $Bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))

    $queue.Enqueue([System.Drawing.Point]::new($x + 1, $y))
    $queue.Enqueue([System.Drawing.Point]::new($x - 1, $y))
    $queue.Enqueue([System.Drawing.Point]::new($x, $y + 1))
    $queue.Enqueue([System.Drawing.Point]::new($x, $y - 1))
  }
}

function Get-TrimBounds {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$Padding = 10
  )

  $minX = $Bitmap.Width
  $minY = $Bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($x = 0; $x -lt $Bitmap.Width; $x++) {
    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
      if ($Bitmap.GetPixel($x, $y).A -gt 0) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt $minX -or $maxY -lt $minY) {
    return New-Object System.Drawing.Rectangle(0, 0, $Bitmap.Width, $Bitmap.Height)
  }

  $left = [Math]::Max(0, $minX - $Padding)
  $top = [Math]::Max(0, $minY - $Padding)
  $right = [Math]::Min($Bitmap.Width - 1, $maxX + $Padding)
  $bottom = [Math]::Min($Bitmap.Height - 1, $maxY + $Padding)

  return New-Object System.Drawing.Rectangle(
    $left,
    $top,
    ($right - $left + 1),
    ($bottom - $top + 1)
  )
}

function Save-TrimmedWorldSprite {
  param(
    [string]$SourcePath,
    [string]$OutputPath,
    [double]$Threshold = 34,
    [int]$Padding = 10
  )

  Ensure-Directory (Split-Path -Parent $OutputPath)

  $bitmap = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $working = $bitmap.Clone(
      [System.Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height),
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
      $background = Get-CornerAverageColor -Bitmap $working
      Remove-ConnectedBackground -Bitmap $working -BackgroundReference $background -Threshold $Threshold
      $trimBounds = Get-TrimBounds -Bitmap $working -Padding $Padding
      $trimmed = $working.Clone($trimBounds, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $trimmed.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $trimmed.Dispose()
      }
    } finally {
      $working.Dispose()
    }
  } finally {
    $bitmap.Dispose()
  }
}

$assets = @(
  @{ Name = "about-marker"; Source = "about-marker-v2.png"; Threshold = 34; Padding = 12 },
  @{ Name = "library"; Source = "library-v2.png"; Threshold = 36; Padding = 12 },
  @{ Name = "news-board"; Source = "news-board-v2.png"; Threshold = 34; Padding = 12 },
  @{ Name = "cafe"; Source = "cafe-v2.png"; Threshold = 36; Padding = 12 },
  @{ Name = "artifact"; Source = "artifact-v2.png"; Threshold = 36; Padding = 12 },
  @{ Name = "portal"; Source = "portal-v2.png"; Threshold = 36; Padding = 12 }
)

foreach ($asset in $assets) {
  $sourcePath = Join-Path $sourceRoot $asset.Source
  $panelPath = Join-Path $panelRoot ($asset.Name + ".png")
  $worldPath = Join-Path $worldRoot ($asset.Name + "-world.png")

  if (-not (Test-Path $sourcePath)) {
    throw "Missing source asset: $sourcePath"
  }

  Ensure-Directory (Split-Path -Parent $panelPath)
  Copy-Item -LiteralPath $sourcePath -Destination $panelPath -Force

  Save-TrimmedWorldSprite `
    -SourcePath $sourcePath `
    -OutputPath $worldPath `
    -Threshold $asset.Threshold `
    -Padding $asset.Padding
}
