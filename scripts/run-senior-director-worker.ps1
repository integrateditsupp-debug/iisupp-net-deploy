$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Worker = Join-Path $RepoRoot "scripts\senior-director-worker.mjs"

Set-Location -LiteralPath $RepoRoot

$env:IIS_BASE_URL = if ($env:IIS_BASE_URL) { $env:IIS_BASE_URL } else { "https://iisupp.net" }
$env:SENIOR_DIRECTOR_OPENCLAW = if ($env:SENIOR_DIRECTOR_OPENCLAW) { $env:SENIOR_DIRECTOR_OPENCLAW } else { "1" }

node $Worker
