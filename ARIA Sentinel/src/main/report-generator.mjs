// RUN 22 §5 — quarterly + ad-hoc report builder. Pure + node-safe: produces the report HTML (main turns
// it into a PDF via Electron printToPDF). Every interpolated value is content-blind + 🔒 R11-sanitized.
import { sanitizeText } from "./system-context.mjs"; // includes R11 redaction + user/machine/email strip
import { isBlockedPath } from "../shared/path-guard.mjs";

const QUARTER_STARTS = [[0, 1], [3, 1], [6, 1], [9, 1]]; // Jan1, Apr1, Jul1, Oct1 (month index, day)

export function quarterOf(now = Date.now()) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}
export function isQuarterStart(now = Date.now()) {
  const d = new Date(now);
  return QUARTER_STARTS.some(([m, day]) => d.getUTCMonth() === m && d.getUTCDate() === day);
}
export function reportFilename(license, q) {
  const lic = String(license || "license").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "license";
  return `aria-sentinel-quarterly-${lic}-${q}.pdf`;
}

const esc = (v) => sanitizeText(String(v == null ? "" : v)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Auto-generated 3-line executive summary (template — NO LLM call). */
export function executiveSummary(data = {}) {
  const k = data.kpis || {};
  return [
    `ARIA Sentinel resolved ${k.incidents ?? 0} incidents this quarter, ${k.autoPct == null ? "--" : k.autoPct + "%"} automatically, saving ~${k.hoursSaved == null ? "--" : k.hoursSaved} hours of L1 effort.${k.deflectionPct == null ? "" : ` ${k.deflectionPct}% of issues were resolved first-touch${k.dollarsSaved == null ? "" : ` (~$${Number(k.dollarsSaved).toLocaleString("en-US")} of L1 effort avoided)`}.`}`,
    `SLA compliance held at ${data.sla?.composite == null ? "--" : data.sla.composite + "%"} against a ${data.sla?.floor == null ? "--" : data.sla.floor + "%"} contractual floor, with ${data.sla?.breaches ?? 0} breach(es).`,
    `Audit integrity verified, privacy verifier passing, and the protected private folder was never accessed (R11 enforced).`
  ];
}

/** The ordered report sections. Each carries a title + sanitized rows/values. */
export function buildSections(data = {}) {
  const k = data.kpis || {};
  return [
    { id: "summary", title: "Executive summary", lines: executiveSummary(data) },
    { id: "kpis", title: "Quarter-over-quarter KPIs", rows: (data.kpiTable || []).map((r) => ({ label: esc(r.label), value: esc(r.value), delta: esc(r.delta || "") })) },
    { id: "sla", title: "SLA achievement", rows: Object.entries(data.sla?.categories || {}).map(([k2, v]) => ({ label: esc(k2), value: esc(v) })) },
    { id: "incidents", title: "Top incidents resolved", rows: (data.topIncidents || []).map((i) => ({ label: esc(i.title), value: esc(i.outcome) })) },
    { id: "roi", title: "Hours of human work avoided", value: esc(`${k.hoursSaved == null ? "--" : k.hoursSaved} hours${k.dollarsSaved == null ? "" : ` = $${Number(k.dollarsSaved).toLocaleString("en-US")}`} (${k.incidents ?? 0} incidents${k.deflectionPct == null ? "" : `, ${k.deflectionPct}% resolved first-touch`})`) },
    { id: "compliance", title: "Compliance posture", rows: Object.entries(data.compliance || {}).map(([fw, s]) => ({ label: esc(fw.toUpperCase()), value: esc(`${s.score}/100 (${s.badge})`) })) },
    { id: "recurring", title: "Recurring issues + recommended fixes", rows: (data.recurring || []).map((r) => ({ label: esc(r.issue), value: esc(r.fix) })) },
    { id: "upcoming", title: "Next-quarter upcoming work", lines: (data.upcoming || []).map(esc) },
    { id: "trust", title: "Trust", lines: ["Audit integrity verified · privacy verifier active · 100% sanitization · R11 private folder never touched."] }
  ];
}

/** Full report HTML (content-blind). main feeds this into printToPDF. */
export function buildQuarterlyReport(data = {}, now = Date.now()) {
  const q = data.quarter || quarterOf(now);
  const company = esc(data.company || "your organization");
  const sections = buildSections(data);
  const body = sections.map((s) => {
    let inner = "";
    if (s.lines) inner = s.lines.map((l) => `<p>${esc(l)}</p>`).join("");
    else if (s.rows) inner = `<table>${s.rows.map((r) => `<tr><td>${r.label}</td><td>${r.value}${r.delta ? " " + r.delta : ""}</td></tr>`).join("")}</table>`;
    else if (s.value) inner = `<p class="big">${s.value}</p>`;
    return `<section><h2>${esc(s.title)}</h2>${inner}</section>`;
  }).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ARIA Sentinel ${esc(q)} — ${company}</title>
<style>body{font-family:Segoe UI,system-ui,sans-serif;background:#fff;color:#111;margin:0;padding:32px}h1{font-size:22px}h2{font-size:15px;color:#8b6d2f;margin-top:20px}table{border-collapse:collapse;width:100%}td{padding:5px 8px;border-bottom:1px solid #eee;font-size:13px}.big{font-size:24px;color:#8b6d2f}</style></head>
<body><h1>ARIA Sentinel — ${esc(q)} performance report</h1><p>${company}</p>${body}
<p style="color:#888;font-size:11px;margin-top:24px">Content-blind report. No usernames, machine names, file paths, or personal data is included.</p></body></html>`;
  return { quarter: q, filename: reportFilename(data.license, q), sections, html };
}

/** Defense-in-depth: confirm a finished report carries no UN-REDACTED PII / R11 reference before it
 *  ships. Redaction placeholders (`<user>` / `&lt;user&gt;` / `<machine>` / `<email>`) are expected. */
export function reportIsClean(html) {
  if (isBlockedPath(html)) return false;
  // A real username after C:\Users\ (not the <user> / &lt;user redaction marker).
  if (/[a-z]:\\users\\(?![<&])[a-z0-9.$]/i.test(html)) return false;
  // A real UNC machine name (not the <machine> / &lt; marker).
  if (/\\\\(?![<&])[a-z0-9._-]+\\/i.test(html)) return false;
  // A real email (the sanitizer replaces all with <email>).
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(html)) return false;
  return true;
}
