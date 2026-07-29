// STAGE 3 S2 (brain-audit F1) — THE DURABILITY LEDGER. The headline gap Ahmad named: today a fix is
// "done" when a post-probe passes, and nothing watches whether the SAME issue comes back. So the same
// symptom fix re-fires forever and the user experiences a problem that "returns easily".
//
// The ledger fixes that with three honest rules:
//   1. Every resolution is recorded under a CONTENT-BLIND signature (sanitizeToSignature → sha256).
//   2. A recurrence of that signature inside RECURRENCE_WINDOW_MS escalates EXACTLY ONE RUNG up the
//      fix ladder (symptom-recipe → deeper-recipe → root-cause → human). We never repeat a fix that
//      already failed to hold.
//   3. A resolution is "durable" ONLY after it stays gone through a quiet monitoring window. The
//      deflection metric counts DURABLE resolutions — not first-pass patches. That is what makes the
//      deflection % we show a customer defensible (Rule 14).
//
// Store shape = an append-only list of records (persisted as JSONL alongside the plan journal by main).
// Pure + node-safe: clock injected, no fs, no crypto beyond node:crypto hashing. 🔒 R11: a signature is
// derived from a sanitized signal, and any off-limits reference is refused before it can be recorded.
import crypto from "node:crypto";
import { isBlockedPath, redactPrivate } from "../shared/path-guard.mjs";
import { sanitizeToSignature } from "../shared/safety.mjs";

export const RECURRENCE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h — a return inside this is the SAME problem
export const DURABLE_QUIET_MS = 24 * 60 * 60 * 1000;     // 24h quiet before we dare call it durable
export const FIX_LADDER = Object.freeze(["symptom-recipe", "deeper-recipe", "root-cause", "human"]);

export function emptyLedger() { return { records: [] }; }

/**
 * Content-blind issue signature. The raw issue text NEVER lands in the ledger — only the sanitized
 * symbolic code and a hash of it. Feed it PII and you get a hash back, by construction.
 */
export function issueSignature(issue) {
  const sig = sanitizeToSignature(issue);
  const stable = `${sig.code}|${sig.family}|${sig.source || ""}|${sig.os_version || ""}`;
  return {
    signature: crypto.createHash("sha256").update(stable).digest("hex"),
    code: sig.code,
    family: sig.family
  };
}

const recordsOf = (ledger) => (ledger && Array.isArray(ledger.records) ? ledger.records : []);
const forSignature = (ledger, signature) => recordsOf(ledger).filter((r) => r && r.signature === signature);

/** Record a resolution attempt that PASSED its goalProbe. Returns a NEW ledger (append-only). */
export function recordResolution(ledger, { signature, fixApplied, resolvedAt, rung, planRunId } = {}) {
  const sig = String(signature || "");
  // 🔒 R11 — nothing off-limits is ever written to the ledger.
  if (!sig || isBlockedPath(sig) || isBlockedPath(String(fixApplied || "")) || isBlockedPath(String(planRunId || ""))) return { records: [...recordsOf(ledger)] };
  const rec = {
    signature: sig,
    fixApplied: redactPrivate(String(fixApplied || "")),
    planRunId: redactPrivate(String(planRunId || "")),
    resolvedAt: Number(resolvedAt) || 0,
    rung: FIX_LADDER.includes(rung) ? rung : FIX_LADDER[0],
    durable: false,
    durableAt: null,
    recurrences: forSignature(ledger, sig).length ? (lastRecord(ledger, sig).recurrences || 0) : 0
  };
  return { records: [...recordsOf(ledger), rec] };
}

/** The most recent record for a signature, or null. */
export function lastRecord(ledger, signature) {
  const list = forSignature(ledger, String(signature || ""));
  return list.length ? list.reduce((a, b) => ((b.resolvedAt || 0) >= (a.resolvedAt || 0) ? b : a)) : null;
}

/** The rung one step above the given rung (never past "human"). */
export function nextRung(rung) {
  const i = FIX_LADDER.indexOf(rung);
  if (i < 0) return FIX_LADDER[1];
  return FIX_LADDER[Math.min(i + 1, FIX_LADDER.length - 1)];
}

/**
 * The recurrence decision. Called BEFORE we choose a fix for an incoming issue.
 * @returns {{recurred:boolean, withinH:number|null, rung:string, escalateToHuman:boolean, reason:string}}
 *   recurred=false → fresh issue, start at the bottom rung (symptom-recipe)
 *   recurred=true  → the same signature came back inside 72h: climb exactly one rung, never repeat
 */
export function onRecurrence(ledger, signature, now = Date.now()) {
  const sig = String(signature || "");
  const last = lastRecord(ledger, sig);
  if (!last) return { recurred: false, withinH: null, rung: FIX_LADDER[0], escalateToHuman: false, reason: "first-sighting" };
  const deltaMs = Number(now) - Number(last.resolvedAt || 0);
  const withinH = Math.round((deltaMs / 3600000) * 10) / 10;
  if (deltaMs < 0 || deltaMs >= RECURRENCE_WINDOW_MS) {
    return { recurred: false, withinH, rung: FIX_LADDER[0], escalateToHuman: false, reason: "outside-72h-window" };
  }
  const rung = nextRung(last.rung || FIX_LADDER[0]);
  return {
    recurred: true,
    withinH,
    rung,
    escalateToHuman: rung === "human",
    reason: `same issue returned ${withinH}h after the last fix — climbing to "${rung}" instead of repeating it`
  };
}

/**
 * Promote a resolution to DURABLE — only if it has stayed quiet for DURABLE_QUIET_MS and no later
 * record for that signature exists. Returns a NEW ledger; a not-yet-quiet call is a no-op.
 */
export function markDurable(ledger, signature, now = Date.now()) {
  const sig = String(signature || "");
  const last = lastRecord(ledger, sig);
  if (!last || last.durable) return { records: [...recordsOf(ledger)] };
  if ((Number(now) - Number(last.resolvedAt || 0)) < DURABLE_QUIET_MS) return { records: [...recordsOf(ledger)] };
  return {
    records: recordsOf(ledger).map((r) => (r === last ? { ...r, durable: true, durableAt: Number(now) } : r))
  };
}

/** True when the signature's newest record has been quiet long enough to be called durable. */
export function isDurable(ledger, signature, now = Date.now()) {
  const last = lastRecord(ledger, String(signature || ""));
  if (!last) return false;
  return last.durable === true || (Number(now) - Number(last.resolvedAt || 0)) >= DURABLE_QUIET_MS;
}

/**
 * Deflection stats — the number that feeds B1 / the Trust Center. It counts DURABLE resolutions only.
 * `attempts` must come from the plan journal (goalProbe-declared attempts), never from a guess.
 * With 0 attempts the rate is null, not 0 and not 100 — real-or-empty.
 */
export function deflectionStats(ledger, { attempts = 0, now = Date.now() } = {}) {
  const records = recordsOf(ledger);
  const signatures = [...new Set(records.map((r) => r.signature))];
  const durable = signatures.filter((s) => isDurable(ledger, s, now)).length;
  const recurred = records.filter((r) => (r.recurrences || 0) > 0).length;
  const n = Number(attempts) || 0;
  return {
    attempts: n,
    resolutionsRecorded: records.length,
    durableResolutions: durable,
    recurrences: recurred,
    deflectionRate: n > 0 ? Math.round((durable / n) * 1000) / 10 : null,
    basis: "durable resolutions / goalProbe-declared attempts (journal-derived)"
  };
}
