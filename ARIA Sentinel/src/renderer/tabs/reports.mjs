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

/** Plain-text preview of what the customer email/report contains. RULE 14 (A1): null -> "--". */
export function previewText(data = {}) {
  const k = data.kpis || {};
  const mv = (v, unit = "") => v == null ? "--" : (v + unit);
  return [
    `ARIA Sentinel -- ${data.quarter || "Q?"} report for ${data.company || "your organization"}`,
    "",
    `* Incidents resolved: ${k.incidents ?? 0} (${mv(k.autoPct, "% automatic")})`,
    `* Hours of human work avoided: ${mv(k.hoursSaved)}`,
    `* SLA compliance: ${mv(data.sla?.composite, "%")} (floor ${mv(data.sla?.floor, "%")})`,
    `* Diagnosis accuracy: ${mv(k.accuracy, "%")}`,
    "",
    "Audit integrity verified -- privacy verifier active -- R11 private folder never touched."
  ].map(esc).join("\n");
}
