// RUN 20 §4 — Tier-0 "safe-generic" recipes. These run when a symptom doesn't match a specific cause.
// EVERY Tier-0 recipe is: dry-run by default · content-blind · audit-logged · user-confirmed · built on
// an allowlisted command set (no shell:true, no eval). Tier-0 NEVER deletes user documents, modifies
// system files, disables security, installs software, or writes the registry.
//
// catalog.mjs is the single source of truth; each <name>.recipe.mjs re-exports one entry from here.

export const TIER0 = "tier-0-safe-generic";

// Allowed first-token of any Tier-0 command. Anything else is rejected by validateTier0().
export const TIER0_ALLOWED_PREFIXES = [
  "ipconfig", "nbtstat", "netsh", "netstat",
  "Get-ChildItem", "Get-Package", "Get-AppxPackage", "Get-CimInstance", "Get-WinEvent",
  "Get-Service", "Get-ItemProperty", "Measure-Object",
  "Stop-Service", "Start-Service", "Restart-Service",
  "Remove-Item", "Start-Process", "wmic", "sfc", "msdt.exe", "reg"
];

// Never-allowed substrings (destructive / security-disabling / write ops) — defense in depth.
export const TIER0_DENY = /\b(format-volume|remove-partition|clear-disk|diskpart|bcdedit|reg\s+add|reg\s+delete|set-itemproperty|new-itemproperty|set-mppreference|disable|uninstall|del\s+\/|rd\s+\/s)\b/i;

const def = (o) => ({
  tier: TIER0,
  readOnly: false,
  touchesSystemFiles: false,
  deletesUserData: false,
  disablesSecurity: false,
  requiresReboot: false,
  requiresConfirm: true,
  dryRunDefault: true,
  ...o
});

