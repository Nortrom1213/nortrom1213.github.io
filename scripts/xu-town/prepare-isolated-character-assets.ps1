Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sourceRoot = Join-Path $repoRoot "static\xu-town\assets\source-isolated\characters"
$portraitRoot = Join-Path $repoRoot "static\xu-town\assets\characters"
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

function Get-ProcessedTransparentBitmap {
  param(
    [string]$SourcePath,
    [double]$Threshold = 32,
    [int]$Padding = 12
  )

  $bitmap = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $working = $bitmap.Clone(
      [System.Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height),
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
  } finally {
    $bitmap.Dispose()
  }

  $background = Get-CornerAverageColor -Bitmap $working
  Remove-ConnectedBackground -Bitmap $working -BackgroundReference $background -Threshold $Threshold
  $trimBounds = Get-TrimBounds -Bitmap $working -Padding $Padding
  $trimmed = $working.Clone($trimBounds, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $working.Dispose()
  return $trimmed
}

function Save-WorldSprite {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$OutputPath
  )

  Ensure-Directory (Split-Path -Parent $OutputPath)
  $Bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-PortraitCrop {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$OutputPath,
    [double]$TopRatio = 0.72
  )

  Ensure-Directory (Split-Path -Parent $OutputPath)

  $desiredHeight = [Math]::Ceiling($Bitmap.Height * $TopRatio)
  $minimumHeight = [Math]::Ceiling($Bitmap.Width * 1.1)
  $portraitHeight = [Math]::Min($Bitmap.Height, [Math]::Max($desiredHeight, $minimumHeight))
  $portraitRect = [System.Drawing.Rectangle]::new(0, 0, $Bitmap.Width, $portraitHeight)
  $portrait = $Bitmap.Clone($portraitRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $portrait.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $portrait.Dispose()
  }
}

$assets = @(
  @{ Name = "player"; Source = "player-v2.png"; Threshold = 30; Padding = 14; PortraitTopRatio = 0.72 },
  @{ Name = "verbrugge"; Source = "verbrugge-v2.png"; Threshold = 30; Padding = 14; PortraitTopRatio = 0.72 },
  @{ Name = "chronicler"; Source = "chronicler-v2.png"; Threshold = 30; Padding = 14; PortraitTopRatio = 0.72 },
  @{ Name = "perlin"; Source = "perlin-v2.png"; Threshold = 32; Padding = 14; PortraitTopRatio = 0.95 },
  @{ Name = "bard"; Source = "bard-v2.png"; Threshold = 30; Padding = 14; PortraitTopRatio = 0.72 },
  @{ Name = "berkeley"; Source = "berkeley-v2.png"; Threshold = 30; Padding = 14; PortraitTopRatio = 0.72 }
)

foreach ($asset in $assets) {
  $sourcePath = Join-Path $sourceRoot $asset.Source
  $portraitPath = Join-Path $portraitRoot ($asset.Name + "-portrait.png")
  $worldPath = Join-Path $worldRoot ($asset.Name + "-world.png")

  if (-not (Test-Path $sourcePath)) {
    throw "Missing source asset: $sourcePath"
  }

  $processed = Get-ProcessedTransparentBitmap `
    -SourcePath $sourcePath `
    -Threshold $asset.Threshold `
    -Padding $asset.Padding

  try {
    Save-WorldSprite -Bitmap $processed -OutputPath $worldPath
    Save-PortraitCrop -Bitmap $processed -OutputPath $portraitPath -TopRatio $asset.PortraitTopRatio
  } finally {
    $processed.Dispose()
  }
}
