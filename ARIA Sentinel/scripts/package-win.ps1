# ARIA Sentinel — PowerShell equivalent of build-installer.bat (same gates, same honesty).
#   .\scripts\package-win.ps1              install → test → package:win (nsis + msi) → verify
#   .\scripts\package-win.ps1 -SkipTests   (not for publishing)
# Signing comes from the environment (docs/SIGNING.md): AZURE_SIGNING_* or CSC_LINK/CSC_KEY_PASSWORD.
# Without a signing identity the artifact is ARIA-Sentinel-<v>-unsigned.exe and SmartScreen will warn.
param([switch]$SkipTests)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$signingEnv = Join-Path $env:USERPROFILE ".aria-sentinel-signing.ps1"
if (Test-Path -LiteralPath $signingEnv) {
  Write-Host "Signing environment: loading $signingEnv"
  . $signingEnv
} else {
  Write-Host "Signing environment: none ($signingEnv not found) - UNSIGNED build; SmartScreen will warn. See docs/SIGNING.md"
}

$nodeMajor = [int]((node -p "process.versions.node").Split(".")[0])
if ($nodeMajor -lt 22) { throw "Node 22 or newer is required (found $nodeMajor)." }

if (-not (Test-Path -LiteralPath "node_modules")) {
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
}

if (-not $SkipTests) {
  npm test
  if ($LASTEXITCODE -ne 0) { throw "npm test is red - packaging refused" }
}

npm run package:win
if ($LASTEXITCODE -ne 0) { throw "package:win failed - read the verifier output above" }

npm run package:win:verify
if ($LASTEXITCODE -ne 0) { throw "verification failed - do not publish this build" }

$version = (node -p "require('./package.json').version")
Write-Host "Windows package complete and verified: see dist/RELEASE-$version.json. Publish with ota-build.bat or scripts/publish-*.mjs (docs/distribution/)."
