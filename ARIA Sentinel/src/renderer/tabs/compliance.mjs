// RUN 22 §4 — Compliance tab: pure HTML builders for the 5 framework composites + the excluded-folder rule.
// PROD 2026-10-14 (audit R6 / R7) — REAL-OR-EMPTY: a verifier that never ran says "not run yet" (never "REVIEW"
// or "100%"); the excluded-folder rows show a COUNT from the customer's own settings, never a folder name.
import { esc } from "./dashboard.mjs";
import { buildTrustSummary } from "../../shared/trust-posture.mjs"; // RUN-B B3 — honest trust/security surface

function row(label, value, em = "", cls = "") { return `<div class="health-row${cls ? " " + cls : ""}"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(em)}</em></div>`; }

export function auditRowsHtml(a = {}) {
  return row("hash chain", a.ok === false ? "BROKEN" : a.ok === true ? "verified" : "not verified yet", a.lastVerified || "") + row("entries (30d)", a.entries ?? 0, "");
}
export function privacyRowsHtml(p = {}) {
  const ran = p.pass === true || p.pass === false;
  return row("last result", ran ? (p.pass ? "PASS" : "REVIEW") : "not run yet", ran ? (p.ts || "") : "run Live capture (10s) to measure")
    + row("6-host allowlist", p.allowlistOk === false ? "WIDENED" : "intact")
    + row("sanitization rate", p.sanitization == null ? "—" : `${p.sanitization}%`, p.sanitization == null ? "not measured yet" : "must be 100%");
}
export function tier0RowsHtml(t = {}) {
  return row("risky actions blocked (30d)", t.blocked ?? 0, "") + row("categories", (t.categories || []).join(", ") || "none");
}
/**
 * Excluded-folder rule — the counter must always read 0 attempted accesses. `excluded` is getState().excludedFolders
 * ({ count, label, configured }); the rows never print a folder NAME (the names stay in the person's own settings).
 */
export function r11RowsHtml(r = {}, excluded = null) {
  const count = excluded && Number.isFinite(Number(excluded.count)) ? Number(excluded.count) : null;
  const label = count == null ? "your excluded folders" : `excluded folders: ${count}`;
  return row("excluded folders", r.touched ? "ACCESS ATTEMPTED" : "never touched", label)
    + row("attempted accesses", r.attempts ?? 0, r.ok === false ? "⚠ must be 0" : "✓ always 0")
    + row("last verified", r.lastVerified || "—", "");
}
/** Outbound endpoint rows — `ok:null` means "not available in this version" (grey), never a red failure. */
export function endpointRowsHtml(list = []) {
  const rows = (Array.isArray(list) ? list : []).map((e) => {
    if (!e) return "";
    if (e.ok === null) return row(e.id || "endpoint", "not available in this version", e.note || "", "endpoint-na");
    if (e.ok === true) return row(e.id || "endpoint", "reachable", e.status ? `HTTP ${e.status}` : "", "endpoint-ok");
    return row(e.id || "endpoint", "unreachable", e.error || (e.status ? `HTTP ${e.status}` : ""), "endpoint-fail");
  }).join("");
  return rows || row("endpoints", "not checked yet", "");
}

export function frameworkTilesHtml(scores = {}) {
  return Object.entries(scores).map(([fw, s]) =>
    `<div class="kpi-tile" data-fw="${esc(fw)}"><div class="kpi-value">${esc(s.score ?? 0)}<span style="font-size:13px">/100</span></div><div class="kpi-label">${esc(fw.toUpperCase())} <span class="framework-badge ${esc(s.badge || "gap")}">${esc(s.badge || "gap")}</span></div><div class="kpi-foot"><span>${esc(s.met ?? 0)}/${esc(s.total ?? 0)} controls</span></div></div>`
  ).join("");
}

// RUN-B B3 — HONEST TRUST/SECURITY SURFACE, rendered from the single source of truth (trust-posture.mjs).
// Buyer-facing: what we ARE / are NOT (no cert we don't hold), what stays local, security controls each
// independently verifiable, "how ARIA measures itself" (real-or-empty), and straight answers. esc-safe.
export function trustPostureHtml(summary) {
  const s = (summary && summary.certification) ? summary : buildTrustSummary();
  const cert = s.certification || {};
  const dr = s.dataResidency || {};
  const liArr = (arr = []) => (arr || []).map((x) => `<li>${esc(x)}</li>`).join("");
  const are = liArr(cert.are);
  const areNot = liArr(cert.areNot);
  const local = liArr(dr.staysLocal);
  const leaves = (dr.leavesDevice || []).map((o) => `<li><strong>${esc(o.what)}</strong> — ${esc(o.contains)} <em>(${esc(o.verifiableBy)})</em></li>`).join("");
  const controls = (s.securityControls || []).map((c) => `<div class="health-row"><span>${esc(c.claim)}</span><em>${esc(c.verifiableBy)}</em></div>`).join("");
  const measured = (s.howMeasured || []).map((m) => `<div class="health-row"><span><strong>${esc(m.metric)}</strong> = ${esc(m.formula)}</span><em>${esc(m.emptyState)}</em></div>`).join("");
  const qa = (s.selfAssessment || []).map((x) => `<div class="trust-qa"><p class="term">${esc(x.q)}</p><p class="desc">${esc(x.a)}</p></div>`).join("");
  const live = s.live || {};
  const pct = (live.deflectionPct == null) ? "—" : `${esc(String(live.deflectionPct))}%`;
  const hrs = (live.hoursSaved == null) ? "—" : esc(String(live.hoursSaved));
  const usd = (live.dollarsSaved == null) ? "—" : `$${esc(String(live.dollarsSaved))}`;
  return `<div class="trust-posture-inner">`
    + `<p class="eyebrow">What we ARE</p><ul class="trust-list">${are}</ul>`
    + `<p class="eyebrow">What we are NOT — no cert we don't hold</p><ul class="trust-list">${areNot}</ul>`
    + `<p class="trust-statement">${esc(cert.statement || "")}</p>`
    + `<p class="eyebrow">Stays on your device</p><ul class="trust-list">${local}</ul>`
    + `<p class="eyebrow">The only things that leave — content-blind</p><ul class="trust-list">${leaves}</ul>`
    + `<p class="eyebrow">Security controls — each independently verifiable</p>${controls}`
    + `<p class="eyebrow">How ARIA measures itself — real-or-empty</p>${measured}`
    + `<div class="health-row"><span>Live: deflection ${pct} · saved ${hrs}h · ${usd}</span><em>traces to the local audit log</em></div>`
    + `<p class="eyebrow">Straight answers</p>${qa}`
    + `<p class="trust-principle">${esc(s.principle || "")}</p>`
    + `</div>`;
}
