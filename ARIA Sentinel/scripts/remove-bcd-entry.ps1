<#
  ARIA Sentinel — BSOD Tier A : remove the boot-menu recovery entry.

  Runs at uninstall time, elevated (NSIS uninstaller UAC token). Reads the GUID recorded by
  install-bcd-entry.ps1 from ~/.aria-sentinel/bcd-id.json and deletes exactly that entry, then
  removes the record. Leaves the machine's boot store exactly as it was before install.

  Safety: like its installer counterpart this is the only sanctioned caller of bcdedit besides
  the installer; recipes can never reach it (bcdedit is denylisted in the recipe runner).
#>

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Output 'ARIA BCD: not elevated; leaving boot-menu entry for a later elevated uninstall.'
    exit 0
}

$idFile = Join-Path $env:USERPROFILE '.aria-sentinel\bcd-id.json'
if (-not (Test-Path $idFile)) {
    Write-Output 'ARIA BCD: no recorded boot entry; nothing to remove.'
    exit 0
}

try {
    $guid = (Get-Content $idFile -Raw | ConvertFrom-Json).guid
} catch {
    Write-Output 'ARIA BCD: bcd-id.json unreadable; removing the record only.'
    Remove-Item $idFile -Force -ErrorAction SilentlyContinue
    exit 0
}

if ($guid) {
    # /delete an /application entry needs /f; /cleanup also drops it from displayorder.
    bcdedit /delete "$guid" /cleanup 2>$null | Out-Null
    Write-Output "ARIA BCD: removed boot-menu recovery entry ($guid)."
}

Remove-Item $idFile -Force -ErrorAction SilentlyContinue
exit 0
