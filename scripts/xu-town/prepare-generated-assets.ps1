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

function Save-Crop {
  param(
    [string]$SourcePath,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [string]$OutputPath
  )

  Ensure-Directory (Split-Path -Parent $OutputPath)

  $bitmap = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $rect = New-Object System.Drawing.Rectangle($X, $Y, $Width, $Height)
    $cropped = $bitmap.Clone($rect, $bitmap.PixelFormat)
    try {
      $cropped.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $cropped.Dispose()
    }
  } finally {
    $bitmap.Dispose()
  }
}

$buildingSheet = Join-Path $sourceRoot "buildings\xu-town_building-lineup_primary_v01.png"

$buildingCrops = @(
  @{ Name = "about-marker.png"; X = 60; Y = 120; Width = 410; Height = 440 },
  @{ Name = "library.png";      X = 455; Y = 110; Width = 620; Height = 470 },
  @{ Name = "news-board.png";   X = 1035; Y = 110; Width = 410; Height = 440 },
  @{ Name = "cafe.png";         X = 50; Y = 490; Width = 465; Height = 455 },
  @{ Name = "artifact.png";     X = 500; Y = 495; Width = 560; Height = 450 },
  @{ Name = "portal.png";       X = 1060; Y = 490; Width = 410; Height = 455 }
)

foreach ($crop in $buildingCrops) {
  $outputPath = Join-Path $targetRoot ("buildings\" + $crop.Name)
  Save-Crop -SourcePath $buildingSheet -X $crop.X -Y $crop.Y -Width $crop.Width -Height $crop.Height -OutputPath $outputPath
}

$characterSheet = Join-Path $sourceRoot "characters\xu-town_character-family_primary_v01.png"

$portraitCrops = @(
  @{ Name = "player-portrait.png"; X = 285; Y = 620; Width = 230; Height = 260 },
  @{ Name = "verbrugge-portrait.png"; X = 525; Y = 620; Width = 250; Height = 260 },
  @{ Name = "chronicler-portrait.png"; X = 770; Y = 620; Width = 240; Height = 260 },
  @{ Name = "perlin-portrait.png"; X = 900; Y = 180; Width = 220; Height = 270 },
  @{ Name = "bard-portrait.png"; X = 1000; Y = 620; Width = 240; Height = 260 },
  @{ Name = "berkeley-portrait.png"; X = 1230; Y = 620; Width = 240; Height = 260 }
)

foreach ($crop in $portraitCrops) {
  $outputPath = Join-Path $targetRoot ("characters\" + $crop.Name)
  Save-Crop -SourcePath $characterSheet -X $crop.X -Y $crop.Y -Width $crop.Width -Height $crop.Height -OutputPath $outputPath
}
