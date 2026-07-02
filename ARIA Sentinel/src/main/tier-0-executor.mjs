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
// 🔒 R11 — every command + probe + recipe id is routed through path-guard BEFORE execution; an off-limits
// reference is an absolute HARD STOP (outcome "blocked", nothing spawns). Defense-in-depth: each command is
// also re-validated against the Tier-0 allowlist + deny list before it runs.
import { spawn } from "node:child_process";
import { isBlockedPath, redactPrivate } from "../shared/path-guard.mjs";
import { TIER0_ALLOWED_PREFIXES, TIER0_DENY } from "./recipes/tier-0/catalog.mjs";

// The 5 vetted, reversible bindings. `kind:"service"` → Status probe; `kind:"dns"` → cache-count probe.
export const TIER0_COMMANDS = Object.freeze({
  "restart-print-spooler": { kind: "service", service: "Spooler", command: "Restart-Service Spooler -Force; (Get-Service Spooler).Status", probe: "(Get-Service Spooler).Status" },
  "restart-windows-update": { kind: "service", service: "wuauserv", command: "Restart-Service wuauserv -Force; (Get-Service wuauserv).Status", probe: "(Get-Service wuauserv).Status" },
  "flush-dns-cache": { kind: "dns", command: "ipconfig /flushdns", probe: "(Get-DnsClientCache | Measure-Object).Count" },
  // S2 (F5) — the 2 missing bindings that make network/print recovery true multi-step plans.
  // reset-network-stack: one-way Winsock + TCP/IP reset (netsh was already allowlisted); catalog says
  // requiresReboot — full effect can need one. Step success = the reset applied (exit 0); whether the
  // USER'S problem is gone is declared only by the plan's outcome goalProbe (DNS resolve). One-way:
  // no rollback exists and rollbackService says so honestly.
  "reset-network-stack": { kind: "netsh", command: "netsh winsock reset; netsh int ip reset", probe: "(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Measure-Object).Count" },
  // clear-print-queue: PowerShell-native per-job clearing — Remove-PrintJob is scoped to print jobs
  // ONLY (it cannot delete files), chosen over Remove-Item on the spool directory as the narrower
  // hammer. Probe counts queued jobs: after=0 with before>0 = success; before=0 too = no-op-neutral
  // (an already-empty queue is never claimed as a fix).
  "clear-print-queue": { kind: "spool", command: "Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name | Remove-PrintJob }", probe: "(Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name } | Measure-Object).Count" },
  "restart-bluetooth": { kind: "service", service: "bthserv", command: "Restart-Service bthserv -Force; (Get-Service bthserv).Status", probe: "(Get-Service bthserv).Status" },
  "restart-audio": { kind: "service", service: "Audiosrv", command: "Restart-Service Audiosrv -Force; (Get-Service Audiosrv).Status", probe: "(Get-Service Audiosrv).Status" }
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
  // S2 — netsh (adapter-up count) and spool (queued-job count) probes parse a number, like dns.
  if (spec.kind === "netsh" || spec.kind === "spool") { const m = text.match(/-?\d+/); return m ? Number(m[0]) : null; }
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || ""; // "Running" / "Stopped" / ""
}

function classify(spec, before, after, exec) {
  if (!exec || exec.exitCode !== 0) return "fail";
  if (spec.kind === "dns") return (before === 0 && after === 0) ? "no-op-neutral" : "success";
  // S2 — netsh reset is one-way and never a no-op: exit 0 = the reset really applied. The plan-level
  // outcome goalProbe (not this step verdict) decides whether the user's problem is gone.
  if (spec.kind === "netsh") return "success";
  // S2 — spool: success only when the queue actually drained; an already-empty queue is no-op-neutral;
  // jobs still queued (or an unreadable count) = fail. Real-or-empty.
  if (spec.kind === "spool") return after === 0 ? (before === 0 ? "no-op-neutral" : "success") : "fail";
  if (after === "Running") return before === "Running" ? "no-op-neutral" : "success";
  return "fail"; // not Running after a restart → failed
}

// Default PowerShell runner (win32-only). Injected in tests; main injects a childProcesses-tracked variant.
export function defaultRun(command) {
  return new Promise((resolve) => {
    if (process.platform !== "win32" || !command) return resolve({ stdout: "", stderr: "", exitCode: 0 });
    let out = "", err = "", child;
    try {
      child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", String(command)], { windowsHide: true, timeout: 30000 });
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

/**
 * Execute a Tier-0 recipe through the pre→exec→post→rollback wrapper.
 * @param {string} recipeId  direct or aliased Tier-0 id
 * @param {{dryRun?:boolean, run?:Function, logger?:Function, now?:Function}} opts
 * @returns {Promise<{recipeId,outcome,before,after,exitCode,rolledBack,events,message}>}
 *   outcome ∈ "success" | "no-op-neutral" | "fail" | "dry-run" | "blocked" | "unbound"
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
  if (!canonical) return { recipeId: redactPrivate(String(recipeId || "")), outcome: "unbound", before: null, after: null, exitCode: null, rolledBack: false, events, message: "No Tier-0 executor binding for this recipe." };
  const spec = TIER0_COMMANDS[canonical];

  // 🔒 R11 — hard stop if the id / command / probe reference the off-limits folder.
  if (isBlockedPath(recipeId) || isBlockedPath(spec.command) || isBlockedPath(spec.probe || "") || isBlockedPath(spec.service || "")) {
    emit("SECURITY", "Tier-0 command blocked by R11 (private folder).", { rule: "R11", surfaced: "1 personal folder excluded" });
    return { recipeId, outcome: "blocked", before: null, after: null, exitCode: null, rolledBack: false, events, message: "R11 blocked." };
  }
  // Defense-in-depth allowlist.
  if (!validateTier0Command(spec.command) || (spec.probe && !validateTier0Command(spec.probe))) {
    emit("SECURITY", "Tier-0 command failed allowlist validation.", {});
    return { recipeId, outcome: "blocked", before: null, after: null, exitCode: null, rolledBack: false, events, message: "Command not allowlisted." };
  }

  // PRE
  const before = spec.probe ? parseState(spec, await safeRun(run, spec.probe)) : null;
  emit("TIER0.PRE", `before=${before}`, { before });

  // DRY-RUN — describe, never spawn the remediation command.
  if (opts.dryRun) {
    emit("TIER0.EXEC", "dry-run — no command executed", { dryRun: true });
    return { recipeId: canonical, outcome: "dry-run", before, after: before, exitCode: null, rolledBack: false, events, message: "Dry-run: no system change was made." };
  }

  // EXEC
  const exec = await safeRun(run, spec.command);
  emit("TIER0.EXEC", `exit=${exec && exec.exitCode}`, { exitCode: exec && exec.exitCode });

  // POST
  const after = spec.probe ? parseState(spec, await safeRun(run, spec.probe)) : null;
  emit("TIER0.POST", `after=${after}`, { after });

  const verdict = classify(spec, before, after, exec);
  if (verdict === "fail") {
    const rolledBack = await rollbackService(spec, run, emit);
    return { recipeId: canonical, outcome: "fail", before, after, exitCode: exec && exec.exitCode, rolledBack, events, message: rolledBack ? "Failed; service recovered to running." : "Failed; manual intervention needed." };
  }
  return { recipeId: canonical, outcome: verdict, before, after, exitCode: exec && exec.exitCode, rolledBack: false, events, message: verdict === "success" ? "Recovered." : "No change needed (already healthy)." };
}
