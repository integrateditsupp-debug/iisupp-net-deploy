// RUN 23b §1 — Tier-0 executor binding. Maps a small set of HIGH-CONFIDENCE Tier-0 recipe ids to actual
// Windows-native, reversible PowerShell commands and runs them through a pre→exec→post→rollback wrapper:
//   PRE  — read state before (service Status / DNS cache count)
//   EXEC — spawn powershell (30s timeout) for the remediation command
//   POST — re-read state, compare → SUCCESS (improved) · NO-OP-NEUTRAL (unchanged) · FAIL (worse/exit≠0)
//   ROLLBACK — on FAIL, try to bring the service back up; worst case logs "manual intervention needed"
//              and STOPS. It NEVER throws and NEVER destabilizes the machine.
// Every step emits a TIER0.{PRE|EXEC|POST|ROLLBACK} audit event. Pure + node-safe: `run` (PowerShell exec)
// is injectable so every path is unit-tested without spawning.
//
// PROD 2026-10-14 (audit M3 / M5) — HONEST ELEVATION. Service control (Restart-Service …) needs an elevated
// token; the app runs as the signed-in user (UAC split token even for admins), so an unelevated attempt is
// refused by Windows with "Cannot open <svc> service" on stderr while the trailing `(Get-Service X).Status`
// statement still exits 0 — which this executor used to report as "already healthy". Now:
//   · every binding that needs administrator rights carries `needsAdmin:true`;
//   · the remediation statement is followed by `if(-not $?){exit 1}` so a refused restart EXITS non-zero;
//   · stderr matching "access is denied | cannot open | PermissionDenied | cannot be stopped" is a FAIL with
//     reason "needs-admin" whatever the exit code says;
//   · a caller that can elevate injects `runElevated` (main: Start-Process -Verb RunAs = the person's UAC
//     consent) and the EXEC step for a needsAdmin binding goes through it; the read-only PRE/POST probes
//     stay unelevated. A caller that declares `elevated:false` and has no elevated runner gets outcome
//     "needs-admin" without a spawn — nothing is tried that is known to fail.
//
// 🔒 R11 — every command + probe + recipe id is routed through path-guard BEFORE execution; an off-limits
// reference is an absolute HARD STOP (outcome "blocked", nothing spawns). Defense-in-depth: each command is
// also re-validated against the Tier-0 allowlist + deny list before it runs.
import { spawn } from "node:child_process";
import { isBlockedPath, redactPrivate } from "../shared/path-guard.mjs";
import { TIER0_ALLOWED_PREFIXES, TIER0_DENY } from "./recipes/tier-0/catalog.mjs";
import { NEEDS_ADMIN_RE } from "../shared/recipe-runner.mjs";

// Commands whose first statement needs an elevated token on a default Windows 10/11 install (one rule, shared
// with the registry recipes in recipe-runner.mjs).
export { NEEDS_ADMIN_RE };
// stderr shapes Windows / PowerShell produce when a non-elevated token tries service control.
export const ACCESS_DENIED_RE = /access is denied|cannot open|PermissionDenied|cannot be stopped/i;
// Windows services nobody (not even an administrator) can stop or restart from a session on Win10 1809+.
export const UNSTOPPABLE_SERVICES = Object.freeze(["Dnscache"]);
const EXIT_GUARD = "if(-not $?){exit 1}";

// The 5 vetted, reversible bindings. `kind:"service"` → Status probe; `kind:"dns"` → cache-count probe.
export const TIER0_COMMANDS = Object.freeze({
  "restart-print-spooler": { kind: "service", service: "Spooler", needsAdmin: true, command: "Restart-Service Spooler -Force; (Get-Service Spooler).Status", probe: "(Get-Service Spooler).Status" },
  "restart-windows-update": { kind: "service", service: "wuauserv", needsAdmin: true, command: "Restart-Service wuauserv -Force; (Get-Service wuauserv).Status", probe: "(Get-Service wuauserv).Status" },
  "flush-dns-cache": { kind: "dns", needsAdmin: false, command: "ipconfig /flushdns", probe: "(Get-DnsClientCache | Measure-Object).Count" },
  "restart-bluetooth": { kind: "service", service: "bthserv", needsAdmin: true, command: "Restart-Service bthserv -Force; (Get-Service bthserv).Status", probe: "(Get-Service bthserv).Status" },
  "restart-audio": { kind: "service", service: "Audiosrv", needsAdmin: true, command: "Restart-Service Audiosrv -Force; (Get-Service Audiosrv).Status", probe: "(Get-Service Audiosrv).Status" }
});

