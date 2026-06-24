<#
  ARIA Sentinel — BSOD Tier A : install the boot-menu recovery entry.

  Runs ONCE at install time, elevated (NSIS calls it with the installer's UAC token).
  Adds a Windows Boot Manager entry titled "ARIA — Solve it for me" so that after an
  unexpected shutdown / BSOD the user can pick a clearly-labelled ARIA recovery option
  at the boot menu instead of staring at a stop code.

  Safety:
   - This is an INSTALL-TIME script, not a recipe. `bcdedit` is on the recipe-runner denylist
     on purpose, so a recipe can never touch the boot configuration. Only the installer (here)
     and the uninstaller (remove-bcd-entry.ps1) ever call bcdedit, and both are gated by UAC.
   - The created entry is a /application bootapp clone; it changes no existing boot entry and
     is fully removed at uninstall via the stored GUID.
   - Idempotent: if bcd-id.json already records a live entry, it does nothing.
#>

$ErrorActionPreference = 'Stop'

# Must be elevated — bcdedit writes to the boot store.
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Output 'ARIA BCD: not elevated; skipping boot-menu entry (install continues).'
    exit 0
}

$stateDir = Join-Path $env:USERPROFILE '.aria-sentinel'
$idFile   = Join-Path $stateDir 'bcd-id.json'
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null }

# Idempotency: if we already recorded a GUID and it still exists in the store, do nothing.
if (Test-Path $idFile) {
    try {
        $existing = (Get-Content $idFile -Raw | ConvertFrom-Json).guid
        if ($existing -and ((bcdedit /enum "$existing") 2>$null)) {
            Write-Output "ARIA BCD: entry already present ($existing); nothing to do."
            exit 0
        }
    } catch {
        # Corrupt/stale record — fall through and recreate.
    }
}

# Create the entry. bcdedit prints:  The entry {GUID} was successfully created.
$created = bcdedit /create /d 'ARIA — Solve it for me' /application bootapp
$guid    = ([regex]'\{[0-9a-fA-F-]{36}\}').Match([string]$created).Value
if (-not $guid) {
    Write-Output 'ARIA BCD: could not parse new entry GUID; leaving boot store unchanged.'
    exit 1
}

# Make it visible on the boot menu (appended, never set as default).
bcdedit /displayorder "$guid" /addlast | Out-Null

[pscustomobject]@{
    guid       = $guid
    title      = 'ARIA — Solve it for me'
    createdUtc = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content -Path $idFile -Encoding utf8

Write-Output "ARIA BCD: boot-menu recovery entry installed ($guid)."
exit 0
