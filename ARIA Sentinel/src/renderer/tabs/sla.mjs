// RUN 22 §3 — SLA tab: pure HTML builders. 🔒 R11-safe (all strings escaped + redacted).
// PROD 2026-10-14 (audit R6) — REAL-OR-EMPTY: main sends `measured:false` + nulls until a detection or a downtime
// row has really been recorded; every builder here says "not measured yet" for that, never "100% MET".
import { esc, tileHtml } from "./dashboard.mjs";

export const SLA_NOT_MEASURED = "SLA not measured yet";

export function uptimeTilesHtml(u = {}) {
  return [["24h", u.h24], ["7d", u.d7], ["30d", u.d30], ["90d", u.d90]]
    .map(([label, v]) => tileHtml({ id: `up-${label}`, label: `Uptime ${label}`, value: v, unit: "%" })).join("");
}

export function severityRowsHtml(metByLevel = {}, threshold = {}) {
  return ["P1", "P2", "P3", "P4"].map((sev) =>
    `<div class="health-row"><span>${esc(sev)}</span><strong>${metByLevel[sev] == null ? "--" : esc(metByLevel[sev]) + "% met"}</strong><em>${threshold[sev] != null ? esc("target " + threshold[sev]) : ""}</em></div>`
  ).join("");
}

export function breachRowsHtml(breaches = [], credits = {}) {
  const byReason = {};
  for (const b of breaches || []) byReason[b.reason] = (byReason[b.reason] || 0) + 1;
  const rows = Object.entries(byReason).map(([reason, n]) =>
    `<div class="health-row"><span>${esc(reason)}</span><strong>${esc(n)}</strong><em></em></div>`).join("");
  // Credits are a figure only once something was measured; otherwise the row says so instead of "$0 (0%)".
  const measured = credits && credits.owed != null;
  const creditLine = `<div class="health-row"><span>credits owed</span><strong>${measured ? `$${esc(credits.owed)} (${esc(credits.pctOwed ?? 0)}%)` : "--"}</strong><em>${measured ? (credits.autoIssue ? "" : "admin sign-off required") : "not measured yet"}</em></div>`;
  return (rows || `<div class="health-row"><span>none</span><strong>${measured ? "0 breaches" : "no breaches recorded yet"}</strong><em></em></div>`) + creditLine;
}

/** True when the SLA payload carries no measurement (main's measured:false, or a null composite). */
export function slaUnmeasured(sla = {}, payload = null) {
  if (payload && payload.measured === false) return true;
  if (sla && sla.measured === false) return true;
  return sla == null || sla.composite == null;
}

/** The headline: "N% SLA-met this month" or the honest empty state. */
export function compositeHeadline(sla = {}, payload = null) {
  if (slaUnmeasured(sla, payload)) return SLA_NOT_MEASURED;
  return `${esc(sla.composite)}% SLA-met this month`;
}

export function complianceLine(sla = {}, payload = null) {
  if (slaUnmeasured(sla, payload)) return "No detections or downtime have been recorded on this device yet, so there is nothing to score. The window starts with the first real event.";
  return `${esc(sla.composite)}% SLA-met for current month (floor ${esc(sla.floor ?? 0)}%, ${sla.met ? "MET" : "BELOW FLOOR"})`;
}
