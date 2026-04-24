Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$terrainSourceRoot = Join-Path $repoRoot "static\xu-town\assets\source-isolated\terrain"
$propSourceRoot = Join-Path $repoRoot "static\xu-town\assets\source-isolated\props"
$terrainTargetRoot = Join-Path $repoRoot "static\xu-town\assets\terrain"
$propTargetRoot = Join-Path $repoRoot "static\xu-town\assets\props"

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

function Save-TrimmedTransparentProp {
  param(
    [string]$SourcePath,
    [string]$OutputPath,
    [double]$Threshold = 34,
    [int]$Padding = 12
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

$terrainAssets = @(
  @{ Source = "grass-v2.png"; Name = "grass.png" },
  @{ Source = "grass-dark-v2.png"; Name = "grass-dark.png" },
  @{ Source = "grass-flower-v2.png"; Name = "grass-flower.png" },
  @{ Source = "grass-tuft-v2.png"; Name = "grass-tuft.png" },
  @{ Source = "path-v2.png"; Name = "path.png" },
  @{ Source = "plaza-v2.png"; Name = "plaza.png" },
  @{ Source = "sand-v2.png"; Name = "sand.png" },
  @{ Source = "water-v2.png"; Name = "water.png" },
  @{ Source = "water-deep-v2.png"; Name = "water-deep.png" }
)

foreach ($asset in $terrainAssets) {
  $sourcePath = Join-Path $terrainSourceRoot $asset.Source
  $targetPath = Join-Path $terrainTargetRoot $asset.Name
  if (-not (Test-Path $sourcePath)) {
    throw "Missing terrain source asset: $sourcePath"
  }
  Ensure-Directory (Split-Path -Parent $targetPath)
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
}

$propAssets = @(
  @{ Source = "tree-v2.png"; Name = "tree.png"; Threshold = 34; Padding = 14 },
  @{ Source = "bush-v2.png"; Name = "bush.png"; Threshold = 34; Padding = 14 },
  @{ Source = "rock-v2.png"; Name = "rock.png"; Threshold = 34; Padding = 14 },
  @{ Source = "flower-v2.png"; Name = "flower.png"; Threshold = 34; Padding = 14 }
)

foreach ($asset in $propAssets) {
  $sourcePath = Join-Path $propSourceRoot $asset.Source
  $targetPath = Join-Path $propTargetRoot $asset.Name
  if (-not (Test-Path $sourcePath)) {
    throw "Missing prop source asset: $sourcePath"
  }

  Save-TrimmedTransparentProp `
    -SourcePath $sourcePath `
    -OutputPath $targetPath `
    -Threshold $asset.Threshold `
    -Padding $asset.Padding
}
