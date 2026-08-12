$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$ffmpegPath = Join-Path $projectRoot "tools\ffmpeg\bin\ffmpeg.exe"
$ffprobePath = Join-Path $projectRoot "tools\ffmpeg\bin\ffprobe.exe"

try {
  if (-not (Test-Path $ffmpegPath)) {
    throw "Missing FFmpeg binary: $ffmpegPath"
  }

  if (-not (Test-Path $ffprobePath)) {
    throw "Missing ffprobe binary: $ffprobePath"
  }

  & $ffmpegPath -version | Select-Object -First 1
  & $ffprobePath -version | Select-Object -First 1
  Write-Host "Project FFmpeg binaries are available."
} catch {
  Write-Error "Project FFmpeg check failed. Put ffmpeg.exe and ffprobe.exe under tools\ffmpeg\bin."
  exit 1
}
