// RUN 22 §6 — Reports tab: pure HTML builders for the report list + retention note. 🔒 R11-safe.
import { esc } from "./dashboard.mjs";

export function reportsRowsHtml(reports = []) {
  const rows = (reports || []).map((r) =>
    `<div class="health-row" data-report="${esc(r.id || r.filename || "")}"><span>${esc(r.period || r.quarter || "")}</span><strong>${esc(r.filename || "")}${r.size ? " · " + esc(r.size) : ""}</strong><em>${esc(r.status || "ready")}</em></div>`
  ).join("");
  return rows || `<div class="health-row"><span>—</span><strong>No reports generated yet.</strong><em></em></div>`;
}

export function retentionNote(nextCleanupAt) {
  return `Reports are kept permanently (compliance audit). Next data-retention cleanup: ${esc(nextCleanupAt || "02:00 local")}.`;
}

/**
 * Plain-text preview of what the customer email/report contains. PROD 2026-10-14 (audit R6 / R7):
 * REAL-OR-EMPTY — "issues detected / diagnoses run / fixes verified" are counted separately (never conflated into
 * "incidents resolved"), SLA says "not measured yet" when main sent measured:false, and the footer states only what
 * was actually verified (audit chain · privacy verifier · excluded folders) instead of asserting all three.
 */
export function previewText(data = {}) {
  const k = data.kpis || {};
  const s = data.sla || {};
  const pct = (v) => (v == null ? "--" : `${v}%`);
  const em = (v) => (v == null ? "--" : v);
  const slaLine = s.measured === false || s.composite == null ? "• SLA: not measured yet (no detections or downtime recorded)" : `• SLA compliance: ${pct(s.composite)} (floor ${pct(s.floor)})`;
  const ev = data.evidence || {};
  const audit = ev.audit || data.audit || {};
  const privacy = ev.privacy || data.privacy || {};
  const excluded = ev.excludedFolders || data.excludedFolders || data.r11 || {};
  const foot = [
    audit.ok === true ? "Audit integrity verified" : audit.ok === false ? "Audit integrity NEEDS REVIEW" : "Audit integrity: not verified yet",
    privacy.pass === true ? "privacy verifier PASS" : privacy.pass === false ? "privacy verifier REVIEW" : "privacy verifier not run yet",
    excluded.touched === true ? "excluded folders: ACCESS ATTEMPTED" : excluded.ok === true || excluded.attempts === 0 ? "excluded folders never touched" : "excluded folders: not verified yet"
  ].join(" · ") + ".";
  return [
    `ARIA Sentinel — ${data.quarter || "Q?"} report for ${data.company || "your organization"}`,
    "",
    `• Issues detected: ${em(k.incidents)} · Diagnoses run: ${em(k.diagnoses)} · Fixes verified: ${em(k.verifiedFixes)}${k.autoPct == null ? "" : ` (${k.autoPct}% automatic)`}`,
    `• Hours of human work avoided: ${em(k.hoursSaved)}`,
    slaLine,
    `• Diagnosis accuracy: ${pct(k.accuracy)}`,
    "",
    foot
  ].map(esc).join("\n");
}
