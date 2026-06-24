// recipe-runner — the gate + argv builder for REAL Windows recipe execution.
//
// Even with ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1, only a tiny allow-list of reversible,
// low-blast-radius recipes may actually touch the machine. Everything else stays dry-run
// no matter what flags are set. This is the difference between "the runner CAN execute"
// and "this specific fix is cleared to execute" — the second gate lives here.
//
// PowerShell is always invoked with -ExecutionPolicy Restricted, which forbids running
// .ps1 FILES — so the cleared command runs inline via -Command (the bundled .ps1 mirrors
// under src/recipes/scripts/ are human-readable source-of-truth, not the execution path).

// Recipes cleared for real execution. All are reversible, low-blast-radius fixes whose
// real-execution actions are cache flushes or service restarts (services Windows auto-recovers).
//   Original 3:  FLUSH_DNS · CLEAR_TEMP_FILES · CLEAR_TEAMS_CACHE
//   RUN 1 added: WIFI (WLAN restart) · PRINT (Spooler restart) · AUDIO (Audiosrv restart) ·
//                VPN (RasMan restart) · WINDOWS UPDATE (wuauserv/bits/cryptsvc restart)
// Every newly-cleared action starts with an already-allowed verb prefix (ipconfig / Restart-Service),
// so no command-allowlist surface was widened to reach 8.
export const EXECUTABLE_RECIPES = new Set([
  "dns-fail-v1",
  "disk-low-space-v1",
  "wifi-no-internet-v1",
  "printer-spooler-v1",
  "audio-no-output-v1",
  "vpn-connect-fail-v1",
  "windows-update-stuck-v1",
  // RUN 7 — 8 service-restart greens (pure reversible Restart-Service, no allowlist widening).
  "svc-spooler-stopped-v1",
  "svc-audiosrv-stopped-v1",
  "svc-bits-stopped-v1",
  "svc-wuauserv-stopped-v1",
  "svc-dnscache-stopped-v1",
  "svc-wlansvc-stopped-v1",
  "svc-workstation-stopped-v1",
  "svc-rasman-stopped-v1"
]);

// YELLOW tier (RUN 2). More invasive than a cache flush / service restart — they close an app,
// rename a local cache file, or reset a sync client — but every action is still REVERSIBLE.
// Two hard guarantees the green tier does NOT carry:
//   1. They NEVER auto-fire. Even in Autonomous mode they require an explicit user confirm.
//   2. A System Restore point MUST be taken before any action runs.
// teams-cache-v1 moved here from the green set in RUN 2: killing Teams + clearing IndexedDB is a
// yellow-tier act and must never auto-fire mid-call.
export const YELLOW_RECIPES = new Set([
  "outlook-ost-repair-v1",
  "teams-cache-v1",
  "onedrive-sync-stuck-v1",
  "bluetooth-off-v1",
  // RUN 13 — internet-down troubleshooter restarts connectivity services, so it always confirms.
  "net-down-troubleshoot-v1"
]);

