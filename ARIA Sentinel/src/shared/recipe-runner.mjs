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
  "svc-rasman-stopped-v1",
  // FAULT LAB 2026-10-14 (defect 1) — the DHCP Client restart, the same reversible shape as svc-wlansvc-stopped-v1.
  // Before it existed, SYSTEM.SERVICE.STOPPED.DHCP had no recipe of its own and the matcher fell through to
  // system-time-drift-v1 (the shared SYSTEM family and the "system" title token were the only points in play).
  "svc-dhcp-stopped-v1"
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
//
// FAULT LAB 2026-10-14 (defect 3) — the runner reads a probe's EXIT CODE only (output is never read: content-blind),
// so a probe that always exits 0 can never fail. dns-fail-v1's old probe — `(Get-DnsClientCache | Measure-Object).Count`
// — always exited 0, and the fault lab caught ARIA reporting a DNS refresh "fixed and verified" while a stale DHCP lease
// or a corrupt Winsock catalog kept the internet down. A GATING probe (VERIFY_GATES below) exits non-zero when the
// problem is still there, and main.mjs turns that into the outcome `not_resolved` (never "success").
//   · dns-fail-v1 — resolve the name Windows' own connectivity sensor (NCSI) resolves, through the configured resolver,
//     DNS protocol only, after the flush: it fails unless a resolver is REACHABLE and ANSWERING. It is the same name the
//     network watcher probes (src/sub-agents/detection/network-watcher.mjs DEFAULT_DNS_PROBE_NAME), so the verify asks
//     exactly the question whose failure raised NET.DNS.FAIL, and it adds no new traffic signature. A third-party anchor
//     (e.g. TCP/53 to a public resolver) was deliberately NOT used: corporate firewalls commonly block direct external
//     DNS, which would turn every verify on those networks into a false "not resolved" (audit M8 removed that probe from
//     the watcher for the same reason). It runs in a child PowerShell (never the app process) and only once per fix.
//   · svc-dhcp-stopped-v1 — the DHCP Client is Running AND, when a connected interface is DHCP-enabled, a DHCP lease is
//     present (an APIPA address means no lease). A statically-addressed device has no DHCP-enabled interface, so only
//     the service state is judged there.
export const DNS_VERIFY_PROBE = "try { Resolve-DnsName -Name dns.msftncsi.com -Type A -DnsOnly -QuickTimeout -ErrorAction Stop | Out-Null } catch { exit 1 }";
export const DHCP_VERIFY_PROBE = "if ((Get-Service -Name Dhcp).Status -ne 'Running') { exit 1 }; "
  + "if ((Get-NetIPInterface -AddressFamily IPv4 -Dhcp Enabled -ConnectionState Connected -ErrorAction SilentlyContinue) -and -not (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp -ErrorAction SilentlyContinue)) { exit 1 }";
export const VERIFY_COMMANDS = {
  "dns-fail-v1": DNS_VERIFY_PROBE,
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
  "svc-rasman-stopped-v1": "(Get-Service -Name RasMan).Status",
  "svc-dhcp-stopped-v1": DHCP_VERIFY_PROBE
};

// FAULT LAB 2026-10-14 (defect 3) — the recipes whose verify probe GATES the outcome: its exit code is the verdict
// (0 = the problem is gone; non-zero = it is still there → `not_resolved`). Every other probe above is a read-only
// status read that exits 0 either way — kept, but it cannot prove a fix, so it cannot earn the vendor floor below.
export const VERIFY_GATES = new Set(["dns-fail-v1", "svc-dhcp-stopped-v1"]);

// The outcome of a live run whose steps all completed but whose gating verify probe failed: NOT resolved — never
// "success", never "fixed and verified". (resolution-outcome.mjs already accepts this word as "not yet resolved".)
export const NOT_RESOLVED = "not_resolved";

// FAULT LAB 2026-10-14 (defect 4) — each shipped recipe's ROLLBACK / INVERSE: what undoes its change, or why nothing
// needs undoing. Declared per recipe (never inferred) so the vendor floor is earned explicitly. Only recipes with a
// real inverse are listed: disk-low-space-v1 (deletes temp files — no inverse) and every yellow recipe are absent.
export const ROLLBACK_PLANS = Object.freeze({
  "dns-fail-v1": Object.freeze({ kind: "self-restoring", inverse: "Nothing to restore: the resolver cache refills itself on the next lookup, and re-registration re-sends the same records." }),
  "svc-dhcp-stopped-v1": Object.freeze({ kind: "service-state", inverse: "A restart of a stopped DHCP Client either brings it back or leaves it stopped — the state it was already in; nothing else is touched." })
});

