Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sourceRoot = Join-Path $repoRoot "static\xu-town\assets\source-gpt-image-2"
$targetRoot = Join-Path $repoRoot "static\xu-town\assets"

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

function Remove-ConnectedBackground {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [double]$Threshold = 30,
    [System.Drawing.Color]$BackgroundReference = [System.Drawing.Color]::FromArgb(255, 243, 227, 196)
  )

  $width = $Bitmap.Width
  $height = $Bitmap.Height
  $visited = New-Object 'bool[,]' $width, $height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()
  $bg = $BackgroundReference

  for ($x = 0; $x -lt $width; $x++) {
    $queue.Enqueue([System.Drawing.Point]::new($x, 0))
    $queue.Enqueue([System.Drawing.Point]::new($x, $height - 1))
  }
  for ($y = 1; $y -lt $height - 1; $y++) {
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
    $distance = Get-ColorDistance -A $pixel -B $bg
    if ($distance -gt $Threshold) { continue }

    $Bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))

    $queue.Enqueue([System.Drawing.Point]::new($x + 1, $y))
    $queue.Enqueue([System.Drawing.Point]::new($x - 1, $y))
    $queue.Enqueue([System.Drawing.Point]::new($x, $y + 1))
    $queue.Enqueue([System.Drawing.Point]::new($x, $y - 1))
  }
}

function Save-TransparentCrop {
  param(
    [string]$SourcePath,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [string]$OutputPath,
    [double]$Threshold = 30,
    [System.Drawing.Color]$BackgroundReference = [System.Drawing.Color]::FromArgb(255, 243, 227, 196)
  )

  Ensure-Directory (Split-Path -Parent $OutputPath)

  $bitmap = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $rect = New-Object System.Drawing.Rectangle($X, $Y, $Width, $Height)
    $cropped = $bitmap.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      Remove-ConnectedBackground -Bitmap $cropped -Threshold $Threshold -BackgroundReference $BackgroundReference
      $cropped.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $cropped.Dispose()
    }
  } finally {
    $bitmap.Dispose()
  }
}

$buildingSheet = Join-Path $sourceRoot "buildings\xu-town_building-lineup_primary_v01.png"
$buildingTargets = @(
  @{ Name = "about-marker-world.png"; X = 82; Y = 148; Width = 330; Height = 240; Threshold = 54 },
  @{ Name = "library-world.png";      X = 530; Y = 148; Width = 470; Height = 285; Threshold = 56 },
  @{ Name = "news-board-world.png";   X = 1120; Y = 142; Width = 290; Height = 250; Threshold = 56 },
  @{ Name = "cafe-world.png";         X = 105; Y = 585; Width = 375; Height = 265; Threshold = 56 },
  @{ Name = "artifact-world.png";     X = 570; Y = 585; Width = 430; Height = 265; Threshold = 56 },
  @{ Name = "portal-world.png";       X = 1120; Y = 590; Width = 255; Height = 245; Threshold = 60 }
)

foreach ($target in $buildingTargets) {
  Save-TransparentCrop `
    -SourcePath $buildingSheet `
    -X $target.X -Y $target.Y -Width $target.Width -Height $target.Height `
    -OutputPath (Join-Path $targetRoot ("world\" + $target.Name)) `
    -Threshold $target.Threshold
}

$characterSheet = Join-Path $sourceRoot "characters\xu-town_character-family_primary_v01.png"
$characterTargets = @(
  @{ Name = "player-world.png";      X = 335; Y = 140; Width = 140; Height = 300; Threshold = 62 },
  @{ Name = "verbrugge-world.png";   X = 565; Y = 135; Width = 145; Height = 315; Threshold = 62 },
  @{ Name = "chronicler-world.png";  X = 795; Y = 140; Width = 145; Height = 305; Threshold = 62 },
  @{ Name = "perlin-world.png";      X = 960; Y = 180; Width = 125; Height = 205; Threshold = 62 },
  @{ Name = "bard-world.png";        X = 1145; Y = 140; Width = 150; Height = 305; Threshold = 62 },
  @{ Name = "berkeley-world.png";    X = 1360; Y = 138; Width = 125; Height = 305; Threshold = 62 }
)

foreach ($target in $characterTargets) {
  Save-TransparentCrop `
    -SourcePath $characterSheet `
    -X $target.X -Y $target.Y -Width $target.Width -Height $target.Height `
    -OutputPath (Join-Path $targetRoot ("world\" + $target.Name)) `
    -Threshold $target.Threshold
}
