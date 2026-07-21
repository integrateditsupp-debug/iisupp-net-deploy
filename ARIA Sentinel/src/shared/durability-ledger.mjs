// STAGE 3 S2 · Sentinel brain-audit F1 — DURABILITY LEDGER (the headline "issue doesn't return" gap).
// Today a fix is declared done when a post-probe passes; nothing records the issue *signature*, watches
// for its *return*, or escalates on recurrence — so the same symptom re-fires forever and the user sees
// the problem "come back easily." This module closes that loop, purely:
//   1. Every real resolution is hashed to an issue signature → { signature, fixApplied, resolvedAt, rung }.
//   2. On recurrence within a window (default 72h) we ESCALATE ONE RUNG up the fix ladder
//      (symptom recipe → deeper recipe → root-cause investigation → human escalation) instead of
//      re-applying the same fix that already failed to hold.
//   3. An issue is marked "durably resolved" ONLY after it stays gone through a quiet monitoring window
//      (default 24h). The deflection metric counts DURABLE resolutions, never first-pass patches.
//
// Rule 14 (real-or-empty): a no-op-neutral / already-healthy pass is NEVER recorded as a resolution;
// an empty ledger yields honest nulls, never a fabricated deflection %. 🔒 R11: the issue signature is
// derived from the plan id AFTER path-guard redaction, and a blocked id is never recorded — nothing
// off-limits can enter the ledger. Pure + node-safe (node:crypto only); fs persistence stays in main.
import crypto from "node:crypto";
import { isBlockedPath, redactPrivate } from "./path-guard.mjs";

export const LEDGER_VERSION = "durability-ledger-v1";
// Windows: a fix that "holds" ≥ 72h is a real fix; a return inside 72h means the symptom patch didn't stick.
export const RECURRENCE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h
// The issue must stay gone this long before we honestly call it durably resolved.
export const QUIET_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
// The escalation ladder — recurrence climbs it one rung at a time, never repeating the failed rung.
export const FIX_LADDER = Object.freeze([
  "symptom-recipe",           // rung 0 — the fast Tier-0 recipe (e.g. restart spooler)
  "deeper-recipe",            // rung 1 — a broader remediation plan
  "root-cause-investigation", // rung 2 — stop patching, diagnose the shared cause
  "human-escalation"          // rung 3 — content-blind packet to an IIS human (terminal rung)
]);
export const TOP_RUNG = FIX_LADDER.length - 1;

export function emptyLedger() { return { v: LEDGER_VERSION, issues: {} }; }

/** Stable, content-blind issue signature from a plan id (R11-redacted first). Blocked → null (never recorded). */
export function issueSignature(planId) {
  const id = String(planId || "");
  if (!id || isBlockedPath(id)) return null; // 🔒 R11 — off-limits ids never earn a signature.
  const safe = redactPrivate(id);
  return crypto.createHash("sha256").update("aria-issue|" + safe).digest("hex").slice(0, 32);
}

function ensureIssue(base, sig, planId) {
  if (!base.issues[sig]) {
    base.issues[sig] = { signature: sig, planId: redactPrivate(String(planId || "")), resolutions: [], escalations: [], recurrences: [], rung: 0 };
  }
  return base.issues[sig];
}
function clone(ledger) {
  const src = ledger && ledger.issues ? ledger : emptyLedger();
  const out = { v: LEDGER_VERSION, issues: {} };
  for (const [k, v] of Object.entries(src.issues)) {
    out.issues[k] = { ...v, resolutions: [...v.resolutions], escalations: [...v.escalations], recurrences: [...v.recurrences] };
  }
  return out;
}

/**
 * Record a REAL resolution (PLAN.RESOLVED with noChange !== true). No-op-neutral / already-healthy is
 * dropped on the floor — it is never a fix (Rule 14). Blocked ids are dropped (R11). Returns a NEW ledger.
 */
export function recordResolution(ledger, { planId, fixApplied = "", noChange = false } = {}, now = Date.now()) {
  const sig = issueSignature(planId);
  if (!sig || noChange === true) return clone(ledger); // real-or-empty: nothing fabricated, nothing off-limits.
  const base = clone(ledger);
  const issue = ensureIssue(base, sig, planId);
  issue.resolutions.push({ ts: Number(now) || 0, fixApplied: redactPrivate(String(fixApplied || "")), rung: issue.rung });
  return base;
}

/** Record an honest escalation outcome for an issue (PLAN.ESCALATED). Returns a NEW ledger. */
export function recordEscalation(ledger, { planId, code = "" } = {}, now = Date.now()) {
  const sig = issueSignature(planId);
  if (!sig) return clone(ledger);
  const base = clone(ledger);
  const issue = ensureIssue(base, sig, planId);
  issue.escalations.push({ ts: Number(now) || 0, code: redactPrivate(String(code || "")), rung: issue.rung });
  return base;
}

const lastResolution = (issue) => (issue && issue.resolutions.length ? issue.resolutions[issue.resolutions.length - 1] : null);

/**
 * Observe the SAME issue happening again. If a prior resolution is within the recurrence window, the last
 * fix did not hold → climb ONE rung up the ladder (capped at human-escalation) and log the recurrence, so
 * the executor stops repeating the failed fix. Returns { ledger, recurredWithinWindow, rung, ladder }.
 */