// Catalog ids that recommend-action / the Tier-0 catalog already emit, aliased to a canonical executor id.
export const ALIASES = Object.freeze({
  "restart-audio-service": "restart-audio",
  "flush-dns": "flush-dns-cache"
});

export const TIER0_EXECUTOR_IDS = Object.freeze(Object.keys(TIER0_COMMANDS));

/** Canonical executor id for a recipe id (direct or aliased), or null if there is no live binding. */
export function resolveExecutorId(recipeId) {
  const id = String(recipeId || "");
  if (TIER0_COMMANDS[id]) return id;
  const a = ALIASES[id];
  return a && TIER0_COMMANDS[a] ? a : null;
}

/** Does a command (any PowerShell string) need administrator rights? Pure, shape-based. */
export function commandNeedsAdmin(cmd) {
  return NEEDS_ADMIN_RE.test(String(cmd || ""));
}

/** Does this executor binding need administrator rights? (false for an unknown id). */
export function executorNeedsAdmin(recipeId) {
  const id = resolveExecutorId(recipeId);
  return Boolean(id && TIER0_COMMANDS[id].needsAdmin);
}

/**
 * The command as it is actually spawned: `if(-not $?){exit 1}` right after the REMEDIATION statement (the first
 * one), so a refused Restart-Service cannot be masked by a trailing read-only statement that exits 0. Pure.
 */
export function guardedCommand(cmd) {
  const c = String(cmd || "").trim();
  if (!c) return c;
  const parts = c.split(";");
  const first = parts[0].trim();
  const rest = parts.slice(1).map((s) => s.trim()).filter(Boolean);
  return [first, EXIT_GUARD, ...rest].join("; ");
}

