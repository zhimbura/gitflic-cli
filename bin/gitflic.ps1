# gitflic - PowerShell launcher (mirrors bin/gitflic and bin/gitflic.cmd).
# Resolves the repo root relative to this script, then forwards every
# argument to the Node ESM entrypoint.
$Root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $Root "lib/gitflic.mjs") @args
exit $LASTEXITCODE
