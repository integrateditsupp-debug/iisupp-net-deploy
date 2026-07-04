// RUN 22 §4 — Compliance tab: pure HTML builders for the 5 framework composites + R11 enforcement.
import { esc } from "./dashboard.mjs";

function row(label, value, em = "") { return `<div class="health-row"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(em)}</em></div>`; }

export function auditRowsHtml(a = {}) {
  return row("hash chain", a.ok ? "verified" : "BROKEN", a.lastVerified || "") + row("entries (30d)", a.entries ?? 0, "");
}
export function privacyRowsHtml(p = {}) {
  // B3: sanitization ?? 100 was seeded (Rule 14). Now real-or-empty: show "--" until first measured value.
  const sanStr = p.sanitization != null ? `${p.sanitization}%` : "--";
  return row("last result", p.pass ? "PASS" : "REVIEW", p.ts || "") + row("6-host allowlist", p.allowlistOk ? "intact" : "WIDENED") + row("sanitization rate", sanStr, "must be 100%");
}
export function tier0RowsHtml(t = {}) {
  return row("risky actions blocked (30d)", t.blocked ?? 0, "") + row("categories", (t.categories || []).join(", ") || "none");
}
/** R11 — the counter must always read 0 attempted accesses. */
export function r11RowsHtml(r = {}) {
  return row("private folder", r.touched ? "ACCESS ATTEMPTED" : "never touched", r.folder || "Private pics and Vids")
    + row("attempted accesses", r.attempts ?? 0, r.ok ? "✓ always 0" : "⚠ must be 0")
    + row("last verified", r.lastVerified || "—", "");
}

export function frameworkTilesHtml(scores = {}) {
  return Object.entries(scores).map(([fw, s]) =>
    `<div class="kpi-tile" data-fw="${esc(fw)}"><div class="kpi-value">${esc(s.score ?? 0)}<span style="font-size:13px">/100</span></div><div class="kpi-label">${esc(fw.toUpperCase())} <span class="framework-badge ${esc(s.badge || "gap")}">${esc(s.badge || "gap")}</span></div><div class="kpi-foot"><span>${esc(s.met ?? 0)}/${esc(s.total ?? 0)} controls</span></div></div>`
  ).join("");
}