// Read-only Get-DnsClientCache is added to the Tier-0 allowlist (consistent with the other Get-* probes).
const EXEC_ALLOWED = [...TIER0_ALLOWED_PREFIXES, "Get-DnsClientCache"];
const firstToken = (seg) => seg.replace(/^[\s(]+/, "").split(/[\s.|]/)[0] || "";

/** Defense-in-depth: each `;`-separated statement must start with an allowlisted token and miss the deny list. */
export function validateTier0Command(cmd) {
  const c = String(cmd || "");
  if (!c || TIER0_DENY.test(c)) return false;
  for (const seg of c.split(";")) {
    const s = seg.trim();
    if (!s) continue;
    if (s === EXIT_GUARD) continue; // the exit guard is ours, never user/remote input
    const tok = firstToken(s);
    if (!EXEC_ALLOWED.some((p) => p.toLowerCase() === tok.toLowerCase())) return false;
  }
  return true;
}

// A throwing runner must never crash the executor — degrade to a failed (exit 1) result.
async function safeRun(run, cmd) {
  try { return (await run(cmd)) || { stdout: "", stderr: "", exitCode: 1 }; }
  catch { return { stdout: "", stderr: "run-threw", exitCode: 1 }; }
}

function parseState(spec, res) {
  // 🔒 R11 — redact probe stdout at the source so a private path can never reach before/after or the audit.
  const text = redactPrivate(String((res && res.stdout) || "")).trim();
  if (spec.kind === "dns") { const m = text.match(/-?\d+/); return m ? Number(m[0]) : null; }
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || ""; // "Running" / "Stopped" / ""
}

/**
 * Classify an execution. Returns { verdict, reason } — verdict ∈ success | no-op-neutral | fail; reason is set
 * on a fail ("needs-admin" when Windows refused the token, "exit-code" / "not-running" otherwise). Exported for tests.
 */
export function classifyOutcome(spec, before, after, exec) {
  const stderr = String((exec && exec.stderr) || "");
  if (ACCESS_DENIED_RE.test(stderr)) return { verdict: "fail", reason: "needs-admin" };
  if (!exec || exec.exitCode !== 0) return { verdict: "fail", reason: exec && exec.reason ? String(exec.reason) : "exit-code" };
  if (spec.kind === "dns") return { verdict: (before === 0 && after === 0) ? "no-op-neutral" : "success", reason: "" };
  if (after === "Running") return { verdict: before === "Running" ? "no-op-neutral" : "success", reason: "" };
  return { verdict: "fail", reason: "not-running" }; // not Running after a restart → failed
}
function classify(spec, before, after, exec) { return classifyOutcome(spec, before, after, exec).verdict; }

// Default PowerShell runner (win32-only). Injected in tests; main injects a childProcesses-tracked variant.
export function defaultRun(command) {
  return new Promise((resolve) => {
    if (process.platform !== "win32" || !command) return resolve({ stdout: "", stderr: "", exitCode: 0 });
    let out = "", err = "", child;
    try {
      child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command", String(command)], { windowsHide: true, timeout: 30000 });
    } catch { return resolve({ stdout: "", stderr: "spawn-failed", exitCode: 1 }); }
    child.stdout?.on("data", (d) => { out += d.toString(); });
    child.stderr?.on("data", (d) => { err += d.toString(); });
    child.on("error", () => resolve({ stdout: out, stderr: err || "error", exitCode: 1 }));
    child.on("close", (code) => resolve({ stdout: out, stderr: err, exitCode: code == null ? 1 : code }));
  });
}

async function rollbackService(spec, run, emit) {
  if (spec.kind !== "service" || !spec.service) { emit("TIER0.ROLLBACK", "no rollback applicable (idempotent command)", { recovered: false, manual: false }); return false; }
  const cmd = `Start-Service ${spec.service}`;
  if (isBlockedPath(cmd) || !validateTier0Command(cmd)) { emit("TIER0.ROLLBACK", "rollback command rejected; manual intervention needed", { recovered: false, manual: true }); return false; }
  try {
    await safeRun(run, cmd);
    const after = parseState(spec, await safeRun(run, spec.probe));
    if (after === "Running") { emit("TIER0.ROLLBACK", `recovered ${spec.service}`, { recovered: true, manual: false }); return true; }
    emit("TIER0.ROLLBACK", `manual intervention needed for ${spec.service}`, { recovered: false, manual: true });
    return false;
  } catch {
    emit("TIER0.ROLLBACK", `rollback error; manual intervention needed for ${spec.service}`, { recovered: false, manual: true });
    return false;
  }
}

const NEEDS_ADMIN_MESSAGE = "Needs administrator approval (UAC) — Windows refused the service change for a standard user. Nothing was changed.";

/**
 * Execute a Tier-0 recipe through the pre→exec→post→rollback wrapper.
 * @param {string} recipeId  direct or aliased Tier-0 id
 * @param {{dryRun?:boolean, run?:Function, runElevated?:Function, elevated?:boolean, logger?:Function, now?:Function}} opts
 *   runElevated — an injected runner that executes ONE allow-listed command with administrator rights (main:
 *                 a UAC prompt the person answers). Used for the EXEC/ROLLBACK steps of a needsAdmin binding.
 *   elevated    — false declares "this process is not elevated and cannot ask"; a needsAdmin binding then
 *                 returns outcome "needs-admin" without spawning. Omitted → the plain runner is attempted.
 * @returns {Promise<{recipeId,outcome,before,after,exitCode,rolledBack,events,message,needsAdmin,reason}>}
 *   outcome ∈ "success" | "no-op-neutral" | "fail" | "dry-run" | "blocked" | "unbound" | "needs-admin"
 */
export async function executeTier0(recipeId, opts = {}) {
  const run = opts.run || defaultRun;
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const events = [];
  const emit = (event, text, extra = {}) => {
    const safe = redactPrivate(String(text == null ? "" : text));
    const e = { event, recipeId: redactPrivate(String(recipeId || "")), text: safe, ts: now(), ...extra };
    events.push(e);
    if (typeof opts.logger === "function") opts.logger(event, safe, { recipeId: e.recipeId, ...extra });
  };

  const canonical = resolveExecutorId(recipeId);
  // 🔒 R11 — never echo a raw (possibly private) id back; redact it in the unbound result.
  if (!canonical) return { recipeId: redactPrivate(String(recipeId || "")), outcome: "unbound", before: null, after: null, exitCode: null, rolledBack: false, events, message: "No Tier-0 executor binding for this recipe.", needsAdmin: false, reason: "unbound" };
  const spec = TIER0_COMMANDS[canonical];
  const needsAdmin = Boolean(spec.needsAdmin);

  // 🔒 R11 — hard stop if the id / command / probe reference the off-limits folder.
  if (isBlockedPath(recipeId) || isBlockedPath(spec.command) || isBlockedPath(spec.probe || "") || isBlockedPath(spec.service || "")) {
    emit("SECURITY", "Tier-0 command blocked by R11 (private folder).", { rule: "R11", surfaced: "1 personal folder excluded" });
    return { recipeId, outcome: "blocked", before: null, after: null, exitCode: null, rolledBack: false, events, message: "R11 blocked.", needsAdmin, reason: "r11" };
  }
  // Defense-in-depth allowlist.
  if (!validateTier0Command(spec.command) || (spec.probe && !validateTier0Command(spec.probe))) {
    emit("SECURITY", "Tier-0 command failed allowlist validation.", {});
    return { recipeId, outcome: "blocked", before: null, after: null, exitCode: null, rolledBack: false, events, message: "Command not allowlisted.", needsAdmin, reason: "allowlist" };
  }

  // PRE
  const before = spec.probe ? parseState(spec, await safeRun(run, spec.probe)) : null;
  emit("TIER0.PRE", `before=${before}`, { before });

  // DRY-RUN — describe, never spawn the remediation command.
  if (opts.dryRun) {
    emit("TIER0.EXEC", "dry-run — no command executed", { dryRun: true, needsAdmin });
    return { recipeId: canonical, outcome: "dry-run", before, after: before, exitCode: null, rolledBack: false, events, message: needsAdmin ? "Dry-run: no system change was made. Running this for real asks for administrator approval (UAC)." : "Dry-run: no system change was made.", needsAdmin, reason: "" };
  }

  // Which runner performs the change: the elevated one for a needsAdmin binding when the caller can elevate.
  const execRun = needsAdmin && typeof opts.runElevated === "function" ? opts.runElevated : run;
  if (needsAdmin && execRun === run && opts.elevated === false) {
    emit("TIER0.EXEC", "not attempted — needs administrator rights and no elevation is available", { needsAdmin: true, elevated: false });
    return { recipeId: canonical, outcome: "needs-admin", before, after: before, exitCode: null, rolledBack: false, events, message: "Needs administrator approval (UAC) — not attempted because no one is here to approve it. Nothing was changed.", needsAdmin, reason: "needs-admin" };
  }

  // EXEC — the remediation statement is exit-guarded so a refusal cannot hide behind a trailing read-only statement.
  const exec = await safeRun(execRun, guardedCommand(spec.command));
  emit("TIER0.EXEC", `exit=${exec && exec.exitCode}`, { exitCode: exec && exec.exitCode, elevated: execRun !== run });

  // POST
  const after = spec.probe ? parseState(spec, await safeRun(run, spec.probe)) : null;
  emit("TIER0.POST", `after=${after}`, { after });

  const { verdict, reason } = classifyOutcome(spec, before, after, exec);
  if (verdict === "fail") {
    if (reason === "needs-admin") {
      emit("TIER0.ROLLBACK", "no rollback attempted — the change was refused before it started (needs administrator)", { recovered: false, manual: false, needsAdmin: true });
      return { recipeId: canonical, outcome: "fail", before, after, exitCode: exec && exec.exitCode, rolledBack: false, events, message: NEEDS_ADMIN_MESSAGE, needsAdmin: true, reason };
    }
    const rolledBack = await rollbackService(spec, execRun, emit);
    const denied = reason === "uac-denied" || reason === "uac-timeout";
    return { recipeId: canonical, outcome: "fail", before, after, exitCode: exec && exec.exitCode, rolledBack, events, message: denied ? "Not applied — the administrator prompt was declined or timed out. Nothing was changed." : rolledBack ? "Failed; service recovered to running." : "Failed; manual intervention needed.", needsAdmin, reason };
  }
  return { recipeId: canonical, outcome: verdict, before, after, exitCode: exec && exec.exitCode, rolledBack: false, events, message: verdict === "success" ? "Recovered." : "No change needed (already healthy).", needsAdmin, reason: "" };
}