// Map each executable recipe to a post-fix verification probe (read-only) so the runner
// can confirm the fix landed. Verification output is never surfaced raw — only ok/!ok.
export const VERIFY_COMMANDS = {
  "dns-fail-v1": "(Get-DnsClientCache | Measure-Object).Count",
  "disk-low-space-v1": "[math]::Round((Get-PSDrive C).Free/1GB,1)",
  "teams-cache-v1": "(Get-Process -Name Teams,ms-teams -ErrorAction SilentlyContinue | Measure-Object).Count",
  "wifi-no-internet-v1": "(Get-Service -Name WlanSvc).Status",
  "printer-spooler-v1": "(Get-Service -Name Spooler).Status",
  "audio-no-output-v1": "(Get-Service -Name Audiosrv).Status",
  "vpn-connect-fail-v1": "(Get-VpnConnection -ErrorAction SilentlyContinue | Measure-Object).Count",
  "windows-update-stuck-v1": "(Get-Service -Name wuauserv).Status",
  // Yellow-tier read-only probes.
  "teams-cache-v1": "(Get-Process -Name Teams,ms-teams -ErrorAction SilentlyContinue | Measure-Object).Count",
  "outlook-ost-repair-v1": "(Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue | Measure-Object).Count",
  "onedrive-sync-stuck-v1": "(Get-Process -Name OneDrive -ErrorAction SilentlyContinue | Measure-Object).Count",
  "bluetooth-off-v1": "(Get-Service -Name bthserv).Status",
  "net-down-troubleshoot-v1": "Test-NetConnection -ComputerName 1.1.1.1 -Port 53 -InformationLevel Quiet",
  // RUN 7 service-restart greens — read-only status probes.
  "svc-spooler-stopped-v1": "(Get-Service -Name Spooler).Status",
  "svc-audiosrv-stopped-v1": "(Get-Service -Name Audiosrv).Status",
  "svc-bits-stopped-v1": "(Get-Service -Name BITS).Status",
  "svc-wuauserv-stopped-v1": "(Get-Service -Name wuauserv).Status",
  "svc-dnscache-stopped-v1": "(Get-Service -Name Dnscache).Status",
  "svc-wlansvc-stopped-v1": "(Get-Service -Name WlanSvc).Status",
  "svc-workstation-stopped-v1": "(Get-Service -Name LanmanWorkstation).Status",
  "svc-rasman-stopped-v1": "(Get-Service -Name RasMan).Status"
};

// Hard denylist — a destructive verb here means the action NEVER executes, allow-list or not.
const DENY = /\b(format-volume|remove-partition|clear-disk|delete\s+shadow|bcdedit|reg\s+delete|cipher\s+\/w|diskpart|format\s)\b/i;

export function isGreenRecipe(recipeId) {
  return EXECUTABLE_RECIPES.has(String(recipeId));
}

export function isYellowRecipe(recipeId) {
  return YELLOW_RECIPES.has(String(recipeId));
}

// "Executable" = cleared to touch the machine at all (green OR yellow tier). Used by the verify
// path so a yellow fix also gets its read-only post-fix probe. Reds and everything else are false.
export function isExecutableRecipe(recipeId) {
  return isGreenRecipe(recipeId) || isYellowRecipe(recipeId);
}

// Yellow recipes mandate a System Restore point before any action runs. Greens don't require one
// (the main process still records one opportunistically when an action touches the system).
export function requiresRestorePoint(recipeId) {
  return isYellowRecipe(recipeId);
}

/**
 * Decide whether THIS action, in THIS recipe, may run for real.
 * Green tier: system fixes enabled, not dry-run, clean powershell command.
 * Yellow tier: ALL of the green conditions PLUS an explicit user confirm AND a restore point
 *   already taken — and this holds regardless of mode, so Autonomous can never auto-fire a yellow.
 * Anything else (red / unlisted) is never executable.
 */
export function isActionExecutable({ recipeId, action, allowSystemFixes, dryRun, confirmed, restorePointTaken }) {
  if (!allowSystemFixes || dryRun) return false;
  if (!action || action.shell !== "powershell" || !action.command) return false;
  if (DENY.test(action.command)) return false;
  if (isGreenRecipe(recipeId)) return true;
  if (isYellowRecipe(recipeId)) {
    return confirmed === true && restorePointTaken === true;
  }
  return false;
}

/**
 * Build the exact spawn argv for an action. Pure + deterministic so a test can assert it.
 * Restricted policy is non-negotiable; the command is passed positionally, never shell-joined.
 */
export function buildExecution(action) {
  return {
    file: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command", String(action.command)]
  };
}

export function buildVerification(recipeId) {
  const command = VERIFY_COMMANDS[String(recipeId)];
  if (!command) return null;
  return {
    file: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command", command]
  };
}
