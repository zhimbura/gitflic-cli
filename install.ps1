# install.ps1 — one-click installer for gitflic-cli (Windows / PowerShell 5+).
#
# Realistic one-shot:
#   git clone git@gitflic.ru:tikhon/gitflic-cli.git C:\tools\gitflic-cli
#   cd C:\tools\gitflic-cli
#   powershell -ExecutionPolicy Bypass -File install.ps1
#
# With a token (HTTPS instead of SSH):
#   $env:GITFLIC_TOKEN = "..."; .\install.ps1
#
# Idempotent: re-running reinstalls the same files and rewires the .cmd shim.
[CmdletBinding()]
param(
  [string]$Repo      = $env:REPO,
  [string]$Branch    = $env:BRANCH,
  [string]$Prefix    = $env:LOCALAPPDATA,
  [string]$Token     = $env:GITFLIC_TOKEN,
  [switch]$NoSymlink,
  [switch]$DryRun,
  [switch]$Quiet
)

if (-not $Repo)   { $Repo   = "tikhon/gitflic-cli" }
if (-not $Branch) { $Branch = "main" }
$InstallDir = Join-Path $Prefix "share\gitflic-cli"
$BinDir     = Join-Path $Prefix "bin"
$CmdName    = "gitflic.cmd"
$Remote     = "git@gitflic.ru:$Repo.git"

$ErrorActionPreference = "Stop"

function Log($m)  { if (-not $Quiet) { Write-Host "[install] $m" -ForegroundColor DarkGray } }
function Ok($m)   { if (-not $Quiet) { Write-Host "[ ok ]   $m" -ForegroundColor Green } }
function Warn($m) {                Write-Host "[warn]   $m" -ForegroundColor Yellow }
function Die($m)  {                Write-Host "[fail]   $m" -ForegroundColor Red; exit 1 }

# ---------- preflight ----------
foreach ($t in "git","node") {
  if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { Die "missing required tool: $t" }
}
$nodeVer = (& node --version) -replace '^v(\d+).*','$1'
if ([int]$nodeVer -lt 18) { Die "need Node 18+ (have $(node --version))" }

Log "repo       $Repo @ $Branch"
Log "prefix     $Prefix"
Log "install    $InstallDir"
Log "bin dir    $BinDir"

# ---------- source: local checkout OR clone ----------
$work = $null
$localMode = $false
if ((Test-Path ".\bin\gitflic") -and (Test-Path ".\lib\gitflic.mjs") -and (Test-Path ".\.git")) {
  Log "using local checkout: $(Get-Location)"
  $work = (Get-Location).Path
  $localMode = $true
} else {
  $work = Join-Path ([System.IO.Path]::GetTempPath()) ("gitflic-install-" + [Guid]::NewGuid().ToString("N").Substring(0,8))
  New-Item -ItemType Directory -Force -Path $work | Out-Null

  Log "cloning via SSH..."
  git clone --depth 1 --branch $Branch --quiet $Remote $work 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    if ($Token) {
      $httpsUrl = "https://oauth2:${Token}@gitflic.ru/$Repo.git"
      Log "SSH failed, trying HTTPS with token..."
      git clone --depth 1 --branch $Branch --quiet $httpsUrl $work 2>&1 | Out-Null
    }
    if ($LASTEXITCODE -ne 0) {
      Die "could not reach $Repo. Either add an SSH key to https://gitflic.ru or set GITFLIC_TOKEN=<pat> and retry."
    }
    Log "cloned via HTTPS"
  } else {
    Log "cloned via SSH"
  }
}

foreach ($f in "bin\gitflic","lib\gitflic.mjs","package.json","README.md") {
  if (-not (Test-Path (Join-Path $work $f))) { Die "source is missing $f" }
}

if ($DryRun) {
  Log "DRY RUN — would install to $InstallDir and write $BinDir\$CmdName"
  if (-not $localMode) { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
  return
}

# ---------- install ----------
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Copy contents of source into install dir.
Get-ChildItem -Path $work -Force | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
}
# Strip .git from the install copy.
if (Test-Path (Join-Path $InstallDir ".git")) { Remove-Item -Recurse -Force (Join-Path $InstallDir ".git") }

if (-not $NoSymlink) {
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $cmdPath = Join-Path $BinDir $CmdName
  if (Test-Path $cmdPath) { Remove-Item -Force $cmdPath }

  # .cmd shim that calls node on the lib entry, mirroring bin/gitflic (bash) 1:1
  $shim = @"
@echo off
node "$InstallDir\lib\gitflic.mjs" %*
"@
  Set-Content -Path $cmdPath -Value $shim -Encoding ASCII
  Ok "wrote $cmdPath"
} else {
  Log "symlink skipped (-NoSymlink). Add $InstallDir\bin to PATH manually."
}

# ---------- verify ----------
Log "smoke test: gitflic help"
try {
  & node "$InstallDir\lib\gitflic.mjs" help *> $null
  Ok "binary works"
} catch {
  Warn "binary installed but self-check failed — run \`gitflic help\` to debug"
}

# ---------- PATH hint ----------
if (-not $NoSymlink) {
  $userPath = [Environment]::GetEnvironmentVariable("Path","User")
  if ($userPath -notlike "*$BinDir*") {
    Write-Host ""
    Warn "$BinDir is not on your PATH."
    Write-Host "       Adding it for the current user..."
    [Environment]::SetEnvironmentVariable("Path", "$BinDir;$userPath", "User")
    $env:Path = "$BinDir;$env:Path"
    Ok "added $BinDir to user PATH (restart shells to pick it up)"
  }
}

if (-not $env:GITFLIC_TOKEN) {
  Write-Host ""
  Warn "GITFLIC_TOKEN is not set."
  Write-Host "       Get a token at https://gitflic.ru -> Profile -> API tokens, then:"
  Write-Host '         $env:GITFLIC_TOKEN = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"'
  Write-Host ""
}

# cleanup tmp clone
if (-not $localMode) { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }

Ok "done. Try:  gitflic auth"
