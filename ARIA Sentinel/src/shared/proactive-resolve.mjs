// MODULE 4 — proactive silent resolution of SAFE local issues + a periodic "what I handled" summary.
//
// ARIA already detects local issues (clock drift, small temp bloat, stale DNS cache, etc.). For
// SAFE/low-risk issues only, and ONLY within the Confirmed/Autonomous gates, it resolves them WITHOUT
// interrupting the user, logs a ServiceNow ticket per issue (M1), and on a cadence emails the USER a
// summary: "ARIA resolved X and prevented Y so you weren't bothered."
//
// HARD SAFETY (structural, RULE 14):
//   • "Safe" == recipe risk "green" AND not flagged destructive. Anything yellow/orange/red, or any
//     destructive action, is NEVER silently auto-run — it is returned for the normal (prompted) path.
//   • In Manual mode NOTHING runs silently (every fix needs the user's confirmation).
//   • The summary lists ONLY what actually ran + verified — never a fabricated "fixed" item, never a
//     fake ticket number. Failed attempts are reported honestly, not counted as resolved.
// PURE + dependency-injected: the decision + summary logic here is unit-tested without Electron; main
// wires the real detector → executor → ServiceNow logging → email cadence.

import { assertContentSafePayload } from "./safety.mjs";

export const RISK_ORDER = { green: 0, yellow: 1, orange: 2, red: 3 };
export const SILENT_MODES = ["confirmed", "autonomous"];
export const RESOLUTION_OUTCOMES = ["resolved", "prevented", "failed"];

/** A risk is silent-eligible only at the very bottom of the ladder. */
export function isSafeRisk(risk) {
  return String(risk || "").toLowerCase() === "green";
}

/**
 * May this issue be resolved SILENTLY (no user prompt) right now?
 * Safe risk + non-destructive + a silent-capable mode. Returns { ok, reason }.
 */
export function canResolveSilently(issue = {}, mode = "manual") {
  if (!SILENT_MODES.includes(String(mode))) return { ok: false, reason: "manual-mode-needs-confirmation" };
  if (issue.destructive === true) return { ok: false, reason: "destructive-never-silent" };
  if (!isSafeRisk(issue.risk)) return { ok: false, reason: `risk-${String(issue.risk || "unknown")}-needs-confirmation` };
  return { ok: true, reason: "safe" };
}

/** Split detected issues into the silent-eligible set and the must-prompt set (with reasons). */
export function selectSilentlyResolvable(issues = [], mode = "manual") {
  const eligible = [];
  const skipped = [];
  for (const issue of Array.isArray(issues) ? issues : []) {
    const verdict = canResolveSilently(issue, mode);
    if (verdict.ok) eligible.push(issue);
    else skipped.push({ id: symbolic(issue.id), risk: issue.risk || "unknown", reason: verdict.reason });
  }
  return { eligible, skipped };
}

/**
 * Run the proactive sweep. Executes only the silent-eligible issues via the injected executor, logs a
 * ServiceNow ticket per successful resolution (M1), and collects honest records. NEVER touches the
 * must-prompt issues — they are handed back for the normal gated/prompted flow.
 * @param deps {
 *   mode,
 *   execute: async (issue) => ({ ok, outcome }),  // outcome ∈ 'resolved'|'prevented' (the real result)
 *   logTicket: async (issue, record) => ({ number }),  // optional — ServiceNow M1 ticket per issue
 *   logger
 * }
 */
export async function runProactiveSweep(issues = [], deps = {}) {
  const mode = deps.mode || "manual";
  const log = typeof deps.logger === "function" ? deps.logger : () => {};
  const audit = (type, message, data = {}) => { try { log({ type, message, ts: new Date().toISOString(), ...data }); } catch { /* never throw */ } };
  const { eligible, skipped } = selectSilentlyResolvable(issues, mode);
  const records = [];

  for (const issue of eligible) {
    let result = { ok: false };
    try { result = typeof deps.execute === "function" ? await deps.execute(issue) : { ok: false }; }
    catch { result = { ok: false }; }
    if (!result || !result.ok) {
      records.push({ id: symbolic(issue.id), label: symbolic(issue.label || issue.id), risk: "green", outcome: "failed", ticketNumber: null });
      audit("PROACTIVE.FAIL", `${symbolic(issue.id)}: silent fix failed`);
      continue;
    }
    const outcome = RESOLUTION_OUTCOMES.includes(result.outcome) ? result.outcome : "resolved";
    let ticketNumber = null;
    if (typeof deps.logTicket === "function") {
      try { const t = await deps.logTicket(issue, { outcome }); ticketNumber = (t && t.number) || null; }
      catch { ticketNumber = null; }
    }
    records.push({ id: symbolic(issue.id), label: symbolic(issue.label || issue.id), risk: "green", outcome, ticketNumber });
    audit("PROACTIVE.OK", `${symbolic(issue.id)}: ${outcome}${ticketNumber ? " · " + ticketNumber : ""}`);
  }
  return { records, skipped };
}

/**
 * Build the content-safe USER summary email payload. Counts ONLY what actually ran:
 *   resolved = fixed in the background · prevented = caught before it caused disruption.
 * Failed attempts are listed truthfully under `needsAttention`, never counted as fixed.
 */
export function buildUserSummary(records = [], profile = {}, opts = {}) {
  const rs = Array.isArray(records) ? records : [];
  const resolved = rs.filter((r) => r.outcome === "resolved");
  const prevented = rs.filter((r) => r.outcome === "prevented");
  const failed = rs.filter((r) => r.outcome === "failed");
  const items = (list) => list.map((r) => ({ item: symbolic(r.label || r.id), ticket: r.ticketNumber || null }));
  const total = resolved.length + prevented.length;
  const headline = total > 0
    ? `ARIA resolved ${resolved.length} and prevented ${prevented.length} issue${total === 1 ? "" : "s"} in the background — so you weren't bothered.`
    : "ARIA ran a background health pass — nothing needed fixing this period.";
  const summary = {
    kind: "proactive-summary",
    period: String(opts.period || "this period").slice(0, 40),
    headline,
    counts: { resolved: resolved.length, prevented: prevented.length, needsAttention: failed.length },
    resolved: items(resolved),
    prevented: items(prevented),
    needsAttention: items(failed),
    user: {
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      company: profile.company || "",
      email: profile.email || ""
    }
  };
  return summary;
}

/**
 * Hard gate: the summary CONTENT (headline, item labels, ticket numbers) must be content-blind. The
 * `user` block is the recipient's OWN contact — the delivery address — so it is exempt from the
 * content-safety scan, exactly as the end-of-session report treats the user's own email/phone.
 */
export function summaryIsContentSafe(summary) {
  const { user, ...content } = summary || {};
  return assertContentSafePayload(content);
}

// Symbolic token — drops paths/emails/free text so only a safe label survives into the summary/ticket.
function symbolic(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']+/g, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/[^A-Za-z0-9 ._:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || "issue";
}
