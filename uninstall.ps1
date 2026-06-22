# uninstall.ps1 — remove gitflic-cli installed via install.ps1.
# Usage:
#   .\uninstall.ps1
#   .\uninstall.ps1 -Prefix $env:LOCALAPPDATA
[CmdletBinding()]
param(
  [string]$Prefix = $env:LOCALAPPDATA
)
$ErrorActionPreference = "Stop"
$InstallDir = Join-Path $Prefix "share\gitflic-cli"
$BinDir     = Join-Path $Prefix "bin"
$CmdName    = "gitflic.cmd"
$cmdPath    = Join-Path $BinDir $CmdName

$removed = $false
if (Test-Path $cmdPath)    { Write-Host "[uninstall] removing $cmdPath";   Remove-Item -Force $cmdPath;   $removed = $true }
if (Test-Path $InstallDir) { Write-Host "[uninstall] removing $InstallDir"; Remove-Item -Recurse -Force $InstallDir; $removed = $true }

if (-not $removed) { Write-Host "[uninstall] nothing to remove at prefix $Prefix"; exit 0 }

$userPath = [Environment]::GetEnvironmentVariable("Path","User")
if ($userPath -like "*$BinDir*") {
  Write-Host "[uninstall] NOTE: $BinDir is still on your user PATH. Remove it from System Properties > Environment Variables."
}
Write-Host "[uninstall] done"
