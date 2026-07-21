# run-sentry-worker.ps1 — runs the Sentry inbox monitor (P5). Dormant until Gmail OAuth exists.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
if (-not $env:IIS_BASE_URL) { $env:IIS_BASE_URL = 'https://iisupp.net' }
node scripts/sentry-agent.mjs