/**
 * FAULT LAB 2026-10-14 (defect 4) — VENDOR-VETTED (the shipped catalogue as the trust floor, GREEN ONLY).
 * A recipe is vendor-vetted when ALL of these hold:
 *   1. it is in the GREEN tier (EXECUTABLE_RECIPES): cleared, reversible, no confirm and no restore point required;
 *   2. it ships a GATING verify probe (VERIFY_GATES + VERIFY_COMMANDS): a fix that did not take ends `not_resolved`;
 *   3. it declares its rollback / inverse (ROLLBACK_PLANS).
 * dry-run-policy.mjs vettedTier() then treats it as Tier 1 from the first run on a fresh install (the minimum the
 * execution policy needs before anything runs unattended). YELLOW never qualifies (it still needs 10 locally vetted
 * runs); RED never runs on its own at all. Every other gate is unchanged: the countdown, Ctrl+Alt+K, the restore point,
 * needsAdmin (an admin-needing fix is still never run unattended) and red-never-automated. Pure.
 */
export function isVendorVetted(recipeId) {
  const id = String(recipeId || "");
  return isGreenRecipe(id) && !isYellowRecipe(id) && VERIFY_GATES.has(id) && Boolean(VERIFY_COMMANDS[id]) && Boolean(ROLLBACK_PLANS[id]);
}

// Hard denylist — a destructive verb here means the action NEVER executes, allow-list or not.
const DENY = /\b(format-volume|remove-partition|clear-disk|delete\s+shadow|bcdedit|reg\s+delete|cipher\s+\/w|diskpart|format\s)\b/i;

// PROD 2026-10-14 (audit M3) — commands that need an ELEVATED token on a default Windows 10/11 install. The app runs
// as the signed-in user (UAC split token, even for administrators), so these steps only succeed through a UAC
// prompt the person answers. Shape-based so a recipe cannot forget the flag; `action.needsAdmin:true` is the
// explicit, test-asserted declaration on every such registry action.
export const NEEDS_ADMIN_RE = /\b(Restart-Service|Stop-Service|Start-Service|Checkpoint-Computer|Update-MpSignature)\b|ipconfig\s+\/release/i;

/** Does this action need administrator rights? Explicit flag OR command shape (either is enough). */
export function actionNeedsAdmin(action) {
  if (!action) return false;
  if (action.needsAdmin === true) return true;
  return action.shell === "powershell" && NEEDS_ADMIN_RE.test(String(action.command || ""));
}

/** Does this recipe (registry object) have at least one live step that needs administrator rights? */
export function recipeHasAdminStep(recipe) {
  return Boolean(recipe && (recipe.actions || []).some((a) => a && a.shell === "powershell" && actionNeedsAdmin(a)));
}

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

/**
 * PROD 2026-10-14 (audit M3) — the elevated spawn for ONE allow-listed command: an outer, non-elevated PowerShell
 * asks Windows for an elevated PowerShell through `Start-Process -Verb RunAs` (the UAC prompt the person answers is
 * the consent), waits for it, and exits with ITS exit code. The inner command travels as -EncodedCommand (base64
 * UTF-16LE) so no quote / semicolon / parenthesis can be re-interpreted on the way through the command line; the
 * inner session is -NonInteractive -ExecutionPolicy Restricted like every other spawn. A declined prompt makes
 * Start-Process throw → exit 1223 (ERROR_CANCELLED) so the caller can say "declined" instead of "failed". Pure.
 */
export const UAC_CANCELLED_EXIT = 1223;
export function buildElevatedExecution(command) {
  const inner = String(command || "");
  const encoded = Buffer.from(inner, "utf16le").toString("base64");
  const outer = "try { $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ErrorAction Stop "
    + `-ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Restricted','-EncodedCommand','${encoded}'); exit $p.ExitCode } catch { exit ${UAC_CANCELLED_EXIT} }`;
  return {
    file: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command", outer],
    encodedCommand: encoded,
    elevated: true
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