export function observeRecurrence(ledger, planId, now = Date.now(), opts = {}) {
  const window = Number(opts.recurrenceWindowMs) || RECURRENCE_WINDOW_MS;
  const sig = issueSignature(planId);
  if (!sig) return { ledger: clone(ledger), recurredWithinWindow: false, rung: 0, ladder: FIX_LADDER[0] };
  const base = clone(ledger);
  const issue = ensureIssue(base, sig, planId);
  const last = lastResolution(issue);
  const within = !!last && (Number(now) - Number(last.ts)) <= window && (Number(now) - Number(last.ts)) >= 0;
  if (within) {
    issue.recurrences.push({ ts: Number(now) || 0, fromRung: issue.rung });
    issue.rung = Math.min(TOP_RUNG, issue.rung + 1); // escalate one rung — never repeat the rung that failed.
  }
  return { ledger: base, recurredWithinWindow: within, rung: issue.rung, ladder: FIX_LADDER[issue.rung] };
}

/**
 * The durability decision the executor consults BEFORE (re)applying a fix. Pure read.
 * Returns { action, rung, ladder, reason }:
 *   - "apply"            — fresh issue (or last fix held past the window): apply the current rung's fix.
 *   - "escalate-rung"    — recurred inside the window: apply the NEXT rung, not the one that just failed.
 *   - "human-escalation" — already at the top rung and still recurring: hand to a human.
 */
export function nextFixAction(ledger, planId, now = Date.now(), opts = {}) {
  const window = Number(opts.recurrenceWindowMs) || RECURRENCE_WINDOW_MS;
  const sig = issueSignature(planId);
  const issue = sig && ledger && ledger.issues ? ledger.issues[sig] : null;
  if (!issue) return { action: "apply", rung: 0, ladder: FIX_LADDER[0], reason: "first occurrence" };
  const last = lastResolution(issue);
  const within = !!last && (Number(now) - Number(last.ts)) <= window && (Number(now) - Number(last.ts)) >= 0;
  if (!within) return { action: "apply", rung: issue.rung, ladder: FIX_LADDER[issue.rung], reason: last ? "last fix held past the recurrence window" : "no prior resolution" };
  if (issue.rung >= TOP_RUNG) return { action: "human-escalation", rung: TOP_RUNG, ladder: FIX_LADDER[TOP_RUNG], reason: "recurred at the top of the fix ladder" };
  return { action: "escalate-rung", rung: issue.rung + 1, ladder: FIX_LADDER[issue.rung + 1], reason: `recurred within ${Math.round(window / 3600000)}h — the previous fix did not hold` };
}

/**
 * Durably resolved = a real resolution that has stayed quiet through the monitoring window with NO
 * recurrence since. Real-or-empty: no data → false, never an optimistic guess.
 */
export function isDurablyResolved(ledger, planId, now = Date.now(), opts = {}) {
  const quiet = Number(opts.quietWindowMs) || QUIET_WINDOW_MS;
  const sig = issueSignature(planId);
  const issue = sig && ledger && ledger.issues ? ledger.issues[sig] : null;
  const last = lastResolution(issue);
  if (!issue || !last) return false;
  if ((Number(now) - Number(last.ts)) < quiet) return false;            // still inside the quiet window
  const recurredSince = issue.recurrences.some((r) => Number(r.ts) >= Number(last.ts)); // returned after the fix
  return !recurredSince;
}

/**
 * Deflection metric — computed ONLY from the ledger (never fabricated). Counts DURABLE resolutions, not
 * first-pass patches. When there are no attempts, deflection is null so the surface can honestly show "--".
 */
export function durabilityMetrics(ledger, now = Date.now(), opts = {}) {
  const issues = ledger && ledger.issues ? Object.values(ledger.issues) : [];
  let attempts = 0, resolutions = 0, durable = 0, recurred = 0;
  for (const issue of issues) {
    if (!issue.resolutions.length && !issue.escalations.length) continue;
    attempts += 1;
    if (issue.resolutions.length) resolutions += 1;
    if (issue.recurrences.length) recurred += 1;
    if (isDurablyResolved(ledger, issue.planId, now, opts)) durable += 1;
  }
  return {
    attempts, resolutions, durableResolutions: durable, recurred,
    deflection: attempts > 0 ? durable / attempts : null // null → honest "--", never a fake number.
  };
}

/**
 * Fold a completed plan-run journal into the ledger (the real integration point). Pure: it reads the
 * hash-chained journal's terminal event and records the honest outcome. Recurrence is observed separately
 * (when the detector re-fires), so a single run is never double-counted as its own recurrence.
 */
export function ingestJournal(ledger, entries, now = Date.now()) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return clone(ledger);
  const planId = list[0].planId || "";
  const last = list[list.length - 1];
  if (!last) return clone(ledger);
  if (last.event === "PLAN.RESOLVED") {
    const noChange = !!(last.extra && last.extra.noChange);
    return recordResolution(ledger, { planId, fixApplied: last.detail || "", noChange }, last.ts ? Date.parse(last.ts) || now : now);
  }
  if (last.event === "PLAN.ESCALATED") {
    return recordEscalation(ledger, { planId, code: (last.extra && last.extra.code) || "" }, last.ts ? Date.parse(last.ts) || now : now);
  }
  return clone(ledger); // aborted / non-terminal → nothing durable to record.
}