export const recipes = {
  "clear-user-temp": def({
    id: "clear-user-temp", title: "Clear user temp files", category: "slow-performance",
    whatItDoes: "Estimates reclaimable space, then deletes files inside %TEMP% only — never C:\\Windows\\Temp or any document folder.",
    scope: "$env:TEMP",
    commands: ["Get-ChildItem -Path $env:TEMP -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum", "Remove-Item -Path \"$env:TEMP\\*\" -Recurse -Force -ErrorAction SilentlyContinue"]
  }),
  "flush-dns": def({
    id: "flush-dns", title: "Flush DNS cache", category: "no-internet",
    whatItDoes: "Clears the DNS resolver + NetBIOS name caches so stale lookups stop failing.",
    commands: ["ipconfig /flushdns", "nbtstat -R"]
  }),
  "reset-network-stack": def({
    id: "reset-network-stack", title: "Reset network stack", category: "no-internet", requiresReboot: true,
    whatItDoes: "Resets Winsock + the TCP/IP stack to defaults. Requires a reboot; asks for consent first.",
    commands: ["netsh winsock reset", "netsh int ip reset"]
  }),
  "clear-browser-cache-prompt": def({
    id: "clear-browser-cache-prompt", title: "Open browser cache cleaner", category: "slow-performance", readOnly: true,
    whatItDoes: "Opens the Edge/Chrome 'Clear browsing data' page for YOU — ARIA never auto-deletes browser data.",
    commands: ["Start-Process msedge -ArgumentList 'edge://settings/clearBrowserData'", "Start-Process chrome -ArgumentList 'chrome://settings/clearBrowserData'"]
  }),
  "restart-print-spooler": def({
    id: "restart-print-spooler", title: "Restart print spooler", category: "printer-issues",
    whatItDoes: "Stops and restarts the Print Spooler service to clear a stuck print queue.",
    commands: ["Stop-Service -Name Spooler", "Start-Service -Name Spooler"]
  }),
  "restart-audio-service": def({
    id: "restart-audio-service", title: "Restart audio services", category: "audio-issues",
    whatItDoes: "Restarts Windows Audio + Audio Endpoint Builder to recover lost or wrong audio output.",
    commands: ["Stop-Service -Name AudioSrv", "Start-Service -Name AudioSrv", "Stop-Service -Name AudioEndpointBuilder", "Start-Service -Name AudioEndpointBuilder"]
  }),
  "restart-windows-search": def({
    id: "restart-windows-search", title: "Restart Windows Search", category: "file-explorer",
    whatItDoes: "Restarts the Windows Search service to fix a slow/broken Start menu + Explorer search.",
    commands: ["Stop-Service -Name WSearch", "Start-Service -Name WSearch"]
  }),
  "check-disk-smart": def({
    id: "check-disk-smart", title: "Check disk SMART health", category: "system-crashes", readOnly: true,
    whatItDoes: "Reads each drive's SMART status (read-only). Reports OK / Pred Fail.",
    commands: ["wmic diskdrive get model,status"]
  }),
  "check-system-files": def({
    id: "check-system-files", title: "Verify system files", category: "system-crashes", readOnly: true,
    whatItDoes: "Runs sfc /verifyonly — reports corrupt system files WITHOUT changing anything.",
    commands: ["sfc /verifyonly"]
  }),
  "view-recent-errors": def({
    id: "view-recent-errors", title: "View recent system errors", category: "app-crashes", readOnly: true,
    whatItDoes: "Reads the last 50 critical/error System-log entries (read-only, sanitized of names/paths).",
    commands: ["Get-WinEvent -FilterHashtable @{LogName='System';Level=1,2} -MaxEvents 50"]
  }),
  "list-startup-impact": def({
    id: "list-startup-impact", title: "List startup programs", category: "slow-performance", readOnly: true,
    whatItDoes: "Lists programs that auto-start at logon and where each is configured (read-only).",
    commands: ["Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location"]
  }),
  "run-native-troubleshooter": def({
    id: "run-native-troubleshooter", title: "Run a built-in Windows troubleshooter", category: "various",
    whatItDoes: "Launches the relevant built-in Windows troubleshooter wizard (msdt.exe) for the user to step through.",
    commands: ["msdt.exe -id NetworkDiagnosticsWeb"]
  }),
  "check-windows-update-state": def({
    id: "check-windows-update-state", title: "Check Windows Update state", category: "update-stuck", readOnly: true,
    whatItDoes: "Reads the Windows Update service status + start type (read-only). No install/change.",
    commands: ["Get-Service -Name wuauserv | Select-Object Status,StartType"]
  }),
  "check-driver-issues": def({
    id: "check-driver-issues", title: "Check device/driver problems", category: "usb-peripheral", readOnly: true,
    whatItDoes: "Lists devices reporting an error code in Device Manager (read-only).",
    commands: ["Get-CimInstance Win32_PnPEntity | Where-Object { $_.ConfigManagerErrorCode -ne 0 } | Select-Object Name,ConfigManagerErrorCode"]
  }),
  "check-ip-configuration": def({
    id: "check-ip-configuration", title: "Show IP configuration", category: "no-internet", readOnly: true,
    whatItDoes: "Shows the full IP configuration (adapters, DHCP, gateway, DNS) read-only to diagnose connectivity.",
    commands: ["ipconfig /all"]
  }),
  "check-active-connections": def({
    id: "check-active-connections", title: "List active network connections", category: "no-internet", readOnly: true,
    whatItDoes: "Lists active TCP/UDP connections and listening ports (read-only) to spot stuck or unexpected connections.",
    commands: ["netstat -ano"]
  }),
  "check-memory-usage": def({
    id: "check-memory-usage", title: "Check memory usage", category: "slow-performance", readOnly: true,
    whatItDoes: "Reports free vs total physical memory (read-only) to confirm whether low RAM is causing slowness.",
    commands: ["Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize"]
  }),
  "check-disk-space": def({
    id: "check-disk-space", title: "Check free disk space", category: "slow-performance", readOnly: true,
    whatItDoes: "Reports free and total space per drive (read-only) to spot a nearly-full disk.",
    commands: ["Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,FreeSpace,Size"]
  }),
  "check-installed-updates": def({
    id: "check-installed-updates", title: "List installed updates", category: "update-stuck", readOnly: true,
    whatItDoes: "Lists installed Windows updates/hotfixes with install dates (read-only).",
    commands: ["Get-CimInstance Win32_QuickFixEngineering | Select-Object HotFixID,InstalledOn"]
  }),
  "restart-dhcp-client": def({
    id: "restart-dhcp-client", title: "Restart DHCP client", category: "no-internet",
    whatItDoes: "Restarts the DHCP Client service to recover a lost or stale IP lease.",
    commands: ["Restart-Service -Name Dhcp"]
  })
};

export const TIER0_IDS = Object.keys(recipes);
export const TIER0_RECIPES = Object.values(recipes);
