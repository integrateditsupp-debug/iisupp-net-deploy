// STAGE 3 S2 (brain-audit F2) — OUTCOME-level probes. The whole point of the audit finding:
// "Spooler is Running" is a SERVICE-state answer, not the user's answer. A spooler can be Running
// while printing still fails; a DNS cache can flush while the site still won't resolve. Declaring
// "resolved" on service state is a false positive that guarantees the issue comes back.
//
// So: an outcome probe answers "is the user's actual problem gone?" and nothing else.
//   pass === true   → the user-visible outcome is good, with evidence
//   pass === false  → the outcome is still bad (honest failure → escalate)
//   pass === null   → the probe could not run. NEVER treated as a pass. Real-or-empty (Rule 14).
//
// Every probe is READ-ONLY, routed through R11 path-guard (check #1) and the Tier-0 allowlist before
// it can run, and its stdout is redacted at the source so evidence stays content-blind by construction.
// Pure + node-safe: `run` and `now` are injected, so every path is unit-tested without spawning.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";
import { validateTier0Command, defaultRun } from "./tier-0-executor.mjs";

const EVIDENCE_CAP = 200;

/**
 * The outcome probe catalog. `interpret` mirrors the plan-schema probe interprets so an authored
 * playbook can point its goalProbe at one of these ids and get the same evaluation either way.
 */
export const OUTCOME_PROBES = Object.freeze({
  "print-queue-drains": Object.freeze({
    id: "print-queue-drains",
    command: "(Get-Printer | Get-PrintJob | Measure-Object).Count",
    interpret: "count-zero",
    description: "no print job is left stuck in the queue (the user's page can actually print)"
  }),
  "dns-resolves-known-host": Object.freeze({
    id: "dns-resolves-known-host",
    command: "(Resolve-DnsName example.com -ErrorAction SilentlyContinue | Measure-Object).Count",
    interpret: "count-positive",
    description: "a real name lookup succeeds end-to-end (not just that the DNS service is running)"
  }),
  "gateway-reachable": Object.freeze({
    id: "gateway-reachable",
    command: "(Test-NetConnection -InformationLevel Quiet)",
    interpret: "bool-true",
    description: "the machine can actually reach the network beyond the adapter"
  }),
  "audio-endpoint-active": Object.freeze({
    id: "audio-endpoint-active",
    command: "(Get-CimInstance Win32_SoundDevice | Measure-Object).Count",
    interpret: "count-positive",
    description: "at least one sound device is present and enumerable (not just that the service is running)"
  })
});

export const OUTCOME_PROBE_IDS = Object.freeze(Object.keys(OUTCOME_PROBES));

/** Get a probe spec by id as a plain (copied) object usable as a plan goalProbe. Null if unknown. */
export function getOutcomeProbe(id) {
  const p = OUTCOME_PROBES[String(id || "")];
  return p ? { command: p.command, interpret: p.interpret, description: p.description, outcomeProbeId: p.id } : null;
}

/**
 * Pure interpretation of probe stdout. Shared with the plan executor so one probe cannot be
 * evaluated two different ways. Unknown interpret → false (never an accidental pass).
 */
export function interpretOutcome(interpret, output) {
  const text = String(output == null ? "" : output).trim();
  if (!text) return false;
  if (interpret === "count-zero") { const m = text.match(/-?\d+/); return !!m && Number(m[0]) === 0; }
  if (interpret === "count-positive") { const m = text.match(/-?\d+/); return !!m && Number(m[0]) > 0; }
  if (interpret === "bool-true") return /^true$/i.test(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || "");
  if (interpret === "service-running") return (text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || "") === "Running";
  return false;
}

/**
 * Run one outcome probe.
 * @param {string} probeId
 * @param {{run?:Function, now?:Function}} opts
 * @returns {Promise<{probeId:string, pass:boolean|null, evidence:string, interpret:string, ts:number, reason:string, surfaced?:string}>}
 */
export async function runOutcomeProbe(probeId, opts = {}) {
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const id = String(probeId || "");
  const spec = OUTCOME_PROBES[id];
  const base = { probeId: redactPrivate(id), pass: null, evidence: "", interpret: "", ts: now(), reason: "" };
  if (!spec) return { ...base, reason: "unknown-probe" };

  // 🔒 R11 — check #1, before anything can spawn or be echoed back.
  if (isBlockedPath(id) || isBlockedPath(spec.command) || isBlockedPath(spec.description)) {
    return { ...base, interpret: spec.interpret, reason: "R11", surfaced: R11_SURFACE };
  }
  if (!validateTier0Command(spec.command)) return { ...base, interpret: spec.interpret, reason: "not-allowlisted" };

  const run = typeof opts.run === "function" ? opts.run : defaultRun;
  let res;
  try { res = await run(spec.command); } catch { res = null; }
  if (!res || res.exitCode !== 0) {
    // Could not observe the outcome → we do NOT know it is fixed. pass stays null, never true.
    return { ...base, interpret: spec.interpret, reason: "probe-unavailable" };
  }
  const evidence = redactPrivate(String(res.stdout || "")).trim().slice(0, EVIDENCE_CAP);
  if (!evidence) return { ...base, interpret: spec.interpret, reason: "probe-unavailable" };
  return { probeId: id, pass: interpretOutcome(spec.interpret, evidence), evidence, interpret: spec.interpret, ts: now(), reason: "" };
}
