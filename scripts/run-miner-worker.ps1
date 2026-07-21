# run-miner-worker.ps1 — runs the Product Discovery agent (P8 Miner).
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
node scripts/miner-agent.mjs
