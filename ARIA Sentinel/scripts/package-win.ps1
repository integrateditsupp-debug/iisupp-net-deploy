$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path -LiteralPath "node_modules")) {
  npm install
}

npm run test
npm run package:win

Write-Host "Unsigned Windows package complete. Code signing remains in docs/DO_BUY_OR_APPROVE_LATER.md"
