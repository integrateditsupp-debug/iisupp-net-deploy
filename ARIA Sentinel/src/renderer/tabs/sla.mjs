// RUN 22 §3 — SLA tab: pure HTML builders. 🔒 R11-safe (all strings escaped + redacted).
import { esc, tileHtml } from "./dashboard.mjs";

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
  const creditLine = `<div class="health-row"><span>credits owed</span><strong>$${esc(credits.owed ?? 0)} (${esc(credits.pctOwed ?? 0)}%)</strong><em>${credits.autoIssue ? "" : "admin sign-off required"}</em></div>`;
  return (rows || `<div class="health-row"><span>none</span><strong>0 breaches</strong><em></em></div>`) + creditLine;
}

export function complianceLine(sla = {}) {
  return `${esc(sla.composite ?? 0)}% SLA-met for current month (floor ${esc(sla.floor ?? 0)}%, ${sla.met ? "MET" : "BELOW FLOOR"})`;
}
