# Convert all MP4 files in a folder to WAV
# Usage: .\convert_mp4_to_wav.ps1 -InputDir "C:\path\to\mp4s" -OutputDir "C:\path\to\wavs"
# If OutputDir is omitted, WAV files are placed next to the originals.

param(
    [Parameter(Mandatory=$true)]
    [string]$InputDir,

    [string]$OutputDir
)

if (-not (Test-Path $InputDir)) {
    Write-Error "Input directory not found: $InputDir"
    exit 1
}

if ($OutputDir -and -not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$files = Get-ChildItem -Path $InputDir -Filter "*.mp4"

if ($files.Count -eq 0) {
    Write-Host "No MP4 files found in $InputDir"
    exit 0
}

Write-Host "Converting $($files.Count) file(s)..."

foreach ($file in $files) {
    $outName = [System.IO.Path]::ChangeExtension($file.Name, ".wav")
    if ($OutputDir) {
        $outPath = Join-Path $OutputDir $outName
    } else {
        $outPath = Join-Path $file.DirectoryName $outName
    }

    Write-Host "  $($file.Name) -> $outName"
    ffmpeg -i $file.FullName -vn -acodec pcm_s16le -ar 44100 -ac 2 $outPath -y -loglevel error

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed: $($file.Name)"
    }
}

Write-Host "Done."
