<#
  Balakar first-run setup. Called by the installer (and runnable by hand).
  Downloads: embeddable Python, pip packages, ffmpeg, the Whisper model you picked.
  After this finishes, everything runs offline - no accounts, no API keys.
#>
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [ValidateSet("base", "small", "medium", "turbo")][string]$Model = "small",
  [int]$Gpu = 0,
  [int]$Translation = 0,
  [int]$SkipExtension = 0
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"            # makes Invoke-WebRequest ~10x faster
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PyVer   = "3.11.9"
$PyZip   = "https://www.python.org/ftp/python/$PyVer/python-$PyVer-embed-amd64.zip"
$GetPip  = "https://bootstrap.pypa.io/get-pip.py"
$FfmpegZ = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

$py      = Join-Path $InstallDir "python\python.exe"
$engine  = Join-Path $InstallDir "engine"
$models  = Join-Path $InstallDir "models"
$bin     = Join-Path $InstallDir "bin"
$tmp     = Join-Path $env:TEMP "balakar-setup"
New-Item -ItemType Directory -Force -Path $tmp, $models, $bin | Out-Null
Start-Transcript -Path (Join-Path $InstallDir "setup.log") -Force | Out-Null

function Step($n, $msg) { Write-Host ""; Write-Host "[$n/7] $msg" }
function Download($url, $out) {
  for ($i = 1; $i -le 3; $i++) {
    try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing; return }
    catch { if ($i -eq 3) { throw "Download failed: $url ($($_.Exception.Message))" }; Start-Sleep -Seconds (2 * $i) }
  }
}
function Run($exe, $argList) {
  & $exe @argList
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $exe $($argList -join ' ')" }
}

try {
  Step 1 "Python $PyVer (private copy, does not touch your system Python)"
  if (-not (Test-Path $py)) {
    Download $PyZip "$tmp\python.zip"
    Expand-Archive -Path "$tmp\python.zip" -DestinationPath (Join-Path $InstallDir "python") -Force
    $pth = Get-ChildItem (Join-Path $InstallDir "python") -Filter "python*._pth" | Select-Object -First 1
    $lines = Get-Content $pth.FullName | ForEach-Object { if ($_ -match "^#\s*import site") { "import site" } else { $_ } }
    $lines += "..\engine"
    Set-Content -Path $pth.FullName -Value $lines -Encoding ASCII
  } else { Write-Host "already installed" }

  Step 2 "pip"
  Download $GetPip "$tmp\get-pip.py"
  Run $py @("$tmp\get-pip.py", "--no-warn-script-location", "--disable-pip-version-check")

  Step 3 "AI libraries (PyTorch + Transformers) - this is the big one"
  if ($Gpu -eq 1) {
    Run $py @("-m", "pip", "install", "--no-warn-script-location", "torch", "--index-url", "https://download.pytorch.org/whl/cu121")
  } else {
    Run $py @("-m", "pip", "install", "--no-warn-script-location", "torch", "--index-url", "https://download.pytorch.org/whl/cpu")
  }
  Run $py @("-m", "pip", "install", "--no-warn-script-location", "transformers", "accelerate", "numpy", "huggingface_hub",
            "sentencepiece", "protobuf", "indic-transliteration", "unidecode", "fonttools")

  Step 4 "ffmpeg"
  if (-not (Test-Path (Join-Path $bin "ffmpeg.exe"))) {
    Download $FfmpegZ "$tmp\ffmpeg.zip"
    Expand-Archive -Path "$tmp\ffmpeg.zip" -DestinationPath "$tmp\ffmpeg" -Force
    Get-ChildItem "$tmp\ffmpeg" -Recurse -Include ffmpeg.exe, ffprobe.exe | Copy-Item -Destination $bin -Force
  }
  if (-not (Test-Path (Join-Path $bin "ffmpeg.exe"))) { throw "ffmpeg.exe missing after extraction" }

  Step 5 "Whisper model '$Model' (one-time download)"
  Push-Location $engine
  try {
    Run $py @("-m", "captionkit.models", "pull", $Model, "--dir", $models)
    if ($Translation -eq 1) { Run $py @("-m", "captionkit.models", "pull", "nllb", "--dir", $models) }
  } finally { Pop-Location }

  Step 6 "Configuration"
  $dirs = @{ base = "whisper-base"; small = "whisper-small"; medium = "whisper-medium"; turbo = "whisper-large-v3-turbo" }
  $cfg = [ordered]@{
    port = 8765
    whisper_model = ((Join-Path $models $dirs[$Model]) -replace "\\", "/")
    model_overrides = @{}
    translation_model = $(if ($Translation -eq 1) { ((Join-Path $models "nllb-200-600m") -replace "\\", "/") } else { "facebook/nllb-200-distilled-600M" })
    ffmpeg = ((Join-Path $bin "ffmpeg.exe") -replace "\\", "/")
    device = "auto"
    batch_size = 8
    offline = $true
  }
  [IO.File]::WriteAllText((Join-Path $engine "config.json"), ($cfg | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))

  Step 7 "After Effects panel"
  if ($SkipExtension -eq 0) {
    $dest = Join-Path $env:APPDATA "Adobe\CEP\extensions\com.balakar.captions"
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item (Join-Path $InstallDir "extension") $dest -Recurse -Force
    # CEP only loads unsigned panels when PlayerDebugMode is on (per-user setting, no admin needed)
    foreach ($v in 9..14) {
      $k = "HKCU:\Software\Adobe\CSXS.$v"
      if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
      New-ItemProperty -Path $k -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force | Out-Null
    }
  }

  Write-Host ""
  Write-Host "Starting the engine and checking it..."
  Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" | Where-Object { $_.CommandLine -match "captionkit" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Process wscript.exe -ArgumentList ('"' + (Join-Path $InstallDir "balakar-engine.vbs") + '"')
  $ok = $false
  for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
    Start-Sleep -Milliseconds 750
    try { $h = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2; $ok = [bool]$h.ok } catch {}
  }
  if (-not $ok) { throw "Engine did not answer on 127.0.0.1:8765. See $InstallDir\setup.log" }
  if (-not $h.ffmpeg) { throw "Engine started but cannot find ffmpeg." }
  Write-Host "Engine is running. Setup complete."
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Stop-Transcript | Out-Null
  exit 0
}
catch {
  Write-Host ""
  Write-Host "SETUP FAILED: $($_.Exception.Message)"
  Write-Host "Full log: $InstallDir\setup.log"
  try { Stop-Transcript | Out-Null } catch {}
  exit 1
}
