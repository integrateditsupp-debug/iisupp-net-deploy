# pull-kb.ps1 - wrapper the Windows Scheduled Task runs to mirror ARIA's live bit-KB
# to this machine (aria_brain_pack/bits/). Reads ARIA_AUDIT_SECRET from your persisted
# user environment (set once via setx). Logs each run to aria_brain_pack/pull.log.
# Pure ASCII + path derived from $PSScriptRoot so the Unicode repo name can't break it.
# Double-click-runnable too (right-click > Run with PowerShell).

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot      # ...\scripts -> repo root
$node = 'C:\Program Files\nodejs\node.exe'
$log  = Join-Path $repo 'aria_brain_pack\pull.log'

Set-Location $repo
$stamp = (Get-Date).ToString('s')
try {
  $out = & $node 'scripts/kb-pull.mjs' 2>&1 | Out-String
  Add-Content -Path $log -Value "[$stamp] $out"
} catch {
  Add-Content -Path $log -Value "[$stamp] ERROR: $($_.Exception.Message)"
  exit 1
}
